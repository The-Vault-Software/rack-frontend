import { useQuery } from '@tanstack/react-query';
import { v1ExchangeRatesTodayRetrieveOptions } from '../client/@tanstack/react-query.gen';

export function useExchangeRates() {
  const query = useQuery({
    ...v1ExchangeRatesTodayRetrieveOptions(),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
  });

  const rates = query.data as { bcv_rate: string; parallel_rate: string } | undefined;

  return { ...query, rates };
}
