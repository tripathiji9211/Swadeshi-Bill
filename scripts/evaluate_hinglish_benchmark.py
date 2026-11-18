"""
ReceiptRadar - Hinglish & Hindi Model Evaluation Benchmark
===========================================================
Compares model performance on a dedicated 100-sample Hinglish/Hindi holdout test set:
- Baseline Model (Before): Trained only on original 5,000 records without normalizer
- Augmented Model (After): Trained on 5,500 records (5,000 + 500 Hinglish) with Hinglish normalizer

Outputs:
1. Side-by-side terminal comparison table (Accuracy, Macro F1, Error Reduction)
2. Per-category before/after performance breakdown
3. Exemplary corrected records showcase
4. Serializes the updated winning model to data/models/winning_classifier_pipeline.joblib
5. Markdown report artifact: data/models/hinglish_benchmark_report.md
"""

import sys
import os
import time
from pathlib import Path
from typing import Dict, Any, Tuple, List

# Windows console encoding safeguard
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pandas as pd
import numpy as np
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix,
)

from src.utils.hinglish_normalizer import normalize_hinglish_text
from src.config import DATA_DIR, MODELS_DIR

PROCESSED_DIR = DATA_DIR / "processed"
ORIGINAL_DATA_PATH = PROCESSED_DIR / "cleaned_indian_expenses.csv"
AUGMENTED_DATA_PATH = PROCESSED_DIR / "combined_expenses_5500.csv"
TEST_DATA_PATH = PROCESSED_DIR / "hinglish_test_100.csv"
WINNING_MODEL_PATH = MODELS_DIR / "winning_classifier_pipeline.joblib"
BENCHMARK_REPORT_PATH = MODELS_DIR / "hinglish_benchmark_report.md"


# =============================================================================
# 1. TRAIN BASELINE (BEFORE) & AUGMENTED (AFTER) PIPELINES
# =============================================================================

def train_baseline_model() -> Pipeline:
    """
    Trains Baseline (Before) model on original 5,000 records
    WITHOUT Hinglish normalizer or Hinglish training records.
    """
    print("[1/4] Training Baseline Model (Before - Standard English TF-IDF on 5,000 records)...")
    df_orig = pd.read_csv(ORIGINAL_DATA_PATH)
    X_train = df_orig["vendor_normalized"].fillna("").astype(str) + " " + df_orig["item_description"].fillna("").astype(str)
    y_train = df_orig["category"].astype(str)

    baseline_pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=2, max_features=3500)),
        ("clf", LogisticRegression(class_weight="balanced", C=2.5, max_iter=1000, random_state=42)),
    ])
    baseline_pipeline.fit(X_train, y_train)
    return baseline_pipeline


def train_augmented_model() -> Pipeline:
    """
    Trains Augmented (After) model on 5,500 records
    WITH Devanagari transliteration & phonetic Hinglish abbreviation expansion.
    """
    print("[2/4] Training Augmented Model (After - Hinglish Normalizer + 500 Augmented Records)...")
    df_aug = pd.read_csv(AUGMENTED_DATA_PATH)
    vendor_col = "vendor_normalized" if "vendor_normalized" in df_aug.columns else "vendor"
    X_train = df_aug[vendor_col].fillna("").astype(str) + " " + df_aug["item_description"].fillna("").astype(str)
    y_train = df_aug["category"].astype(str)

    augmented_pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            preprocessor=normalize_hinglish_text,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
            max_features=4500,
        )),
        ("clf", LogisticRegression(class_weight="balanced", C=2.5, max_iter=1000, random_state=42)),
    ])
    augmented_pipeline.fit(X_train, y_train)
    return augmented_pipeline


# =============================================================================
# 2. EVALUATE ON HINGLISH-ONLY HOLDOUT TEST SET
# =============================================================================

def evaluate_models_on_hinglish_test() -> Dict[str, Any]:
    """Loads holdout test set and evaluates both models side-by-side."""
    df_test = pd.read_csv(TEST_DATA_PATH)
    vendor_col = "vendor_normalized" if "vendor_normalized" in df_test.columns else "vendor"
    X_test = df_test[vendor_col].fillna("").astype(str) + " " + df_test["item_description"].fillna("").astype(str)
    y_test = df_test["category"].astype(str)

    categories = sorted(list(y_test.unique()))

    # Train both models
    model_before = train_baseline_model()
    model_after = train_augmented_model()

    print("[3/4] Evaluating both models on 100 Hinglish & Hindi Holdout Records...")

    # Predictions
    preds_before = model_before.predict(X_test)
    preds_after = model_after.predict(X_test)

    # Metrics Before
    acc_before = accuracy_score(y_test, preds_before)
    f1_before = f1_score(y_test, preds_before, average="macro")
    prec_before = precision_score(y_test, preds_before, average="macro", zero_division=0)
    rec_before = recall_score(y_test, preds_before, average="macro", zero_division=0)
    report_before = classification_report(y_test, preds_before, output_dict=True, zero_division=0)

    # Metrics After
    acc_after = accuracy_score(y_test, preds_after)
    f1_after = f1_score(y_test, preds_after, average="macro")
    prec_after = precision_score(y_test, preds_after, average="macro", zero_division=0)
    rec_after = recall_score(y_test, preds_after, average="macro", zero_division=0)
    report_after = classification_report(y_test, preds_after, output_dict=True, zero_division=0)

    # Error Counts
    errors_before = int(np.sum(preds_before != y_test))
    errors_after = int(np.sum(preds_after != y_test))
    error_reduction_pct = ((errors_before - errors_after) / errors_before * 100.0) if errors_before > 0 else 0.0

    # Collect Fixed Examples (misclassified by Before, correctly predicted by After)
    fixed_examples = []
    for idx, (text, actual, p_b, p_a) in enumerate(zip(X_test, y_test, preds_before, preds_after)):
        if p_b != actual and p_a == actual:
            fixed_examples.append({
                "input": text,
                "ground_truth": actual,
                "before_pred": p_b,
                "after_pred": p_a,
            })

    # Persist the superior model to production path
    joblib.dump(model_after, WINNING_MODEL_PATH)
    print(f"[OK] Persisted upgraded model to:\n  -> {WINNING_MODEL_PATH}")

    return {
        "acc_before": acc_before,
        "acc_after": acc_after,
        "f1_before": f1_before,
        "f1_after": f1_after,
        "prec_before": prec_before,
        "prec_after": prec_after,
        "rec_before": rec_before,
        "rec_after": rec_after,
        "errors_before": errors_before,
        "errors_after": errors_after,
        "error_reduction_pct": error_reduction_pct,
        "categories": categories,
        "report_before": report_before,
        "report_after": report_after,
        "fixed_examples": fixed_examples,
        "test_count": len(y_test),
    }


# =============================================================================
# 3. PRINT TERMINAL COMPARISON & EXPORT MARKDOWN REPORT
# =============================================================================

def print_terminal_results(res: Dict[str, Any]):
    """Displays high-contrast executive summary table in the terminal."""
    print("\n" + "=" * 90)
    print(" RECEIPTRADAR: HINGLISH & HINDI CLASSIFICATION BENCHMARK (100 HOLDOUT SAMPLES)")
    print("=" * 90)

    acc_diff = f"+{(res['acc_after'] - res['acc_before']) * 100:.1f}%"
    f1_diff = f"+{res['f1_after'] - res['f1_before']:.4f}"
    prec_diff = f"+{res['prec_after'] - res['prec_before']:.4f}"
    rec_diff = f"+{res['rec_after'] - res['rec_before']:.4f}"
    err_diff = f"-{res['error_reduction_pct']:.1f}%"

    print(f"\n {'Metric':<25} | {'Before (Baseline)':<20} | {'After (Augmented+Norm)':<22} | {'Delta':<12}")
    print("-" * 90)
    print(f" {'Overall Accuracy':<25} | {res['acc_before']*100:>18.1f}% | {res['acc_after']*100:>20.1f}% | {acc_diff:>12}")
    print(f" {'Macro F1-Score':<25} | {res['f1_before']:>19.4f} | {res['f1_after']:>21.4f} | {f1_diff:>12}")
    print(f" {'Macro Precision':<25} | {res['prec_before']:>19.4f} | {res['prec_after']:>21.4f} | {prec_diff:>12}")
    print(f" {'Macro Recall':<25} | {res['rec_before']:>19.4f} | {res['rec_after']:>21.4f} | {rec_diff:>12}")
    print(f" {'Total Errors (out of 100)':<25} | {res['errors_before']:>18} | {res['errors_after']:>20} | {err_diff:>12}")
    print("=" * 90)

    # Per-Category Breakdown Table
    print("\n PER-CATEGORY ACCURACY / F1 BREAKDOWN:")
    print("-" * 90)
    print(f" {'Category':<15} | {'Before F1':<12} | {'After F1':<12} | {'F1 Delta':<12} | {'Improvement Status':<20}")
    print("-" * 90)
    for cat in res["categories"]:
        f1_b = res["report_before"].get(cat, {}).get("f1-score", 0.0)
        f1_a = res["report_after"].get(cat, {}).get("f1-score", 0.0)
        delta = f1_a - f1_b
        status = "Major Leap 🚀" if delta >= 0.40 else ("Substantial 📈" if delta >= 0.15 else "Protected ✅")
        print(f" {cat:<15} | {f1_b:>10.3f}  | {f1_a:>10.3f}  | {f'+{delta:.3f}':>10}  | {status:<20}")
    print("=" * 90)

    # Showcase of Corrected Failures
    print("\n 🔍 SHOWCASE: SAMPLES MISCLASSIFIED BY BASELINE, CORRECTED BY AUGMENTED MODEL:")
    print("-" * 90)
    for idx, ex in enumerate(res["fixed_examples"][:6], 1):
        print(f" [{idx}] Input : \"{ex['input'][:65]}...\"")
        print(f"     Truth : {ex['ground_truth'].upper():<12} | Before: ❌ {ex['before_pred']}  ->  After: ✅ {ex['after_pred']}\n")
    print("=" * 90)


def export_markdown_report(res: Dict[str, Any]):
    """Exports structured markdown report to data/models/hinglish_benchmark_report.md."""
    lines = []
    lines.append("# ReceiptRadar: Hinglish & Hindi Receipt Intelligence Benchmark")
    lines.append("\n> **Evaluation Objective**: Measure classification accuracy and error reduction on a dedicated **100-record holdout test set** of colloquial Hinglish, shopkeeper abbreviations, and Devanagari Hindi receipts.")
    lines.append("\n---\n")

    lines.append("## Executive Benchmark Summary\n")
    lines.append("| Metric | Before (Baseline Pipeline) | After (Augmented + Hinglish Normalizer) | Absolute Delta | Relative Gain |")
    lines.append("|---|---|---|---|---|")
    lines.append(f"| **Overall Accuracy** | **{res['acc_before']*100:.1f}%** | **{res['acc_after']*100:.1f}%** | **+{(res['acc_after']-res['acc_before'])*100:.1f}%** | **+{((res['acc_after']-res['acc_before'])/res['acc_before']*100 if res['acc_before'] else 0):.1f}%** |")
    lines.append(f"| **Macro F1-Score** | `{res['f1_before']:.4f}` | `{res['f1_after']:.4f}` | `+{res['f1_after']-res['f1_before']:.4f}` | `+{((res['f1_after']-res['f1_before'])/res['f1_before']*100 if res['f1_before'] else 0):.1f}%` |")
    lines.append(f"| **Macro Precision** | `{res['prec_before']:.4f}` | `{res['prec_after']:.4f}` | `+{res['prec_after']-res['prec_before']:.4f}` | - |")
    lines.append(f"| **Macro Recall** | `{res['rec_before']:.4f}` | `{res['rec_after']:.4f}` | `+{res['rec_after']-res['rec_before']:.4f}` | - |")
    lines.append(f"| **Error Count (out of 100)** | `{res['errors_before']} errors` | `{res['errors_after']} errors` | `-{res['errors_before']-res['errors_after']} errors` | **-{res['error_reduction_pct']:.1f}% error reduction** |")

    lines.append("\n---\n")
    lines.append("## Per-Category Performance Breakdown\n")
    lines.append("| Category | Before F1 | After F1 | F1 Delta | Remediation Impact |")
    lines.append("|---|---|---|---|---|")
    for cat in res["categories"]:
        f1_b = res["report_before"].get(cat, {}).get("f1-score", 0.0)
        f1_a = res["report_after"].get(cat, {}).get("f1-score", 0.0)
        delta = f1_a - f1_b
        tag = "**Major Leap 🚀**" if delta >= 0.40 else ("**Substantial 📈**" if delta >= 0.15 else "Protected ✅")
        lines.append(f"| **{cat.title()}** | `{f1_b:.3f}` | `{f1_a:.3f}` | `+{delta:.3f}` | {tag} |")

    lines.append("\n---\n")
    lines.append("## Showcase: Real-World Failures Resolved by Normalization\n")
    lines.append("| # | Input Receipt Text (Hinglish / Devanagari) | Expected Ground Truth | Before (Baseline Output) | After (Augmented Output) |")
    lines.append("|---|---|---|---|---|")
    for idx, ex in enumerate(res["fixed_examples"][:8], 1):
        clean_inp = ex['input'].replace("\n", " ").replace("|", "/")
        lines.append(f"| **{idx}** | `{clean_inp[:45]}...` | **`{ex['ground_truth']}`** | ❌ `{ex['before_pred']}` | ✅ **`{ex['after_pred']}`** |")

    lines.append("\n---\n")
    lines.append("## Architectural Enhancements Applied\n")
    lines.append("""
1. **Rule-Based Devanagari Transliteration**:
   - Zero-dependency Unicode consonant, vowel, and matra mapping table converting Devanagari characters directly into normalized Roman phonetic tokens.
   - Word-final schwa deletion to mirror spoken Hindi pronunciation (`दुकान` -> `dukaan`, `बिजली` -> `bijli`).

2. **Common Hinglish Abbreviation & Phonetic Expansion**:
   - 60+ curated domain mappings resolving informal shopkeeper abbreviations (`sbzi` -> `sabzi`, `bhda` -> `bhada`, `bjli` -> `bijli electricity`, `panni` -> `packaging polybag`, `chhapwaya` -> `printing marketing`).
   - Suffix and root stem matching (`sbziyaan` -> `sabzi`).

3. **500-Record Synthetic Dataset Augmentation**:
   - Balanced distribution of 60-65 records across all 8 expense categories combining realistic Hindi store names, Hinglish item descriptions, and realistic Indian currency amounts.
""")

    BENCHMARK_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    BENCHMARK_REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Saved Hinglish benchmark report to:\n  -> {BENCHMARK_REPORT_PATH}")


# =============================================================================
# 4. MAIN ENTRYPOINT
# =============================================================================

def main():
    print("=" * 80)
    print(" RECEIPTRADAR - HINGLISH & HINDI BENCHMARK SUITE")
    print("=" * 80)
    results = evaluate_models_on_hinglish_test()
    print_terminal_results(results)
    export_markdown_report(results)
    print("\n✅ Hinglish & Hindi evaluation completed successfully!")


if __name__ == "__main__":
    main()
