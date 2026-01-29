import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  v1ProductListOptions, 
  v1ProductListQueryKey,
  v1CategoryListOptions, 
  v1CategoryListQueryKey,
  v1MeasurementListOptions,
  v1MeasurementListQueryKey,
  v1CategoryDestroyMutation,
  v1MeasurementDestroyMutation,
  v1ProductDestroyMutation,
  v1ProductBranchStockListOptions,
} from '../../client/@tanstack/react-query.gen';
import { useExchangeRates } from '../../hooks/useExchangeRates';
import { useBranch } from '../../context/BranchContext';
import type { Category, MeasurementUnit, ProductMaster } from '../../client/types.gen';
import { Plus, Trash2, Edit2, Search, Package, Tag, Scale, Filter, FileSpreadsheet } from 'lucide-react';
import ProductForm from '../../components/inventory/ProductForm';
import CategoryForm from '../../components/inventory/CategoryForm';
import UnitForm from '../../components/inventory/UnitForm';
import ProductImportModal from '../../components/inventory/ProductImportModal';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import Modal from '../../components/ui/Modal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import MobileProductList from '../../components/inventory/MobileProductList';
import MobileCategoryList from '../../components/inventory/MobileCategoryList';
import MobileUnitList from '../../components/inventory/MobileUnitList';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'units'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'product' | 'category' | 'unit' | null>(null);
  const [editingData, setEditingData] = useState<ProductMaster | Category | MeasurementUnit | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { data: productsData, isLoading: isProductsLoading } = useQuery(v1ProductListOptions());
  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery(v1CategoryListOptions());
  const { data: unitsData, isLoading: isUnitsLoading } = useQuery(v1MeasurementListOptions());
  
  const { data: stockData } = useQuery({
    ...v1ProductBranchStockListOptions({
      // @ts-expect-error - The API generator might not have picked up the query params
      query: { branch: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id
  });

  const { rates } = useExchangeRates();

  const deleteProduct = useMutation({
    ...v1ProductDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1ProductListQueryKey() });
      toast.success('Producto eliminado correctamente');
    },
    onError: () => {
      toast.error('Error al eliminar el producto');
    }
  });

  const deleteCategory = useMutation({
    ...v1CategoryDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1CategoryListQueryKey() });
      toast.success('Categoría eliminada correctamente');
    },
    onError: () => {
      toast.error('Error al eliminar la categoría');
    }
  });

  const deleteUnit = useMutation({
    ...v1MeasurementDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1MeasurementListQueryKey() });
      toast.success('Unidad eliminada correctamente');
    },
    onError: () => {
      toast.error('Error al eliminar la unidad');
    }
  });

  const products = useMemo(() => {
    let data = Array.isArray(productsData) ? productsData : [];
    
    if (searchTerm) {
      data = data.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    if (filterCategory !== 'all') {
      data = data.filter(p => p.category === filterCategory);
    }
    
    if (filterUnit !== 'all') {
      data = data.filter(p => p.measurement_unit === filterUnit);
    }
    
    return data;
  }, [productsData, searchTerm, filterCategory, filterUnit]);

  const categories = useMemo(() => {
    const data = Array.isArray(categoriesData) ? categoriesData : [];
    if (!searchTerm) return data;
    return data.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [categoriesData, searchTerm]);

  const units = useMemo(() => {
    const data = Array.isArray(unitsData) ? unitsData : [];
    if (!searchTerm) return data;
    return data.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [unitsData, searchTerm]);

  const handleCreate = () => {
    setEditingData(null);
    if (activeTab === 'products') setModalType('product');
    if (activeTab === 'categories') setModalType('category');
    if (activeTab === 'units') setModalType('unit');
    setIsModalOpen(true);
  };

  const handleEdit = (type: 'product' | 'category' | 'unit', data: ProductMaster | Category | MeasurementUnit) => {
    setEditingData(data);
    setModalType(type);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    setEditingData(null);
  };

  const openConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm
    });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    const data = Array.isArray(categoriesData) ? categoriesData : [];
    for (const cat of data) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categoriesData]);

  const unitMap = useMemo(() => {
    const map = new Map<string, string>();
    const data = Array.isArray(unitsData) ? unitsData : [];
    for (const unit of data) {
      map.set(unit.id, unit.name);
    }
    return map;
  }, [unitsData]);

  const stockMap = useMemo(() => {
    const map = new Map<string, string>();
    if (stockData) {
      for (const stock of stockData) {
        map.set(stock.product_id, stock.stock);
      }
    }
    return map;
  }, [stockData]);

  const getCategoryName = (id?: string | null) => {
    if (!id) return '-';
    return categoryMap.get(id) || id;
  };

  const getStock = (productId: string) => {
    return stockMap.get(productId) || '0';
  };

  const getUnitName = (id?: string | null) => {
    if (!id) return '-';
    return unitMap.get(id) || id;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className={isMobile ? 'text-xl font-bold text-gray-900' : 'text-2xl font-bold text-gray-900'}>Gestión de Inventario</h1>
        <div className="flex items-center gap-3">
          {activeTab === 'products' && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex cursor-pointer items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Importar
            </button>
          )}
          <button
            onClick={handleCreate}
            className="inline-flex cursor-pointer items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear {activeTab === 'products' ? 'Producto' : activeTab === 'categories' ? 'Categoría' : 'Unidad'}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder={`Buscar por nombre en ${activeTab === 'products' ? 'productos' : activeTab === 'categories' ? 'categorías' : 'unidades'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {activeTab === 'products' && (
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Filter className="h-5 w-5 text-gray-400 shrink-0 hidden sm:block" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="block cursor-pointer w-full sm:w-48 pl-3 pr-10 py-2.5 text-sm border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl border bg-white shadow-sm transition-all"
            >
              <option value="all">Todas las categorías</option>
              {(Array.isArray(categoriesData) ? categoriesData : []).map((cat: Category) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="block cursor-pointer w-full sm:w-48 pl-3 pr-10 py-2.5 text-sm border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl border bg-white shadow-sm transition-all"
            >
              <option value="all">Todas las unidades</option>
              {(Array.isArray(unitsData) ? unitsData : []).map((unit: MeasurementUnit) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => { setActiveTab('products'); setSearchTerm(''); setFilterCategory('all'); setFilterUnit('all'); }}
            className={`${
              activeTab === 'products' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <Package className={`${activeTab === 'products' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Productos
          </button>
          <button
            onClick={() => { setActiveTab('categories'); setSearchTerm(''); setFilterCategory('all'); setFilterUnit('all'); }}
            className={`${
              activeTab === 'categories' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <Tag className={`${activeTab === 'categories' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Categorías
          </button>
          <button
            onClick={() => { setActiveTab('units'); setSearchTerm(''); setFilterCategory('all'); setFilterUnit('all'); }}
            className={`${
              activeTab === 'units' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <Scale className={`${activeTab === 'units' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Unidades
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {activeTab === 'products' && (
          <div className="overflow-x-auto">
             {isProductsLoading ? (
               <div className="p-4 text-center text-gray-500">Cargando productos...</div>
             ) : (
               isMobile ? (
                 <MobileProductList 
                   products={products}
                   getCategoryName={getCategoryName}
                   getUnitName={getUnitName}
                   getStock={getStock}
                   rates={rates}
                   onEdit={(p) => handleEdit('product', p)}
                   onDelete={(p) => openConfirm(
                     'Eliminar Producto',
                     `¿Estás seguro de que deseas eliminar el producto "${p.name}"? Esta acción no se puede deshacer.`,
                     () => deleteProduct.mutate({ path: { id: p.id } })
                   )}
                 />
               ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IVA</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Costo (USD)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio de Venta (USD)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio de Venta (Bs - BCV)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product: ProductMaster) => {
                  const basePrice = parseFloat(product.cost_price_usd) * (1 + parseFloat(product.profit_margin || '0') / 100);
                  const finalPriceUsd = product.IVA ? basePrice * 1.16 : basePrice;
                  
                  return (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCategoryName(product.category)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getUnitName(product.measurement_unit)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.IVA ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {product.IVA ? 'Sí (16%)' : 'Exento'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.cost_price_usd}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${finalPriceUsd.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rates ? `Bs. ${(finalPriceUsd * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                        <span className={parseFloat(getStock(product.id)) > 0 ? 'text-green-600' : 'text-red-600'}>
                            {getStock(product.id)}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleEdit('product', product)}
                        className="text-blue-600 hover:text-blue-900 mr-4 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => {
                          openConfirm(
                            'Eliminar Producto',
                            `¿Estás seguro de que deseas eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`,
                            () => deleteProduct.mutate({ path: { id: product.id } })
                          );
                      }} className="text-red-600 hover:text-red-900 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                  );
                })}
                {products.length === 0 && (
                   <tr>
                       <td colSpan={8} className="px-6 py-4 text-center text-gray-500 text-sm">No se encontraron productos.</td>
                   </tr>
                )}
              </tbody>
            </table>
               )
             )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="overflow-x-auto">
              {isCategoriesLoading ? (
               <div className="p-4 text-center text-gray-500">Cargando categorías...</div>
             ) : (
               isMobile ? (
                 <MobileCategoryList
                   categories={categories}
                   onEdit={(c) => handleEdit('category', c)}
                   onDelete={(c) => openConfirm(
                     'Eliminar Categoría',
                     `¿Estás seguro de que deseas eliminar la categoría "${c.name}"? Esta acción no se puede deshacer.`,
                     () => deleteCategory.mutate({ path: { id: c.id } })
                   )}
                 />
               ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((category: Category) => (
                  <tr key={category.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{category.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleEdit('category', category)}
                        className="text-blue-600 hover:text-blue-900 mr-4 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => {
                          openConfirm(
                            'Eliminar Categoría',
                            `¿Estás seguro de que deseas eliminar la categoría "${category.name}"? Esta acción no se puede deshacer.`,
                            () => deleteCategory.mutate({ path: { id: category.id } })
                          );
                      }} className="text-red-600 hover:text-red-900 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
                 {categories.length === 0 && (
                   <tr>
                       <td colSpan={2} className="px-6 py-4 text-center text-gray-500 text-sm">No se encontraron categorías.</td>
                   </tr>
                )}
              </tbody>
            </table>
             )
             )}
          </div>
        )}

        {activeTab === 'units' && (
          <div className="overflow-x-auto">
             {isUnitsLoading ? (
               <div className="p-4 text-center text-gray-500">Cargando unidades...</div>
             ) : (
               isMobile ? (
                 <MobileUnitList
                   units={units}
                   onEdit={(u) => handleEdit('unit', u)}
                   onDelete={(u) => openConfirm(
                     'Eliminar Unidad',
                     `¿Estás seguro de que deseas eliminar la unidad "${u.name}"? Esta acción no se puede deshacer.`,
                     () => deleteUnit.mutate({ path: { id: u.id } })
                   )}
                 />
               ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decimales</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {units.map((unit: MeasurementUnit) => (
                  <tr key={unit.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{unit.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.decimals ? 'Sí' : 'No'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleEdit('unit', unit)}
                        className="text-blue-600 hover:text-blue-900 mr-4 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => {
                          openConfirm(
                            'Eliminar Unidad',
                            `¿Estás seguro de que deseas eliminar la unidad "${unit.name}"? Esta acción no se puede deshacer.`,
                            () => deleteUnit.mutate({ path: { id: unit.id } })
                          );
                      }} className="text-red-600 hover:text-red-900 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
                {units.length === 0 && (
                   <tr>
                       <td colSpan={3} className="px-6 py-4 text-center text-gray-500 text-sm">No se encontraron unidades.</td>
                   </tr>
                )}
              </tbody>
            </table>
             )
             )}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          modalType === 'product' ? (editingData ? 'Editar Producto' : 'Crear Producto') :
          modalType === 'category' ? (editingData ? 'Editar Categoría' : 'Crear Categoría') :
          (editingData ? 'Editar Unidad' : 'Crear Unidad')
        }
      >
        {modalType === 'product' && <ProductForm initialData={editingData as ProductMaster} onSuccess={closeModal} />}
        {modalType === 'category' && <CategoryForm initialData={editingData as Category} onSuccess={closeModal} />}
        {modalType === 'unit' && <UnitForm initialData={editingData as MeasurementUnit} onSuccess={closeModal} />}
      </Modal>

      <ProductImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        description={confirmState.description}
        confirmText="Eliminar"
        variant="danger"
        />
    </div>
  );
}

const tabButtonBaseClass = "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm cursor-pointer";
const tabButtonActiveClass = "border-blue-500 text-blue-600";
const tabButtonInactiveClass = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";

