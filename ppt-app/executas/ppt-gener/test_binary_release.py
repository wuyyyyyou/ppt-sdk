from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HELPER_PATH = ROOT / "scripts" / "binary_release.py"
CAIRO_HELPER_PATH = ROOT / "prepare_cairo_runtime.py"
PLUGIN_PATH = ROOT / "src" / "presenton_pptx_generator_plugin.py"
spec = importlib.util.spec_from_file_location("binary_release", HELPER_PATH)
assert spec is not None and spec.loader is not None
binary_release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(binary_release)
cairo_spec = importlib.util.spec_from_file_location("prepare_cairo_runtime", CAIRO_HELPER_PATH)
assert cairo_spec is not None and cairo_spec.loader is not None
prepare_cairo_runtime = importlib.util.module_from_spec(cairo_spec)
cairo_spec.loader.exec_module(prepare_cairo_runtime)
plugin_spec = importlib.util.spec_from_file_location("presenton_pptx_generator_plugin", PLUGIN_PATH)
assert plugin_spec is not None and plugin_spec.loader is not None
plugin = importlib.util.module_from_spec(plugin_spec)
plugin_spec.loader.exec_module(plugin)


TOOL_MANIFEST = {
    "name": "tool-lightvoss_5433-ppt-gener-dc7ftcep",
    "display_name": "ppt-gener",
    "version": "2.0.2",
    "tools": [{"name": "generatePptx", "parameters": []}],
}


class BinaryReleaseTest(unittest.TestCase):
    def test_build_distribution_manifest_uses_short_binary_name(self) -> None:
        self.assertEqual(
            binary_release.build_distribution_manifest(
                TOOL_MANIFEST,
                binary_name="ppt-gener",
            ),
            {
                "name": "tool-lightvoss_5433-ppt-gener-dc7ftcep",
                "version": "2.0.2",
                "runtime": {
                    "binary": {
                        "entrypoint": {
                            "default": "bin/ppt-gener",
                            "windows-x86_64": "bin/ppt-gener.exe",
                            "windows-arm64": "bin/ppt-gener.exe",
                        },
                        "lib_dirs": ["lib"],
                        "data_dirs": ["data"],
                        "permissions": {
                            "bin/ppt-gener": "0o755",
                        },
                    },
                },
            },
        )

    def test_verify_archive_requires_root_manifest_without_bundled_manifest(self) -> None:
        # The tool manifest is embedded in the binary, so the archive ships only the
        # root distribution manifest -- verify_archive must pass without bin/manifest.json.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tool_manifest_path = root / "tool-manifest.json"
            extract_dir = root / "extract"
            (extract_dir / "bin").mkdir(parents=True)
            (extract_dir / "lib").mkdir()
            (extract_dir / "data").mkdir()
            (extract_dir / "bin" / "ppt-gener").write_text("", encoding="utf-8")
            tool_manifest_path.write_text(
                f"{json.dumps(TOOL_MANIFEST)}\n",
                encoding="utf-8",
            )

            distribution_manifest = binary_release.build_distribution_manifest(
                TOOL_MANIFEST,
                binary_name="ppt-gener",
            )
            (extract_dir / "manifest.json").write_text(
                f"{json.dumps(distribution_manifest)}\n",
                encoding="utf-8",
            )

            binary_release.verify_archive(
                Namespace(
                    tool_manifest=tool_manifest_path,
                    binary_name="ppt-gener",
                    extract_dir=extract_dir,
                    platform_key="linux-aarch64",
                ),
            )

    def test_linux_cairo_runtime_excludes_core_system_libraries(self) -> None:
        self.assertFalse(
            prepare_cairo_runtime.should_bundle_linux_library(
                Path("/lib/x86_64-linux-gnu/libc.so.6")
            )
        )
        self.assertFalse(
            prepare_cairo_runtime.should_bundle_linux_library(
                Path("/lib64/ld-linux-x86-64.so.2")
            )
        )
        with tempfile.TemporaryDirectory() as tmp:
            library_path = Path(tmp) / "libcairo.so.2"
            library_path.write_text("", encoding="utf-8")
            self.assertTrue(prepare_cairo_runtime.should_bundle_linux_library(library_path))

    def test_read_tool_manifest_prefers_embedded_manifest(self) -> None:
        # When the codegen module is present, the plugin must use it and ignore
        # any on-disk manifest.json, so binary builds need no bin/manifest.json.
        original = plugin.EMBEDDED_MANIFEST
        try:
            plugin.EMBEDDED_MANIFEST = {"name": "embedded", "version": "9.9.9", "tools": []}
            self.assertEqual(plugin.read_tool_manifest(), plugin.EMBEDDED_MANIFEST)
        finally:
            plugin.EMBEDDED_MANIFEST = original

    def test_tool_manifest_candidates_prefer_binary_directory(self) -> None:
        candidates = plugin.build_tool_manifest_candidates(
            module_path=Path("/opt/ppt-gener/bin/presenton_pptx_generator_plugin.py"),
            executable_path=Path("/opt/ppt-gener/bin/ppt-gener"),
            cwd=Path("/opt/repo/ppt-app/executas/ppt-gener"),
        )

        self.assertEqual(
            candidates,
            [
                Path("/opt/ppt-gener/bin/manifest.json"),
                Path("/opt/ppt-gener/manifest.json"),
                Path("/opt/repo/ppt-app/executas/ppt-gener/manifest.json"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
