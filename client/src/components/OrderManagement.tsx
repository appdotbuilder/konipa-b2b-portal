import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User, Client, Order, OrderItem } from '../../../server/src/schema';

interface OrderManagementProps {
  user: User | null;
  client: Client | null;
}

interface OrderWithItems extends Order {
  items?: OrderItem[];
}

export default function OrderManagement({ user, client }: OrderManagementProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('current');

  const loadOrders = useCallback(async () => {
    if (!client || !user) return;

    try {
      setIsLoading(true);
      const ordersData = await trpc.orders.getByClient.query({ clientId: client.id });
      setOrders(ordersData);
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [client, user]);

  const loadOrderDetails = async (orderId: number) => {
    try {
      const [orderDetails, orderItems] = await Promise.all([
        trpc.orders.getById.query({ orderId }),
        trpc.orders.getItems.query({ orderId })
      ]);

      // Check if orderDetails exists (API can return null)
      if (!orderDetails) {
        console.error('Order not found');
        return;
      }

      const orderWithItems: OrderWithItems = {
        ...orderDetails,
        items: orderItems
      };

      setSelectedOrder(orderWithItems);
      
      // Update the order in the orders list
      setOrders((prev: OrderWithItems[]) => 
        prev.map((order: OrderWithItems) => 
          order.id === orderId 
            ? orderWithItems
            : order
        )
      );
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-600';
      case 'validated': return 'bg-green-600';
      case 'in_preparation': return 'bg-yellow-600';
      case 'ready': return 'bg-orange-600';
      case 'shipped': return 'bg-purple-600';
      case 'delivered': return 'bg-green-700';
      case 'refused': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'submitted': return 'Soumise';
      case 'validated': return 'Validée';
      case 'in_preparation': return 'En Préparation';
      case 'ready': return 'Prête';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'refused': return 'Refusée';
      default: return status;
    }
  };

  const getCarrierLabel = (carrier: string) => {
    switch (carrier) {
      case 'ghazala': return 'Ghazala';
      case 'sh2t': return 'SH2T';
      case 'baha': return 'Baha';
      default: return carrier;
    }
  };

  const filterOrdersByStatus = (orders: OrderWithItems[], tab: string) => {
    switch (tab) {
      case 'current':
        return orders.filter(order => 
          !['delivered', 'refused'].includes(order.status)
        );
      case 'completed':
        return orders.filter(order => 
          ['delivered'].includes(order.status)
        );
      case 'cancelled':
        return orders.filter(order => 
          ['refused'].includes(order.status)
        );
      case 'all':
      default:
        return orders;
    }
  };

  const filteredOrders = filterOrdersByStatus(orders, activeTab);

  if (!user) return <div>Utilisateur non trouvé</div>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-white">Chargement des commandes...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes Commandes</h1>
          <p className="text-blue-200">Suivi et historique de vos commandes</p>
        </div>
        
        <div className="text-blue-200">
          Total: {orders.length} commande{orders.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-2">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
            <CardHeader>
              <CardTitle className="text-white">Liste des Commandes</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 bg-slate-800">
                  <TabsTrigger value="current" className="text-white">
                    En cours ({filterOrdersByStatus(orders, 'current').length})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-white">
                    Livrées ({filterOrdersByStatus(orders, 'completed').length})
                  </TabsTrigger>
                  <TabsTrigger value="cancelled" className="text-white">
                    Annulées ({filterOrdersByStatus(orders, 'cancelled').length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-white">
                    Toutes ({orders.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="space-y-4 mt-4">
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-blue-200">Aucune commande dans cette catégorie</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredOrders.map((order) => (
                        <Card
                          key={order.id}
                          className={`cursor-pointer transition-all duration-200 ${
                            selectedOrder?.id === order.id
                              ? 'bg-blue-900/30 border-blue-400'
                              : 'bg-white/5 border-blue-200/20 hover:bg-white/10'
                          }`}
                          onClick={() => loadOrderDetails(order.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="text-white font-medium">
                                    #{order.order_number}
                                  </h3>
                                  <Badge className={getStatusColor(order.status)}>
                                    {getStatusLabel(order.status)}
                                  </Badge>
                                  {order.is_grouped && (
                                    <Badge variant="outline" className="border-orange-400 text-orange-300">
                                      Groupée
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-blue-200 text-sm">
                                  {order.created_at.toLocaleDateString('fr-MA')} • 
                                  Transporteur: {getCarrierLabel(order.carrier)}
                                </p>
                                <p className="text-white font-medium">
                                  {order.total_amount.toLocaleString('fr-MA')} MAD
                                </p>
                              </div>
                              <div className="text-right text-xs text-blue-300">
                                {order.validated_at && (
                                  <div>Validée le {order.validated_at.toLocaleDateString('fr-MA')}</div>
                                )}
                                {order.shipped_at && (
                                  <div>Expédiée le {order.shipped_at.toLocaleDateString('fr-MA')}</div>
                                )}
                                {order.delivered_at && (
                                  <div>Livrée le {order.delivered_at.toLocaleDateString('fr-MA')}</div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Order Details */}
        <div className="lg:col-span-1">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20 sticky top-6">
            <CardHeader>
              <CardTitle className="text-white">Détails de la Commande</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedOrder ? (
                <div className="text-center py-8">
                  <p className="text-blue-200">Sélectionnez une commande pour voir les détails</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Order Header */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-white font-bold text-lg">
                        #{selectedOrder.order_number}
                      </h3>
                      <Badge className={getStatusColor(selectedOrder.status)}>
                        {getStatusLabel(selectedOrder.status)}
                      </Badge>
                    </div>
                    <p className="text-blue-200 text-sm">
                      Commande passée le {selectedOrder.created_at.toLocaleDateString('fr-MA')}
                    </p>
                  </div>

                  <Separator className="bg-blue-300/20" />

                  {/* Order Info */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-300">Transporteur:</span>
                      <span className="text-white">{getCarrierLabel(selectedOrder.carrier)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-300">Mode de paiement:</span>
                      <span className="text-white">En Compte</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-300">Type:</span>
                      <span className="text-white">
                        {selectedOrder.is_grouped ? 'Commande Groupée' : 'Commande Individuelle'}
                      </span>
                    </div>
                    {selectedOrder.sage_document_number && (
                      <div className="flex justify-between">
                        <span className="text-blue-300">N° Document Sage:</span>
                        <span className="text-white">{selectedOrder.sage_document_number}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-blue-300/20" />

                  {/* Order Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-white font-medium">Suivi de la Commande</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-200">
                          Soumise le {selectedOrder.created_at.toLocaleDateString('fr-MA')}
                        </span>
                      </div>
                      {selectedOrder.validated_at && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-green-300">
                            Validée le {selectedOrder.validated_at.toLocaleDateString('fr-MA')}
                          </span>
                        </div>
                      )}
                      {selectedOrder.shipped_at && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="text-purple-300">
                            Expédiée le {selectedOrder.shipped_at.toLocaleDateString('fr-MA')}
                          </span>
                        </div>
                      )}
                      {selectedOrder.delivered_at && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          <span className="text-green-400">
                            Livrée le {selectedOrder.delivered_at.toLocaleDateString('fr-MA')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-blue-300/20" />

                  {/* Order Items */}
                  {selectedOrder.items && selectedOrder.items.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-white font-medium">Articles Commandés</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedOrder.items.map((item) => (
                          <div key={item.id} className="bg-white/5 p-2 rounded text-xs">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-white font-medium">Produit #{item.product_id}</p>
                                <p className="text-blue-200">
                                  {item.quantity} × {item.unit_price.toLocaleString('fr-MA')} MAD
                                </p>
                              </div>
                              <p className="text-white font-medium">
                                {item.total_price.toLocaleString('fr-MA')} MAD
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator className="bg-blue-300/20" />

                  {/* Total */}
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span className="text-blue-200">Total:</span>
                    <span className="text-white">
                      {selectedOrder.total_amount.toLocaleString('fr-MA')} MAD
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    {selectedOrder.sage_document_number && (
                      <Button className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                        📄 Télécharger BL/Facture
                      </Button>
                    )}
                    {['delivered', 'refused'].includes(selectedOrder.status) && (
                      <Button 
                        variant="outline" 
                        className="w-full border-blue-400 text-blue-200 hover:bg-blue-800/20"
                      >
                        🔄 Recommander ces articles
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}