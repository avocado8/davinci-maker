from PIL import Image
import rembg


def remove_background(image: Image.Image) -> Image.Image:
    result = rembg.remove(image)
    return result.convert("RGBA")
