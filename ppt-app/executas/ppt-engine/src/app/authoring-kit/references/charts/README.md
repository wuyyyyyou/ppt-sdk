# Charts（图表参考）

- `BarChart.tsx`：比较少量类别或主体的数值大小时参考。支持横向/纵向方向，并默认让少量类别的数值可读。
- `LineChart.tsx`：表达按时间或顺序变化的趋势时参考。少量数据点显示关键值，密集趋势只保留关键值。
- `RadarChart.tsx`：比较少量主体的多个共同维度时参考。
- `DonutChart.tsx`：表达一个整体内部的少量占比时参考；当前参考默认显示百分比。

图表依赖父容器尺寸时必须配合 `foundations/MeasuredChartArea.tsx`。精确值图表必须让关键数值、单位和统计范围可读；没有数据时不要复制 Preview 中的示意数值。
