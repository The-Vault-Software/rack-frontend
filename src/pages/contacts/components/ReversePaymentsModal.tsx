import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import {
  v1CustomerPaymentsListOptions,
  v1CustomerSalePaymentsListOptions,
} from '../../../client/@tanstack/react-query.gen';
import type {
  CustomerPaymentList,
  CustomerSalePaymentList,
} from '../../../client/types.gen';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';
import { useReversePayments } from '../hooks/useReversePayments';
import { useReverseCustomerPayment } from '../hooks/useReverseCustomerPayment';

const REASON_MAX_LENGTH = 255;

type TabKey = 'grouped' | 'individual';

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

function fromCents(cents: number): number {
  return cents / 100;
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

/**
 * Grouped-tab status. A group is either fully reversed (every active child has
 * an active reversal → remaining refundable is zero) or still active. Partial
 * individual refunds reduce the remaining refundable amount but keep the group
 * "Activo" — there is no per-group "Devolución" badge (that is a per-row state
 * on the Individual tab).
 */
function GroupStatusBadge({ fullyReversed }: { fullyReversed: boolean }) {
  if (fullyReversed) {
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
  // Grouped is the default tab on open (spec: Default tab on open).
  const [activeTab, setActiveTab] = useState<TabKey>('grouped');

  // Individual-tab state (preserved verbatim from the pre-tab modal).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  // Grouped-tab state: single-select (one group → one reverse call).
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Individual-tab query: legacy per-sale-payment list (unchanged).
  const { data, isLoading, isError } = useQuery({
    ...v1CustomerSalePaymentsListOptions({
      query: { customer_id: customerId, page_size: 100 },
    }),
    enabled: isOpen && !!customerId,
  });

  // Grouped-tab query: CustomerPayment groups, newest-first (backend orders).
  const {
    data: groupsData,
    isLoading: isLoadingGroups,
    isError: isGroupsError,
  } = useQuery({
    ...v1CustomerPaymentsListOptions({
      query: { customer_id: customerId, page_size: 100 },
    }),
    enabled: isOpen && !!customerId,
  });

  /**
   * Clears every tab's form and closes. Every close path (footer button, header
   * X, backdrop click, escape, successful reversal on either tab) funnels
   * through here, so the next open always starts from a clean Grouped tab.
   */
  const handleClose = () => {
    setSelectedIds(new Set());
    setReason('');
    setSelectedGroupId(null);
    setIsConfirmOpen(false);
    setActiveTab('grouped');
    onClose();
  };

  const { mutateAsync: reversePayments, isPending: isIndividualPending } = useReversePayments(
    customerId,
    { onSuccess: handleClose },
  );
  const { mutateAsync: reverseGroup, isPending: isGroupPending } = useReverseCustomerPayment(
    customerId,
    { onSuccess: handleClose },
  );

  const isPending = activeTab === 'grouped' ? isGroupPending : isIndividualPending;

  // ---- Individual-tab derived state (unchanged) ----
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
    return { usd: fromCents(cents.usd), ves: fromCents(cents.ves) };
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

  // ---- Grouped-tab derived state ----
  const groups = useMemo(() => groupsData?.results ?? [], [groupsData]);

  // A group is fully reversed when both remaining-refundable legs are zero.
  // Compared in integer cents so "0.00" / "0" / "0.0" all collapse to 0.
  const isGroupFullyReversed = (group: CustomerPaymentList): boolean =>
    toCents(group.remaining_refundable_usd) === 0 &&
    toCents(group.remaining_refundable_ves) === 0;

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const selectGroup = (group: CustomerPaymentList) => {
    // Toggle-radio: clicking the selected group clears it so the cashier can
    // back out without confirming. Fully-reversed groups are never selectable.
    if (isGroupFullyReversed(group)) return;
    setSelectedGroupId((previous) => (previous === group.id ? null : group.id));
  };

  // Grouped confirm states the EXACT remaining refundable amount (the amount
  // the server will reverse), summed in integer cents to match the backend
  // Decimal exactly — never the registered total, which may be higher after
  // partial individual refunds.
  const groupedRemaining = useMemo(() => {
    if (!selectedGroup) return { usd: 0, ves: 0 };
    return {
      usd: fromCents(toCents(selectedGroup.remaining_refundable_usd)),
      ves: fromCents(toCents(selectedGroup.remaining_refundable_ves)),
    };
  }, [selectedGroup]);

  // ---- Confirm handler branches by active tab ----
  const handleConfirm = async () => {
    if (isPending) return;
    try {
      if (activeTab === 'grouped') {
        // Exactly one group-reverse request. The remaining-children set is
        // computed by the backend from the group; only an optional reason
        // would be sent (omitted here — Grouped tab is exact-amount only).
        if (!selectedGroup) return;
        await reverseGroup({ path: { id: selectedGroup.id }, body: {} });
      } else {
        // Individual tab: legacy POST /v1/sale-payments/reverse/ (unchanged).
        const paymentIds = selectedPayments.map((payment) => payment.id);
        if (paymentIds.length === 0) return;
        await reversePayments({
          body: {
            payment_ids: paymentIds,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
        });
      }
    } catch {
      // Error feedback is handled by the hooks (backend `detail` via toast).
      setIsConfirmOpen(false);
    }
  };

  const handleTabChange = (tab: TabKey) => {
    if (tab === activeTab) return;
    // Don't carry an open confirm across tabs; selections persist so the user
    // can peek at the other tab and come back without re-selecting.
    setActiveTab(tab);
    setIsConfirmOpen(false);
  };

  // ---- Confirm dialog content (tab-aware) ----
  const confirmTitle =
    activeTab === 'grouped'
      ? '¿Devolver cobro?'
      : selectedPayments.length > 1
        ? `¿Devolver ${selectedPayments.length} pagos?`
        : '¿Devolver pago?';

  const confirmDescription =
    activeTab === 'grouped' && selectedGroup
      ? `Se registrará una devolución de ${formatUsd(groupedRemaining.usd)} ` +
        `(${formatVes(groupedRemaining.ves)}) sobre ${selectedGroup.sales_count} ` +
        `venta(s). El cobro se conserva en el historial y la deuda del cliente ` +
        'aumentará. Esta acción no se puede deshacer.'
      : `Se registrará una devolución de ${formatUsd(totals.usd)} (${formatVes(totals.ves)}) sobre ` +
        `${affectedSalesCount} venta(s). El pago original se conserva en el historial y la deuda del ` +
        'cliente aumentará. Esta acción no se puede deshacer.';

  const canConfirm = activeTab === 'grouped' ? !!selectedGroup : selectedPayments.length > 0;
  const actionLabel = activeTab === 'grouped' ? 'Devolver Cobro' : 'Devolver Pago';

  // ---- Individual-tab content (preserved) ----
  const renderIndividualContent = () => {
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

  // ---- Grouped-tab content (new) ----
  const renderGroupedContent = () => {
    if (isLoadingGroups) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Cargando pagos...</span>
        </div>
      );
    }

    if (isGroupsError) {
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

    if (groups.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-gray-500">
          Este cliente no tiene pagos registrados.
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="grid grid-cols-1 gap-3">
          {groups.map((group) => {
            const fullyReversed = isGroupFullyReversed(group);
            const totalUsd = parseFloat(group.total_amount_usd);
            const totalVes = parseFloat(group.total_amount_ves);
            const remainingUsd = parseFloat(group.remaining_refundable_usd);
            const remainingVes = parseFloat(group.remaining_refundable_ves);
            const isSelected = selectedGroupId === group.id;

            return (
              <div
                key={group.id}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm transition-colors',
                  fullyReversed
                    ? 'border-gray-100 opacity-60'
                    : isSelected
                      ? 'border-red-300 ring-1 ring-red-200'
                      : 'border-gray-100',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="grouped-cobro"
                      className="mt-1 h-4 w-4 cursor-pointer border-gray-300 text-red-600 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      checked={isSelected}
                      onChange={() => selectGroup(group)}
                      disabled={fullyReversed}
                      aria-label={`Seleccionar cobro del ${formatPaymentDate(group.payment_date)}`}
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Cobro</p>
                      <p className="text-[11px] text-gray-500">
                        {formatPaymentDate(group.payment_date)}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-gray-600">
                        {group.payment_method} · {group.currency}
                      </p>
                    </div>
                  </div>
                  <GroupStatusBadge fullyReversed={fullyReversed} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-[11px]">
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-gray-400">Total</p>
                    <p className="mt-0.5 font-bold text-gray-700">{formatUsd(totalUsd)}</p>
                    <p className="text-gray-400">{formatVes(totalVes)}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-gray-400">
                      Reembolsable
                    </p>
                    <p className="mt-0.5 font-bold text-gray-900">{formatUsd(remainingUsd)}</p>
                    <p className="text-gray-500">{formatVes(remainingVes)}</p>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-gray-500">
                  {group.sales_count} venta{group.sales_count === 1 ? '' : 's'} afectada
                  {group.sales_count === 1 ? '' : 's'}
                </p>
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
            Cobros agrupados del cliente, con totales registrados, monto reembolsable y ventas
            afectadas, disponibles para devolución.
          </caption>
          <thead className="bg-gray-50">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-3 py-2 text-left" />
              <th scope="col" className="px-3 py-2 text-left">Fecha</th>
              <th scope="col" className="px-3 py-2 text-left">Método</th>
              <th scope="col" className="px-3 py-2 text-left">Moneda</th>
              <th scope="col" className="px-3 py-2 text-right">Total</th>
              <th scope="col" className="px-3 py-2 text-right">Reembolsable</th>
              <th scope="col" className="px-3 py-2 text-right">Ventas</th>
              <th scope="col" className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {groups.map((group) => {
              const fullyReversed = isGroupFullyReversed(group);
              const totalUsd = parseFloat(group.total_amount_usd);
              const totalVes = parseFloat(group.total_amount_ves);
              const remainingUsd = parseFloat(group.remaining_refundable_usd);
              const remainingVes = parseFloat(group.remaining_refundable_ves);
              const isSelected = selectedGroupId === group.id;

              return (
                <tr
                  key={group.id}
                  className={cn(
                    'cursor-pointer text-sm transition-colors',
                    fullyReversed
                      ? 'cursor-not-allowed opacity-60'
                      : isSelected
                        ? 'bg-red-50'
                        : 'hover:bg-gray-50',
                  )}
                  onClick={() => selectGroup(group)}
                >
                  <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="radio"
                      name="grouped-cobro"
                      className="h-4 w-4 cursor-pointer border-gray-300 text-red-600 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      checked={isSelected}
                      onChange={() => selectGroup(group)}
                      disabled={fullyReversed}
                      aria-label={`Seleccionar cobro del ${formatPaymentDate(group.payment_date)}`}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {formatPaymentDate(group.payment_date)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{group.payment_method}</td>
                  <td className="px-3 py-2 text-gray-600">{group.currency}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-bold text-gray-700">{formatUsd(totalUsd)}</div>
                    <div className="text-[11px] text-gray-400">{formatVes(totalVes)}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-bold text-gray-900">{formatUsd(remainingUsd)}</div>
                    <div className="text-[11px] text-gray-500">{formatVes(remainingVes)}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{group.sales_count}</td>
                  <td className="px-3 py-2">
                    <GroupStatusBadge fullyReversed={fullyReversed} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const subtitle =
    activeTab === 'grouped'
      ? 'Se muestran los cobros más recientes primero. Un cobro totalmente devuelto no se puede seleccionar.'
      : 'Se muestran los pagos más recientes primero. Los pagos de un mismo cobro comparten fecha, hora y método.';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={customerName ? `Devolver Pago - ${customerName}` : 'Devolver Pago'}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">{subtitle}</p>

          {/* Tab switcher: Grouped (Agrupados) is default on open. */}
          <div
            role="tablist"
            aria-label="Modo de devolución"
            className="flex gap-1 rounded-lg bg-gray-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'grouped'}
              onClick={() => handleTabChange('grouped')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'grouped'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              Agrupados
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'individual'}
              onClick={() => handleTabChange('individual')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'individual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              Individuales
            </button>
          </div>

          <div className="max-h-[45vh] overflow-y-auto">
            {activeTab === 'grouped' ? (
              renderGroupedContent()
            ) : (
              <>
                {isTruncated && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      Este cliente tiene {totalCount} pagos y sólo se muestran los{' '}
                      {payments.length} más recientes. Si el pago que buscás no aparece en la
                      lista, todavía no se puede devolver desde acá.
                    </p>
                  </div>
                )}
                {renderIndividualContent()}
              </>
            )}
          </div>

          {activeTab === 'grouped' && selectedGroup && (
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Cobro seleccionado
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-bold text-gray-900">
                  {formatUsd(groupedRemaining.usd)}
                </span>
                <span className="text-sm font-medium text-gray-500">
                  {formatVes(groupedRemaining.ves)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Monto a devolver sobre {selectedGroup.sales_count} venta
                {selectedGroup.sales_count === 1 ? '' : 's'} afectada
                {selectedGroup.sales_count === 1 ? '' : 's'}.
              </p>
            </div>
          )}

          {activeTab === 'individual' && (
            <>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Total seleccionado ({selectedPayments.length} pago
                  {selectedPayments.length === 1 ? '' : 's'})
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatUsd(totals.usd)}
                  </span>
                  <span className="text-sm font-medium text-gray-500">
                    {formatVes(totals.ves)}
                  </span>
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
            </>
          )}

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
              disabled={!canConfirm || isPending}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? 'Devolviendo...' : actionLabel}
            </button>
          </div>
        </div>
      </Modal>

      {/*
        Rendered as a sibling of the list Modal (not inside it) so the confirmation
        dialog mounts its own Headless UI portal after the list portal and therefore
        paints above it, since both shells are hardcoded to z-50. The confirm
        content is tab-aware: Grouped states the exact remaining refundable amount
        and issues one group-reverse request; Individual keeps the per-row totals.
      */}
      <ActionConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        variant="danger"
        title={confirmTitle}
        description={confirmDescription}
        confirmText={isPending ? 'Devolviendo...' : actionLabel}
        cancelText="Cancelar"
      />
    </>
  );
}
