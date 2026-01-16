import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  productListOptions, 
  productBranchStockListOptions,
  salesCreateMutation,
  salesListQueryKey,
  productBranchStockListQueryKey,
  customersListOptions,
  exchangeRatesTodayRetrieveOptions
} from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { ShoppingCart, Plus, Minus, Trash2, Search, User, ArrowRight, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductMaster, SaleRequestWritable, Customer, ProductStockSale, Sale } from '../../../client/types.gen';
import Modal from '../../../components/ui/Modal';
import PaymentForm from '../../accounts/components/PaymentForm';
import ProductForm from '../../../components/inventory/ProductForm';

interface CartItem {
  product: ProductMaster;
  quantity: number;
}

export default function SaleBuilder() {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [createdSale, setCreatedSale] = useState<Sale | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);

  const { data: products = [] } = useQuery(productListOptions());
  const { data: customers = [] } = useQuery(customersListOptions());
  
  const { data: stockData = [] } = useQuery({
    ...productBranchStockListOptions({
      // @ts-expect-error - Query params might not be fully typed
      query: { branch: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id
  });

  const { data: ratesData } = useQuery({
    ...exchangeRatesTodayRetrieveOptions(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const rates = ratesData as { bcv_rate: string; parallel_rate: string } | undefined;

  const { branches, isLoading: loadingBranches } = useBranch();

  const createSaleMutation = useMutation({
    ...salesCreateMutation(),
    onSuccess: (data: Sale) => {
      queryClient.invalidateQueries({ queryKey: salesListQueryKey() });
      queryClient.invalidateQueries({ queryKey: productBranchStockListQueryKey() });
      toast.success('Venta realizada con éxito');
      setCart([]);
      setSelectedCustomerId('');
      setCreatedSale(data);
      setIsPaymentModalOpen(true);
    },
    onError: () => {
      toast.error('Error al realizar la venta');
    }
  });

  const getStock = (productId: string) => {
    const stockItem = stockData.find((s: ProductStockSale) => s.product_id === productId);
    return stockItem ? parseFloat(stockItem.stock) : 0;
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p: ProductMaster) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

  const total = useMemo(() => {
    return cart.reduce((acc: number, item: CartItem) => {
      const cost_price = parseFloat(item.product.cost_price_usd || '0');
      const margin = parseFloat(item.product.profit_margin || '0');
      const price = cost_price * (1 + margin / 100);
      return acc + (price * item.quantity);
    }, 0);
  }, [cart]);

  if (loadingBranches) {
    return <div className="p-8 text-center text-gray-500 text-sm">Cargando datos...</div>;
  }

  // Validation for missing branches
  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mx-4">
        <div className="bg-blue-50 p-4 rounded-full mb-4">
          <ShoppingCart className="h-10 w-10 text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Configuración Necesaria</h3>
        <p className="text-gray-500 text-center max-w-md mb-6 px-4">
          Para comenzar a vender, primero debes tener configurada al menos una sucursal en el sistema.
        </p>
        <div className="space-y-3 w-full max-w-xs">
          <div className="flex items-center p-3 rounded-lg border bg-red-50 border-red-200">
            <div className="h-2 w-2 rounded-full mr-3 bg-red-500" />
            <span className="text-sm font-medium text-red-800">
              ✗ Falta crear sucursal
            </span>
          </div>
        </div>
      </div>
    );
  }

  const addToCart = (product: ProductMaster) => {
    const availableStock = getStock(product.id);
    const existingItem = cart.find((item: CartItem) => item.product.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty + 1 > availableStock) {
      toast.error(`Stock insuficiente. Disponible: ${availableStock}`);
      return;
    }

    if (existingItem) {
      setCart(cart.map((item: CartItem) => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item: CartItem) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find((i: CartItem) => i.product.id === productId);
    if (!item) return;

    const availableStock = getStock(productId);
    const newQty = item.quantity + delta;

    if (newQty > availableStock) {
      toast.error(`Stock insuficiente. Disponible: ${availableStock}`);
      return;
    }

    if (newQty <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map((i: CartItem) => 
        i.product.id === productId ? { ...i, quantity: newQty } : i
      ));
    }
  };


  const handleCheckout = () => {
    if (!selectedBranch) {
      toast.error('Seleccione una sucursal');
      return;
    }

    if (cart.length === 0) return;

    const payload: SaleRequestWritable = {
      branch: selectedBranch.id,
      customer: selectedCustomerId || null,
      details: cart.map((item: CartItem) => ({
        product: item.product.id,
        quantity: item.quantity
      }))
    };

    createSaleMutation.mutate({ body: payload });
  };

  const handleEditProduct = (e: React.MouseEvent, product: ProductMaster) => {
    e.stopPropagation();
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-16rem)]">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b space-y-4">
           {/* Branch Indicator */}
           <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Sucursal Activa: <span className="text-blue-600">{selectedBranch?.name || 'Ninguna'}</span>
                </span>
              </div>
           </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-64 relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">Cliente (Opcional)</option>
                {customers.map((c: Customer) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const stock = getStock(product.id);
            const price = parseFloat(product.cost_price_usd) * (1 + parseFloat(product.profit_margin) / 100);
            
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={stock <= 0}
                className="flex flex-col p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:bg-gray-50 relative group"
              >
                <div className="flex justify-between items-start w-full">
                  <h4 className="font-semibold text-gray-900 truncate pr-8">{product.name}</h4>
                  <button
                    onClick={(e) => handleEditProduct(e, product)}
                    className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex justify-between items-end">
                  <div>
                    <p className="text-lg font-bold text-blue-600">${price.toFixed(2)}</p>
                    <p className={`text-xs ${stock > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                      Stock: {stock}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-full">
                    <Plus className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart / Checkout */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2 text-gray-700" />
            <h2 className="font-bold text-gray-800">Carrito</h2>
          </div>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {cart.length} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.map(item => {
            const price = parseFloat(item.product.cost_price_usd) * (1 + parseFloat(item.product.profit_margin) / 100);
            return (
              <div key={item.product.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0 mr-4">
                  <h5 className="text-sm font-medium text-gray-900 truncate">{item.product.name}</h5>
                  <p className="text-xs text-gray-500">${price.toFixed(2)} c/u</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center border rounded-md">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-gray-100">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2 text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-gray-100">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-600 font-medium">Total USD</span>
            <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
          </div>
          
          {rates && (
            <div className="space-y-1 mb-4 border-t pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">BCV: <span className="font-semibold">{rates.bcv_rate}</span></span>
                <span className="text-gray-500"> VES USDT: <span className="font-semibold">{rates.parallel_rate}</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium text-sm">Total VES</span>
                <span className="text-lg font-bold text-blue-600">
                  Bs. {total ? (total * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
}) : '0,00'}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || createSaleMutation.isPending}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center space-x-2"
          >
            {createSaleMutation.isPending ? (
              'Procesando...'
            ) : (
              <>
                <span>Finalizar y Cobrar</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
-
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Registrar Cobro"
      >
        {createdSale && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-bold uppercase">Monto de la Venta</p>
                <p className="text-2xl font-black text-blue-900">${parseFloat(createdSale.total_amount_usd || '0').toFixed(2)}</p>
              </div>
              <div className="text-right text-sm text-blue-700">
                <p className="font-medium">Venta #{createdSale.seq_number}</p>
                <p>{createdSale.customer_name}</p>
              </div>
            </div>

            <PaymentForm 
              type="sale" 
              id={createdSale.id} 
              pendingAmount={parseFloat(createdSale.total_amount_usd || '0') - parseFloat(createdSale.total_paid || '0')}
              onSuccess={() => {
                setIsPaymentModalOpen(false);
                setCreatedSale(null);
              }}
            />
            
            <div className="pt-2 border-t flex justify-center">
              <button 
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setCreatedSale(null);
                }}
                className="text-sm text-gray-400 hover:text-gray-600 underline font-medium"
              >
                Pagar después
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isProductModalOpen}
        onClose={closeProductModal}
        title="Editar Producto"
      >
        <ProductForm 
          initialData={editingProduct} 
          onSuccess={closeProductModal} 
        />
      </Modal>
    </div>
  );
}
