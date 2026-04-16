#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from presenton_sdk_pptx_generator import generate_pptx_sync


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a PPTX file from a PptxPresentationModel JSON file.",
    )
    parser.add_argument(
        "json_path",
        help="Path to the PptxPresentationModel JSON file.",
    )
    parser.add_argument(
        "output_path",
        help="Path where the generated PPTX file should be written.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    result = generate_pptx_sync(
        args.json_path,
        output_path=args.output_path,
    )

    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
