import cv2
import numpy as np
from typing import List, Tuple


def extract_contours(
    rgba_image: np.ndarray,
    alpha_threshold: int = 128,
    extract_internal: bool = False,
    canny_low: int = 50,
    canny_high: int = 150,
    min_contour_area: int = 100,
) -> Tuple[List[np.ndarray], np.ndarray, np.ndarray]:
    alpha = rgba_image[:, :, 3]
    mask = (alpha >= alpha_threshold).astype(np.uint8) * 255

    if extract_internal:
        rgb = rgba_image[:, :, :3]
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        gray_masked = cv2.bitwise_and(gray, gray, mask=mask)
        edges = cv2.Canny(gray_masked, canny_low, canny_high)
        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    else:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    contours = [c for c in contours if cv2.contourArea(c) >= min_contour_area]

    overlay = rgba_image[:, :, :3].copy()
    cv2.drawContours(overlay, contours, -1, (0, 255, 0), 2)

    return contours, mask, overlay
