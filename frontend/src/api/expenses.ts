import { apiClient } from './client';
import { ExpenseRecord, CorrectionPayload, RetrainResponse } from '@/types';

export interface ExpenseQueryParams {
  category?: string;
  vendor?: string;
  is_anomaly?: boolean;
  needs_review?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
  skip?: number;
}

export async function getExpenses(params: ExpenseQueryParams = {}): Promise<ExpenseRecord[]> {
  const { data } = await apiClient.get<ExpenseRecord[]>('/expenses', { params });
  return data;
}

export async function getExpenseById(id: string): Promise<ExpenseRecord> {
  const { data } = await apiClient.get<ExpenseRecord>(`/expenses/${id}`);
  return data;
}

export async function getReviewQueue(): Promise<ExpenseRecord[]> {
  const { data } = await apiClient.get<ExpenseRecord[]>('/review-queue');
  return data;
}

export async function submitExpenseCorrection(
  id: string,
  payload: CorrectionPayload
): Promise<{ status: string; message: string; expense: ExpenseRecord }> {
  const { data } = await apiClient.post(`/review-queue/${id}/correct`, payload);
  return data;
}

export async function triggerRetrainFeedback(): Promise<RetrainResponse> {
  const { data } = await apiClient.post<RetrainResponse>('/retrain-feedback');
  return data;
}

export async function checkBackendHealth(): Promise<{ status: string; timestamp: string }> {
  const { data } = await apiClient.get('/health');
  return data;
}
