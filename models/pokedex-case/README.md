# iPhone X Pokédex 手机壳

来源：MakerWorld 设计师 Billy3D，原文件为 BambuStudio 4 色 AMS 工程（红/黑/白/浅蓝）。
双铰链翻盖设计，前脸做成宝可梦图鉴造型。

## 文件说明

- `iPhone-X-Pokedex-single-color.3mf` — 单色版。删除全部 45,289 个刷色面、6 个零件统一到 1 号挤出机，可单色直接打印。几何浮雕保留（同色后基本看不出图鉴细节）。
- `front-cover-flattened.3mf` — 前脸「中间按键区」铲平版。只在中间内凹区（X[-38,30] Y[-68.5,68.5]）把地板以上的按键/屏幕框削平成平底，**保留四周约 4mm 边框 lip**；外侧图鉴面、3 个铰链节均保留。平底 + 边框的托盘状。无刷色，单色几何，可直接打印。
- `source/iPhone-X-Pokedex-original-4color.3mf` — 原始 4 色文件副本。
- `source/front-cover-only.3mf` — 从原件抽出的「front」翻盖单片（约 49k 面），用于挖孔 / 铲平等编辑。
- `source/flatten-center.scad` — 铲平用的 OpenSCAD 脚本。`CUT_Z` 调切深、`X0/X1/Y0/Y1` 调中间区范围（缩小可多留边框）。
- `renders/` — OpenSCAD 渲染预览（纯色，仅示意形状）。

## 铲平浮雕方法（已验证）

OpenSCAD 布尔差集：用一块切刀 cube（只覆盖中间区 XY、z 从 -4.30 往上）与 `import()` 的网格求差，
削掉中间地板以上的按键，范围外的边框/铰链不动。`import(..., convexity=10)` 后可正常布尔，
CGAL 报 `Simple: yes`，约 15s，不用先修网格。命令见 `source/flatten-center.scad`。

mesh 体检/修复用 pymeshlab（已装在 `tools/mesh-venv/`，py3.12，不进 git）。
当前铲平版体检：0 非流形边、0 洞、封闭实体，无需修复。

## 已知尺寸（front 翻盖片）

- 外形约 83.5 × 148.7 mm，为薄平板。
- 内侧（按键面）有凸起浮雕：两排方键、两条横杠、两方键、一圆键，及一处凹陷「屏幕」。
- 外侧为图鉴装饰面，一条长边上有 3 个铰链节。

## 待办 / 进行中

- 在圆键位置开孔安装卡扣式橡胶按钮（grommet）：需匹配孔径 ≈ Ø11.1、卡槽宽 2.3mm；前脸现为薄板，可能需加凸台补厚。
- 移除内侧凸起浮雕做成光面（调研中）。
