from html.parser import HTMLParser
import re
from typing import List, Optional

from .models import PptxFontModel, PptxTextRunModel


class InlineHTMLToRunsParser(HTMLParser):
    def __init__(self, base_font: PptxFontModel):
        super().__init__(convert_charrefs=True)
        self.base_font = base_font
        self.tag_stack: List[str] = []
        self.style_stack: List[dict[str, object]] = []
        self.text_runs: List[PptxTextRunModel] = []

    def _current_font(self) -> PptxFontModel:
        font_json = self.base_font.model_dump()
        is_bold = any(tag in ("strong", "b") for tag in self.tag_stack)
        is_italic = any(tag in ("em", "i") for tag in self.tag_stack)
        is_underline = any(tag == "u" for tag in self.tag_stack)
        is_strike = any(tag in ("s", "strike", "del") for tag in self.tag_stack)
        is_code = any(tag == "code" for tag in self.tag_stack)

        if is_bold:
            font_json["font_weight"] = 700
        if is_italic:
            font_json["italic"] = True
        if is_underline:
            font_json["underline"] = True
        if is_strike:
            font_json["strike"] = True
        if is_code:
            font_json["name"] = "Courier New"

        for style in self.style_stack:
            if "color" in style:
                font_json["color"] = style["color"]
            if "opacity" in style:
                font_json["opacity"] = style["opacity"]

        return PptxFontModel(**font_json)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "br":
            self.text_runs.append(PptxTextRunModel(text="\n"))
            return
        self.tag_stack.append(tag)
        self.style_stack.append(self._parse_style(attrs))

    def handle_endtag(self, tag):
        tag = tag.lower()
        for index in range(len(self.tag_stack) - 1, -1, -1):
            if self.tag_stack[index] == tag:
                del self.tag_stack[index]
                del self.style_stack[index]
                break

    def handle_data(self, data):
        if data == "":
            return
        self.text_runs.append(PptxTextRunModel(text=data, font=self._current_font()))

    def _parse_style(self, attrs) -> dict[str, object]:
        attrs_dict = {str(name).lower(): value for name, value in attrs}
        style = attrs_dict.get("style") or ""
        if not style:
            return {}

        color_match = re.search(r"(?:^|;)\s*color\s*:\s*([^;]+)", style, re.I)
        if not color_match:
            return {}

        color_value = self._resolve_css_color_value(color_match.group(1).strip())
        hex_match = re.match(r"#([0-9a-f]{3}|[0-9a-f]{6})$", color_value, re.I)
        if hex_match:
            hex_value = hex_match.group(1)
            if len(hex_value) == 3:
                hex_value = "".join(char * 2 for char in hex_value)
            return {"color": hex_value.upper()}

        rgb_match = re.match(r"rgba?\(([^)]+)\)", color_value, re.I)
        if rgb_match:
            parts = [part.strip() for part in rgb_match.group(1).split(",")]
            if len(parts) >= 3:
                try:
                    red, green, blue = [
                        max(0, min(255, int(float(part)))) for part in parts[:3]
                    ]
                    style_result: dict[str, object] = {
                        "color": f"{red:02X}{green:02X}{blue:02X}",
                    }
                    if len(parts) >= 4:
                        opacity = float(parts[3])
                        style_result["opacity"] = max(0.0, min(1.0, opacity))
                    return style_result
                except ValueError:
                    return {}

        return {}

    def _resolve_css_color_value(self, color_value: str) -> str:
        var_match = re.match(r"var\([^,]+,\s*([^)]+)\)", color_value, re.I)
        if var_match:
            return var_match.group(1).strip()
        return color_value


def parse_html_text_to_text_runs(
    text: str, base_font: Optional[PptxFontModel] = None
) -> List[PptxTextRunModel]:
    normalized_text = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized_text = normalized_text.replace("\n", "<br>")

    parser = InlineHTMLToRunsParser(base_font if base_font else PptxFontModel())
    parser.feed(normalized_text)
    return parser.text_runs
