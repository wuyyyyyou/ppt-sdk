# `presenton-pptx-generator-executa`

这个目录是从旧的 `pptx-generator` 代码迁移出来的独立业务插件包。

它现在同时承担两层角色：

- vendored Presenton pptx-generator 代码
- Anna Executa 插件入口

## Executa 插件

插件入口文件：

- `example_plugin.py`

当前只暴露一个工具：

- `generatePptx`

### 安装依赖

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-pptx-generator
uv venv .venv
UV_CACHE_DIR=$(pwd)/.uv-cache uv pip install --python .venv/bin/python -e .
```

### 启动插件

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-pptx-generator
.venv/bin/python example_plugin.py
```

### 最小协议测试

```bash
echo '{"jsonrpc":"2.0","method":"describe","id":1}' | .venv/bin/python example_plugin.py 2>/dev/null
```

## 打包二进制

使用 Nuitka 打包，产物会写到 `bundle/` 目录下的 Anna Binary 分发包：

```bash
cd presenton-pptx-generator
./build_binary.sh
```

如果希望构建后顺手做一次协议和真实生成自测：

```bash
cd presenton-pptx-generator
./build_binary.sh --test
```

默认脚本会用 `uv` 管理 `.venv`，自动安装项目依赖以及 `nuitka`、`ordered-set`。

打包完成后目录结构类似：

```text
bundle/
  tool-youming_5703-ppt-gener-ahzv8re6-v3.1.1-darwin-arm64.tar.gz
  tool-youming_5703-ppt-gener-ahzv8re6-v3.1.1-darwin-arm64.tar.gz.sha256
```

GitHub release workflow 会构建：

- `darwin-x86_64`
- `darwin-arm64`
- `windows-x86_64`
- `linux-x86_64`
- `linux-aarch64`

Linux 包会随包携带 Cairo 相关运行库；`linux-aarch64` 是 Anna Binary 的 ARM64 Linux platform key。

包内结构类似：

```text
bin/
  ppt-gener
  manifest.json
  cairo/
  ...
lib/
data/
manifest.json
```

根目录的 `manifest.json` 是 Anna Binary 分发入口配置；`bin/manifest.json` 是插件 `describe` 返回的 Executa tool manifest。需要手动调用二进制时，先解压当前平台 archive，再调用 `bin/ppt-gener`；Windows 平台入口是 `bin/ppt-gener.exe`。

### `generatePptx`

这个工具读取 `model_path` 指向的 `PptxPresentationModel` JSON 文件，生成最终 `.pptx` 文件，并返回输出路径和摘要信息。

支持的参数：

- `model_path`
- `output_path`
- `cwd`

工具不会返回二进制文件内容，只返回写出的 `.pptx` 文件路径和结果摘要。`model_path` 和 `output_path` 必须是绝对路径；`cwd` 如提供也必须是绝对路径。

## Vendored SDK

下面保留原始 SDK 说明，便于后续继续维护底层生成源码：

Presenton 的独立 Python SDK，用来把 `PptxPresentationModel` 或兼容 JSON 生成为最终 `.pptx` 文件。

它只负责：

- `PptxPresentationModel -> .pptx`

它不负责：

- 模板查询
- HTML 渲染
- HTML 编译
- HTTP 服务封装

## 安装

```bash
pip install presenton-sdk-pptx-generator
```

本地开发时也可以：

```bash
pip install -e ./presenton-sdk/pptx-generator
```

## 最常用用法

```python
from presenton_sdk_pptx_generator import generate_pptx_sync

result = generate_pptx_sync(
    "presentation-model.json",
    output_dir="./output",
)

print(result.path)
```

也可以直接传字典：

```python
from presenton_sdk_pptx_generator import generate_pptx_sync

result = generate_pptx_sync(
    {
        "name": "demo",
        "slides": [
            {
                "shapes": [
                    {
                        "shape_type": "textbox",
                        "position": {
                            "left": 64,
                            "top": 72,
                            "width": 480,
                            "height": 80,
                        },
                        "text_wrap": True,
                        "paragraphs": [{"text": "Presenton SDK"}],
                    }
                ]
            }
        ],
    },
    output_dir="./output",
)
```

## API

### `generate_pptx(...)`

异步接口。输入可以是：

- `PptxPresentationModel`
- Python `dict`
- JSON 字符串
- JSON 文件路径

返回结构化结果：

- `path`
- `filename`
- `format`
- `slide_count`
- `presentation_name`

### `generate_pptx_sync(...)`

同步包装，适合脚本和 CLI。

### CLI

```bash
presenton-pptx-generator ./presentation-model.json --output-dir ./output
```
