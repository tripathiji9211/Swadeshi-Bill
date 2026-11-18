"""
Data Models and Pydantic Schemas for ReceiptRadar
Provides strong typing and validation across OCR, LLM, ML, and API layers.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ReceiptItem(BaseModel):
    """Represents an individual line item on a parsed receipt."""
    description: str = Field(..., description="Name or description of the purchased item")
    quantity: float = Field(default=1.0, description="Quantity purchased")
    unit_price: Optional[float] = Field(default=None, description="Price per unit")
    total_price: float = Field(..., description="Total line price")


class ParsedReceipt(BaseModel):
    """Structured data extracted from receipt image/text via LLM parser."""
    merchant_name: str = Field(..., description="Name of the vendor or store")
    date: str = Field(..., description="Purchase date in YYYY-MM-DD format")
    total_amount: float = Field(..., description="Grand total amount paid")
    tax_amount: float = Field(default=0.0, description="Sales tax amount")
    items: List[ReceiptItem] = Field(default_factory=list, description="Extracted line items")
    payment_method: Optional[str] = Field(default="Credit Card", description="Payment method used")
    receipt_number: Optional[str] = Field(default=None, description="Invoice or receipt reference number")
    raw_text: Optional[str] = Field(default="", description="Raw OCR text extracted from the document")


class AuditRisk(BaseModel):
    """Anomaly detection and compliance audit findings."""
    is_anomaly: bool = Field(..., description="Flag indicating if the transaction is suspicious")
    anomaly_score: float = Field(..., description="Normalized risk score from 0.0 (safe) to 1.0 (high risk)")
    risk_severity: str = Field(..., description="'LOW', 'MEDIUM', or 'HIGH'")
    reasons: List[str] = Field(default_factory=list, description="Explanations of detected anomalies or flags")
    z_score: Optional[float] = Field(default=0.0, description="Standard deviations from category mean")


class AuditedReceipt(BaseModel):
    """Complete audited receipt response combining OCR, LLM, Classification, and Anomaly Detection."""
    parsed: ParsedReceipt
    predicted_category: str = Field(..., description="ML-predicted expense category")
    category_confidence: float = Field(..., description="Classifier confidence probability (0.0 to 1.0)")
    audit_risk: AuditRisk


class ExpenseRecord(BaseModel):
    """Internal historical expense record stored in the database/CSV."""
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
    """Executive KPI summary for the business dashboard."""
    total_spend: float
    total_receipts: int
    anomalous_receipts: int
    anomaly_rate_pct: float
    average_transaction: float
    spending_by_category: Dict[str, float]
    top_vendors: List[Dict[str, Any]]


class ForecastDataPoint(BaseModel):
    """Single time-series forecast projection point."""
    date: str
    predicted_amount: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    """Spending projection response for upcoming days."""
    horizon_days: int
    historical_daily_avg: float
    forecast_total_spend: float
    trend_direction: str  # 'Increasing', 'Stable', 'Decreasing'
    trend_percentage: float
    daily_projections: List[ForecastDataPoint]


class SavingsRecommendation(BaseModel):
    """AI cost-saving and optimization recommendation."""
    id: str
    title: str
    category: str
    priority: str  # 'High', 'Medium', 'Low'
    potential_monthly_savings: float
    potential_annual_savings: float
    description: str
    action_steps: List[str]

