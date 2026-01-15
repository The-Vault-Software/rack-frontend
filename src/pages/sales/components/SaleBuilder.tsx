import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  productListOptions, 
  productBranchStockListOptions,
  salesCreateMutation,
  salesListQueryKey,
  productBranchStockListQueryKey,
  customersListOptions
} from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { ShoppingCart, Plus, Minus, Trash2, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductMaster, SaleRequestWritable, Customer, ProductStockSale } from '../../../client/types.gen';

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

  const { data: products = [] } = useQuery(productListOptions());
  const { data: customers = [] } = useQuery(customersListOptions());
  
  const { data: stockData = [] } = useQuery({
    ...productBranchStockListOptions({
      // @ts-expect-error - Query params might not be fully typed
      query: { branch: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id
  });

  const { branches, isLoading: loadingBranches } = useBranch();

  const createSaleMutation = useMutation({
    ...salesCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesListQueryKey() });
      queryClient.invalidateQueries({ queryKey: productBranchStockListQueryKey() });
      toast.success('Venta realizada con éxito');
      setCart([]);
      setSelectedCustomerId('');
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

  const total = cart.reduce((acc: number, item: CartItem) => {
    const price = parseFloat(item.product.cost_price_usd) * (1 + parseFloat(item.product.profit_margin) / 100);
    return acc + (price * item.quantity);
  }, 0);

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
                className="flex flex-col p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:bg-gray-50"
              >
                <h4 className="font-semibold text-gray-900 truncate w-full">{product.name}</h4>
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
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">Total</span>
            <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || createSaleMutation.isPending}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:bg-gray-400"
          >
            {createSaleMutation.isPending ? 'Procesando...' : 'Finalizar Venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
