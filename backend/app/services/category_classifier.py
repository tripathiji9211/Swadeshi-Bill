"""
ReceiptRadar - ML Expense Category Classifier
Machine Learning NLP classifier using TF-IDF feature extraction and Logistic Regression
to predict standard business expense categories with calibrated confidence scores.
"""

from typing import Tuple, Dict
import pandas as pd
import numpy as np
from pathlib import Path
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from backend.app.config import (
    CLASSIFIER_MODEL_PATH,
    EXPENSES_DB_PATH,
    EXPENSE_CATEGORIES,
)


class CategoryClassifier:
    """
    NLP Text Classifier for Business Expenses.
    Maps vendor names and itemized descriptions to standard accounting categories.
    """

    def __init__(self):
        self.model_path = CLASSIFIER_MODEL_PATH
        self.pipeline: Pipeline = None
        self._load_or_train()

    def _load_or_train(self):
        """Loads existing model from disk, or trains a new one from historical data."""
        if self.model_path.exists():
            try:
                self.pipeline = joblib.load(self.model_path)
                return
            except Exception as e:
                print(f"Notice: Failed to load existing model ({e}), retraining...")

        self.train_on_history()

    def _prepare_features(self, df: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
        """Combines merchant and text into a unified representation."""
        text_features = df["merchant"].fillna("") + " " + df["receipt_text"].fillna("")
        labels = df["category"]
        return text_features, labels

    def train_on_history(self) -> Dict[str, float]:
        """
        Trains the TF-IDF + Logistic Regression classification pipeline
        on the historical transaction dataset.
        """
        if not EXPENSES_DB_PATH.exists():
            from backend.app.utils.sample_data import ensure_sample_database
            ensure_sample_database()

        df = pd.read_csv(EXPENSES_DB_PATH)
        X, y = self._prepare_features(df)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # Build production NLP Pipeline
        self.pipeline = Pipeline([
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    stop_words="english",
                    max_features=2500,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    class_weight="balanced",
                    C=2.0,
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ])

        self.pipeline.fit(X_train, y_train)

        # Evaluation metrics
        train_acc = float(self.pipeline.score(X_train, y_train))
        test_acc = float(self.pipeline.score(X_test, y_test))

        # Save artifact
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.pipeline, self.model_path)
        print(f"Category Classifier trained and saved. Train Acc: {train_acc:.3f}, Test Acc: {test_acc:.3f}")

        return {"train_accuracy": train_acc, "test_accuracy": test_acc}

    def predict(self, merchant: str, items_text: str = "") -> Tuple[str, float, Dict[str, float]]:
        """
        Predicts expense category and returns calibrated confidence score.
        Returns:
            (predicted_category, confidence_score, probabilities_by_category)
        """
        if self.pipeline is None:
            self._load_or_train()

        query_text = f"{merchant} {items_text}".strip()
        probs = self.pipeline.predict_proba([query_text])[0]
        classes = self.pipeline.classes_

        top_idx = int(np.argmax(probs))
        predicted_cat = str(classes[top_idx])
        confidence = float(probs[top_idx])

        prob_dict = {str(cls): float(prob) for cls, prob in zip(classes, probs)}

        return predicted_cat, round(confidence, 3), prob_dict

