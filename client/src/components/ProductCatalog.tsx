import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { User, Client, Product } from '../../../server/src/schema';

interface ProductCatalogProps {
  user: User | null;
  client: Client | null;
}

interface ProductWithStock extends Product {
  stock: {
    ibn_tachfine: number;
    drb_omar: number;
    la_villette: number;
    total: number;
  };
  clientPrice?: number;
  substitutes?: Product[];
}

export default function ProductCatalog({ user, client }: ProductCatalogProps) {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [cart, setCart] = useState<{[key: number]: number}>({});
  const [showCart, setShowCart] = useState(false);

  // Available filter options (normally would come from API)
  const categories = ['Freinage', 'Moteur', 'Transmission', 'Suspension', 'Électrique', 'Carrosserie'];
  const brands = ['Bosch', 'Continental', 'Valeo', 'Sachs', 'Gates', 'Febi'];
  const vehicles = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Renault', 'Peugeot'];

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Build filter object
      const filters = {
        search: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        brand: selectedBrand !== 'all' ? selectedBrand : undefined,
        vehicleModel: selectedVehicle !== 'all' ? selectedVehicle : undefined
      };

      const productsData = await trpc.products.getAll.query(filters);
      
      // For each product, get stock information and client pricing
      const productsWithStock = await Promise.all(
        productsData.map(async (product: Product) => {
          try {
            // Get stock for this product
            const stockData = await trpc.products.getStock.query({ productId: product.id });
            
            // Calculate stock by warehouse
            const stock = {
              ibn_tachfine: stockData.find(s => s.warehouse === 'ibn_tachfine')?.quantity || 0,
              drb_omar: stockData.find(s => s.warehouse === 'drb_omar')?.quantity || 0,
              la_villette: stockData.find(s => s.warehouse === 'la_villette')?.quantity || 0,
              total: stockData.reduce((sum, s) => sum + s.quantity, 0)
            };

            // Get client-specific pricing if user is a client
            let clientPrice = product.base_price;
            if (client) {
              try {
                const priceData = await trpc.products.getPriceForClient.query({
                  productId: product.id,
                  clientId: client.id
                });
                clientPrice = priceData.finalPrice;
              } catch (error) {
                // Use base price if no custom pricing
                clientPrice = product.base_price;
              }
            }

            // Get substitutes - API returns ProductSubstitute[], we need to fetch the actual products
            let substitutes: Product[] = [];
            try {
              const substitutesData = await trpc.products.getSubstitutes.query({ productId: product.id });
              // For now, we'll create placeholder products based on substitute IDs
              // In real implementation, we'd need to fetch the actual product data
              substitutes = substitutesData.map(sub => ({
                id: sub.substitute_product_id,
                reference: `REF-${sub.substitute_product_id}`,
                designation: `Substitute Product ${sub.substitute_product_id}`,
                brand: null,
                category: null,
                vehicle_compatibility: null,
                base_price: 0,
                is_active: true,
                created_at: sub.created_at,
                updated_at: sub.created_at
              }));
            } catch (error) {
              // No substitutes available
            }

            return {
              ...product,
              stock,
              clientPrice,
              substitutes
            };
          } catch (error) {
            console.error(`Error loading data for product ${product.id}:`, error);
            return {
              ...product,
              stock: { ibn_tachfine: 0, drb_omar: 0, la_villette: 0, total: 0 },
              clientPrice: product.base_price,
              substitutes: []
            };
          }
        })
      );

      setProducts(productsWithStock);
    } catch (error) {
      console.error('Erreur lors du chargement du catalogue:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedBrand, selectedVehicle, client]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const addToCart = (productId: number, quantity: number = 1) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + quantity
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      delete newCart[productId];
      return newCart;
    });
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(prev => ({
        ...prev,
        [productId]: quantity
      }));
    }
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === parseInt(productId));
      return total + (product?.clientPrice || product?.base_price || 0) * quantity;
    }, 0);
  };

  const getCartItemCount = () => {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  };

  if (!user) return <div>Utilisateur non trouvé</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Catalogue Produits</h1>
          <p className="text-blue-200">Découvrez notre gamme complète de pièces automobiles</p>
        </div>
        
        {user.role === 'client' && (
          <Button
            onClick={() => setShowCart(!showCart)}
            className="bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 relative"
          >
            🛒 Panier ({getCartItemCount()})
            {getCartItemCount() > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white">
                {getCartItemCount()}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
        <CardHeader>
          <CardTitle className="text-white">Filtres de Recherche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-blue-100 text-sm">Recherche</label>
              <Input
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder="Référence, désignation..."
                className="bg-white/20 border-blue-300/30 text-white placeholder-blue-200"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-blue-100 text-sm">Catégorie</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-white/20 border-blue-300/30 text-white">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-blue-100 text-sm">Marque</label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="bg-white/20 border-blue-300/30 text-white">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all">Toutes les marques</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-blue-100 text-sm">Véhicule</label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger className="bg-white/20 border-blue-300/30 text-white">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all">Tous les véhicules</SelectItem>
                  {vehicles.map(vehicle => (
                    <SelectItem key={vehicle} value={vehicle}>{vehicle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Status Warnings */}
      {client?.is_blocked && (
        <Alert className="bg-red-900/20 border-red-500/50">
          <AlertDescription className="text-red-300">
            ⚠️ Votre compte est bloqué. Impossible de passer commande.
          </AlertDescription>
        </Alert>
      )}

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-white">Chargement du catalogue...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="bg-white/10 backdrop-blur-sm border-blue-200/20 hover:bg-white/15 transition-all duration-200">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white text-lg">{product.reference}</CardTitle>
                    <p className="text-blue-200 text-sm">{product.designation}</p>
                  </div>
                  {product.stock.total > 0 ? (
                    <Badge className="bg-green-600">En stock</Badge>
                  ) : (
                    <Badge variant="destructive">Rupture</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Details */}
                <div className="space-y-2 text-sm">
                  {product.brand && (
                    <div className="flex justify-between">
                      <span className="text-blue-300">Marque:</span>
                      <span className="text-white">{product.brand}</span>
                    </div>
                  )}
                  {product.category && (
                    <div className="flex justify-between">
                      <span className="text-blue-300">Catégorie:</span>
                      <span className="text-white">{product.category}</span>
                    </div>
                  )}
                  {product.vehicle_compatibility && (
                    <div className="flex justify-between">
                      <span className="text-blue-300">Compatibilité:</span>
                      <span className="text-white text-right text-xs">{product.vehicle_compatibility}</span>
                    </div>
                  )}
                </div>

                {/* Stock Information - Show for internal roles */}
                {(['representative', 'accounting', 'counter_ibn_tachfine', 'warehouse_la_villette', 'director_admin'].includes(user.role)) && (
                  <div className="space-y-2">
                    <Separator className="bg-blue-300/20" />
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-blue-300">Ibn Tachfine:</span>
                        <span className="text-white">{product.stock.ibn_tachfine}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-300">Drb Omar:</span>
                        <span className="text-white">{product.stock.drb_omar}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-300">La Villette:</span>
                        <span className="text-white">{product.stock.la_villette}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="space-y-2">
                  <Separator className="bg-blue-300/20" />
                  <div className="flex justify-between items-center">
                    <span className="text-blue-300">Prix:</span>
                    <div className="text-right">
                      {product.clientPrice && product.clientPrice !== product.base_price ? (
                        <>
                          <span className="text-white font-bold text-lg">
                            {product.clientPrice.toLocaleString('fr-MA')} MAD
                          </span>
                          <div className="text-xs text-gray-400 line-through">
                            {product.base_price.toLocaleString('fr-MA')} MAD
                          </div>
                        </>
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {product.base_price.toLocaleString('fr-MA')} MAD
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Substitutes */}
                {product.substitutes && product.substitutes.length > 0 && (
                  <div className="space-y-2">
                    <Separator className="bg-blue-300/20" />
                    <div>
                      <p className="text-blue-300 text-sm">Substituts disponibles:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.substitutes.slice(0, 3).map(sub => (
                          <Badge key={sub.id} variant="outline" className="text-xs border-blue-400 text-blue-200">
                            {sub.reference}
                          </Badge>
                        ))}
                        {product.substitutes.length > 3 && (
                          <Badge variant="outline" className="text-xs border-blue-400 text-blue-200">
                            +{product.substitutes.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add to Cart */}
                {user.role === 'client' && !client?.is_blocked && (
                  <div className="space-y-2">
                    <Separator className="bg-blue-300/20" />
                    {product.stock.total > 0 ? (
                      <div className="flex items-center space-x-2">
                        {cart[product.id] ? (
                          <div className="flex items-center space-x-2 w-full">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCartQuantity(product.id, cart[product.id] - 1)}
                              className="border-blue-400 text-blue-200 hover:bg-blue-800/20"
                            >
                              -
                            </Button>
                            <span className="text-white font-medium flex-1 text-center">
                              {cart[product.id]}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCartQuantity(product.id, cart[product.id] + 1)}
                              className="border-blue-400 text-blue-200 hover:bg-blue-800/20"
                              disabled={cart[product.id] >= product.stock.total}
                            >
                              +
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => addToCart(product.id)}
                            className="w-full bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700"
                          >
                            🛒 Ajouter au panier
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button disabled className="w-full">
                        Produit non disponible
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && user.role === 'client' && (
        <div className="fixed top-0 right-0 w-96 h-full bg-slate-900/95 backdrop-blur-sm border-l border-blue-200/20 z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Mon Panier</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCart(false)}
                className="text-blue-200"
              >
                ✕
              </Button>
            </div>

            {Object.keys(cart).length === 0 ? (
              <p className="text-blue-200 text-center">Votre panier est vide</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(cart).map(([productId, quantity]) => {
                  const product = products.find(p => p.id === parseInt(productId));
                  if (!product) return null;

                  return (
                    <Card key={productId} className="bg-white/10 border-blue-200/20">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{product.reference}</h4>
                            <p className="text-blue-200 text-sm">{product.designation}</p>
                            <p className="text-white text-sm">
                              {(product.clientPrice || product.base_price).toLocaleString('fr-MA')} MAD × {quantity}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(parseInt(productId))}
                            className="text-red-300 hover:text-red-200"
                          >
                            🗑️
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Separator className="bg-blue-300/20" />
                
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-blue-200">Total:</span>
                  <span className="text-white">{getCartTotal().toLocaleString('fr-MA')} MAD</span>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700"
                  disabled={client?.is_blocked}
                >
                  Passer la commande
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}