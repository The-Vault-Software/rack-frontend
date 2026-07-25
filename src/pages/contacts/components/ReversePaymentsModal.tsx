import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import { v1CustomerSalePaymentsListOptions } from '../../../client/@tanstack/react-query.gen';
import type { CustomerSalePaymentList } from '../../../client/types.gen';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';
import { useReversePayments } from '../hooks/useReversePayments';

const REASON_MAX_LENGTH = 255;

interface ReversePaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
}

type PaymentKind = 'selectable' | 'reversal' | 'reversed';

function classifyPayment(payment: CustomerSalePaymentList): PaymentKind {
  // Keyed off the explicit relation rather than the amount's sign: a negative
  // amount happens to imply a reversal today, but `reverses` is what actually
  // states it.
  if (payment.reverses !== null) return 'reversal';
  if (payment.is_reversed) return 'reversed';
  return 'selectable';
}

/**
 * Parses a backend decimal string into integer cents, so several amounts can be
 * summed without floating-point drift. The API always sends 2 decimal places.
 */
function toCents(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatVes(amount: number): string {
  return `Bs. ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPaymentDate(value: string): string {
  return format(new Date(value), 'dd/MM/yyyy HH:mm');
}

function StatusBadge({ kind }: { kind: PaymentKind }) {
  if (kind === 'reversal') {
    return (
      <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-red-50 text-red-700">
        Devolución
      </span>
    );
  }
  if (kind === 'reversed') {
    return (
      <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-gray-100 text-gray-600">
        Devuelto
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 text-emerald-700">
      Activo
    </span>
  );
}

export default function ReversePaymentsModal({
  isOpen,
  onClose,
  customerId,
  customerName,
}: ReversePaymentsModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    ...v1CustomerSalePaymentsListOptions({
      query: { customer_id: customerId, page_size: 100 },
    }),
    enabled: isOpen && !!customerId,
  });

  /**
   * Clears the form and closes. Every close path (footer button, header X,
   * backdrop click, escape, successful reversal) funnels through here, so the
   * next open always starts from a clean selection without a reset effect.
   */
  const handleClose = () => {
    setSelectedIds(new Set());
    setReason('');
    setIsConfirmOpen(false);
    onClose();
  };

  const { mutateAsync: reversePayments, isPending } = useReversePayments(customerId, {
    onSuccess: handleClose,
  });

  const payments = useMemo(() => data?.results ?? [], [data]);

  // The API caps page_size at 100, so a customer with a long payment history is
  // silently truncated. Surface that instead of letting the user conclude the
  // payment they are looking for does not exist.
  const totalCount = data?.count ?? 0;
  const isTruncated = totalCount > payments.length;

  const selectablePayments = useMemo(
    () => payments.filter((payment) => classifyPayment(payment) === 'selectable'),
    [payments],
  );

  const selectedPayments = useMemo(
    () => selectablePayments.filter((payment) => selectedIds.has(payment.id)),
    [selectablePayments, selectedIds],
  );

  // Accumulated in integer cents, then scaled back once. Summing parseFloat
  // results directly drifts, and this total is what the user is shown in the
  // irreversible-confirmation dialog — it has to match the server's Decimal sum.
  const totals = useMemo(() => {
    const cents = selectedPayments.reduce(
      (acc, payment) => ({
        usd: acc.usd + toCents(payment.total_amount_usd),
        ves: acc.ves + toCents(payment.total_amount_ves),
      }),
      { usd: 0, ves: 0 },
    );
    return { usd: cents.usd / 100, ves: cents.ves / 100 };
  }, [selectedPayments]);

  const affectedSalesCount = useMemo(
    () => new Set(selectedPayments.map((payment) => payment.sale)).size,
    [selectedPayments],
  );

  const allSelectableSelected =
    selectablePayments.length > 0 && selectedPayments.length === selectablePayments.length;

  const togglePayment = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(
      allSelectableSelected ? new Set() : new Set(selectablePayments.map((payment) => payment.id)),
    );
  };

  const handleConfirm = async () => {
    if (isPending) return;
    const paymentIds = selectedPayments.map((payment) => payment.id);
    if (paymentIds.length === 0) return;

    try {
      await reversePayments({
        body: {
          payment_ids: paymentIds,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      });
    } catch {
      // Error feedback is handled by useReversePayments.
      setIsConfirmOpen(false);
    }
  };

  const confirmTitle =
    selectedPayments.length > 1 ? `¿Devolver ${selectedPayments.length} pagos?` : '¿Devolver pago?';

  const confirmDescription =
    `Se registrará una devolución de ${formatUsd(totals.usd)} (${formatVes(totals.ves)}) sobre ` +
    `${affectedSalesCount} venta(s). El pago original se conserva en el historial y la deuda del ` +
    'cliente aumentará. Esta acción no se puede deshacer.';

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Cargando pagos...</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-gray-900">
            No se pudieron cargar los pagos del cliente.
          </p>
          <p className="text-xs text-gray-500">
            Revisa tu conexión e intenta abrir la ventana de nuevo.
          </p>
        </div>
      );
    }

    if (payments.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-gray-500">
          Este cliente no tiene pagos registrados.
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="grid grid-cols-1 gap-3">
          {payments.map((payment) => {
            const kind = classifyPayment(payment);
            const isSelectable = kind === 'selectable';
            const usd = parseFloat(payment.total_amount_usd);
            const ves = parseFloat(payment.total_amount_ves);

            return (
              <div
                key={payment.id}
                className={cn(
                  'rounded-xl border border-gray-100 bg-white p-4 shadow-sm',
                  kind === 'reversed' && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {isSelectable && (
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-red-600 focus:ring-red-500"
                        checked={selectedIds.has(payment.id)}
                        onChange={() => togglePayment(payment.id)}
                        aria-label={`Seleccionar pago de la venta #${payment.sale_seq_number}`}
                      />
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Venta #{payment.sale_seq_number}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {formatPaymentDate(payment.payment_date)}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-gray-600">
                        {payment.payment_method} · {payment.currency}
                      </p>
                    </div>
                  </div>
                  <StatusBadge kind={kind} />
                </div>

                <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-3">
                  <span className="text-sm font-black text-gray-900">{formatUsd(usd)}</span>
                  <span className="text-[11px] text-gray-500">{formatVes(ves)}</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <caption className="sr-only">
            Pagos registrados del cliente, con su estado y montos, disponibles para devolución.
          </caption>
          <thead className="bg-gray-50">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-red-600 focus:ring-red-500"
                  checked={allSelectableSelected}
                  onChange={toggleAll}
                  disabled={selectablePayments.length === 0}
                  aria-label="Seleccionar todos los pagos disponibles"
                />
              </th>
              <th scope="col" className="px-3 py-2 text-left">Fecha</th>
              <th scope="col" className="px-3 py-2 text-left">Venta #</th>
              <th scope="col" className="px-3 py-2 text-left">Método</th>
              <th scope="col" className="px-3 py-2 text-left">Moneda</th>
              <th scope="col" className="px-3 py-2 text-right">Monto USD</th>
              <th scope="col" className="px-3 py-2 text-right">Monto Bs</th>
              <th scope="col" className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {payments.map((payment) => {
              const kind = classifyPayment(payment);
              const isSelectable = kind === 'selectable';
              const usd = parseFloat(payment.total_amount_usd);
              const ves = parseFloat(payment.total_amount_ves);

              return (
                <tr
                  key={payment.id}
                  className={cn('text-sm', kind === 'reversed' && 'opacity-60')}
                >
                  <td className="px-3 py-2">
                    {isSelectable && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-red-600 focus:ring-red-500"
                        checked={selectedIds.has(payment.id)}
                        onChange={() => togglePayment(payment.id)}
                        aria-label={`Seleccionar pago de la venta #${payment.sale_seq_number}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {formatPaymentDate(payment.payment_date)}
                  </td>
                  <td className="px-3 py-2 font-semibold text-gray-900">
                    #{payment.sale_seq_number}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{payment.payment_method}</td>
                  <td className="px-3 py-2 text-gray-600">{payment.currency}</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">
                    {formatUsd(usd)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatVes(ves)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge kind={kind} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={customerName ? `Devolver Pago - ${customerName}` : 'Devolver Pago'}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Se muestran los pagos más recientes primero. Los pagos de un mismo cobro
            comparten fecha, hora y método.
          </p>

          {isTruncated && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                Este cliente tiene {totalCount} pagos y sólo se muestran los{' '}
                {payments.length} más recientes. Si el pago que buscás no aparece en la
                lista, todavía no se puede devolver desde acá.
              </p>
            </div>
          )}

          <div className="max-h-[45vh] overflow-y-auto">{renderContent()}</div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Total seleccionado ({selectedPayments.length} pago
              {selectedPayments.length === 1 ? '' : 's'})
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold text-gray-900">{formatUsd(totals.usd)}</span>
              <span className="text-sm font-medium text-gray-500">{formatVes(totals.ves)}</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="reverse-payments-reason"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Motivo (opcional)
            </label>
            <input
              id="reverse-payments-reason"
              type="text"
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej: el cliente pidió reversar el cobro"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              disabled={selectedPayments.length === 0 || isPending}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? 'Devolviendo...' : 'Devolver Pago'}
            </button>
          </div>
        </div>
      </Modal>

      {/*
        Rendered as a sibling of the list Modal (not inside it) so the confirmation
        dialog mounts its own Headless UI portal after the list portal and therefore
        paints above it, since both shells are hardcoded to z-50.
      */}
      <ActionConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        variant="danger"
        title={confirmTitle}
        description={confirmDescription}
        confirmText={isPending ? 'Devolviendo...' : 'Devolver Pago'}
        cancelText="Cancelar"
      />
    </>
  );
}
