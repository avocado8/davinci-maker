from PIL import Image
import rembg

_session = rembg.new_session("u2netp")


def remove_background(image: Image.Image) -> Image.Image:
    result = rembg.remove(image, session=_session)
    return result.convert("RGBA")
