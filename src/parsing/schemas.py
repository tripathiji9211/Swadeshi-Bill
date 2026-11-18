"""
Pydantic Data Schemas for ReceiptRadar
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ReceiptItem(BaseModel):
    description: str = Field(..., description="Item description")
    quantity: float = Field(default=1.0, description="Quantity purchased")
    unit_price: Optional[float] = Field(default=None, description="Price per unit")
    total_price: float = Field(..., description="Total line price")


class ParsedReceipt(BaseModel):
    merchant_name: str = Field(..., description="Vendor or merchant name")
    date: str = Field(..., description="Date formatted as YYYY-MM-DD")
    total_amount: float = Field(..., description="Grand total amount paid")
    tax_amount: float = Field(default=0.0, description="Sales tax amount")
    items: List[ReceiptItem] = Field(default_factory=list, description="Itemized lines")
    payment_method: Optional[str] = Field(default="Credit Card", description="Payment method")
    receipt_number: Optional[str] = Field(default=None, description="Invoice or receipt number")
    raw_text: Optional[str] = Field(default="", description="Raw extracted OCR text")


class AuditRisk(BaseModel):
    is_anomaly: bool = Field(..., description="Anomaly flag")
    anomaly_score: float = Field(..., description="Normalized risk score (0.0 to 1.0)")
    risk_severity: str = Field(..., description="'LOW', 'MEDIUM', or 'HIGH'")
    reasons: List[str] = Field(default_factory=list, description="Audit violation details")
    z_score: Optional[float] = Field(default=0.0, description="Category standard deviations")


class AuditedReceipt(BaseModel):
    parsed: ParsedReceipt
    predicted_category: str
    category_confidence: float
    audit_risk: AuditRisk
    explanation: Optional[Dict[str, Any]] = None


class ExpenseRecord(BaseModel):
    id: str
    date: str
    merchant: str
    amount: float
    category: str
    tax: float = 0.0
    is_anomaly: bool = False
    risk_severity: str = "LOW"
    risk_reasons: List[str] = []
    receipt_text: Optional[str] = None


class AnalyticsSummary(BaseModel):
    total_spend: float
    total_receipts: int
    anomalous_receipts: int
    anomaly_rate_pct: float
    average_transaction: float
    spending_by_category: Dict[str, float]
    top_vendors: List[Dict[str, Any]]


class ForecastDataPoint(BaseModel):
    date: str
    predicted_amount: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    horizon_days: int
    historical_daily_avg: float
    forecast_total_spend: float
    trend_direction: str
    trend_percentage: float
    daily_projections: List[ForecastDataPoint]


class SavingsRecommendation(BaseModel):
    id: str
    title: str
    category: str
    priority: str
    potential_monthly_savings: float
    potential_annual_savings: float
    description: str
    action_steps: List[str]


# =============================================================================
# REST API REQUEST & RESPONSE SCHEMAS
# =============================================================================

class ExpenseItemResponse(BaseModel):
    id: str
    date: str
    vendor: str
    merchant: Optional[str] = None
    item_description: str
    amount: float
    category: str
    payment_mode: Optional[str] = "UPI"
    tax: float = 0.0
    is_anomaly: bool = False
    anomaly_score: float = 0.0
    risk_severity: str = "LOW"
    risk_reasons: List[str] = []
    raw_text: Optional[str] = ""
    receipt_text: Optional[str] = ""
    created_at: Optional[str] = None
    ocr_confidence: Optional[float] = 0.85
    classifier_confidence: Optional[float] = 0.85
    needs_review: bool = False
    review_reason: Optional[str] = ""
    # Additive machine-readable codes for frontend i18n
    category_code: Optional[str] = None
    risk_code: Optional[str] = None
    reason_codes: Optional[List[str]] = None


class UploadReceiptResponse(BaseModel):
    status: str = "success"
    message: str
    expense_id: str
    expense: Dict[str, Any]
    parsed_receipt: Dict[str, Any]
    predicted_category: str
    category_confidence: float
    classifier_confidence: float = 0.85
    ocr_confidence: float = 0.85
    needs_review: bool = False
    review_reason: Optional[str] = ""
    audit_risk: Dict[str, Any]
    ocr_metadata: Optional[Dict[str, Any]] = None
    image_url: Optional[str] = None
    explanation: Optional[Dict[str, Any]] = None
    # Additive machine-readable codes for frontend i18n
    category_code: Optional[str] = None
    risk_code: Optional[str] = None


class UpdateExpenseRequest(BaseModel):
    vendor: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    tax: Optional[float] = None
    category: Optional[str] = None
    payment_mode: Optional[str] = None
    item_description: Optional[str] = None


class SampleReceiptResponse(BaseModel):
    filename: str
    title: str
    expected_category: str
    expected_amount: float
    image_url: str


class DashboardSummaryResponse(BaseModel):
    total_spend: float
    total_receipts: int
    anomalous_receipts: int
    anomaly_rate_pct: float
    average_transaction: float
    average_ocr_confidence: float
    monthly_trend: List[Dict[str, Any]]
    category_breakdown: Dict[str, float]
    top_vendors: List[Dict[str, Any]]
    recent_anomalies: List[Dict[str, Any]]


class CorrectionRequest(BaseModel):
    corrected_category: str
    corrected_vendor: Optional[str] = None
    corrected_description: Optional[str] = None
    notes: Optional[str] = ""


class RetrainFeedbackResponse(BaseModel):
    status: str = "success"
    message: str
    corrections_applied: int
    training_accuracy: float
    total_training_examples: int


class CategoryForecastResponse(BaseModel):
    forecast_month: str
    forecast_date: str
    category_projections: Dict[str, float]
    total_projected_spend: float
    horizon_days: Optional[int] = 30
    methodology: str = "Winning models selected per category (SARIMA, XGBoost, Moving-Average)"
    model_evaluations: Optional[Any] = None


class InsightsResponse(BaseModel):
    total_expenses_audited: int
    total_spend_analyzed: float
    total_potential_annual_savings: float
    price_variance_findings: List[Dict[str, Any]]
    category_spike_findings: List[Dict[str, Any]]
    subscription_findings: List[Dict[str, Any]]
    actionable_tips: List[str]
    executive_report_markdown: str


class AskQuestionRequest(BaseModel):
    question: str = Field(..., min_length=2, description="Natural-language question about business expenses")
    lang: Optional[str] = Field(default="en", description="Target response language (e.g. en, hi, mr, gu, bn, ta, te, kn, ml, pa)")


class AskQuestionResponse(BaseModel):
    question: str
    answer: str
    relevant_metrics: Dict[str, Any]
    sources_cited: List[str] = []


# =============================================================================
# AUTHENTICATION & USER MANAGEMENT SCHEMAS (SWADESHI KHATA)
# =============================================================================

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    business_name: str = Field(..., min_length=2, max_length=128)
    business_type: str = Field(default="kirana", max_length=64)
    state: str = Field(default="Delhi", max_length=64)
    mobile: str = Field(..., min_length=10, max_length=20)
    email: str = Field(..., min_length=5, max_length=128)
    password: str = Field(..., min_length=6, max_length=128)
    gstin: Optional[str] = Field(default=None, max_length=32)


class LoginRequest(BaseModel):
    login: str = Field(..., description="Email or mobile number")
    password: str = Field(..., min_length=1)
    remember_me: bool = Field(default=True)


class OtpRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=20)


class OtpVerifyRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=20)
    otp_code: str = Field(..., min_length=4, max_length=10)


class UserProfileResponse(BaseModel):
    id: str
    name: str
    business_name: str
    business_type: str
    state: str
    mobile: str
    email: str
    gstin: Optional[str] = None
    created_at: Optional[str] = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]



