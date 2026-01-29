import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  v1ProductListOptions, 
  v1ProductBranchStockListOptions,
  v1SalesCreateMutation,
  v1SalesListQueryKey,
  v1ProductBranchStockListQueryKey,
  v1CustomersListOptions,
  v1MeasurementListOptions,
  v1ProductRetrieveOptions
} from '../../../client/@tanstack/react-query.gen';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { useBranch } from '../../../context/BranchContext';
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, User, 
  ArrowRight, Layers, X, ChevronRight, Info
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  ProductMaster, SaleRequestWritable, Customer, 
  ProductStockSale, Sale, MeasurementUnit 
} from '../../../client/types.gen';
import Modal from '../../../components/ui/Modal';
import PaymentForm from '../../accounts/components/PaymentForm';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import { cn } from '../../../lib/utils';

interface SellingUnit {
  id: string;
  name: string;
  unit_conversion_factor: string;
  measurement_unit: string;
}

interface CartItem {
  product: ProductMaster;
  quantity: number;
  sellingUnits?: SellingUnit[];
  selectedSellingUnit?: SellingUnit;
  measurementUnitDetail?: MeasurementUnit;
  loadingDetails?: boolean;
}

export default function MobileSaleBuilder() {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [createdSale, setCreatedSale] = useState<Sale | null>(null);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

  const { data: products = [] } = useQuery(v1ProductListOptions());
  const { data: customers = [] } = useQuery(v1CustomersListOptions());
  
  const { data: stockData = [] } = useQuery({
    ...v1ProductBranchStockListOptions({
      // @ts-expect-error - Query params might not be fully typed
      query: { branch_id: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id
  });

  const { rates } = useExchangeRates();
  const { data: measurementUnits = [] } = useQuery(v1MeasurementListOptions());

  const createSaleMutation = useMutation({
    ...v1SalesCreateMutation(),
    onSuccess: (data: Sale) => {
      queryClient.invalidateQueries({ queryKey: v1SalesListQueryKey() });
      queryClient.invalidateQueries({ queryKey: v1ProductBranchStockListQueryKey() });
      toast.success('Venta realizada con éxito');
      setCart([]);
      setSelectedCustomerId('');
      setCreatedSale(data);
      setIsCartOpen(false);
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
    if (!searchTerm) return products.slice(0, 20); // Limit initial view
    return products.filter((p: ProductMaster) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50);
  }, [products, searchTerm]);

  const total = useMemo(() => {
    return cart.reduce((acc: number, item: CartItem) => {
      const cost_price = parseFloat(item.product.cost_price_usd || '0');
      const margin = parseFloat(item.product.profit_margin || '0');
      const basePrice = cost_price * (1 + margin / 100);
      const finalPrice = item.product.IVA ? basePrice * 1.16 : basePrice;
      const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
      return acc + (finalPrice * item.quantity * factor);
    }, 0);
  }, [cart]);

  const addToCart = async (product: ProductMaster) => {
    const availableStock = getStock(product.id);
    const existingItem = cart.find((item: CartItem) => item.product.id === product.id);
    
    if (existingItem) {
      updateQuantity(product.id, 1);
      return;
    }

    if (availableStock <= 0) {
      toast.error(`Stock insuficiente.`);
      return;
    }

    const newItem: CartItem = { product, quantity: 1, loadingDetails: true };
    setCart([...cart, newItem]);
    toast.success(`${product.name} agregado`);

    try {
      const fullProduct = await queryClient.fetchQuery(
        v1ProductRetrieveOptions({ path: { id: product.id } })
      );
      const sellingUnits = (fullProduct.selling_units || []) as SellingUnit[];
      const unitDetail = measurementUnits.find((u: MeasurementUnit) => u.id === fullProduct.measurement_unit);

      setCart(current => current.map(item => 
        item.product.id === product.id 
          ? { ...item, loadingDetails: false, sellingUnits, measurementUnitDetail: unitDetail }
          : item
      ));
    } catch {
      setCart(current => current.map(item => 
        item.product.id === product.id ? { ...item, loadingDetails: false } : item
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item: CartItem) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find((i: CartItem) => i.product.id === productId);
    if (!item) return;

    const availableStock = getStock(productId);
    const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
    const baseStep = item.measurementUnitDetail?.decimals ? 0.1 : 1;
    const newQty = item.quantity + (delta * baseStep);

    if (newQty * factor > availableStock) {
      toast.error(`Stock insuficiente. Disponible: ${availableStock}`);
      return;
    }

    if (newQty <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map((i: CartItem) => 
        i.product.id === productId ? { ...i, quantity: parseFloat(newQty.toFixed(3)) } : i
      ));
    }
  };

  const handleManualQuantityChange = (productId: string, value: string) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const availableStock = getStock(productId);
    const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;

    let numValue = parseFloat(value);
    if (isNaN(numValue)) numValue = 0;
    if (!item.measurementUnitDetail?.decimals) numValue = Math.floor(numValue);

    if (numValue * factor > availableStock) {
      toast.error(`Stock insuficiente. Disponible: ${availableStock}`);
      return;
    }

    setCart(cart.map(i => 
      i.product.id === productId ? { ...i, quantity: numValue } : i
    ));
  };

  const handleSelectSellingUnit = (productId: string, sellingUnitId: string) => {
    setCart(cart.map(item => {
      if (item.product.id !== productId) return item;
      const sellingUnit = item.sellingUnits?.find(u => u.id === sellingUnitId);
      return { ...item, selectedSellingUnit: sellingUnit };
    }));
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
      details: cart.map((item: CartItem) => {
        const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
        return {
          product: item.product.id,
          quantity: item.quantity * factor
        };
      })
    };

    createSaleMutation.mutate({ body: payload });
  };

  const confirmClosePayment = () => {
    setIsConfirmCloseOpen(false);
    setIsPaymentModalOpen(false);
    setCreatedSale(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-24">
      {/* Header & Search */}
      <div className="sticky top-0 z-20 bg-white shadow-sm p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar productos por nombre..."
            className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full cursor-pointer"
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Product List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {filteredProducts.map(product => {
          const stock = getStock(product.id);
          const cost_price = parseFloat(product.cost_price_usd || '0');
          const margin = parseFloat(product.profit_margin || '0');
          const basePrice = cost_price * (1 + margin / 100);
          const finalPrice = product.IVA ? basePrice * 1.16 : basePrice;
          const inCart = cart.find(i => i.product.id === product.id);

          return (
            <div 
              key={product.id}
              className={cn(
                "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition-all active:scale-[0.98]",
                stock <= 0 && "opacity-60",
                inCart && "border-blue-200 bg-blue-50/30"
              )}
            >
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-blue-600 font-extrabold">${finalPrice.toFixed(2)}</span>
                  {product.IVA && (
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">IVA 16%</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    stock > 10 ? "bg-green-500" : stock > 0 ? "bg-amber-500" : "bg-red-500"
                  )} />
                  <span className="text-[10px] text-gray-500 font-medium">Stock: {stock}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inCart ? (
                  <div className="flex items-center bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => updateQuantity(product.id, -1)}
                      className="p-2 hover:bg-gray-50 text-blue-600 cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900">
                      {inCart.quantity}
                    </span>
                    <button 
                      onClick={() => updateQuantity(product.id, 1)}
                      className="p-2 hover:bg-gray-50 text-blue-600 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(product)}
                    disabled={stock <= 0}
                    className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-200 active:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none transition-all cursor-pointer"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="pt-20 flex flex-col items-center text-gray-400">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">No se encontraron productos</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-300 flex items-center justify-between pointer-events-auto active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-4 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-blue-600">
                  {cart.length}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-blue-100">Ver Carrito</p>
                <p className="text-sm font-bold">${total.toFixed(2)}</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Cart Modal/Drawer */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="Tu Carrito"
      >  <div className="flex flex-col max-h-[70vh]">
          {/* Customer Selection */}
          <div className="p-4 bg-gray-50 rounded-2xl mb-4">
             <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase">
                <User className="h-3 w-3" />
                <span>Cliente</span>
             </div>
             <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
              >
                <option value="">Consumidor Final</option>
                {customers.map((c: Customer) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 px-1">
            {cart.map(item => {
              const basePrice = parseFloat(item.product.cost_price_usd || '0') * (1 + parseFloat(item.product.profit_margin || '0') / 100);
              const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
              const finalPrice = (item.product.IVA ? basePrice * 1.16 : basePrice) * factor;

              return (
                <div key={item.product.id} className="p-3 bg-white border border-gray-100 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{item.product.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ${finalPrice.toFixed(2)} x {item.quantity} {item.selectedSellingUnit?.name || item.measurementUnitDetail?.name || 'u'}
                      </p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    {item.sellingUnits && item.sellingUnits.length > 0 && (
                      <div className="flex-1 relative">
                        <Layers className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                        <select
                          className="w-full pl-7 pr-2 py-1.5 bg-gray-50 border-none rounded-lg text-[10px] font-medium focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                          value={item.selectedSellingUnit?.id || ''}
                          onChange={(e) => handleSelectSellingUnit(item.product.id, e.target.value)}
                        >
                          <option value="">{item.measurementUnitDetail?.name || 'Base'}</option>
                          {item.sellingUnits.map((u: SellingUnit) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1.5 px-3 cursor-pointer">
                        <Minus className="h-3 w-3" />
                      </button>
                      <input 
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleManualQuantityChange(item.product.id, e.target.value)}
                        className="w-12 text-center text-xs font-bold bg-transparent outline-none"
                      />
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1.5 px-3 cursor-pointer">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Subtotal</span>
              <span className="font-bold text-gray-900">${total.toFixed(2)}</span>
            </div>
            
            {rates && (
              <div className="bg-blue-50 p-3 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 p-1.5 rounded-lg">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Tasa BCV</p>
                    <p className="text-xs font-bold text-blue-900">{rates.bcv_rate} VES</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider text-right">Total VES</p>
                  <p className="text-sm font-bold text-blue-900">
                    Bs. {(total * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={createSaleMutation.isPending}
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 active:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              {createSaleMutation.isPending ? 'Procesando...' : (
                <>
                  <span>Finalizar y Cobrar</span>
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Processing Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsConfirmCloseOpen(true)}
        title="Registrar Cobro"
      >
        {createdSale && (
          <div className="space-y-4">
            <div className="bg-blue-600 p-6 rounded-2xl text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Total a cobrar</p>
              <div className="flex justify-between items-end">
                <p className="text-4xl font-black">${parseFloat(createdSale.total_amount_usd || '0').toFixed(2)}</p>
                <div className="text-right">
                   <p className="text-xs font-bold">Venta #{createdSale.seq_number}</p>
                   <p className="text-[10px] opacity-80">{createdSale.customer_name || 'Consumidor Final'}</p>
                </div>
              </div>
            </div>

            <PaymentForm 
              type="sale" 
              id={createdSale.id} 
              pendingAmount={parseFloat(createdSale.total_amount_usd || '0') - parseFloat(createdSale.total_paid || '0')}
              onSuccess={() => {
                setIsPaymentModalOpen(false);
                setCreatedSale(null);
                toast.success('¡Cobro registrado con éxito!');
              }}
            />
            
            <button 
              onClick={() => setIsConfirmCloseOpen(true)}
              className="w-full py-3 text-sm text-gray-400 font-medium hover:text-gray-600 transition-colors cursor-pointer"
            >
              Pagar después
            </button>
          </div>
        )}
      </Modal>

      <ActionConfirmationModal
        isOpen={isConfirmCloseOpen}
        onClose={() => setIsConfirmCloseOpen(false)}
        onConfirm={confirmClosePayment}
        title="¿Salir sin cobrar?"
        description="La venta ha sido registrada pero el pago quedará pendiente."
        confirmText="Sí, salir"
        cancelText="Volver al cobro"
        variant="warning"
      />
    </div>
  );
}
