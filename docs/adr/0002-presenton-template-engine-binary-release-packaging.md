# presenton-template-engine 打包脚本产出 Binary 分发包

`presenton-template-engine` 的二进制发布入口由 `build_binary.sh` 负责产出最终 Anna Binary 分发包，而不是只产出中间裸二进制后再由 GitHub Actions 组装。这样本地打包和 CI 打包共享同一套产物规则，GitHub Actions 只负责在不同 Anna 平台 key 对应的 runner 上执行脚本、验证产物并发布 Release。

**考虑过的方案**

- 继续让 `build_binary.sh` 只生成裸二进制，由 GitHub Actions 生成 `bin/`、`lib/`、`data/`、顶层 `manifest.json`、压缩包和 sha256。拒绝，因为 release artifact 的格式规则会分散在 CI 配置里，本地难以复现完整 Anna Binary 分发包。
- 让 `build_binary.sh` 成为最终分发包入口。选择这个方案，因为它把 tool id、version、平台 key、archive 命名、sha256 和 archive 冒烟验证收敛到项目脚本中，降低本地与 CI 产物不一致的风险。
