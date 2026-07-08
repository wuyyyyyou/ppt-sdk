# Use pptx-svg for PPTX Rasterization

PPT App will use `pptx-svg` as the first PPTX Rasterization backend for turning user-provided PPTX files into PNG Reference Slide Images, keeping SVG as an intermediate diagnostic artifact. This avoids requiring users or packaged binaries to provide a local LibreOffice installation, while accepting the maturity risk of a newer PPTX renderer and the requirement that `ppt-engine` run on Node.js 22+.

**Considered Options**

- Use local LibreOffice / `soffice`. Rejected for the first version because it adds an external desktop-suite dependency that is awkward to bundle into Anna Binary distributions.
- Use `pptx-svg`. Accepted because it runs in Node/browser without a LibreOffice dependency and can render PPTX slides to SVG, which can then be converted into PNG Reference Slide Images.
- Build a custom PPTX renderer. Rejected because high-fidelity PowerPoint rendering is too broad for this feature phase.

**Consequences**

- `ppt-engine` may raise its runtime and binary packaging baseline to Node.js 22+ for this capability.
- PPTX Rasterization should be treated as best-effort visual preparation for Style Profile Creation, not as a guaranteed PowerPoint-compatible renderer.
- Reference Slide Images are PNG outputs that preserve the source slide aspect ratio with a target height of 720 pixels; SVG files are kept only as intermediate diagnostic artifacts.
- The rasterization tool receives absolute input and output paths from its caller and does not own any app-specific storage policy.
- A small compatibility proof should verify representative PPTX files before the feature depends on this path.
