from typing import List

from PIL import Image, ImageDraw

from .models import PptxObjectFitEnum, PptxObjectFitModel


def clip_image(
    image: Image.Image,
    width: int,
    height: int,
    focus_x: float = 50.0,
    focus_y: float = 50.0,
) -> Image.Image:
    img_width, img_height = image.size

    img_aspect = img_width / img_height
    box_aspect = width / height

    if img_aspect > box_aspect:
        new_height = height
        new_width = int(new_height * img_aspect)
    else:
        new_width = width
        new_height = int(new_width / img_aspect)

    resized_image = image.resize((new_width, new_height), Image.LANCZOS)

    focus_x = max(0.0, min(100.0, focus_x))
    focus_y = max(0.0, min(100.0, focus_y))

    center_x = int((new_width - width) * (focus_x / 100.0))
    center_y = int((new_height - height) * (focus_y / 100.0))

    left = center_x
    top = center_y
    right = left + width
    bottom = top + height

    return resized_image.crop((left, top, right, bottom))


def round_image_corners(image: Image.Image, radii: List[int]) -> Image.Image:
    if len(radii) != 4:
        raise ValueError("radii must contain exactly 4 values")

    width, height = image.size
    max_radius = min(width // 2, height // 2)
    clamped_radii = [min(radius, max_radius) for radius in radii]

    if image.mode != "RGBA":
        image = image.convert("RGBA")

    rounded_mask = Image.new("L", image.size, 0)
    rectangular_mask = Image.new("L", image.size, 255)

    for index, radius in enumerate(clamped_radii):
        if radius <= 0:
            continue

        circle = Image.new("L", (radius * 2, radius * 2), 0)
        draw = ImageDraw.Draw(circle)
        draw.ellipse((0, 0, radius * 2 - 1, radius * 2 - 1), fill=255)

        if index == 0:
            rounded_mask.paste(circle.crop((0, 0, radius, radius)), (0, 0))
            rectangular_mask.paste(0, (0, 0, radius, radius))
        elif index == 1:
            rounded_mask.paste(
                circle.crop((radius, 0, radius * 2, radius)),
                (width - radius, 0),
            )
            rectangular_mask.paste(0, (width - radius, 0, width, radius))
        elif index == 2:
            rounded_mask.paste(
                circle.crop((radius, radius, radius * 2, radius * 2)),
                (width - radius, height - radius),
            )
            rectangular_mask.paste(
                0,
                (width - radius, height - radius, width, height),
            )
        else:
            rounded_mask.paste(
                circle.crop((0, radius, radius, radius * 2)),
                (0, height - radius),
            )
            rectangular_mask.paste(0, (0, height - radius, radius, height))

    original_alpha = image.getchannel("A")
    corner_mask = Image.composite(rounded_mask, rectangular_mask, rounded_mask)
    final_alpha = Image.composite(
        original_alpha,
        Image.new("L", image.size, 0),
        corner_mask,
    )

    result = Image.new("RGBA", image.size)
    result.paste(image.convert("RGB"), (0, 0))
    result.putalpha(final_alpha)
    return result


def invert_image(image: Image.Image) -> Image.Image:
    data = image.getdata()
    new_data = []
    for item in data:
        red, green, blue, alpha = item
        if alpha != 0:
            new_data.append((255 - red, 255 - green, 255 - blue, alpha))
        else:
            new_data.append((0, 0, 0, 0))

    new_image = Image.new("RGBA", image.size)
    new_image.putdata(new_data)
    return new_image


def create_circle_image(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    size = image.size
    circle_size = min(size)
    mask = Image.new("RGBA", size, color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(mask)

    center_x = size[0] // 2
    center_y = size[1] // 2
    radius = circle_size // 2

    draw.ellipse(
        (
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
        ),
        fill=(255, 255, 255, 255),
    )

    return Image.composite(image, mask, mask)


def set_image_opacity(image: Image.Image, opacity: float) -> Image.Image:
    opacity = max(0.0, min(1.0, opacity))

    if image.mode != "RGBA":
        image = image.convert("RGBA")

    original_alpha = image.getchannel("A")
    new_alpha = original_alpha.point(lambda value: int(value * opacity))

    result = Image.new("RGBA", image.size)
    result.paste(image.convert("RGB"), (0, 0))
    result.putalpha(new_alpha)
    return result


def fit_image(
    image: Image.Image,
    width: int,
    height: int,
    object_fit: PptxObjectFitModel,
) -> Image.Image:
    if not object_fit.fit:
        return image

    img_width, img_height = image.size
    img_aspect = img_width / img_height
    box_aspect = width / height

    if object_fit.fit == PptxObjectFitEnum.CONTAIN:
        if img_aspect > box_aspect:
            new_width = width
            new_height = int(width / img_aspect)
        else:
            new_height = height
            new_width = int(height * img_aspect)
        resized_image = image.resize((new_width, new_height), Image.LANCZOS)

        focus_x = 50.0
        focus_y = 50.0
        if object_fit.focus and len(object_fit.focus) == 2:
            focus_x = object_fit.focus[0] if object_fit.focus[0] is not None else 50.0
            focus_y = object_fit.focus[1] if object_fit.focus[1] is not None else 50.0

        paste_x = int((width - new_width) * (focus_x / 100.0))
        paste_y = int((height - new_height) * (focus_y / 100.0))

        result = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        result.paste(resized_image, (paste_x, paste_y))
        return result

    if object_fit.fit == PptxObjectFitEnum.COVER:
        if img_aspect > box_aspect:
            new_height = height
            new_width = int(height * img_aspect)
        else:
            new_width = width
            new_height = int(width / img_aspect)
        resized_image = image.resize((new_width, new_height), Image.LANCZOS)

        focus_x = 50.0
        focus_y = 50.0
        if object_fit.focus and len(object_fit.focus) == 2:
            focus_x = object_fit.focus[0] if object_fit.focus[0] is not None else 50.0
            focus_y = object_fit.focus[1] if object_fit.focus[1] is not None else 50.0

        paste_x = int((new_width - width) * (focus_x / 100.0))
        paste_y = int((new_height - height) * (focus_y / 100.0))

        return resized_image.crop((paste_x, paste_y, paste_x + width, paste_y + height))

    if object_fit.fit == PptxObjectFitEnum.FILL:
        return image.resize((width, height), Image.LANCZOS)

    return image
