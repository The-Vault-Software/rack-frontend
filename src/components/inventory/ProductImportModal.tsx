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
  cost: string; // Keep as string for input parsing
  // Validation status
  isValid: boolean;
  errors: string[];
  // Resolved data
  categoryId: string | null;
  unitId: string | null;
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
      const existingProductNames = new Set((products as ProductMaster[] || []).map(p => p.name.toLowerCase()));
      const categoryMap = new Map((categories as Category[] || []).map(c => [c.name.toLowerCase(), c.id]));
      const unitMap = new Map((units as MeasurementUnit[] || []).map(u => [u.name.toLowerCase(), u.id]));

      // Skip header row
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const name = String(row[nameIdx] || '').trim();
        if (!name) continue; // Skip empty names

        const sku = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : undefined;

        const categoryName = catIdx !== -1 ? String(row[catIdx] || '').trim() : '';
        const unitName = unitIdx !== -1 ? String(row[unitIdx] || '').trim() : '';
        const costRaw = costIdx !== -1 ? row[costIdx] : '0';
        
        // Validation logic
        const errors: string[] = [];
        let isValid = true;

        // 1. Check duplicate name
        if (existingProductNames.has(name.toLowerCase())) {
            errors.push('El nombre ya existe');
            isValid = false;
        }

        // 2. Check cost
        let costPrice = '0';
        if (typeof costRaw === 'number') {
            costPrice = costRaw.toString();
        } else if (typeof costRaw === 'string') {
            const parsed = parseFloat(costRaw.replace(',', '.')); // Handle potential comma decimals
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

        // 3. Resolve Category
        const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) || null : null;
        // Logic: "Verificar si existe una categoria con dicho nombre, si no, se deja sin asignar." -> Handled by null default

        // 4. Resolve Unit
        const unitId = unitName ? unitMap.get(unitName.toLowerCase()) || null : null;
         // Logic: "Verificar si existe una unidad de medida con dicho nombre, si no, se deja sin asignar." -> Handled by null default

        rows.push({
          id: `row-${i}`,
          name,
          sku,
          categoryName,
          unitName,
          cost: costPrice,
          isValid,
          errors,
          categoryId: categoryId || null,
          unitId: unitId || null
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
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
        try {
            await createProduct.mutateAsync({
                body: {
                    name: row.name,
                    sku: row.sku,
                    cost_price_usd: row.cost,
                    category: row.categoryId,
                    measurement_unit: row.unitId,
                    profit_margin: "30", // Default profit margin
                    IVA: false,
                    description: "Importado desde Excel"
                }
            });
            successCount++;
        } catch (err) {
            failCount++;
            console.error(`Failed to import ${row.name}`, err);
        }
        setProgress(prev => prev + 1);
    }

    setIsImporting(false);
    toast.success(`Importación completada: ${successCount} creados, ${failCount} fallidos.`);
    queryClient.invalidateQueries({ queryKey: v1ProductListQueryKey() });
    onClose();
    // Reset state
    setFile(null);
    setData([]);
  };

  if (!isOpen) return null;

  const validCount = data.filter(d => d.isValid).length;
  const invalidCount = data.length - validCount;

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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                                <p className="text-2xl font-bold text-green-700">{validCount}</p>
                                <p className="text-sm text-green-600 font-medium">Válidos</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                                <p className="text-2xl font-bold text-red-700">{invalidCount}</p>
                                <p className="text-sm text-red-600 font-medium">Con errores</p>
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
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validación</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                            {data.slice(0, 100).map((row) => (
                                                <tr key={row.id} className={!row.isValid ? 'bg-red-50/50' : ''}>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        {row.isValid ? (
                                                            <CheckCircle className="text-green-500" size={18} />
                                                        ) : (
                                                            <AlertCircle className="text-red-500" size={18} />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-900 font-medium">{row.name}</td>
                                                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.sku || '-'}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={row.categoryId ? 'text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs' : 'text-gray-400 italic'}>
                                                            {row.categoryName || 'N/A'} {row.categoryId ? '(Existente)' : '(Sin asignar)'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className={row.unitId ? 'text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs' : 'text-gray-400 italic'}>
                                                            {row.unitName || 'N/A'} {row.unitId ? '(Existente)' : '(Sin asignar)'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">${row.cost}</td>
                                                    <td className="px-4 py-2">
                                                        {row.errors.length > 0 ? (
                                                            <span className="text-red-600 text-xs">{row.errors.join(', ')}</span>
                                                        ) : (
                                                            <span className="text-green-600 text-xs">Listo para crear</span>
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
