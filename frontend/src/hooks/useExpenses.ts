import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getExpenses,
  getReviewQueue,
  submitExpenseCorrection,
  triggerRetrainFeedback,
  checkBackendHealth,
  ExpenseQueryParams,
} from '@/api/expenses';
import { CorrectionPayload } from '@/types';

export function useExpenses(params: ExpenseQueryParams = {}) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => getExpenses(params),
  });
}

export function useReviewQueue() {
  return useQuery({
    queryKey: ['review-queue'],
    queryFn: getReviewQueue,
  });
}

import { useBackendStatus } from '@/api/client';
export { useBackendStatus };

export function useBackendHealth() {
  const queryClient = useBackendStatus();
  return queryClient;
}

export function useCorrectExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CorrectionPayload }) =>
      submitExpenseCorrection(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useRetrainFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerRetrainFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
