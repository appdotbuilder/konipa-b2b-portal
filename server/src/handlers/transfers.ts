import { db } from '../db';
import { transferRequestsTable, stockTable, ordersTable, productsTable, usersTable } from '../db/schema';
import { type TransferRequest, type TransferStatus } from '../schema';
import { eq, and, or, SQL } from 'drizzle-orm';

export async function createTransferRequest(
    orderId: number,
    productId: number,
    fromWarehouse: string,
    toWarehouse: string,
    quantity: number,
    requestedBy: number
): Promise<TransferRequest> {
    try {
        // Verify order exists
        const orderExists = await db.select({ id: ordersTable.id })
            .from(ordersTable)
            .where(eq(ordersTable.id, orderId))
            .execute();

        if (orderExists.length === 0) {
            throw new Error(`Order with id ${orderId} not found`);
        }

        // Verify product exists
        const productExists = await db.select({ id: productsTable.id })
            .from(productsTable)
            .where(eq(productsTable.id, productId))
            .execute();

        if (productExists.length === 0) {
            throw new Error(`Product with id ${productId} not found`);
        }

        // Verify user exists
        const userExists = await db.select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.id, requestedBy))
            .execute();

        if (userExists.length === 0) {
            throw new Error(`User with id ${requestedBy} not found`);
        }

        // Create transfer request
        const result = await db.insert(transferRequestsTable)
            .values({
                order_id: orderId,
                product_id: productId,
                from_warehouse: fromWarehouse as any,
                to_warehouse: toWarehouse as any,
                quantity_requested: quantity,
                requested_by: requestedBy
            })
            .returning()
            .execute();

        const transferRequest = result[0];
        return {
            ...transferRequest,
            requested_at: transferRequest.requested_at || transferRequest.created_at
        };
    } catch (error) {
        console.error('Transfer request creation failed:', error);
        throw error;
    }
}

export async function getTransferRequestsForWarehouse(warehouse: string): Promise<TransferRequest[]> {
    try {
        const results = await db.select()
            .from(transferRequestsTable)
            .where(eq(transferRequestsTable.from_warehouse, warehouse as any))
            .execute();

        return results.map(result => ({
            ...result,
            requested_at: result.requested_at || result.created_at
        }));
    } catch (error) {
        console.error('Failed to fetch transfer requests for warehouse:', error);
        throw error;
    }
}

export async function updateTransferRequestStatus(
    transferId: number,
    status: TransferStatus,
    updatedBy: number,
    quantityPrepared?: number
): Promise<TransferRequest> {
    try {
        // Verify transfer request exists
        const existingTransfer = await db.select()
            .from(transferRequestsTable)
            .where(eq(transferRequestsTable.id, transferId))
            .execute();

        if (existingTransfer.length === 0) {
            throw new Error(`Transfer request with id ${transferId} not found`);
        }

        // Verify user exists
        const userExists = await db.select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.id, updatedBy))
            .execute();

        if (userExists.length === 0) {
            throw new Error(`User with id ${updatedBy} not found`);
        }

        // Prepare update values
        const updateValues: any = {
            status: status,
            updated_at: new Date()
        };

        // Set appropriate fields based on status
        if (status === 'in_preparation' || status === 'ready_to_ship') {
            updateValues.prepared_by = updatedBy;
            updateValues.prepared_at = new Date();
            if (quantityPrepared !== undefined) {
                updateValues.quantity_prepared = quantityPrepared;
            }
        } else if (status === 'shipped') {
            if (quantityPrepared !== undefined) {
                updateValues.quantity_prepared = quantityPrepared;
            }
        }

        // Update transfer request
        const result = await db.update(transferRequestsTable)
            .set(updateValues)
            .where(eq(transferRequestsTable.id, transferId))
            .returning()
            .execute();

        const updatedTransfer = result[0];
        return {
            ...updatedTransfer,
            requested_at: updatedTransfer.requested_at || updatedTransfer.created_at
        };
    } catch (error) {
        console.error('Transfer request status update failed:', error);
        throw error;
    }
}

export async function getTransferRequestsByOrder(orderId: number): Promise<TransferRequest[]> {
    try {
        const results = await db.select()
            .from(transferRequestsTable)
            .where(eq(transferRequestsTable.order_id, orderId))
            .execute();

        return results.map(result => ({
            ...result,
            requested_at: result.requested_at || result.created_at
        }));
    } catch (error) {
        console.error('Failed to fetch transfer requests by order:', error);
        throw error;
    }
}

export async function confirmTransferReception(
    transferId: number,
    receivedBy: number,
    quantityReceived: number
): Promise<TransferRequest> {
    try {
        // Verify transfer request exists and is in 'shipped' status
        const existingTransfer = await db.select()
            .from(transferRequestsTable)
            .where(eq(transferRequestsTable.id, transferId))
            .execute();

        if (existingTransfer.length === 0) {
            throw new Error(`Transfer request with id ${transferId} not found`);
        }

        const transfer = existingTransfer[0];
        if (transfer.status !== 'shipped') {
            throw new Error(`Transfer request must be in 'shipped' status to be received. Current status: ${transfer.status}`);
        }

        // Verify user exists
        const userExists = await db.select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.id, receivedBy))
            .execute();

        if (userExists.length === 0) {
            throw new Error(`User with id ${receivedBy} not found`);
        }

        // Update transfer request to received status
        const transferResult = await db.update(transferRequestsTable)
            .set({
                status: 'received',
                received_by: receivedBy,
                received_at: new Date(),
                updated_at: new Date()
            })
            .where(eq(transferRequestsTable.id, transferId))
            .returning()
            .execute();

        // Update stock levels at destination warehouse
        const existingStock = await db.select()
            .from(stockTable)
            .where(and(
                eq(stockTable.product_id, transfer.product_id),
                eq(stockTable.warehouse, transfer.to_warehouse)
            ))
            .execute();

        if (existingStock.length > 0) {
            // Update existing stock
            await db.update(stockTable)
                .set({
                    quantity: existingStock[0].quantity + quantityReceived,
                    updated_at: new Date()
                })
                .where(eq(stockTable.id, existingStock[0].id))
                .execute();
        } else {
            // Create new stock entry
            await db.insert(stockTable)
                .values({
                    product_id: transfer.product_id,
                    warehouse: transfer.to_warehouse,
                    quantity: quantityReceived
                })
                .execute();
        }

        // Update stock levels at source warehouse (reduce quantity)
        const sourceStock = await db.select()
            .from(stockTable)
            .where(and(
                eq(stockTable.product_id, transfer.product_id),
                eq(stockTable.warehouse, transfer.from_warehouse)
            ))
            .execute();

        if (sourceStock.length > 0) {
            const newQuantity = Math.max(0, sourceStock[0].quantity - quantityReceived);
            await db.update(stockTable)
                .set({
                    quantity: newQuantity,
                    updated_at: new Date()
                })
                .where(eq(stockTable.id, sourceStock[0].id))
                .execute();
        }

        const updatedTransfer = transferResult[0];
        return {
            ...updatedTransfer,
            requested_at: updatedTransfer.requested_at || updatedTransfer.created_at
        };
    } catch (error) {
        console.error('Transfer reception confirmation failed:', error);
        throw error;
    }
}

export async function getPendingTransferRequestsForIbnTachfine(): Promise<TransferRequest[]> {
    try {
        const results = await db.select()
            .from(transferRequestsTable)
            .where(and(
                eq(transferRequestsTable.to_warehouse, 'ibn_tachfine'),
                or(
                    eq(transferRequestsTable.status, 'shipped'),
                    eq(transferRequestsTable.status, 'ready_to_ship')
                )
            ))
            .execute();

        return results.map(result => ({
            ...result,
            requested_at: result.requested_at || result.created_at
        }));
    } catch (error) {
        console.error('Failed to fetch pending transfer requests for Ibn Tachfine:', error);
        throw error;
    }
}