from __future__ import annotations

from importlib.resources import files
from typing import cast


def _load_template_bytes(template_name: str) -> bytes:
    return (
        files("presenton_sdk_pptx_generator")
        .joinpath("templates", f"{template_name}.xml")
        .read_bytes()
    )


def ensure_pptx_runtime_templates() -> None:
    import pptx.oxml
    import pptx.oxml.slide
    import pptx.oxml.theme
    from pptx.oxml import parse_xml
    from pptx.oxml.slide import CT_NotesMaster, CT_NotesSlide
    from pptx.oxml.theme import CT_OfficeStyleSheet

    if getattr(ensure_pptx_runtime_templates, "_patched", False):
        return

    original_parse_from_template = pptx.oxml.parse_from_template

    def parse_from_template_with_fallback(template_file_name: str):
        try:
            return original_parse_from_template(template_file_name)
        except FileNotFoundError:
            return parse_xml(_load_template_bytes(template_file_name))

    @classmethod
    def notes_master_new_default(cls):
        return cast(CT_NotesMaster, parse_xml(_load_template_bytes("notesMaster")))

    @classmethod
    def notes_slide_new(cls):
        return cast(CT_NotesSlide, parse_xml(_load_template_bytes("notes")))

    @classmethod
    def office_style_sheet_new_default(cls):
        return cast(
            CT_OfficeStyleSheet,
            parse_xml(_load_template_bytes("theme")),
        )

    pptx.oxml.parse_from_template = parse_from_template_with_fallback
    pptx.oxml.slide.parse_from_template = parse_from_template_with_fallback
    pptx.oxml.theme.parse_from_template = parse_from_template_with_fallback
    CT_NotesMaster.new_default = notes_master_new_default
    CT_NotesSlide.new = notes_slide_new
    CT_OfficeStyleSheet.new_default = office_style_sheet_new_default

    ensure_pptx_runtime_templates._patched = True
