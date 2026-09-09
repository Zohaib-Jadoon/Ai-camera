"""Apply privacy masks consistently to inference, snapshots and live previews."""
import math


def apply_privacy_masks(frame, masks):
    """Return a masked copy; invalid mask configuration blacks out the whole frame."""
    if frame is None:
        return None
    result = frame.copy()
    height, width = result.shape[:2]
    try:
        if not isinstance(masks, list):
            raise ValueError("Masks must be a list")
        for mask in masks:
            values = [mask[key] for key in ("x", "y", "width", "height")]
            if any(isinstance(value, bool) or not isinstance(value, (int, float))
                   or not math.isfinite(value) for value in values):
                raise ValueError("Invalid mask coordinates")
            x, y, w, h = values
            if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > 1.000001 or y + h > 1.000001:
                raise ValueError("Mask must fit within the frame")
            left, top = math.floor(x * width), math.floor(y * height)
            right, bottom = min(width, math.ceil((x + w) * width)), min(height, math.ceil((y + h) * height))
            result[top:bottom, left:right] = 0
    except (KeyError, TypeError, ValueError):
        result[:] = 0
    return result
