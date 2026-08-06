import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  v1CustomersRetrieveQueryKey,
  v1SalePaymentsReverseCreateMutation,
  v1SalesPaymentsListQueryKey,
  v1SalesRetrieveQueryKey,
} from '../../../client/@tanstack/react-query.gen';

/**
 * Pulls a DRF `detail` message out of an unknown error payload.
 * The message can live either on the error itself or on `error.body`,
 * depending on how the transport surfaced the response.
 */
export function extractErrorDetail(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const candidates: unknown[] = [error, (error as { body?: unknown }).body];

  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const detail = (candidate as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim().length > 0) return detail;
  }

  return undefined;
}

interface UseReversePaymentsOptions {
  onSuccess?: () => void;
}

/**
 * Owns the payment reversal mutation and the full cache invalidation set.
 *
 * No optimistic update on purpose: the payments list and the sale totals come
 * from different queries, so optimistically removing a payment would render a
 * list that contradicts the totals until the refetch lands.
 */
export function useReversePayments(
  customerId: string | undefined,
  opts?: UseReversePaymentsOptions,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...v1SalePaymentsReverseCreateMutation(),
    onSuccess: (data) => {
      // Broad key form: matches both the flat and the infinite sales queries.
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1SalesList' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1CustomerSalePaymentsList' }] });

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

      toast.success('Pago devuelto correctamente');
      opts?.onSuccess?.();
    },
    onError: (error) => {
      toast.error(extractErrorDetail(error) ?? 'Error al devolver el pago');
    },
  });

  return mutation;
}
