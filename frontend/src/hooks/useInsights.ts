import { useQuery } from '@tanstack/react-query';
import { getExpenseInsights } from '@/api/insights';

export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: getExpenseInsights,
  });
}
