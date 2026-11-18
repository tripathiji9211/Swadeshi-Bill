from src.models.classifier import CategoryClassifier
from src.models.anomaly import ExpenseAnomalyDetector
from src.models.forecaster import SpendingForecaster
from src.models.forecast import CategorySpendForecaster
from src.models.insights import ExpenseInsightsAnalyzer

def test_category_classifier():
    clf = CategoryClassifier()
    cat, conf, probs = clf.predict("Gupta Ji Stationery", "Printer paper packing tape")
    assert cat in ["supplies", "Office Supplies & Software"]
    assert conf > 0.0

def test_anomaly_detector_safe():
    ano = ExpenseAnomalyDetector()
    risk = ano.audit_transaction(
        amount=450.00,
        category="supplies",
        merchant="Gupta Ji Stationery",
        txn_date_str="2025-06-04 10:00:00",
    )
    assert risk.risk_severity in ["LOW", "MEDIUM"]
    assert risk.anomaly_score < 0.70

def test_anomaly_detector_high_risk():
    ano = ExpenseAnomalyDetector()
    risk = ano.audit_transaction(
        amount=65000.00,  # 50x spike for tea
        category="groceries",
        merchant="Chai Point & Snacks",
        txn_date_str="2025-08-08 02:45:00",  # Midnight off-hour
    )
    assert risk.is_anomaly == True
    assert risk.risk_severity in ["MEDIUM", "HIGH"]
    assert len(risk.reasons) >= 1

def test_spending_forecaster():
    forecaster = SpendingForecaster()
    fc = forecaster.forecast_next_30_days(horizon_days=14)
    assert len(fc.daily_projections) == 14
    assert fc.forecast_total_spend > 0

def test_category_spend_forecaster():
    forecaster = CategorySpendForecaster()
    next_m = forecaster.forecast_next_month()
    assert "category_projections" in next_m
    assert len(next_m["category_projections"]) == 8
    assert next_m["total_projected_spend"] > 0.0
    for cat in ["groceries", "rent", "salaries", "utilities"]:
        assert cat in next_m["category_projections"]
        assert next_m["category_projections"][cat] > 0.0

def test_expense_insights_analyzer():
    analyzer = ExpenseInsightsAnalyzer()
    insights = analyzer.generate_structured_insights()
    assert insights.total_expenses_audited > 0
    assert len(insights.price_variance_findings) >= 1
    assert len(insights.category_spike_findings) >= 1
    assert len(insights.subscription_findings) >= 1
    assert len(insights.actionable_tips) == 3
    assert insights.executive_plain_language_report is not None
