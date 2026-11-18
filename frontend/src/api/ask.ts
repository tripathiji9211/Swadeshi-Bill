import { apiClient } from './client';
import { AskQuestionResponse } from '@/types';

export async function askExpensesQuestion(question: string): Promise<AskQuestionResponse> {
  const { data } = await apiClient.post<AskQuestionResponse>('/ask', { question });
  return data;
}
