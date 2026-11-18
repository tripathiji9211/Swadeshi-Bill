"""
Image Preprocessing for Thermal Receipt OCR using OpenCV
"""

from typing import Union
from pathlib import Path
import numpy as np
from PIL import Image
import cv2


def preprocess_receipt_image(image_input: Union[str, Path, Image.Image, np.ndarray]) -> np.ndarray:
    """
    Applies OpenCV enhancements for degraded receipt images:
    - Grayscale conversion
    - Contrast stretching
    - Bilateral edge-preserving denoising
    """
    if isinstance(image_input, (str, Path)):
        cv_img = cv2.imread(str(image_input))
        if cv_img is None:
            raise ValueError(f"Unable to read image at: {image_input}")
    elif isinstance(image_input, Image.Image):
        cv_img = cv2.cvtColor(np.array(image_input), cv2.COLOR_RGB2BGR)
    elif isinstance(image_input, np.ndarray):
        cv_img = image_input.copy()
    else:
        raise TypeError("Unsupported image input type")

    # Grayscale
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # Normalize contrast
    norm_img = cv2.normalize(gray, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)

    # Edge-preserving filter for thermal receipt text
    denoised = cv2.bilateralFilter(norm_img, d=9, sigmaColor=75, sigmaSpace=75)

    return denoised

