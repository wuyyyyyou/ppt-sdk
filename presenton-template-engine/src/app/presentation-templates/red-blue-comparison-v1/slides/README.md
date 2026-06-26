# Red Blue Comparison 最终页面

本目录存放该模板组可注册的最终页面入口。

约定：

- `group.json.layouts` 只引用本目录下的文件。
- `manifest.json` 中每页的 `source.path` 只指向本目录。
- 起步页面可以 re-export 蓝图；具体 deck 页面如果需要调整结构、间距或组件组合，应在这里直接修改。
- 当前注册页按演示 deck 顺序排列：cover、overview、economy chart、structure comparison、demographic snapshot、composition insight、population trend。
- 当前没有 timeline 或 closing slide；新增这些页型时，先在 `blueprints/` 建立真实蓝图，再新增同名 re-export。
