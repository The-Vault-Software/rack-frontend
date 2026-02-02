import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  v1ProductListOptions, 
  v1ProvidersListOptions,
  v1MeasurementListOptions,
  v1ProductRetrieveOptions
} from '../../../client/@tanstack/react-query.gen';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { useBranch } from '../../../context/BranchContext';
import { ShoppingCart, Plus, Minus, Trash2, Search, Truck, Edit2, ArrowRight, Layers, Check, ChevronsUpDown, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProductMaster, Provider, MeasurementUnit } from '../../../client/types.gen';
import Modal from '../../../components/ui/Modal';
import ProductForm from '../../../components/inventory/ProductForm';
import AccountProcessModal from './AccountProcessModal';
import ProviderForm from '../../../components/providers/ProviderForm';

interface SellingUnit {
  id: string;
  name: string;
  unit_conversion_factor: string;
  measurement_unit: string;
}

interface CartItem {
  product: ProductMaster;
  quantity: number;
  // Dynamic fields from product detail
  sellingUnits?: SellingUnit[]; 
  selectedSellingUnit?: SellingUnit;
  measurementUnitDetail?: MeasurementUnit;
  loadingDetails?: boolean;
}

export default function AccountBuilder() {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [providerQuery, setProviderQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);

  const { data: products = [] } = useQuery(v1ProductListOptions());
  const { data: providers = [], isLoading: loadingProviders } = useQuery(v1ProvidersListOptions());
  const { rates } = useExchangeRates();
  const { data: measurementUnits = [] } = useQuery(v1MeasurementListOptions());
  const { branches, isLoading: loadingBranches } = useBranch();



  const filteredProducts = useMemo(() => {
    return products.filter((p: ProductMaster) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

  const filteredProviders = useMemo(() => {
    return providerQuery === ''
      ? providers
      : providers.filter((p: Provider) =>
          p.name.toLowerCase().includes(providerQuery.toLowerCase())
        );
  }, [providerQuery, providers]);

  const selectedProvider = useMemo(() => {
    return providers.find(p => p.id === selectedProviderId) || null;
  }, [providers, selectedProviderId]);

  const isProviderInvalid = cart.length > 0 && !selectedProviderId;

  if (loadingBranches || loadingProviders) {
    return <div className="p-8 text-center text-gray-500 text-sm">Cargando datos maestros...</div>;
  }

  // Validation for missing base data
  if (branches.length === 0 || providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mx-4">
        <div className="bg-yellow-50 p-4 rounded-full mb-4">
          <Truck className="h-10 w-10 text-yellow-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Configuración Requerida</h3>
        <p className="text-gray-500 text-center max-w-md mb-6 px-4">
          Para realizar una compra, primero debes asegurarte de tener configurado lo siguiente:
        </p>
        <div className="space-y-3 w-full max-w-xs">
          <div className={`flex items-center p-3 rounded-lg border ${branches.length > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`h-2 w-2 rounded-full mr-3 ${branches.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-sm font-medium ${branches.length > 0 ? 'text-green-800' : 'text-red-800'}`}>
              {branches.length > 0 ? '✓ Sucursal configurada' : '✗ Falta crear sucursal'}
            </span>
          </div>
          <div className={`flex items-center p-3 rounded-lg border ${providers.length > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`h-2 w-2 rounded-full mr-3 ${providers.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-sm font-medium ${providers.length > 0 ? 'text-green-800' : 'text-red-800'}`}>
              {providers.length > 0 ? '✓ Proveedores configurados' : '✗ Falta crear proveedores'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const addToCart = async (product: ProductMaster) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    if (existingItem) {
      updateQuantity(product.id, 1);
      return;
    }

    // Add with loading state
    const newItem: CartItem = { 
      product, 
      quantity: 1, 
      loadingDetails: true 
    };
    setCart([...cart, newItem]);

    try {
      // Fetch full product detail to get selling_units and check decimals
      const fullProduct = await queryClient.fetchQuery(
        v1ProductRetrieveOptions({ path: { id: product.id } })
      );

      const sellingUnits = (fullProduct.selling_units || []) as SellingUnit[];
      const unitDetail = measurementUnits.find((u: MeasurementUnit) => u.id === fullProduct.measurement_unit);

      setCart(currentCart => currentCart.map(item => 
        item.product.id === product.id 
          ? { 
              ...item, 
              loadingDetails: false, 
              sellingUnits,
              measurementUnitDetail: unitDetail
            } 
          : item
      ));
    } catch (error) {
      console.error("Error fetching product details:", error);
      toast.error("Error al obtener detalles del producto");
      setCart(currentCart => currentCart.map(item => 
        item.product.id === product.id ? { ...item, loadingDetails: false } : item
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const baseStep = item.measurementUnitDetail?.decimals ? 0.1 : 1;
    const newQty = Math.max(0, item.quantity + (delta * baseStep));
    
    if (newQty <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(i => 
        i.product.id === productId ? { ...i, quantity: parseFloat(newQty.toFixed(3)) } : i
      ));
    }
  };

  const handleManualQuantityChange = (productId: string, value: string) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    let numValue = parseFloat(value);
    if (isNaN(numValue)) numValue = 0;

    // If decimals are not allowed, round down
    if (!item.measurementUnitDetail?.decimals) {
      numValue = Math.floor(numValue);
    }

    setCart(cart.map(i => 
      i.product.id === productId ? { ...i, quantity: numValue } : i
    ));
  };

  const handleSelectSellingUnit = (productId: string, sellingUnitId: string) => {
    setCart(cart.map(item => {
      if (item.product.id !== productId) return item;
      
      const sellingUnit = item.sellingUnits?.find(u => u.id === sellingUnitId);
      if (!sellingUnit) {
        // Revert to base unit (quantity is already in base terms mostly, but this serves as a reset)
        return { ...item, selectedSellingUnit: undefined };
      }

      // When selecting a selling unit, we might want to keep the same "visual" quantity
      // or just keep the base quantity. Usually, the user wants to buy "1" of the new unit.
      return { ...item, selectedSellingUnit: sellingUnit };
    }));
  };

  const total = cart.reduce((acc, item) => {
    const baseCost = parseFloat(item.product.cost_price_usd);
    // If selling unit is selected, the factor applies to the base COST
    // Fact: if 1 unit costs $10 and a box has 12, the box cost is $120.
    // The details in the payload SHOULD BE in base units, but we need to convert back.
    const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
    return acc + (baseCost * item.quantity * factor);
  }, 0);

  const handleCheckout = () => {
    if (!selectedBranch) {
      toast.error('Seleccione una sucursal');
      return;
    }

    if (!selectedProviderId) {
      toast.error('Seleccione un proveedor');
      return;
    }

    if (cart.length === 0) return;

    setIsProcessModalOpen(true);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (e: React.MouseEvent, product: ProductMaster) => {
    e.stopPropagation();
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };



  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-16rem)]">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recibiendo en: <span className="text-blue-600">{selectedBranch?.name || 'Ninguna'}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
             <div className="w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar productos por nombre o SKU..."
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="w-full flex gap-2">
                <div className="relative flex-1">
                  <motion.div
                     animate={isProviderInvalid ? { x: [0, -5, 5, -5, 5, 0] } : {}}
                     transition={{ duration: 0.4 }}
                     className="relative"
                  >
                    <Combobox 
                      value={selectedProvider} 
                      onChange={(p: Provider | null) => setSelectedProviderId(p?.id || '')}
                      onClose={() => setProviderQuery('')}
                    >
                      <div className="relative">
                        <div className="relative w-full cursor-default overflow-hidden rounded-md text-left focus:outline-none sm:text-sm">
                          <Truck className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10 ${isProviderInvalid ? 'text-red-400' : 'text-gray-400'}`} />
                          <ComboboxInput
                            className={`w-full border py-2 pl-10 pr-10 text-sm leading-5 text-gray-900 focus:ring-1 focus:outline-none ${
                              isProviderInvalid 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white'
                            } rounded-md transition-colors duration-200`}
                            displayValue={(p: Provider) => p?.name || ''}
                            onChange={(event) => setProviderQuery(event.target.value)}
                            placeholder="Buscar proveedor..."
                          />
                          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronsUpDown
                              className="h-5 w-5 text-gray-400 hover:text-gray-500"
                              aria-hidden="true"
                            />
                          </ComboboxButton>
                        </div>
                        <ComboboxOptions className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
                          {filteredProviders.length === 0 && providerQuery !== '' ? (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                              No se encontraron resultados.
                            </div>
                          ) : (
                            filteredProviders.map((person) => (
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
                  onClick={() => setIsProviderModalOpen(true)}
                  className="p-2 border rounded-md hover:bg-gray-50 text-blue-600 border-blue-200"
                  title="Nuevo Proveedor"
                >
                  <UserPlus className="h-5 w-5" />
                </button>
              </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Add Product Card */}
          <button
            onClick={handleCreateProduct}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="bg-gray-100 group-hover:bg-blue-100 p-3 rounded-full mb-2">
              <Plus className="h-6 w-6 text-gray-400 group-hover:text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">Nuevo Producto</span>
          </button>

          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="flex flex-col p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left relative group"
            >
              <div className="flex justify-between items-start w-full">
                <h4 className="font-semibold text-gray-900 truncate pr-8">{product.name}</h4>
                {product.sku && <p className="text-xs text-gray-400 font-mono mt-0.5">SKU: {product.sku}</p>}
                <button
                  onClick={(e) => handleEditProduct(e, product)}
                  className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex justify-between items-end">
                <div>
                  <p className="text-lg font-bold text-gray-700">${parseFloat(product.cost_price_usd).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Costo</p>
                </div>
                <div className="bg-green-50 p-2 rounded-full group-hover:bg-green-100 transition-colors">
                  <Plus className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart / Checkout */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2 text-gray-700" />
            <h2 className="font-bold text-gray-800">Detalle Compra</h2>
          </div>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {cart.length} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.map(item => (
            <div key={item.product.id} className="py-3 border-b border-gray-100 last:border-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <h5 className="text-sm font-medium text-gray-900 truncate">{item.product.name}</h5>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      ${(parseFloat(item.product.cost_price_usd) * (item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1)).toFixed(2)} 
                      <span className="ml-1 italic text-[10px]">
                        ({item.selectedSellingUnit ? item.selectedSellingUnit.name : (item.measurementUnitDetail?.name || 'Base')})
                      </span>
                    </p>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Selling Units Selector */}
              {item.sellingUnits && item.sellingUnits.length > 0 && (
                <div className="flex items-center gap-2">
                  <Layers className="h-3 w-3 text-gray-400" />
                  <select
                    className="text-[10px] bg-gray-50 border-none rounded p-1 focus:ring-1 focus:ring-blue-500 outline-none"
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
                    <button 
                      onClick={() => updateQuantity(item.product.id, -1)} 
                      className="p-1 px-2 hover:bg-gray-100 border-r"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input 
                      type="number"
                      step={item.measurementUnitDetail?.decimals ? "0.01" : "1"}
                      value={item.quantity}
                      onChange={(e) => handleManualQuantityChange(item.product.id, e.target.value)}
                      className="w-16 text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button 
                      onClick={() => updateQuantity(item.product.id, 1)} 
                      className="p-1 px-2 hover:bg-gray-100 border-l"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 truncate">
                    {item.selectedSellingUnit ? item.selectedSellingUnit.name : (item.measurementUnitDetail?.name || 'u')}
                  </span>
                </div>
                
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    ${(parseFloat(item.product.cost_price_usd) * item.quantity * (item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1)).toFixed(2)}
                  </p>
                </div>
              </div>

              {item.loadingDetails && (
                <div className="flex items-center gap-2 text-[10px] text-blue-500 animate-pulse">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  Cargando opciones...
                </div>
              )}
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
              <p>No se han añadido productos</p>
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
            disabled={cart.length === 0 || !selectedProviderId}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center space-x-2"
          >
              <>
                <span>Registrar y Pagar</span>
                <ArrowRight className="h-5 w-5" />
              </>
          </button>
          
          <AnimatePresence>
            {isProviderInvalid && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-center"
              >
                <motion.span 
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-red-500 text-sm font-bold bg-red-50 px-3 py-1 rounded-full border border-red-100 flex items-center justify-center gap-2 mx-auto w-fit"
                >
                  <Truck className="h-3 w-3" />
                  Selecciona un proveedor para continuar
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
      >
        <ProductForm 
          initialData={editingProduct} 
          onSuccess={closeModal} 
        />
      </Modal>

      <AccountProcessModal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        cart={cart}
        providerId={selectedProviderId}
        branchId={selectedBranch?.id || ''}
        totalAmount={total}
        onSuccess={() => {
          setIsProcessModalOpen(false);
          setCart([]);
          setSelectedProviderId('');
        }}
      />

      <Modal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        title="Crear Nuevo Proveedor"
      >
        <ProviderForm
          onSuccess={() => setIsProviderModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
