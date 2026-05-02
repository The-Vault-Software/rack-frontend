import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { v1AccountsRetrieveOptions, v1CompanyRetrieveOptions } from '../../client/@tanstack/react-query.gen';
import { format } from 'date-fns';
import { useBranch } from '../../context/BranchContext';
import { Printer } from 'lucide-react';

export default function PrintAccountPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'factura'; // 'factura', 'nota_entrega', 'pdf'
  
  const { selectedBranch } = useBranch();
  
  const { data: account, isLoading, error } = useQuery(v1AccountsRetrieveOptions({
    path: { id: id! }
  }));

  const { data: company } = useQuery(v1CompanyRetrieveOptions());

  const hasPrinted = useRef(false);

  useEffect(() => {
    if (account && company && !isLoading && !hasPrinted.current) {
      // Small delay to ensure styles and fonts are loaded
      setTimeout(() => {
        window.print();
        hasPrinted.current = true;
      }, 500);
    }
  }, [account, company, isLoading]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Preparando documento...</div>;
  }

  if (error || !account) {
    return <div className="p-8 text-center text-red-500">Error al cargar los datos de la cuenta.</div>;
  }

  const documentTitle = type === 'nota_entrega' ? 'NOTA DE RECEPCIÓN' : 'FACTURA DE COMPRA';

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white p-4 sm:p-8">
      {/* Non-printable controls */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Vista de Impresión: {documentTitle}</h2>
          <p className="text-sm text-gray-500">Ajusta los márgenes a "Ninguno" o "Mínimo" si es necesario.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.close()}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="max-w-4xl mx-auto bg-white print:p-0 print:shadow-none shadow-md rounded-lg p-8 sm:p-12">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-1">{company?.name || 'Compañía'}</h1>
            {selectedBranch && (
              <div className="text-sm text-gray-600 space-y-0.5">
                <p>RIF: {company?.rif || 'N/A'}</p>
                <p>Sucursal: {selectedBranch.name}</p>
                <p>{selectedBranch.address}</p>
                <p>Tel: {selectedBranch.phone}</p>
              </div>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-800 tracking-wider">{documentTitle}</h2>
            <p className="text-lg font-bold text-gray-600 mt-1">Nº {account.seq_number}</p>
            <p className="text-sm text-gray-500 mt-2">
              Fecha: {format(new Date(account.created_at), "dd/MM/yyyy")}
            </p>
            <p className="text-sm text-gray-500">
              Hora: {format(new Date(account.created_at), "HH:mm")}
            </p>
          </div>
        </div>

        {/* Supplier Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Proveedor:</h3>
            <p className="font-bold text-gray-900">{account.provider_name || 'Proveedor Desconocido'}</p>
            <p className="text-sm text-gray-600">ID / RIF: {account.provider || 'N/A'}</p>
          </div>
          <div className="text-right">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Estado de Pago:</h3>
            <p className="font-bold text-gray-900">
              {account.payment_status === 'PAID' ? 'PAGADO' : account.payment_status === 'PARTIALLY_PAID' ? 'PAGO PARCIAL' : 'PENDIENTE'}
            </p>
          </div>
        </div>

        {/* Products Table */}
        <div className="mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="py-3 text-sm font-bold text-gray-800 uppercase tracking-wider">Descripción</th>
                <th className="py-3 text-sm font-bold text-gray-800 uppercase tracking-wider text-center">Cant</th>
                <th className="py-3 text-sm font-bold text-gray-800 uppercase tracking-wider text-right">Precio Unitario</th>
                <th className="py-3 text-sm font-bold text-gray-800 uppercase tracking-wider text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {account.account_details.map((detail, index) => {
                const subtotal = parseFloat(detail.quantity) * parseFloat(detail.unit_price || '0');
                const isLast = index === account.account_details.length - 1;
                return (
                  <tr key={detail.id} className={isLast ? 'border-b-2 border-gray-200' : 'border-b border-gray-200'}>
                    <td className="py-3 text-sm text-gray-900">{detail.product_name}</td>
                    <td className="py-3 text-sm text-gray-900 text-center">{detail.quantity}</td>
                    <td className="py-3 text-sm text-gray-900 text-right">${parseFloat(detail.unit_price || '0').toFixed(2)}</td>
                    <td className="py-3 text-sm font-bold text-gray-900 text-right">${subtotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-sm font-bold text-gray-600">Subtotal:</span>
              <span className="text-sm font-bold text-gray-900">${parseFloat(account.total_amount_usd || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-3 border-b-2 border-gray-800">
              <span className="text-base font-black text-gray-900">Total USD:</span>
              <span className="text-base font-black text-gray-900">${parseFloat(account.total_amount_usd || '0').toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-600">Total Pagado:</span>
              <span className="font-medium text-emerald-600">${parseFloat(account.total_paid || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-600">Saldo Pendiente:</span>
              <span className="font-medium text-red-600">${(parseFloat(account.total_amount_usd || '0') - parseFloat(account.total_paid || '0')).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>Este documento es una representación impresa de la {documentTitle.toLowerCase()}.</p>
        </div>

      </div>
    </div>
  );
}
