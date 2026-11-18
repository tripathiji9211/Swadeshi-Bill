import { useQuery } from '@tanstack/react-query';
import { getSpendForecast } from '@/api/forecast';

export function useForecast() {
  return useQuery({
    queryKey: ['forecast'],
    queryFn: getSpendForecast,
  });
}
