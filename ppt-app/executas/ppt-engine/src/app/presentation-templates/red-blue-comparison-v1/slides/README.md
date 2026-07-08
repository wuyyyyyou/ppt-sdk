# Red Blue Comparison 最终页面

本目录存放该模板组可注册的最终页面入口。

约定：

- `group.json.layouts` 只引用本目录下的文件。
- `manifest.json` 中每页的 `source.path` 只指向本目录。
- 起步页面可以 re-export 蓝图；具体 deck 页面如果需要调整结构、间距或组件组合，应在这里直接修改。
- 当前注册页按演示 deck 顺序排列：cover、overview、economy chart、structure comparison、demographic snapshot、composition insight、population trend、technology KPI、evidence image/table、timeline、closing。
- 本目录入口通常只 re-export 同名 blueprint；如果某个具体 deck 需要调整结构、间距或组件组合，再在 slides 中派生出最终实现。
