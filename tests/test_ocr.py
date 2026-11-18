from pathlib import Path
from PIL import Image
from src.ocr.engine import OCREngine
from src.ocr.preprocess import preprocess_receipt_image
from src.ocr.extract import extract_text, compare_preprocessing, preprocess_receipt
from src.config import SAMPLE_RECEIPTS_DIR


def test_ocr_engine_initialization():
    engine = OCREngine()
    assert engine.engine_name in ["EasyOCR", "PyTesseract", "OpenCV_Heuristic_Engine"]


def test_ocr_extraction_sample():
    engine = OCREngine()
    sample_file = SAMPLE_RECEIPTS_DIR / "sample_office_supplies.png"
    if not sample_file.exists():
        from src.utils.sample_data import generate_sample_receipt_suite
        generate_sample_receipt_suite()
    res = engine.extract_text(sample_file)
    assert "raw_text" in res
    assert len(res["lines"]) > 0
    assert res["confidence"] > 0.0


def test_extract_module_and_preprocessing():
    sample_file = SAMPLE_RECEIPTS_DIR / "sample_office_supplies.png"
    res = extract_text(sample_file, preprocess=True)
    assert "raw_text" in res
    assert res["word_count"] > 0
    assert res["mean_confidence"] > 0.0


def test_compare_preprocessing_metrics():
    sample_file = SAMPLE_RECEIPTS_DIR / "sample_office_supplies.png"
    comp = compare_preprocessing(sample_file)
    assert "unprocessed" in comp
    assert "preprocessed" in comp
    assert "improvements" in comp
    assert comp["preprocessed"]["confidence"] >= comp["unprocessed"]["confidence"]
