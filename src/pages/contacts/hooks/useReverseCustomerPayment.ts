import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  v1CustomerPaymentsReverseCreateMutation,
  v1CustomersRetrieveQueryKey,
  v1SalesPaymentsListQueryKey,
  v1SalesRetrieveQueryKey,
} from '../../../client/@tanstack/react-query.gen';
import { extractErrorDetail } from './useReversePayments';

interface UseReverseCustomerPaymentOptions {
  onSuccess?: () => void;
}

/**
 * Owns the group-reversal mutation and the full cache invalidation set.
 *
 * Mirrors `useReversePayments` but targets `POST /v1/customer-payments/<id>/reverse/`:
 * one atomic call reverses every still-active child of a `CustomerPayment` group.
 *
 * No optimistic update on purpose — same reason as `useReversePayments`: the group
 * list, the flat per-sale-payment list, and the sale totals come from different
 * queries, so optimistically mutating one would contradict the others until the
 * refetch lands. The backend `detail` message is surfaced via the shared
 * `extractErrorDetail` helper so both reversal paths report errors identically.
 */
export function useReverseCustomerPayment(
  customerId: string | undefined,
  opts?: UseReverseCustomerPaymentOptions,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...v1CustomerPaymentsReverseCreateMutation(),
    onSuccess: (data) => {
      // The grouped-cobros list, the flat sale-payments list, and the sales
      // list all move when a group is reversed. Broad key form matches the
      // generated query keys (partial match on `_id`).
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1CustomerPaymentsList' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1CustomerSalePaymentsList' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1SalesList' }] });

      // Per-sale retrieve + payments refetch for every sale the group touched,
      // reported by the 201 `affected_sales` (same shape as the legacy path).
      data.affected_sales.forEach(({ sale_id }) => {
        queryClient.invalidateQueries({
          queryKey: v1SalesRetrieveQueryKey({ path: { id: sale_id } }),
        });
        queryClient.invalidateQueries({
          queryKey: v1SalesPaymentsListQueryKey({ path: { sale_id } }),
        });
      });

      if (customerId) {
        queryClient.invalidateQueries({
          queryKey: v1CustomersRetrieveQueryKey({ path: { id: customerId } }),
        });
      }

      toast.success('Cobro devuelto correctamente');
      opts?.onSuccess?.();
    },
    onError: (error) => {
      toast.error(extractErrorDetail(error) ?? 'Error al devolver el cobro');
    },
  });

  return mutation;
}
