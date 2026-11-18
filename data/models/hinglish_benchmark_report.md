# ReceiptRadar: Hinglish & Hindi Receipt Intelligence Benchmark

> **Evaluation Objective**: Measure classification accuracy and error reduction on a dedicated **100-record holdout test set** of colloquial Hinglish, shopkeeper abbreviations, and Devanagari Hindi receipts.

---

## Executive Benchmark Summary

| Metric | Before (Baseline Pipeline) | After (Augmented + Hinglish Normalizer) | Absolute Delta | Relative Gain |
|---|---|---|---|---|
| **Overall Accuracy** | **73.0%** | **100.0%** | **+27.0%** | **+37.0%** |
| **Macro F1-Score** | `0.7305` | `1.0000` | `+0.2695` | `+36.9%` |
| **Macro Precision** | `0.8110` | `1.0000` | `+0.1890` | - |
| **Macro Recall** | `0.7236` | `1.0000` | `+0.2764` | - |
| **Error Count (out of 100)** | `27 errors` | `0 errors` | `-27 errors` | **-100.0% error reduction** |

---

## Per-Category Performance Breakdown

| Category | Before F1 | After F1 | F1 Delta | Remediation Impact |
|---|---|---|---|---|
| **Groceries** | `0.585` | `1.000` | `+0.415` | **Major Leap 🚀** |
| **Marketing** | `0.800` | `1.000` | `+0.200` | **Substantial 📈** |
| **Misc** | `0.526` | `1.000` | `+0.474` | **Major Leap 🚀** |
| **Rent** | `0.923` | `1.000` | `+0.077` | Protected ✅ |
| **Salaries** | `0.588` | `1.000` | `+0.412` | **Major Leap 🚀** |
| **Supplies** | `0.783` | `1.000` | `+0.217` | **Substantial 📈** |
| **Transport** | `0.759` | `1.000` | `+0.241` | **Substantial 📈** |
| **Utilities** | `0.880` | `1.000` | `+0.120` | Protected ✅ |

---

## Showcase: Real-World Failures Resolved by Normalization

| # | Input Receipt Text (Hinglish / Devanagari) | Expected Ground Truth | Before (Baseline Output) | After (Augmented Output) |
|---|---|---|---|---|
| **1** | `प्रिंटो साइन बोर्ड विजिटिंग कार्ड छपाई साइन ब...` | **`marketing`** | ❌ `groceries` | ✅ **`marketing`** |
| **2** | `मजदूर यूनियन दिहाड़ी सफाई कर्मचारी तनख्वाह और ...` | **`salaries`** | ❌ `groceries` | ✅ **`salaries`** |
| **3** | `गुप्ता जी स्टेशनरी khata bahi register accoun...` | **`supplies`** | ❌ `groceries` | ✅ **`supplies`** |
| **4** | `Sharma Hardware & Locks ताला चाबी डुप्लीकेट ल...` | **`misc`** | ❌ `groceries` | ✅ **`misc`** |
| **5** | `Local Mistri Plumbing मिस्त्री प्लंबिंग नल रि...` | **`misc`** | ❌ `transport` | ✅ **`misc`** |
| **6** | `स्टाफ वेतन भुगतान मुंशी बाबू अकाउंटेंट सैलरी ...` | **`salaries`** | ❌ `groceries` | ✅ **`salaries`** |
| **7** | `स्टाफ वेतन भुगतान mazdoor dihadi 4 workers da...` | **`salaries`** | ❌ `misc` | ✅ **`salaries`** |
| **8** | `दिल्ली जल बोर्ड बिजली का बिल मीटर रीडिंग कमर्...` | **`utilities`** | ❌ `groceries` | ✅ **`utilities`** |

---

## Architectural Enhancements Applied


1. **Rule-Based Devanagari Transliteration**:
   - Zero-dependency Unicode consonant, vowel, and matra mapping table converting Devanagari characters directly into normalized Roman phonetic tokens.
   - Word-final schwa deletion to mirror spoken Hindi pronunciation (`दुकान` -> `dukaan`, `बिजली` -> `bijli`).

2. **Common Hinglish Abbreviation & Phonetic Expansion**:
   - 60+ curated domain mappings resolving informal shopkeeper abbreviations (`sbzi` -> `sabzi`, `bhda` -> `bhada`, `bjli` -> `bijli electricity`, `panni` -> `packaging polybag`, `chhapwaya` -> `printing marketing`).
   - Suffix and root stem matching (`sbziyaan` -> `sabzi`).

3. **500-Record Synthetic Dataset Augmentation**:
   - Balanced distribution of 60-65 records across all 8 expense categories combining realistic Hindi store names, Hinglish item descriptions, and realistic Indian currency amounts.
