import { db } from '../db';
import { 
  usersTable, 
  clientsTable, 
  ordersTable, 
  orderItemsTable,
  productsTable,
  stockTable,
  transferRequestsTable
} from '../db/schema';
import { eq, sql, and, gte, desc, count, sum } from 'drizzle-orm';
import { type UserRole } from '../schema';

export async function getRepresentativeDashboard(representativeId: number): Promise<{
    clients: Array<{ id: number; company_name: string; total_orders: number; last_order_date: Date | null }>;
    salesStats: { totalSales: number; monthlyOrders: number; topProducts: Array<{ product_id: number; quantity: number }> };
    commissions: { current_month: number; total: number };
}> {
    try {
        // Get representative's clients with order counts and last order dates
        const clientsQuery = await db
            .select({
                id: clientsTable.id,
                company_name: clientsTable.company_name,
                total_orders: sql<number>`COALESCE(COUNT(${ordersTable.id}), 0)`,
                last_order_date: sql<Date | null>`MAX(${ordersTable.created_at})`
            })
            .from(clientsTable)
            .leftJoin(ordersTable, eq(clientsTable.id, ordersTable.client_id))
            .where(eq(clientsTable.representative_id, representativeId))
            .groupBy(clientsTable.id, clientsTable.company_name)
            .execute();

        // Get sales stats for the current month
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const salesStatsQuery = await db
            .select({
                totalSales: sql<number>`COALESCE(SUM(${ordersTable.total_amount}), 0)`,
                monthlyOrders: sql<number>`COALESCE(COUNT(${ordersTable.id}), 0)`
            })
            .from(ordersTable)
            .innerJoin(clientsTable, eq(ordersTable.client_id, clientsTable.id))
            .where(
                and(
                    eq(clientsTable.representative_id, representativeId),
                    gte(ordersTable.created_at, currentMonth)
                )
            )
            .execute();

        // Get top products for this representative's clients
        const topProductsQuery = await db
            .select({
                product_id: orderItemsTable.product_id,
                quantity: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)`
            })
            .from(orderItemsTable)
            .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
            .innerJoin(clientsTable, eq(ordersTable.client_id, clientsTable.id))
            .where(
                and(
                    eq(clientsTable.representative_id, representativeId),
                    gte(ordersTable.created_at, currentMonth)
                )
            )
            .groupBy(orderItemsTable.product_id)
            .orderBy(desc(sql`SUM(${orderItemsTable.quantity})`))
            .limit(5)
            .execute();

        // Calculate commissions (5% of total sales)
        const totalSalesAllTime = await db
            .select({
                total: sql<number>`COALESCE(SUM(${ordersTable.total_amount}), 0)`
            })
            .from(ordersTable)
            .innerJoin(clientsTable, eq(ordersTable.client_id, clientsTable.id))
            .where(eq(clientsTable.representative_id, representativeId))
            .execute();

        const salesStats = salesStatsQuery[0] || { totalSales: 0, monthlyOrders: 0 };
        const totalAllTime = totalSalesAllTime[0]?.total || 0;

        return {
            clients: clientsQuery.map(client => ({
                id: client.id,
                company_name: client.company_name,
                total_orders: Number(client.total_orders),
                last_order_date: client.last_order_date ? new Date(client.last_order_date) : null
            })),
            salesStats: {
                totalSales: parseFloat(salesStats.totalSales.toString()),
                monthlyOrders: Number(salesStats.monthlyOrders),
                topProducts: topProductsQuery.map(product => ({
                    product_id: product.product_id,
                    quantity: Number(product.quantity)
                }))
            },
            commissions: {
                current_month: parseFloat(salesStats.totalSales.toString()) * 0.05,
                total: parseFloat(totalAllTime.toString()) * 0.05
            }
        };
    } catch (error) {
        console.error('Representative dashboard query failed:', error);
        throw error;
    }
}

export async function getAccountingDashboard(): Promise<{
    pendingOrders: Array<{ id: number; client_name: string; total_amount: number; created_at: Date }>;
    blockedAccounts: Array<{ client_id: number; company_name: string; overdue_amount: number }>;
    dailyValidations: { approved: number; refused: number };
}> {
    try {
        // Get pending orders (submitted status)
        const pendingOrdersQuery = await db
            .select({
                id: ordersTable.id,
                client_name: clientsTable.company_name,
                total_amount: ordersTable.total_amount,
                created_at: ordersTable.created_at
            })
            .from(ordersTable)
            .innerJoin(clientsTable, eq(ordersTable.client_id, clientsTable.id))
            .where(eq(ordersTable.status, 'submitted'))
            .orderBy(desc(ordersTable.created_at))
            .limit(50)
            .execute();

        // Get blocked accounts (clients with is_blocked = true or overdue_amount > 0)
        const blockedAccountsQuery = await db
            .select({
                client_id: clientsTable.id,
                company_name: clientsTable.company_name,
                overdue_amount: clientsTable.overdue_amount
            })
            .from(clientsTable)
            .where(
                sql`${clientsTable.is_blocked} = true OR ${clientsTable.overdue_amount} > 0`
            )
            .orderBy(desc(clientsTable.overdue_amount))
            .execute();

        // Get today's validations count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dailyValidationsQuery = await db
            .select({
                approved: sql<number>`COALESCE(COUNT(CASE WHEN ${ordersTable.status} = 'validated' THEN 1 END), 0)`,
                refused: sql<number>`COALESCE(COUNT(CASE WHEN ${ordersTable.status} = 'refused' THEN 1 END), 0)`
            })
            .from(ordersTable)
            .where(
                and(
                    gte(ordersTable.validated_at, today),
                    sql`${ordersTable.validated_at} < ${tomorrow}`
                )
            )
            .execute();

        const validations = dailyValidationsQuery[0] || { approved: 0, refused: 0 };

        return {
            pendingOrders: pendingOrdersQuery.map(order => ({
                id: order.id,
                client_name: order.client_name,
                total_amount: parseFloat(order.total_amount),
                created_at: order.created_at
            })),
            blockedAccounts: blockedAccountsQuery.map(account => ({
                client_id: account.client_id,
                company_name: account.company_name,
                overdue_amount: parseFloat(account.overdue_amount)
            })),
            dailyValidations: {
                approved: Number(validations.approved),
                refused: Number(validations.refused)
            }
        };
    } catch (error) {
        console.error('Accounting dashboard query failed:', error);
        throw error;
    }
}

export async function getCounterDashboard(): Promise<{
    ordersToPreparation: Array<{ id: number; client_name: string; items_count: number; created_at: Date }>;
    groupedOrders: Array<{ client_id: number; order_count: number; total_amount: number }>;
    lowStockAlerts: Array<{ product_id: number; reference: string; stock_level: number }>;
    pendingTransfers: Array<{ id: number; product_reference: string; quantity: number; from_warehouse: string }>;
}> {
    try {
        // Get orders ready for preparation (validated status)
        const ordersToPreparationQuery = await db
            .select({
                id: ordersTable.id,
                client_name: clientsTable.company_name,
                items_count: sql<number>`COALESCE(COUNT(${orderItemsTable.id}), 0)`,
                created_at: ordersTable.created_at
            })
            .from(ordersTable)
            .innerJoin(clientsTable, eq(ordersTable.client_id, clientsTable.id))
            .leftJoin(orderItemsTable, eq(ordersTable.id, orderItemsTable.order_id))
            .where(eq(ordersTable.status, 'validated'))
            .groupBy(ordersTable.id, clientsTable.company_name, ordersTable.created_at)
            .orderBy(desc(ordersTable.created_at))
            .limit(20)
            .execute();

        // Get grouped orders by client (for batch processing)
        const groupedOrdersQuery = await db
            .select({
                client_id: ordersTable.client_id,
                order_count: sql<number>`COALESCE(COUNT(${ordersTable.id}), 0)`,
                total_amount: sql<number>`COALESCE(SUM(${ordersTable.total_amount}), 0)`
            })
            .from(ordersTable)
            .where(eq(ordersTable.status, 'validated'))
            .groupBy(ordersTable.client_id)
            .having(sql`COUNT(${ordersTable.id}) > 1`)
            .orderBy(desc(sql`COUNT(${ordersTable.id})`))
            .execute();

        // Get low stock alerts (stock < 10 items at ibn_tachfine warehouse)
        const lowStockAlertsQuery = await db
            .select({
                product_id: stockTable.product_id,
                reference: productsTable.reference,
                stock_level: stockTable.quantity
            })
            .from(stockTable)
            .innerJoin(productsTable, eq(stockTable.product_id, productsTable.id))
            .where(
                and(
                    eq(stockTable.warehouse, 'ibn_tachfine'),
                    sql`${stockTable.quantity} < 10`,
                    eq(productsTable.is_active, true)
                )
            )
            .orderBy(stockTable.quantity)
            .limit(20)
            .execute();

        // Get pending transfer requests from other warehouses to ibn_tachfine
        const pendingTransfersQuery = await db
            .select({
                id: transferRequestsTable.id,
                product_reference: productsTable.reference,
                quantity: transferRequestsTable.quantity_requested,
                from_warehouse: transferRequestsTable.from_warehouse
            })
            .from(transferRequestsTable)
            .innerJoin(productsTable, eq(transferRequestsTable.product_id, productsTable.id))
            .where(
                and(
                    eq(transferRequestsTable.to_warehouse, 'ibn_tachfine'),
                    eq(transferRequestsTable.status, 'pending')
                )
            )
            .orderBy(desc(transferRequestsTable.requested_at))
            .limit(20)
            .execute();

        return {
            ordersToPreparation: ordersToPreparationQuery.map(order => ({
                id: order.id,
                client_name: order.client_name,
                items_count: Number(order.items_count),
                created_at: order.created_at
            })),
            groupedOrders: groupedOrdersQuery.map(group => ({
                client_id: group.client_id,
                order_count: Number(group.order_count),
                total_amount: parseFloat(group.total_amount.toString())
            })),
            lowStockAlerts: lowStockAlertsQuery.map(alert => ({
                product_id: alert.product_id,
                reference: alert.reference,
                stock_level: alert.stock_level
            })),
            pendingTransfers: pendingTransfersQuery.map(transfer => ({
                id: transfer.id,
                product_reference: transfer.product_reference,
                quantity: transfer.quantity,
                from_warehouse: transfer.from_warehouse
            }))
        };
    } catch (error) {
        console.error('Counter dashboard query failed:', error);
        throw error;
    }
}

export async function getWarehouseLaVilletteDashboard(): Promise<{
    transferRequests: Array<{ id: number; product_reference: string; quantity: number; requested_at: Date }>;
    todayTransfers: { prepared: number; shipped: number };
}> {
    try {
        // Get pending transfer requests to la_villette warehouse
        const transferRequestsQuery = await db
            .select({
                id: transferRequestsTable.id,
                product_reference: productsTable.reference,
                quantity: transferRequestsTable.quantity_requested,
                requested_at: transferRequestsTable.requested_at
            })
            .from(transferRequestsTable)
            .innerJoin(productsTable, eq(transferRequestsTable.product_id, productsTable.id))
            .where(
                and(
                    eq(transferRequestsTable.from_warehouse, 'la_villette'),
                    sql`${transferRequestsTable.status} IN ('pending', 'in_preparation')`
                )
            )
            .orderBy(desc(transferRequestsTable.requested_at))
            .limit(30)
            .execute();

        // Get today's transfer statistics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayTransfersQuery = await db
            .select({
                prepared: sql<number>`COALESCE(COUNT(CASE WHEN ${transferRequestsTable.status} = 'ready_to_ship' THEN 1 END), 0)`,
                shipped: sql<number>`COALESCE(COUNT(CASE WHEN ${transferRequestsTable.status} = 'shipped' THEN 1 END), 0)`
            })
            .from(transferRequestsTable)
            .where(
                and(
                    eq(transferRequestsTable.from_warehouse, 'la_villette'),
                    gte(transferRequestsTable.prepared_at, today),
                    sql`${transferRequestsTable.prepared_at} < ${tomorrow}`
                )
            )
            .execute();

        const todayStats = todayTransfersQuery[0] || { prepared: 0, shipped: 0 };

        return {
            transferRequests: transferRequestsQuery.map(request => ({
                id: request.id,
                product_reference: request.product_reference,
                quantity: request.quantity,
                requested_at: request.requested_at
            })),
            todayTransfers: {
                prepared: Number(todayStats.prepared),
                shipped: Number(todayStats.shipped)
            }
        };
    } catch (error) {
        console.error('Warehouse La Villette dashboard query failed:', error);
        throw error;
    }
}

export async function getDirectorDashboard(): Promise<{
    globalStats: {
        totalClients: number;
        activeOrders: number;
        totalRevenue: number;
        overdueAmount: number;
    };
    clientOverview: Array<{
        client_id: number;
        company_name: string;
        revenue: number;
        current_balance: number;
        overdue_amount: number;
    }>;
    webActivity: {
        dailyOrders: number;
        activeUsers: number;
        topProducts: Array<{ product_id: number; reference: string; orders_count: number }>;
    };
    representativePerformance: Array<{
        representative_id: number;
        name: string;
        clients_count: number;
        total_sales: number;
        orders_count: number;
    }>;
}> {
    try {
        // Get global statistics using individual queries
        const totalClientsResult = await db
            .select({ count: count() })
            .from(clientsTable)
            .execute();

        const activeOrdersResult = await db
            .select({ count: count() })
            .from(ordersTable)
            .where(sql`${ordersTable.status} IN ('submitted', 'validated', 'in_preparation', 'ready')`)
            .execute();

        const totalRevenueResult = await db
            .select({ total: sum(ordersTable.total_amount) })
            .from(ordersTable)
            .where(eq(ordersTable.status, 'delivered'))
            .execute();

        const overdueAmountResult = await db
            .select({ total: sum(clientsTable.overdue_amount) })
            .from(clientsTable)
            .execute();

        const globalStats = {
            totalClients: totalClientsResult[0]?.count || 0,
            activeOrders: activeOrdersResult[0]?.count || 0,
            totalRevenue: totalRevenueResult[0]?.total || 0,
            overdueAmount: overdueAmountResult[0]?.total || 0
        };

        // Get client overview with revenue data
        const clientOverviewQuery = await db
            .select({
                client_id: clientsTable.id,
                company_name: clientsTable.company_name,
                revenue: sql<number>`COALESCE(SUM(${ordersTable.total_amount}), 0)`,
                current_balance: clientsTable.current_balance,
                overdue_amount: clientsTable.overdue_amount
            })
            .from(clientsTable)
            .leftJoin(ordersTable, and(
                eq(clientsTable.id, ordersTable.client_id),
                eq(ordersTable.status, 'delivered')
            ))
            .groupBy(clientsTable.id, clientsTable.company_name, clientsTable.current_balance, clientsTable.overdue_amount)
            .orderBy(desc(sql`SUM(${ordersTable.total_amount})`))
            .limit(20)
            .execute();

        // Get today's web activity
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const webActivityQuery = await db
            .select({
                dailyOrders: sql<number>`COALESCE(COUNT(${ordersTable.id}), 0)`,
                activeUsers: sql<number>`COALESCE((SELECT COUNT(DISTINCT ${ordersTable.client_id}) FROM ${ordersTable} WHERE ${ordersTable.created_at} >= ${today}), 0)`
            })
            .from(ordersTable)
            .where(
                and(
                    gte(ordersTable.created_at, today),
                    sql`${ordersTable.created_at} < ${tomorrow}`
                )
            )
            .execute();

        // Get top products by order count
        const topProductsQuery = await db
            .select({
                product_id: orderItemsTable.product_id,
                reference: productsTable.reference,
                orders_count: sql<number>`COALESCE(COUNT(DISTINCT ${orderItemsTable.order_id}), 0)`
            })
            .from(orderItemsTable)
            .innerJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
            .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
            .where(gte(ordersTable.created_at, today))
            .groupBy(orderItemsTable.product_id, productsTable.reference)
            .orderBy(desc(sql`COUNT(DISTINCT ${orderItemsTable.order_id})`))
            .limit(5)
            .execute();

        // Get representative performance
        const representativePerformanceQuery = await db
            .select({
                representative_id: usersTable.id,
                name: sql<string>`${usersTable.email}`,
                clients_count: sql<number>`COALESCE(COUNT(DISTINCT ${clientsTable.id}), 0)`,
                total_sales: sql<number>`COALESCE(SUM(${ordersTable.total_amount}), 0)`,
                orders_count: sql<number>`COALESCE(COUNT(${ordersTable.id}), 0)`
            })
            .from(usersTable)
            .leftJoin(clientsTable, eq(usersTable.id, clientsTable.representative_id))
            .leftJoin(ordersTable, and(
                eq(clientsTable.id, ordersTable.client_id),
                eq(ordersTable.status, 'delivered')
            ))
            .where(eq(usersTable.role, 'representative'))
            .groupBy(usersTable.id, usersTable.email)
            .orderBy(desc(sql`SUM(${ordersTable.total_amount})`))
            .execute();

        // globalStats is already defined above
        const webActivity = webActivityQuery[0] || { dailyOrders: 0, activeUsers: 0 };

        return {
            globalStats: {
                totalClients: Number(globalStats.totalClients),
                activeOrders: Number(globalStats.activeOrders),
                totalRevenue: parseFloat((globalStats.totalRevenue || '0').toString()),
                overdueAmount: parseFloat((globalStats.overdueAmount || '0').toString())
            },
            clientOverview: clientOverviewQuery.map(client => ({
                client_id: client.client_id,
                company_name: client.company_name,
                revenue: parseFloat(client.revenue.toString()),
                current_balance: parseFloat(client.current_balance),
                overdue_amount: parseFloat(client.overdue_amount)
            })),
            webActivity: {
                dailyOrders: Number(webActivity.dailyOrders),
                activeUsers: Number(webActivity.activeUsers),
                topProducts: topProductsQuery.map(product => ({
                    product_id: product.product_id,
                    reference: product.reference,
                    orders_count: Number(product.orders_count)
                }))
            },
            representativePerformance: representativePerformanceQuery.map(rep => ({
                representative_id: rep.representative_id,
                name: rep.name,
                clients_count: Number(rep.clients_count),
                total_sales: parseFloat(rep.total_sales.toString()),
                orders_count: Number(rep.orders_count)
            }))
        };
    } catch (error) {
        console.error('Director dashboard query failed:', error);
        throw error;
    }
}