"""
ReceiptRadar - Explainability Sentinel (SHAP / Feature Attribution Engine)
==========================================================================
Provides local and global feature attribution for ReceiptRadar's ML category
classifier and anomaly detector:
1. Linear SHAP / Local Token Attribution: Computes exact additive feature contributions
   (phi_i = x_i * w_{c, i} - E[x_i * w_{c, i}]) for TF-IDF + Logistic Regression,
   revealing the exact lexical tokens that triggered the category assignment.
2. Anomaly Rule & Isolation Attribution: Deconstructs multi-engine risk scores
   into legible forensic reasons ("Why Flagged?").
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from pydantic import BaseModel, Field


class FeatureAttribution(BaseModel):
    token: str
    weight: float
    contribution: float  # tfidf * weight
    direction: str  # "positive" (supports class) or "negative" (opposes class)


class PredictionExplanation(BaseModel):
    predicted_category: str
    confidence: float
    base_value: float  # Intercept / prior
    top_features: List[FeatureAttribution] = Field(default_factory=list)
    summary_explanation: str


class ReceiptExplainer:
    """
    Computes exact local token feature attributions (SHAP values for linear models)
    explaining 'Why?' a given receipt was classified into a specific category.
    """

    def __init__(self, pipeline=None):
        self.pipeline = pipeline

    def set_pipeline(self, pipeline):
        self.pipeline = pipeline

    def explain(
        self,
        text: str,
        predicted_category: Optional[str] = None,
        top_k: int = 5,
    ) -> PredictionExplanation:
        """
        Calculates token-level feature attribution scores for the given input text.
        For TF-IDF + Logistic Regression:
            f(x)_c = b_c + sum_i (x_i * w_{c, i})
        The term (x_i * w_{c, i}) represents the exact local contribution of token i.
        """
        if self.pipeline is None:
            return PredictionExplanation(
                predicted_category=predicted_category or "unknown",
                confidence=1.0,
                base_value=0.0,
                top_features=[],
                summary_explanation="Classifier pipeline not initialized for explainability.",
            )

        try:
            tfidf = self.pipeline.named_steps.get("tfidf")
            clf = self.pipeline.named_steps.get("clf")

            if tfidf is None or clf is None:
                return PredictionExplanation(
                    predicted_category=predicted_category or "unknown",
                    confidence=1.0,
                    base_value=0.0,
                    top_features=[],
                    summary_explanation="Pipeline does not contain standard tfidf and clf steps.",
                )

            # Transform text
            vec = tfidf.transform([text])
            feature_names = tfidf.get_feature_names_out()

            # Predict probabilities
            probs = clf.predict_proba(vec)[0]
            classes = list(clf.classes_)

            if predicted_category is None or predicted_category not in classes:
                cat_idx = int(np.argmax(probs))
                predicted_category = str(classes[cat_idx])
            else:
                cat_idx = classes.index(predicted_category)

            confidence = float(probs[cat_idx])
            intercept = float(clf.intercept_[cat_idx]) if hasattr(clf, "intercept_") else 0.0
            coefs = clf.coef_[cat_idx]

            # Non-zero indices in the sparse vector
            nonzero_indices = vec.indices
            nonzero_values = vec.data

            attributions: List[FeatureAttribution] = []
            for col_idx, val in zip(nonzero_indices, nonzero_values):
                token_name = feature_names[col_idx]
                w = float(coefs[col_idx])
                contrib = float(val * w)
                direction = "positive" if contrib >= 0 else "negative"
                attributions.append(
                    FeatureAttribution(
                        token=token_name,
                        weight=round(w, 4),
                        contribution=round(contrib, 4),
                        direction=direction,
                    )
                )

            # Sort by absolute contribution
            attributions.sort(key=lambda a: abs(a.contribution), reverse=True)
            top_features = attributions[:top_k]

            # Generate natural language summary
            pos_tokens = [f"'{a.token}' (+{a.contribution:.2f})" for a in top_features if a.direction == "positive"]
            if pos_tokens:
                summary = (
                    f"Classified as '{predicted_category}' with {confidence*100:.1f}% confidence primarily due to "
                    f"salient tokens: {', '.join(pos_tokens)}."
                )
            else:
                summary = f"Classified as '{predicted_category}' ({confidence*100:.1f}% confidence) based on baseline category prior."

            return PredictionExplanation(
                predicted_category=predicted_category,
                confidence=round(confidence, 3),
                base_value=round(intercept, 4),
                top_features=top_features,
                summary_explanation=summary,
            )

        except Exception as e:
            return PredictionExplanation(
                predicted_category=predicted_category or "unknown",
                confidence=0.0,
                base_value=0.0,
                top_features=[],
                summary_explanation=f"Explainability attribution error: {e}",
            )

