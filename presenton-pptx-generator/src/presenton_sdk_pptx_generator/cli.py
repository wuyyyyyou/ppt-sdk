import argparse
import json

from .api import generate_pptx_sync


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a .pptx file from a Presenton PptxPresentationModel JSON.",
    )
    parser.add_argument(
        "input",
        help="Path to a presentation-model JSON file.",
    )
    parser.add_argument(
        "--output",
        help="Absolute or relative output .pptx path.",
    )
    parser.add_argument(
        "--output-dir",
        help="Output directory used when --output is not provided.",
    )
    parser.add_argument(
        "--filename",
        help="Output filename used when --output is not provided.",
    )
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    result = generate_pptx_sync(
        args.input,
        output_path=args.output,
        output_dir=args.output_dir,
        filename=args.filename,
    )
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

