"""
ReceiptRadar - Expense Category Classifier Pytest Suite
======================================================
Tests the trained multi-class expense category classifier:
- Baseline prediction and confidence bounds
- Coverage across all 8 categories
- Robustness against noisy Hinglish, typos, and short tokens
- Calibrated probability distributions
"""

import pytest
from src.models.classifier import CategoryClassifier


@pytest.fixture(scope="module")
def classifier():
    """Initializes CategoryClassifier singleton for test module."""
    return CategoryClassifier()


def test_classifier_initialization(classifier):
    """Verify model is loaded and ready for inference."""
    assert classifier.model is not None
    assert hasattr(classifier.model, "predict_proba")
    assert len(classifier.model.classes_) == 8


@pytest.mark.parametrize(
    "vendor,description,expected_category",
    [
        ("Aggarwal Sweets & Namkeen", "Chai Patti sugar and biscuits refreshments", "groceries"),
        ("Tata Power DDL", "Commercial electricity bill for godown unit", "utilities"),
        ("DLF Commercial Leasing", "Monthly office rent payment godown", "rent"),
        ("Uber India", "Ola cab auto tempo fare for deliveries", "transport"),
        ("Staff Salary Payout", "Accountant monthly salary and overtime bonus", "salaries"),
        ("Gupta Ji Stationery", "JK Copier A4 paper ream printer toner", "supplies"),
        ("Meta Ads India", "Facebook and Google search advertising campaign", "marketing"),
        ("Local Mistri & Plumbing", "Office washroom tap repair and maintenance", "misc"),
    ],
)
def test_all_eight_categories_prediction(classifier, vendor, description, expected_category):
    """Ensure high accuracy across all 8 core business expense categories."""
    pred_cat, conf, probs = classifier.predict(description, vendor=vendor)
    assert pred_cat == expected_category
    assert conf >= 0.20
    assert isinstance(probs, dict)
    assert len(probs) == 8


def test_probability_distribution_properties(classifier):
    """Validate that posterior probabilities sum to 1.0 within floating point tolerance."""
    _, conf, probs = classifier.predict("Printer cartridge ink", vendor="Amazon")
    total_prob = sum(probs.values())
    assert pytest.approx(total_prob, rel=1e-2) == 1.0
    assert 0.0 <= conf <= 1.0


def test_hinglish_robustness(classifier):
    """Check resilience to common Hinglish / colloquial expressions."""
    # Transpot / freight charges
    cat1, _, _ = classifier.predict("porter tempo bhada maal loading", vendor="Local Tempo")
    assert cat1 == "transport"

    # Grocery snacks
    cat2, _, _ = classifier.predict("chai patti chini samosa nashta staff", vendor="Chai Stall")
    assert cat2 == "groceries"

    # Bijli bill
    cat3, _, _ = classifier.predict("bijli karcha metre reading payment", vendor="Electricity Board")
    assert cat3 == "utilities"


def test_devanagari_hindi_classification(classifier):
    """Verify end-to-end transliteration and classification of Devanagari Hindi text."""
    # Groceries (सब्जी मंडी)
    cat_groc, conf1, _ = classifier.predict("सब्जी मंडी से ताजा आलू प्याज टमाटर", vendor="शर्मा सब्जी भंडार")
    assert cat_groc == "groceries"
    assert conf1 > 0.30

    # Rent (गोदाम भाड़ा दुकान किराया)
    cat_rent, conf2, _ = classifier.predict("दुकान का किराया और गोदाम भाड़ा दिया", vendor="श्री राम कॉम्प्लेक्स")
    assert cat_rent == "rent"
    assert conf2 > 0.30

    # Salaries (मजदूर यूनियन दिहाड़ी)
    cat_sal, conf3, _ = classifier.predict("मजदूर यूनियन दिहाड़ी सफाई कर्मचारी तनख्वाह", vendor="लेबर ठेकेदार")
    assert cat_sal == "salaries"
    assert conf3 > 0.30

    # Utilities (बिजली बिल)
    cat_util, conf4, _ = classifier.predict("बिजली का बिल मीटर रीडिंग भुगतान", vendor="बीएसईएस राजधानी बिजली")
    assert cat_util == "utilities"
    assert conf4 > 0.30


def test_abbreviated_slang_classification(classifier):
    """Ensure informal abbreviations like 'sbzi', 'bjli', 'bhda' resolve correctly."""
    cat1, _, _ = classifier.predict("sbzi mandi taaza aalu pyaaz", vendor="kirna store")
    assert cat1 == "groceries"

    cat2, _, _ = classifier.predict("tempo bhda maal transport delivery", vendor="porter gadi")
    assert cat2 == "transport"

    cat3, _, _ = classifier.predict("bjli bill payment nagar nigam", vendor="tata power")
    assert cat3 == "utilities"

    cat4, _, _ = classifier.predict("pamplet chhapwaya dukan prachar", vendor="aggarwal flex print")
    assert cat4 == "marketing"


def test_empty_and_minimal_inputs(classifier):
    """Verify classifier handles short, noisy, or minimal inputs gracefully."""
    pred_cat, conf, probs = classifier.predict("xyz123 random noise")
    assert pred_cat in classifier.model.classes_
    assert conf > 0.0
    assert len(probs) == 8


def test_explain_prediction_feature_attribution(classifier):
    """Verify SHAP / token feature attribution explainability engine."""
    exp = classifier.explain_prediction("diesel fuel refill 50 liters", vendor="IndianOil")
    assert exp.predicted_category in ["transport", "utilities", "misc"]
    assert exp.confidence > 0.0
    assert len(exp.top_features) > 0
    assert any(f.direction == "positive" for f in exp.top_features)
    assert "Classified as" in exp.summary_explanation

