# 桌下电源支架 (Desk Power Mount)

书桌底部电源/充电器固定板，使用 OpenSCAD 参数化建模。

## 最终版本

`final/mounting_plate_v9.stl` - 可直接用于 3D 打印

### 规格参数
- 中间承托板：90mm x 150mm（6mm 圆角）
- 厚度：3.2mm
- 螺丝孔距：120mm x 40mm
- 螺丝规格：M6 沉头螺丝
- 减重方式：六边形蜂窝镂空

## 设计迭代记录

| 版本 | 特点 | 厚度 | 文件大小 | 渲染时间 |
|------|------|------|----------|----------|
| v1 | 基础矩形板 + 圆形减重孔 | 5mm | 2.2MB | 1:08 |
| v2 | 板子尺寸与孔位分离设计 | 5mm | 1.3MB | 0:41 |
| v3 | 骨架结构（四角基座+连接梁） | 5mm | 940KB | 0:36 |
| v4 | 超薄版本 | 3mm | 1.2MB | 0:55 |
| v5 | 跑道形设计 | 5mm | 955KB | 0:28 |
| v6 | 十字形（大承托板+安装耳） | 5mm | 2.1MB | 1:51 |
| v7 | 六边形蜂窝 + 应力通道 | 3.2mm | 410KB | 0:22 |
| v8 | 改进蜂窝（边框保护+智能挖孔） | 3.2mm | 637KB | 0:14 |
| v9 | 圆角矩形 + 居中蜂窝图案 | 3.2mm | 680KB | 0:26 |

## 经验总结

### 1. OpenSCAD 渲染优化
- `$fn` 值影响渲染速度：60 很慢，30 足够用于打印
- 六边形（`$fn=6`）比圆形渲染快很多
- 减少布尔运算（difference/intersection）次数可大幅提速

### 2. 结构设计要点
- M6 沉头螺丝需要约 3mm 深度，板厚 3.2mm 是极限
- 螺丝孔周围需要实心保护区（半径 10-13mm）
- 边缘留 3-4mm 实心边框防止蜂窝孔打穿边缘

### 3. 蜂窝减重孔技巧
- 六边形旋转 30 度更易打印（尖角朝上）
- 筋骨宽度 1.6-1.8mm 强度够且省料
- 使用 intersection 限制挖孔区域比循环内判断更简洁

### 4. 参数化设计建议
- 核心孔位（对应桌底）和板子外观尺寸分开设置
- 关键尺寸用变量定义，方便调整
- 注释写清楚每个参数的作用

## 打印建议
- 材料：PLA 或 PETG
- 层高：0.2mm
- 填充：不需要（已有蜂窝减重）
- 壁厚：3-4 圈
- 支撑：不需要

## 安装
1. 确认桌底螺丝孔位置（120mm x 40mm）
2. 使用 4 颗 M6 沉头螺丝固定
3. 将电源/充电器放置于中间承托板上

## 文件结构
```
desk-power-mount/
├── README.md          # 本文档
├── final/             # 最终版本
│   ├── mounting_plate_v9.scad
│   └── mounting_plate_v9.stl
└── iterations/        # 迭代版本
    ├── mounting_plate.scad/stl      (v1)
    ├── mounting_plate_v2.scad/stl
    ├── mounting_plate_v3.scad/stl
    ├── mounting_plate_v4.scad/stl
    ├── mounting_plate_v5.scad/stl
    ├── mounting_plate_v6.scad/stl
    ├── mounting_plate_v7.scad/stl
    ├── mounting_plate_v8.scad/stl
    └── mounting_plate_v9.scad/stl
```

## 工具
- 建模：[OpenSCAD](https://openscad.org/)
- 命令行导出：`openscad -o output.stl input.scad`
