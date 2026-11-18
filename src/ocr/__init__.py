"""
ReceiptRadar OCR Module
"""

from src.ocr.engine import OCREngine
from src.ocr.preprocess import preprocess_receipt_image
from src.ocr.extract import (
    extract_text,
    preprocess_receipt,
    compare_preprocessing,
    get_easyocr_reader,
    deskew_image,
    denoise_image,
    apply_thresholding,
)

__all__ = [
    "OCREngine",
    "preprocess_receipt_image",
    "extract_text",
    "preprocess_receipt",
    "compare_preprocessing",
    "get_easyocr_reader",
    "deskew_image",
    "denoise_image",
    "apply_thresholding",
]
