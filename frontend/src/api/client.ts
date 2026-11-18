import axios, { AxiosError } from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  UploadReceiptResponse,
  ExpenseItemResponse,
  ExpenseQueryParams,
  CategoryForecastResponse,
  InsightsResponse,
  AskQuestionRequest,
  AskQuestionResponse,
  BackendStatusResponse,
  DashboardSummaryResponse,
  SampleReceiptResponse,
  UpdateExpenseRequest,
  CorrectionRequest,
  RetrainFeedbackResponse,
  AskSuggestionsResponse,
  UserProfile,
  AuthResponse,
  SignupPayload,
  LoginPayload,
} from '@/types';

// ============================================================================
// 1. AXIOS CLIENT INSTANCE & ERROR INTERCEPTOR
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('swadeshi_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    const status = error.response?.status;
    if (status === 401 && typeof window !== 'undefined') {
      // Clear token on 401 if not already on auth page
      if (!window.location.pathname.startsWith('/auth')) {
        localStorage.removeItem('swadeshi_token');
      }
    }

    const errorData = error.response?.data;
    const detailMsg =
      errorData?.detail ||
      errorData?.message ||
      (typeof errorData === 'string' ? errorData : null) ||
      error.message ||
      'An unexpected network error occurred while communicating with Swadeshi Khata API.';
    return Promise.reject(new Error(detailMsg));
  }
);

// ============================================================================
// 2. TYPED API ENDPOINT FUNCTIONS
// ============================================================================

/**
 * POST /upload-receipt
 * Uploads a receipt image (or PDF) for full OCR text extraction, LLM parsing,
 * ML category classification, and anomaly auditing.
 */
export async function uploadReceipt(file: File | FormData): Promise<UploadReceiptResponse> {
  const formData = file instanceof FormData ? file : new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  }

  const { data } = await apiClient.post<UploadReceiptResponse>('/upload-receipt', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000,
  });
  return data;
}

/**
 * GET /expenses
 * Queries historical and newly audited expense records from SQLite with
 * dynamic category, vendor, search, date range, and pagination parameters.
 */
export async function getExpenses(params: ExpenseQueryParams = {}): Promise<ExpenseItemResponse[]> {
  const { data } = await apiClient.get<ExpenseItemResponse[]>('/expenses', { params });
  return data;
}

/**
 * GET /expenses/{id}
 * Retrieves a single expense record by ID.
 */
export async function getExpenseById(id: string): Promise<ExpenseItemResponse> {
  const { data } = await apiClient.get<ExpenseItemResponse>(`/expenses/${id}`);
  return data;
}

/**
 * PUT /expenses/{id}
 * Updates editable fields (vendor, amount, tax, category, payment_mode, item_description)
 * during Step 2 of the receipt review workflow.
 */
export async function updateExpense(
  id: string,
  payload: UpdateExpenseRequest
): Promise<ExpenseItemResponse> {
  const { data } = await apiClient.put<ExpenseItemResponse>(`/expenses/${id}`, payload);
  return data;
}

/**
 * DELETE /expenses/{id}
 * Deletes an expense record from the SQLite database.
 */
export async function deleteExpense(id: string): Promise<{ status: string; message: string }> {
  const { data } = await apiClient.delete<{ status: string; message: string }>(`/expenses/${id}`);
  return data;
}

/**
 * GET /dashboard/summary
 * Returns server-side pre-aggregated KPI cards, monthly spending trend,
 * category distributions, top vendors, and recent anomalies.
 */
export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await apiClient.get<DashboardSummaryResponse>('/dashboard/summary');
  return data;
}

/**
 * GET /forecast
 * Forecasts next month's business spend across all 8 spending categories
 * comparing SARIMA, XGBoost with lag features, and Moving Average models.
 */
export async function getForecast(): Promise<CategoryForecastResponse> {
  const { data } = await apiClient.get<CategoryForecastResponse>('/forecast');
  return data;
}

/**
 * GET /insights
 * Generates automated financial intelligence findings: price variance across
 * vendors, budget spikes exceeding >25%, and recurring subscriptions.
 */
export async function getInsights(): Promise<InsightsResponse> {
  const { data } = await apiClient.get<InsightsResponse>('/insights');
  return data;
}

/**
 * POST /ask
 * Answers natural-language financial questions using live SQLite database
 * metrics and Google Gemini (with an intelligent factual offline fallback).
 */
export async function askQuestion(
  payload: string | AskQuestionRequest
): Promise<AskQuestionResponse> {
  const requestBody = typeof payload === 'string' ? { question: payload } : payload;
  const { data } = await apiClient.post<AskQuestionResponse>('/ask', requestBody);
  return data;
}

/**
 * GET /ask/suggestions
 * Returns curated prompt suggestion chips for quick one-click querying.
 */
export async function getAskSuggestions(): Promise<AskSuggestionsResponse> {
  const { data } = await apiClient.get<AskSuggestionsResponse>('/ask/suggestions');
  return data;
}

/**
 * GET /sample-receipts
 * Lists pre-configured demo invoices for one-click testing without image uploads.
 */
export async function getSampleReceipts(): Promise<SampleReceiptResponse[]> {
  const { data } = await apiClient.get<SampleReceiptResponse[]>('/sample-receipts');
  return data;
}

/**
 * GET /review-queue
 * Retrieves low-confidence or ambiguous receipts routed to the human review queue.
 */
export async function getReviewQueue(limit = 50): Promise<ExpenseItemResponse[]> {
  const { data } = await apiClient.get<ExpenseItemResponse[]>('/review-queue', {
    params: { limit },
  });
  return data;
}

/**
 * POST /review-queue/{id}/correct
 * Submits verified human corrections for an ambiguous or misclassified receipt.
 */
export async function correctExpense(
  id: string,
  payload: CorrectionRequest
): Promise<{
  status: string;
  message: string;
  expense: ExpenseItemResponse;
  feedback_record: any;
}> {
  const { data } = await apiClient.post(`/review-queue/${id}/correct`, payload);
  return data;
}

/**
 * POST /retrain-feedback
 * Retrains the ML classifier on historical expenses + verified human corrections.
 */
export async function retrainFeedback(): Promise<RetrainFeedbackResponse> {
  const { data } = await apiClient.post<RetrainFeedbackResponse>('/retrain-feedback');
  return data;
}

/**
 * POST /review-queue/simulate
 * Injects a realistic borderline-confidence receipt into the review queue for UI testing.
 */
export async function simulateReviewItem(): Promise<ExpenseItemResponse> {
  const { data } = await apiClient.post<ExpenseItemResponse>('/review-queue/simulate');
  return data;
}

/**
 * GET /feedback-corrections
 * Retrieves recorded human feedback corrections from data/human_feedback_corrections.csv.
 */
export async function getFeedbackCorrections(): Promise<Record<string, any>[]> {
  const { data } = await apiClient.get<Record<string, any>[]>('/feedback-corrections');
  return data;
}

/**
 * GET /health
 * Pings the FastAPI backend health and status check.
 */
export async function getBackendHealth(): Promise<BackendStatusResponse> {
  const { data } = await apiClient.get<BackendStatusResponse>('/health');
  return data;
}

// ============================================================================
// 3. TANSTACK QUERY HOOKS
// ============================================================================

/**
 * Hook for POST /upload-receipt mutation.
 * Automatically invalidates 'expenses', 'dashboard-summary', and 'review-queue' queries.
 */
export function useUploadReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File | FormData) => uploadReceipt(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });
}

/**
 * Hook for GET /expenses query with dynamic filters.
 */
export function useExpenses(params: ExpenseQueryParams = {}) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => getExpenses(params),
  });
}

/**
 * Hook for GET /expenses/{id} query.
 */
export function useExpense(id: string) {
  return useQuery({
    queryKey: ['expense', id],
    queryFn: () => getExpenseById(id),
    enabled: Boolean(id),
  });
}

/**
 * Hook for PUT /expenses/{id} mutation.
 */
export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateExpenseRequest }) =>
      updateExpense(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

/**
 * Hook for DELETE /expenses/{id} mutation.
 */
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

/**
 * Hook for GET /dashboard/summary query.
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  });
}

/**
 * Hook for GET /forecast query.
 */
export function useForecast() {
  return useQuery({
    queryKey: ['forecast'],
    queryFn: getForecast,
  });
}

/**
 * Hook for GET /insights query.
 */
export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: getInsights,
  });
}

/**
 * Hook for POST /ask mutation.
 */
export function useAsk() {
  return useMutation({
    mutationFn: (payload: string | AskQuestionRequest) => askQuestion(payload),
  });
}

/**
 * Hook for GET /ask/suggestions query.
 */
export function useAskSuggestions() {
  return useQuery({
    queryKey: ['ask-suggestions'],
    queryFn: getAskSuggestions,
  });
}

/**
 * Hook for GET /sample-receipts query.
 */
export function useSampleReceipts() {
  return useQuery({
    queryKey: ['sample-receipts'],
    queryFn: getSampleReceipts,
  });
}

/**
 * Hook for GET /review-queue query.
 */
export function useReviewQueue(limit = 50) {
  return useQuery({
    queryKey: ['review-queue', limit],
    queryFn: () => getReviewQueue(limit),
  });
}

/**
 * Hook for POST /review-queue/{id}/correct mutation.
 */
export function useCorrectExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CorrectionRequest }) =>
      correctExpense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

/**
 * Hook for POST /retrain-feedback mutation.
 */
export function useRetrainFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retrainFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

/**
 * Hook for POST /review-queue/simulate mutation.
 */
export function useSimulateReviewQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: simulateReviewItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });
}

/**
 * Hook for GET /feedback-corrections query.
 */
export function useFeedbackCorrections() {
  return useQuery({
    queryKey: ['feedback-corrections'],
    queryFn: getFeedbackCorrections,
    staleTime: 30000,
  });
}

/**
 * useBackendStatus Hook
 * Pings the FastAPI backend `/health` endpoint every 30 seconds.
 * Returns { isOnline, status, data, isLoading, isError, error, refetch }.
 */
export function useBackendStatus() {
  const query = useQuery({
    queryKey: ['backend-status'],
    queryFn: getBackendHealth,
    refetchInterval: 30000, // 30 seconds polling interval
    refetchIntervalInBackground: false,
    retry: 1,
    staleTime: 25000,
  });

  const isOnline = query.isSuccess && !query.isError;

  return {
    ...query,
    isOnline,
    status: isOnline ? ('online' as const) : ('offline' as const),
  };
}

// ============================================================================
// 4. AUTHENTICATION & USER PROFILE ENDPOINTS
// ============================================================================

export async function authSignup(data: SignupPayload): Promise<AuthResponse> {
  const resp = await apiClient.post<AuthResponse>('/auth/signup', data);
  if (resp.data.access_token && typeof window !== 'undefined') {
    localStorage.setItem('swadeshi_token', resp.data.access_token);
  }
  return resp.data;
}

export async function authLogin(data: LoginPayload): Promise<AuthResponse> {
  const resp = await apiClient.post<AuthResponse>('/auth/login', data);
  if (resp.data.access_token && typeof window !== 'undefined') {
    localStorage.setItem('swadeshi_token', resp.data.access_token);
  }
  return resp.data;
}

export async function authRequestOtp(mobile: string): Promise<{ status: string; message: string; dev_otp?: string }> {
  const resp = await apiClient.post<{ status: string; message: string; dev_otp?: string }>('/auth/otp/request', {
    mobile,
  });
  return resp.data;
}

export async function authVerifyOtp(mobile: string, otp_code: string): Promise<AuthResponse> {
  const resp = await apiClient.post<AuthResponse>('/auth/otp/verify', {
    mobile,
    otp_code,
  });
  if (resp.data.access_token && typeof window !== 'undefined') {
    localStorage.setItem('swadeshi_token', resp.data.access_token);
  }
  return resp.data;
}

export async function authLogout(): Promise<{ status: string; message: string }> {
  try {
    const resp = await apiClient.post<{ status: string; message: string }>('/auth/logout');
    return resp.data;
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('swadeshi_token');
    }
  }
}

export async function authGetProfile(): Promise<UserProfile> {
  const resp = await apiClient.get<UserProfile>('/auth/me');
  return resp.data;
}

export function useUserProfile() {
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: authGetProfile,
    staleTime: 60000,
    retry: false,
  });
}

