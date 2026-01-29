import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  v1ProductListOptions, 
  v1ProductBranchStockListOptions,
  v1CustomersListOptions,
  v1MeasurementListOptions,
  v1ProductRetrieveOptions
} from '../../../client/@tanstack/react-query.gen';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { useBranch } from '../../../context/BranchContext';
import { ShoppingCart, Plus, Minus, Trash2, Search, User, ArrowRight, Edit2, Layers, UserPlus, Check, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProductMaster, Customer, ProductStockSale, MeasurementUnit } from '../../../client/types.gen';
import Modal from '../../../components/ui/Modal';
import ProductForm from '../../../components/inventory/ProductForm';
import SaleProcessModal from './SaleProcessModal';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import CustomerForm from '../../../components/customers/CustomerForm';

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

export default function SaleBuilder() {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [showNoCustomerConfirmation, setShowNoCustomerConfirmation] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);

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
  const { branches, isLoading: loadingBranches } = useBranch();

  const getStock = (productId: string) => {
    const stockItem = stockData.find((s: ProductStockSale) => s.product_id === productId);
    return stockItem ? parseFloat(stockItem.stock) : 0;
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p: ProductMaster) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

  const filteredCustomers = useMemo(() => {
    return customerQuery === ''
      ? customers
      : customers.filter((c: Customer) =>
          c.name.toLowerCase().includes(customerQuery.toLowerCase())
        );
  }, [customerQuery, customers]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const isMissingCustomer = cart.length > 0 && !selectedCustomerId;

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
    } catch (e) {
      console.error(e);
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

    if (!item.measurementUnitDetail?.decimals) {
      numValue = Math.floor(numValue);
    }

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

    if (!selectedCustomerId) {
      setShowNoCustomerConfirmation(true);
    } else {
      setIsProcessModalOpen(true);
    }
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

          <div className="flex flex-col gap-4">
            <div className="w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="w-full flex gap-2">
              <div className="relative flex-1">
                <motion.div
                   animate={isMissingCustomer ? { x: [0, -3, 3, -3, 3, 0] } : {}}
                   transition={{ duration: 0.4 }}
                   className="relative"
                >
                  <Combobox 
                      value={selectedCustomer} 
                      onChange={(c: Customer | null) => setSelectedCustomerId(c?.id || '')}
                      onClose={() => setCustomerQuery('')}
                    >
                      <div className="relative">
                        <div className="relative w-full cursor-default overflow-hidden rounded-md text-left focus:outline-none sm:text-sm">
                          <User className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10 ${isMissingCustomer ? 'text-yellow-600' : 'text-gray-400'}`} />
                          <ComboboxInput
                            className={`w-full border py-2 pl-10 pr-10 text-sm leading-5 text-gray-900 focus:ring-1 focus:outline-none ${
                              isMissingCustomer 
                                ? 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500 bg-yellow-50/50' 
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white'
                            } rounded-md transition-colors duration-200`}
                            displayValue={(c: Customer) => c?.name || ''}
                            onChange={(event) => setCustomerQuery(event.target.value)}
                            placeholder="Buscar cliente (Opcional)"
                          />
                          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer">
                            <ChevronsUpDown
                              className="h-5 w-5 text-gray-400 hover:text-gray-500"
                              aria-hidden="true"
                            />
                          </ComboboxButton>
                        </div>
                        <ComboboxOptions className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
                          {filteredCustomers.length === 0 && customerQuery !== '' ? (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                              No se encontraron resultados.
                            </div>
                          ) : (
                            filteredCustomers.map((person) => (
                              <ComboboxOption
                                key={person.id}
                                className={({ focus }) =>
                                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                    focus ? 'bg-blue-600 text-white' : 'text-gray-900'
                                  }`
                                }
                                value={person}
                              >
                                {({ selected, focus }) => (
                                  <>
                                    <span
                                      className={`block truncate ${
                                        selected ? 'font-medium' : 'font-normal'
                                      }`}
                                    >
                                      {person.name}
                                    </span>
                                    {selected ? (
                                      <span
                                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                          focus ? 'text-white' : 'text-blue-600'
                                        }`}
                                      >
                                        <Check className="h-5 w-5" aria-hidden="true" />
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </ComboboxOption>
                            ))
                          )}
                        </ComboboxOptions>
                      </div>
                    </Combobox>
                </motion.div>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="p-2 border rounded-md hover:bg-gray-50 text-blue-600 border-blue-200 cursor-pointer"
                title="Nuevo Cliente"
              >
                <UserPlus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const stock = getStock(product.id);
            const basePrice = parseFloat(product.cost_price_usd) * (1 + parseFloat(product.profit_margin) / 100);
            const finalPrice = product.IVA ? basePrice * 1.16 : basePrice;
            
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={stock <= 0}
                className="flex flex-col p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:bg-gray-50 relative group cursor-pointer"
              >
                <div className="flex justify-between items-start w-full">
                  <h4 className="font-semibold text-gray-900 truncate pr-8">{product.name}</h4>
                  <button
                    onClick={(e) => handleEditProduct(e, product)}
                    className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-blue-600">${finalPrice.toFixed(2)}</p>
                        {product.IVA && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 font-medium">IVA 16%</span>
                        )}
                    </div>
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
            const basePrice = parseFloat(item.product.cost_price_usd) * (1 + parseFloat(item.product.profit_margin) / 100);
            const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
            const finalPrice = (item.product.IVA ? basePrice * 1.16 : basePrice) * factor;

            return (
              <div key={item.product.id} className="py-3 border-b border-gray-100 last:border-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <h5 className="text-sm font-medium text-gray-900 truncate">{item.product.name}</h5>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-500">${finalPrice.toFixed(2)} c/u</p>
                      {item.product.IVA && <span className="text-[10px] text-gray-400 border px-1 rounded">IVA</span>}
                      <span className="text-[10px] italic text-gray-400">
                        ({item.selectedSellingUnit ? item.selectedSellingUnit.name : (item.measurementUnitDetail?.name || 'Base')})
                      </span>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-gray-400 hover:text-red-500 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Selling Units Selector */}
                {item.sellingUnits && item.sellingUnits.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Layers className="h-3 w-3 text-gray-400" />
                    <select
                      className="text-[10px] bg-gray-50 border-none rounded p-1 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                      value={item.selectedSellingUnit?.id || ''}
                      onChange={(e) => handleSelectSellingUnit(item.product.id, e.target.value)}
                    >
                      <option value="">{item.measurementUnitDetail?.name || 'Unidad Base'}</option>
                      {item.sellingUnits.map((u: SellingUnit) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center border rounded-md overflow-hidden bg-white">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 px-2 hover:bg-gray-100 border-r cursor-pointer">
                        <Minus className="h-3 w-3" />
                      </button>
                      <input 
                        type="number"
                        step={item.measurementUnitDetail?.decimals ? "0.01" : "1"}
                        value={item.quantity}
                        onChange={(e) => handleManualQuantityChange(item.product.id, e.target.value)}
                        className="w-16 text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 px-2 hover:bg-gray-100 border-l cursor-pointer">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400">
                      {item.selectedSellingUnit ? item.selectedSellingUnit.name : (item.measurementUnitDetail?.name || 'u')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">${(finalPrice * item.quantity).toFixed(2)}</p>
                  </div>
                </div>

                {item.loadingDetails && (
                  <div className="flex items-center gap-2 text-[10px] text-blue-500 animate-pulse">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    Cargando opciones...
                  </div>
                )}
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
            disabled={cart.length === 0}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center space-x-2 cursor-pointer"
          >
              <>
                <span>Finalizar y Cobrar</span>
                <ArrowRight className="h-5 w-5" />
              </>
          </button>
          
          <AnimatePresence>
            {isMissingCustomer && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-center"
              >
                <motion.span 
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-yellow-600 text-sm font-bold bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200 flex items-center justify-center gap-2 mx-auto w-fit"
                >
                  <AlertTriangle className="h-3 w-3" />
                  No has seleccionado un cliente
                </motion.span>
              </motion.div>
            )}
           </AnimatePresence>
        </div>
      </div>
      <SaleProcessModal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        cart={cart}
        customerId={selectedCustomerId}
        branchId={selectedBranch?.id || ''}
        totalAmount={total}
        onSuccess={() => {
          setIsProcessModalOpen(false);
          setCart([]);
          setSelectedCustomerId('');
        }}
      />

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

      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Crear Nuevo Cliente"
      >
        <CustomerForm
          onSuccess={() => setIsCustomerModalOpen(false)}
        />
      </Modal>
      
      <ActionConfirmationModal
        isOpen={showNoCustomerConfirmation}
        onClose={() => setShowNoCustomerConfirmation(false)}
        onConfirm={() => {
          setShowNoCustomerConfirmation(false);
          setIsProcessModalOpen(true);
        }}
        title="¿Vender sin cliente?"
        description="No has seleccionado un cliente para esta venta. La venta se registrará como 'Anónima'. ¿Deseas continuar?"
        confirmText="Continuar sin cliente"
        cancelText="Seleccionar cliente"
        variant="warning"
      />
    </div>
  );
}
