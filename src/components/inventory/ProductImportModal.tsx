import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  v1ProductListOptions, 
  v1CategoryListOptions, 
  v1MeasurementListOptions,
  v1ProductCreateMutation,
  v1ProductUpdateMutation,
  v1ProductListQueryKey
} from '../../client/@tanstack/react-query.gen';
import type { Category, MeasurementUnit, ProductMaster } from '../../client/types.gen';
import { motion } from 'motion/react';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportedRow {
  id: string; // Temporary ID for list rendering
  name: string;
  sku?: string;
  categoryName: string;
  unitName: string;
  cost?: string; // Keep as string for input parsing, optional if column missing
  // Validation status
  isValid: boolean;
  errors: string[];
  // Resolved data
  categoryId?: string | null;
  unitId?: string | null;
  // Update logic
  isUpdate: boolean;
  existingProductId?: string;
  changes?: string[];
}

export default function ProductImportModal({ isOpen, onClose }: ProductImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch existing data for validation
  const { data: products } = useQuery(v1ProductListOptions());
  const { data: categories } = useQuery(v1CategoryListOptions());
  const { data: units } = useQuery(v1MeasurementListOptions());

  const createProduct = useMutation({
    ...v1ProductCreateMutation(),
    onSuccess: () => {
      // We'll handle individual successes manually to track progress
    },
    onError: (error) => {
      console.error('Error creating product:', error);
    }
  });

  const updateProduct = useMutation({
    ...v1ProductUpdateMutation(),
    onSuccess: () => {
      // Manual handling
    },
    onError: (error) => {
      console.error('Error updating product:', error);
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setData([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (jsonData.length < 2) {
        toast.error('El archivo Excel parece estar vacío o no tiene datos.');
        setIsProcessing(false);
        return;
      }

      // Identify headers (Case insensitive)
      const headers = (jsonData[0] as unknown[]).map((h) => String(h || '').toLowerCase().trim());
      
      const nameIdx = headers.findIndex((h: string) => h.includes('nombre') || h.includes('name'));
      const skuIdx = headers.findIndex((h: string) => h.includes('sku') || h.includes('código') || h.includes('codigo'));
      const catIdx = headers.findIndex((h: string) => h.includes('categor') || h.includes('category'));
      const unitIdx = headers.findIndex((h: string) => h.includes('unidad') || h.includes('unit'));
      const costIdx = headers.findIndex((h: string) => h.includes('cost') || h.includes('precio'));

      if (nameIdx === -1) {
        toast.error('No se encontró la columna "Nombre" en el Excel.');
        setIsProcessing(false);
        return;
      }

      const rows: ImportedRow[] = [];
      const existingProductsMap = new Map((products as ProductMaster[] || []).map(p => [p.name.toLowerCase(), p]));
      const categoryMap = new Map((categories as Category[] || []).map(c => [c.name.toLowerCase(), c.id]));
      const unitMap = new Map((units as MeasurementUnit[] || []).map(u => [u.name.toLowerCase(), u.id]));

      // Skip header row
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const name = String(row[nameIdx] || '').trim();
        if (!name) continue; // Skip empty names

        // 1. Initialize variables
        const errors: string[] = [];
        let isValid = true;
        let isUpdate = false;
        let existingProductId: string | undefined = undefined;
        const changes: string[] = [];

        // 2. Extract basic values
        const sku = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : undefined;
        const categoryName = catIdx !== -1 ? String(row[catIdx] || '').trim() : '';
        const unitName = unitIdx !== -1 ? String(row[unitIdx] || '').trim() : '';
        
        // 3. Process Cost
        let costPrice: string | undefined = undefined;
        if (costIdx !== -1) {
            const costRaw = row[costIdx];
            if (costRaw === undefined || costRaw === null || String(costRaw).trim() === '') {
                 costPrice = '0'; 
            } else if (typeof costRaw === 'number') {
                costPrice = costRaw.toString();
            } else if (typeof costRaw === 'string') {
                const parsed = parseFloat(costRaw.replace(',', '.'));
                if (isNaN(parsed) || parsed < 0) {
                   errors.push('Costo inválido');
                   isValid = false;
                } else {
                   costPrice = parsed.toString();
                }
            } else {
                 errors.push('Costo inválido');
                 isValid = false;
            }
        }

        // 4. Resolve IDs
        let categoryId: string | null | undefined = undefined;
        if (catIdx !== -1) {
             categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) || null : null;
        }

        let unitId: string | null | undefined = undefined;
        if (unitIdx !== -1) {
             unitId = unitName ? unitMap.get(unitName.toLowerCase()) || null : null;
        }

        // 5. Check Update status
        if (existingProductsMap.has(name.toLowerCase())) {
            const existing = existingProductsMap.get(name.toLowerCase())!;
            existingProductId = existing.id;
            
            // Check for changes
            if (skuIdx !== -1 && (existing.sku || '') !== (sku || '')) changes.push('SKU');
            if (catIdx !== -1 && existing.category !== categoryId) changes.push('Categoría');
            if (unitIdx !== -1 && existing.measurement_unit !== unitId) changes.push('Unidad');
            
            if (costIdx !== -1 && costPrice !== undefined) {
                 const oldCost = parseFloat(existing.cost_price_usd);
                 const newCost = parseFloat(costPrice);
                 if (Math.abs(oldCost - newCost) > 0.0001) changes.push('Costo');
            }

            if (changes.length > 0) {
                isUpdate = true;
            } else {
                errors.push('El producto ya existe y es idéntico');
                isValid = false;
            }
        }

        rows.push({
          id: `row-${i}`,
          name,
          sku,
          categoryName,
          unitName,
          cost: costPrice,
          isValid,
          errors,
          categoryId,
          unitId,
          isUpdate,
          existingProductId,
          changes
        });
      }

      setData(rows);
      if (rows.length === 0) {
          toast.warning("No se encontraron productos válidos para importar.");
      } else {
        toast.success(`Se encontraron ${rows.length} filas procesables.`);
      }

    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('Error al leer el archivo Excel.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    const validRows = data.filter(d => d.isValid);
    if (validRows.length === 0) {
        toast.error("No hay productos válidos para importar");
        return;
    }

    setIsImporting(true);
    setProgress(0);
    let createdCount = 0;
    let updatedCount = 0;
    let failCount = 0;

    const productsMap = new Map((products as ProductMaster[] || []).map(p => [p.id, p]));

    for (const row of validRows) {
        try {
            if (row.isUpdate && row.existingProductId) {
                const existing = productsMap.get(row.existingProductId);
                if (existing) {
                     await updateProduct.mutateAsync({
                        path: { id: row.existingProductId },
                        body: {
                            ...existing, // Keep existing fields
                            name: row.name, // Name is always present
                            // Only update fields if they were in the CSV (defined)
                            sku: row.sku !== undefined ? row.sku : existing.sku,
                            cost_price_usd: row.cost !== undefined ? row.cost : existing.cost_price_usd,
                            category: row.categoryId !== undefined ? row.categoryId : existing.category,
                            measurement_unit: row.unitId !== undefined ? row.unitId : existing.measurement_unit,
                        } as ProductMaster
                    });
                    updatedCount++;
                } else {
                    failCount++;
                }
            } else {
                await createProduct.mutateAsync({
                    body: {
                        name: row.name,
                        sku: row.sku || '',
                        cost_price_usd: row.cost || '0', // Default if missing
                        category: row.categoryId || null,
                        measurement_unit: row.unitId || null,
                        profit_margin: "30",
                        IVA: false,
                        description: "Importado desde Excel"
                    }
                });
                createdCount++;
            }
        } catch (err) {
            failCount++;
            console.error(`Failed to process ${row.name}`, err);
        }
        setProgress(prev => prev + 1);
    }

    setIsImporting(false);
    toast.success(`Proceso completado: ${createdCount} creados, ${updatedCount} actualizados, ${failCount} fallidos.`);
    queryClient.invalidateQueries({ queryKey: v1ProductListQueryKey() });
    onClose();
    // Reset state
    setFile(null);
    setData([]);
  };

  if (!isOpen) return null;

  const validCount = data.filter(d => d.isValid).length;
  const invalidCount = data.length - validCount;
  const updateCount = data.filter(d => d.isUpdate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
             <h2 className="text-xl font-bold text-gray-900">Importar Productos</h2>
             <p className="text-sm text-gray-500 mt-1">Sube un archivo Excel (.xlsx, .xls) para cargar productos masivamente.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {!file ? (
            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Haz clic para subir tu Excel</h3>
              <p className="text-gray-500 text-sm max-w-sm">
                Asegúrate de que tenga las columnas: Nombre, SKU, Categoría, Unidad y Costo.
              </p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </div>
          ) : (
             <div className="space-y-6">
                 <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
                     <div className="flex items-center gap-3">
                         <FileSpreadsheet className="text-blue-600" size={24} />
                         <div>
                             <p className="font-medium text-gray-900">{file.name}</p>
                             <p className="text-xs text-blue-600 font-medium">{(file.size / 1024).toFixed(1)} KB</p>
                         </div>
                     </div>
                     <button 
                        onClick={() => { setFile(null); setData([]); }}
                        className="text-sm text-red-600 hover:text-red-700 font-medium hover:underline"
                     >
                        Cambiar archivo
                     </button>
                 </div>

                 {isProcessing ? (
                     <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                         <Loader2 className="animate-spin mb-3" size={32} />
                         <p>Procesando archivo...</p>
                     </div>
                 ) : (
                     <>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                                <p className="text-2xl font-bold text-green-700">{validCount - updateCount}</p>
                                <p className="text-sm text-green-600 font-medium">Nuevos</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                                <p className="text-2xl font-bold text-blue-700">{updateCount}</p>
                                <p className="text-sm text-blue-600 font-medium">Actualizaciones</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                                <p className="text-2xl font-bold text-red-700">{invalidCount}</p>
                                <p className="text-sm text-red-600 font-medium">Errores</p>
                            </div>
                        </div>

                        {data.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo (USD)</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Información</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                            {data.slice(0, 100).map((row) => (
                                                <tr key={row.id} className={!row.isValid ? 'bg-red-50/50' : row.isUpdate ? 'bg-blue-50/30' : ''}>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        {row.isValid ? (
                                                            row.isUpdate ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                    Actualizar
                                                                </span>
                                                            ) : (
                                                                <CheckCircle className="text-green-500" size={18} />
                                                            )
                                                        ) : (
                                                            <AlertCircle className="text-red-500" size={18} />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-900 font-medium">{row.name}</td>
                                                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.sku || '-'}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={row.categoryId ? 'text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs' : 'text-gray-400 italic'}>
                                                            {row.categoryId === undefined ? '-' : (row.categoryName || 'N/A')} {row.categoryId ? '(Existente)' : (row.categoryId === undefined ? '(Ignorar)' : '(Sin asignar)')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className={row.unitId ? 'text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs' : 'text-gray-400 italic'}>
                                                            {row.unitId === undefined ? '-' : (row.unitName || 'N/A')} {row.unitId ? '(Existente)' : (row.unitId === undefined ? '(Ignorar)' : '(Sin asignar)')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">{row.cost !== undefined ? `$${row.cost}` : '-'}</td>
                                                    <td className="px-4 py-2">
                                                        {row.errors.length > 0 ? (
                                                            <span className="text-red-600 text-xs">{row.errors.join(', ')}</span>
                                                        ) : row.isUpdate ? (
                                                             <span className="text-blue-600 text-xs font-medium">
                                                                Cambios: {row.changes?.join(', ')}
                                                             </span>
                                                        ) : (
                                                            <span className="text-green-600 text-xs">Nuevo producto</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {data.length > 100 && (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-3 text-center text-gray-500 text-xs bg-gray-50">
                                                        ... y {data.length - 100} productos más
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                     </>
                 )}
             </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-3 rounded-b-xl">
           {isImporting && (
             <div className="w-full space-y-2">
               <div className="flex justify-between text-sm text-gray-600">
                 <span>Procesando...</span>
                 <span className="font-medium">{progress} / {data.filter(d => d.isValid).length}</span>
               </div>
               <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                 <div 
                   className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                   style={{ width: `${(progress / data.filter(d => d.isValid).length) * 100}%` }}
                 ></div>
               </div>
             </div>
           )}
           <div className="flex justify-end gap-3 w-full">
            <button 
                onClick={onClose} 
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                disabled={isImporting}
            >
                Cancelar
            </button>
            <button 
                onClick={handleImport} 
                disabled={!file || validCount === 0 || isImporting}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                {isImporting ? 'Importando...' : `Importar ${validCount} Productos`}
            </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
