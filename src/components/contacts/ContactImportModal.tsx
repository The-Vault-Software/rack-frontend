import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  v1CustomersListOptions,
  v1CustomersListQueryKey,
  v1CustomersCreateMutation,
  v1CustomersUpdateMutation,
  v1ProvidersListOptions,
  v1ProvidersListQueryKey,
  v1ProvidersCreateMutation,
  v1ProvidersUpdateMutation,
} from '../../client/@tanstack/react-query.gen';
import type { Customer, Provider } from '../../client/types.gen';
import { motion } from 'motion/react';

interface ContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'customer' | 'provider';
}

interface ImportedRow {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  isValid: boolean;
  errors: string[];
  isUpdate: boolean;
  existingId?: string;
  changes?: string[];
}

export default function ContactImportModal({ isOpen, onClose, type }: ContactImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const isCustomer = type === 'customer';
  const label = isCustomer ? 'Clientes' : 'Proveedores';

  const { data: customersData } = useQuery({ ...v1CustomersListOptions(), enabled: isCustomer });
  const { data: providersData } = useQuery({ ...v1ProvidersListOptions(), enabled: !isCustomer });

  const createCustomer = useMutation({ ...v1CustomersCreateMutation() });
  const updateCustomer = useMutation({ ...v1CustomersUpdateMutation() });
  const createProvider = useMutation({ ...v1ProvidersCreateMutation() });
  const updateProvider = useMutation({ ...v1ProvidersUpdateMutation() });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setData([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (jsonData.length < 2) {
        toast.error('El archivo Excel parece estar vacío o no tiene datos.');
        setIsProcessing(false);
        return;
      }

      const headers = (jsonData[0] as unknown[]).map((h) => String(h || '').toLowerCase().trim());

      const nameIdx = headers.findIndex((h) => h.includes('nombre') || h.includes('name'));
      const phoneIdx = headers.findIndex((h) => h.includes('teléfono') || h.includes('telefono') || h.includes('phone') || h.includes('tel'));
      const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('correo'));
      const docIdx = headers.findIndex((h) => h.includes('documento') || h.includes('document') || h.includes('rif') || h.includes('cédula') || h.includes('cedula') || h.includes('id'));

      if (nameIdx === -1) {
        toast.error('No se encontró la columna "Nombre" en el Excel.');
        setIsProcessing(false);
        return;
      }

      const contacts = isCustomer
        ? (Array.isArray(customersData) ? customersData as Customer[] : [])
        : (Array.isArray(providersData) ? providersData as Provider[] : []);

      const existingMap = new Map(contacts.map((c) => [c.name.toLowerCase(), c]));

      const rows: ImportedRow[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        if (!row || row.length === 0) continue;

        const name = String(row[nameIdx] ?? '').trim();
        if (!name) continue;

        const errors: string[] = [];
        let isValid = true;
        let isUpdate = false;
        let existingId: string | undefined;
        const changes: string[] = [];

        const phone = phoneIdx !== -1 ? String(row[phoneIdx] ?? '').trim() || undefined : undefined;
        const email = emailIdx !== -1 ? String(row[emailIdx] ?? '').trim() || undefined : undefined;
        const document = docIdx !== -1 ? String(row[docIdx] ?? '').trim() || undefined : undefined;

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push('Email inválido');
          isValid = false;
        }

        if (existingMap.has(name.toLowerCase())) {
          const existing = existingMap.get(name.toLowerCase())!;
          existingId = existing.id;

          if (phoneIdx !== -1 && (existing.phone ?? '') !== (phone ?? '')) changes.push('Teléfono');
          if (emailIdx !== -1 && (existing.email ?? '') !== (email ?? '')) changes.push('Email');
          if (docIdx !== -1 && (existing.document ?? '') !== (document ?? '')) changes.push('Documento');

          if (changes.length > 0) {
            isUpdate = true;
          } else {
            errors.push('El contacto ya existe y es idéntico');
            isValid = false;
          }
        }

        rows.push({ id: `row-${i}`, name, phone, email, document, isValid, errors, isUpdate, existingId, changes });
      }

      setData(rows);
      if (rows.length === 0) {
        toast.warning('No se encontraron contactos válidos para importar.');
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
    const validRows = data.filter((d) => d.isValid);
    if (validRows.length === 0) {
      toast.error('No hay contactos válidos para importar');
      return;
    }

    setIsImporting(true);
    setProgress(0);
    let createdCount = 0;
    let updatedCount = 0;
    let failCount = 0;

    const contacts = isCustomer
      ? (Array.isArray(customersData) ? customersData as Customer[] : [])
      : (Array.isArray(providersData) ? providersData as Provider[] : []);
    const contactsMap = new Map(contacts.map((c) => [c.id, c]));

    for (const row of validRows) {
      try {
        if (row.isUpdate && row.existingId) {
          const existing = contactsMap.get(row.existingId);
          if (existing) {
            const body = {
              name: row.name,
              phone: row.phone !== undefined ? row.phone : existing.phone,
              email: row.email !== undefined ? row.email : existing.email,
              document: row.document !== undefined ? row.document : existing.document,
            };
            if (isCustomer) {
              await updateCustomer.mutateAsync({ path: { id: row.existingId }, body });
            } else {
              await updateProvider.mutateAsync({ path: { id: row.existingId }, body });
            }
            updatedCount++;
          } else {
            failCount++;
          }
        } else {
          const body = { name: row.name, phone: row.phone, email: row.email, document: row.document };
          if (isCustomer) {
            await createCustomer.mutateAsync({ body });
          } else {
            await createProvider.mutateAsync({ body });
          }
          createdCount++;
        }
      } catch (err) {
        failCount++;
        console.error(`Error procesando ${row.name}`, err);
      }
      setProgress((prev) => prev + 1);
    }

    setIsImporting(false);
    toast.success(`Proceso completado: ${createdCount} creados, ${updatedCount} actualizados, ${failCount} fallidos.`);
    queryClient.invalidateQueries({ queryKey: isCustomer ? v1CustomersListQueryKey() : v1ProvidersListQueryKey() });
    onClose();
    setFile(null);
    setData([]);
  };

  if (!isOpen) return null;

  const validCount = data.filter((d) => d.isValid).length;
  const invalidCount = data.length - validCount;
  const updateCount = data.filter((d) => d.isUpdate).length;

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
            <h2 className="text-xl font-bold text-gray-900">Importar {label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Sube un archivo Excel (.xlsx, .xls). Columnas soportadas: Nombre, Teléfono, Email, Documento.
            </p>
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
                Columnas: <span className="font-medium">Nombre</span> (requerido), Teléfono, Email, Documento/RIF/Cédula.
              </p>
              <input ref={fileInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
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
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
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
                                <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.document || '-'}</td>
                                <td className="px-4 py-2 text-gray-600">{row.phone || '-'}</td>
                                <td className="px-4 py-2 text-gray-600">{row.email || '-'}</td>
                                <td className="px-4 py-2">
                                  {row.errors.length > 0 ? (
                                    <span className="text-red-600 text-xs">{row.errors.join(', ')}</span>
                                  ) : row.isUpdate ? (
                                    <span className="text-blue-600 text-xs font-medium">Cambios: {row.changes?.join(', ')}</span>
                                  ) : (
                                    <span className="text-green-600 text-xs">Nuevo contacto</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {data.length > 100 && (
                              <tr>
                                <td colSpan={6} className="px-4 py-3 text-center text-gray-500 text-xs bg-gray-50">
                                  ... y {data.length - 100} contactos más
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
                <span className="font-medium">{progress} / {validCount}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${validCount > 0 ? (progress / validCount) * 100 : 0}%` }}
                />
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
              {isImporting ? 'Importando...' : `Importar ${validCount} ${label}`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
