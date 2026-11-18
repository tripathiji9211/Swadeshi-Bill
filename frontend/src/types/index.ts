/**
 * ReceiptRadar - Frontend TypeScript Type Definitions
 * Directly matching backend Pydantic models from src/parsing/schemas.py,
 * src/models/insights.py, and src/api/main.py.
 */

// ============================================================================
// 1. RECEIPT PARSING & OCR SCHEMAS
// ============================================================================

export interface UserProfile {
  id: string;
  name: string;
  business_name: string;
  business_type: string;
  state: string;
  mobile: string;
  email: string;
  gstin?: string | null;
  created_at?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
}

export interface SignupPayload {
  name: string;
  business_name: string;
  business_type: string;
  state: string;
  mobile: string;
  email: string;
  password: string;
  gstin?: string;
}

export interface LoginPayload {
  login: string;
  password: string;
  remember_me?: boolean;
}

export interface ReceiptItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price: number;
  // Aliases for compatibility
  name?: string;
  price?: number;
}

export interface ParsedReceipt {
  merchant_name: string;
  date: string;
  total_amount: number;
  tax_amount: number;
  items: ReceiptItem[];
  payment_method?: string;
  receipt_number?: string;
  raw_text?: string;
  // UI & alternate field convenience aliases
  vendor?: string;
  total?: number;
  tax?: number;
  currency?: string;
  line_items?: ReceiptItem[];
}

export interface AuditRisk {
  is_anomaly: boolean;
  anomaly_score: number;
  risk_severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  reasons: string[];
  z_score?: number;
}

// ============================================================================
// 2. EXPENSE RECORD SCHEMAS
// ============================================================================

export interface ExpenseItemResponse {
  id: string;
  date: string;
  vendor: string;
  merchant?: string;
  item_description: string;
  amount: number;
  category: string;
  payment_mode?: string;
  tax: number;
  is_anomaly: boolean;
  anomaly_score?: number;
  risk_severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  risk_reasons: string[] | string;
  raw_text?: string;
  receipt_text?: string;
  created_at?: string;
  ocr_confidence?: number;
  classifier_confidence?: number;
  needs_review: boolean;
  review_reason?: string;
}

// Alias for ExpenseItemResponse
export type ExpenseRecord = ExpenseItemResponse;

export interface UpdateExpenseRequest {
  vendor?: string;
  date?: string;
  amount?: number;
  tax?: number;
  category?: string;
  payment_mode?: string;
  item_description?: string;
}

export interface ExpenseQueryParams {
  category?: string;
  vendor?: string;
  search?: string;
  only_anomalies?: boolean;
  is_anomaly?: boolean;
  needs_review?: boolean;
  min_amount?: number;
  max_amount?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  skip?: number;
}

// ============================================================================
// 3. AUDIT & UPLOAD SCHEMAS
// ============================================================================

export interface UploadReceiptResponse {
  status: string;
  message: string;
  expense_id: string;
  expense: ExpenseItemResponse;
  parsed_receipt: ParsedReceipt;
  predicted_category: string;
  category_confidence: number;
  classifier_confidence: number;
  ocr_confidence: number;
  needs_review: boolean;
  review_reason?: string;
  audit_risk: AuditRisk;
  ocr_metadata?: Record<string, any>;
  image_url?: string;
  explanation?: Record<string, any>;
}

// Alias for UploadReceiptResponse
export type AuditedReceipt = UploadReceiptResponse;

export interface SampleReceiptResponse {
  filename: string;
  title: string;
  expected_category: string;
  expected_amount: number;
  image_url: string;
}

// ============================================================================
// 4. DASHBOARD SUMMARY SCHEMAS
// ============================================================================

export interface MonthlyTrendItem {
  month: string;
  amount: number;
  count: number;
}

export interface TopVendorItem {
  vendor: string;
  total: number;
  count: number;
  // Compatibility alias
  name?: string;
}

export interface DashboardSummaryResponse {
  total_spend: number;
  total_receipts: number;
  anomalous_receipts: number;
  anomaly_rate_pct: number;
  average_transaction: number;
  average_ocr_confidence: number;
  monthly_trend: MonthlyTrendItem[];
  category_breakdown: Record<string, number>;
  top_vendors: TopVendorItem[];
  recent_anomalies: ExpenseItemResponse[];
}

export type AnalyticsSummary = DashboardSummaryResponse;

// ============================================================================
// 5. HUMAN-IN-THE-LOOP & RETRAINING SCHEMAS
// ============================================================================

export interface CorrectionRequest {
  corrected_category: string;
  corrected_vendor?: string;
  corrected_description?: string;
  notes?: string;
}

export type CorrectionPayload = CorrectionRequest;

export interface RetrainFeedbackResponse {
  status: string;
  message: string;
  corrections_applied: number;
  training_accuracy: number;
  total_training_examples: number;
  // Compatibility alias
  records_trained_on?: number;
  model_timestamp?: string;
}

export type RetrainResponse = RetrainFeedbackResponse;

export interface FeedbackCorrectionRecord {
  timestamp: string;
  expense_id: string;
  vendor: string;
  item_description: string;
  old_category: string;
  corrected_category: string;
  ocr_confidence: number;
  classifier_confidence: number;
  notes: string;
  applied_in_training: boolean;
}

// ============================================================================
// 6. FORECASTING SCHEMAS
// ============================================================================

export interface ModelEvaluation {
  winning_model: string;
  rmse: number;
  mae: number;
}

export interface CategoryForecastResponse {
  forecast_month: string;
  forecast_date: string;
  category_projections: Record<string, number>;
  total_projected_spend: number;
  horizon_days?: number;
  methodology: string;
  model_evaluations?: Record<string, ModelEvaluation>;
  // UI compatibility aliases
  status?: string;
  model_evaluation?: Record<string, ModelEvaluation>;
  projections?: Record<string, number>;
  forecast_target_month?: string;
}

export type ForecastResponse = CategoryForecastResponse;

export interface ForecastDataPoint {
  date: string;
  predicted_amount: number;
  lower_bound: number;
  upper_bound: number;
}

// ============================================================================
// 7. FINANCIAL INSIGHTS & SAVINGS SCHEMAS
// ============================================================================

export interface PriceVarianceFinding {
  item_description: string;
  category: string;
  cheapest_vendor: string;
  cheapest_price: number;
  expensive_vendor: string;
  expensive_price: number;
  price_spread_pct: number;
  orders_count: number;
  potential_savings_per_order: number;
  estimated_annual_savings: number;
  recommendation: string;
  // UI compatibility aliases
  vendor?: string;
  average_price?: number;
  benchmark_price?: number;
  variance_pct?: number;
}

export type PriceVariance = PriceVarianceFinding;

export interface CategoryBudgetSpikeFinding {
  category: string;
  month: string;
  actual_spend: number;
  rolling_3m_average: number;
  spike_percentage: number;
  excess_spend: number;
  severity: string;
  likely_driver: string;
  // UI compatibility aliases
  prior_month_spend?: number;
  current_month_spend?: number;
  increase_pct?: number;
}

export type BudgetSpike = CategoryBudgetSpikeFinding;

export interface SubscriptionFinding {
  service_name: string;
  vendor: string;
  category: string;
  billing_cadence: string;
  avg_billing_amount: number;
  annual_spend: number;
  transaction_count: number;
  optimization_action: string;
  // UI compatibility aliases
  cadence?: string;
  recurring_amount?: number;
}

export type SubscriptionItem = SubscriptionFinding;

export interface ActionableTip {
  title: string;
  category: string;
  potential_savings: number;
  description: string;
  action_plan?: string;
}

export interface InsightsResponse {
  total_expenses_audited: number;
  total_spend_analyzed: number;
  total_potential_annual_savings: number;
  price_variance_findings: PriceVarianceFinding[];
  category_spike_findings: CategoryBudgetSpikeFinding[];
  subscription_findings: SubscriptionFinding[];
  actionable_tips: (string | ActionableTip)[];
  executive_report_markdown: string;
  // UI compatibility aliases
  vendor_price_variances?: PriceVarianceFinding[];
  budget_spikes?: CategoryBudgetSpikeFinding[];
  active_subscriptions?: SubscriptionFinding[];
  executive_summary?: string;
}

// ============================================================================
// 8. NATURAL LANGUAGE AI COPILOT (ASK) SCHEMAS
// ============================================================================

export interface AskQuestionRequest {
  question: string;
}

export interface AskQuestionResponse {
  question: string;
  answer: string;
  relevant_metrics: Record<string, any>;
  sources_cited?: string[];
  // UI compatibility aliases
  query?: string;
  timestamp?: string;
}

export interface AskSuggestionsResponse {
  suggestions: string[];
}

// ============================================================================
// 9. SYSTEM HEALTH & UI UTILITIES
// ============================================================================

export interface BackendStatusResponse {
  status: string;
  version?: string;
  timestamp?: string;
}

export type HealthResponse = BackendStatusResponse;

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rateToInr: number;
}
