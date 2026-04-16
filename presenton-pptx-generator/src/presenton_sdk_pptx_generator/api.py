import asyncio
import json
import re
import uuid
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Mapping, Optional, Union

from pydantic import BaseModel

from .creator import PptxPresentationCreator
from .models import PptxPresentationModel
from .pptx_runtime_patch import ensure_pptx_runtime_templates

PresentationModelInput = Union[PptxPresentationModel, Mapping[str, Any], str, Path]


class GeneratePptxResult(BaseModel):
    path: str
    filename: str
    format: str = "pptx"
    slide_count: int
    presentation_name: Optional[str] = None


def load_presentation_model(source: PresentationModelInput) -> PptxPresentationModel:
    if isinstance(source, PptxPresentationModel):
        return source

    if isinstance(source, Mapping):
        return PptxPresentationModel(**dict(source))

    if isinstance(source, Path):
        payload = json.loads(source.read_text(encoding="utf-8"))
        return PptxPresentationModel(**payload)

    if isinstance(source, str):
        candidate_path = Path(source).expanduser()
        if candidate_path.is_file():
            payload = json.loads(candidate_path.read_text(encoding="utf-8"))
            return PptxPresentationModel(**payload)
        payload = json.loads(source)
        return PptxPresentationModel(**payload)

    raise TypeError(f"Unsupported presentation model input: {type(source)!r}")


def sanitize_filename(value: str) -> str:
    normalized = re.sub(r"[\\/:*?\"<>|]+", "-", value).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized[:200] or str(uuid.uuid4())


def build_output_path(
    model: PptxPresentationModel,
    output_path: Optional[Union[str, Path]] = None,
    output_dir: Optional[Union[str, Path]] = None,
    filename: Optional[str] = None,
    create_dirs: bool = True,
) -> Path:
    if output_path is not None:
        final_path = Path(output_path).expanduser()
    else:
        base_dir = Path(output_dir).expanduser() if output_dir else Path.cwd()
        base_name = sanitize_filename(filename or model.name or str(uuid.uuid4()))
        if not base_name.lower().endswith(".pptx"):
            base_name = f"{base_name}.pptx"
        final_path = base_dir / base_name

    if create_dirs:
        final_path.parent.mkdir(parents=True, exist_ok=True)

    return final_path.resolve()


async def generate_pptx(
    source: PresentationModelInput,
    *,
    output_path: Optional[Union[str, Path]] = None,
    output_dir: Optional[Union[str, Path]] = None,
    filename: Optional[str] = None,
    create_dirs: bool = True,
) -> GeneratePptxResult:
    ensure_pptx_runtime_templates()
    model = load_presentation_model(source)
    final_path = build_output_path(
        model,
        output_path=output_path,
        output_dir=output_dir,
        filename=filename,
        create_dirs=create_dirs,
    )

    with TemporaryDirectory(prefix="presenton-sdk-pptx-generator-") as temp_dir:
        creator = PptxPresentationCreator(model, temp_dir)
        await creator.create_ppt()
        creator.save(str(final_path))

    return GeneratePptxResult(
        path=str(final_path),
        filename=final_path.name,
        slide_count=len(model.slides),
        presentation_name=model.name,
    )


def generate_pptx_sync(
    source: PresentationModelInput,
    *,
    output_path: Optional[Union[str, Path]] = None,
    output_dir: Optional[Union[str, Path]] = None,
    filename: Optional[str] = None,
    create_dirs: bool = True,
) -> GeneratePptxResult:
    return asyncio.run(
        generate_pptx(
            source,
            output_path=output_path,
            output_dir=output_dir,
            filename=filename,
            create_dirs=create_dirs,
        )
    )
