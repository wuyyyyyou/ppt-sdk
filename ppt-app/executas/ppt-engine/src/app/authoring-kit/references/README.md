# Reference Library（参考实现库）

需要寻找可复制的视觉模式或 PPTX 稳定实现时，先读对应分类的 `README.md`，再读一个最匹配的 TSX。

- `charts/`：需要柱状图、折线图、雷达图或环形图时阅读。
- `cards/`：需要目录项、叙事列表、双值指标或进度卡时阅读。
- `comparison/`：需要分段比较或少量行列矩阵时阅读。
- `timelines/`：内容存在明确阶段、顺序或时间语义时阅读。
- `media/`：需要单张主图、说明、来源或加载失败占位时阅读。
- `pages/`：需要完整页面组合思路时阅读。

不要直接 import `references/`。复制、拆解或重写所需做法，并按 Workspace Style Guide 调整视觉。`*.preview.tsx` 只供套件维护者测试，不会安装到 Workspace。
