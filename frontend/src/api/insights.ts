import { apiClient } from './client';
import { InsightsResponse } from '@/types';

export async function getExpenseInsights(): Promise<InsightsResponse> {
  const { data } = await apiClient.get<InsightsResponse>('/insights');
  return data;
}
