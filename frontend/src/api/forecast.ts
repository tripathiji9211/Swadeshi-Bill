import { apiClient } from './client';
import { ForecastResponse } from '@/types';

export async function getSpendForecast(): Promise<ForecastResponse> {
  const { data } = await apiClient.get<ForecastResponse>('/forecast');
  return data;
}
