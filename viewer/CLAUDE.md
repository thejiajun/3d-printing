# FBX Viewer - UV Transfer Tool

## 项目简介
将 OBJ 模型的 UV 和贴图转移到 GLB 动画模型上，并提供 3D 预览。
核心场景：Meshy AI 生成的带贴图 OBJ + 带骨骼动画的 GLB → 合并为带贴图的动画角色。

## 文件结构
- `transfer-uv.mjs` — CLI 工具，OBJ→GLB UV 转移（重心哈希匹配 + 贪心顶点配对）
- `bake-glb.mjs` — 将 UV + 贴图烘焙为自包含 GLB（non-indexed geometry）
- `index.html` — Three.js viewer，从 config.json 加载模型列表，支持 Gaussian Splatting 场景
- `config.json` — viewer 配置（由 transfer-uv.mjs 自动生成）
- `run.sh` — 一键运行脚本
- `models/` — 模型和贴图文件（不要提交到 git）

## 常用命令
```bash
# UV 转移
node transfer-uv.mjs --obj <obj路径> --glb <glb路径或目录> --texture <贴图路径> [--out <输出目录>]

# 烘焙为自包含 GLB
node bake-glb.mjs --glb <glb> --uv <uvfix.bin> --texture <png> [--out <输出路径>]

# 启动 viewer
python3 -m http.server 8765
```

## 技术要点
- 坐标对齐：自动从 OBJ 和 GLB 的 bounding box 计算 scale 和 Y offset
- Per-corner UV：使用 non-indexed geometry 避免 UV 接缝裂缝
- Baked GLB 文件较大（~48MB）因为 de-indexing 导致顶点膨胀（138K → 828K）
- Gaussian Splatting 场景用 Spark 库渲染，性能较重

## 部署
- Baked GLB 部署在 Vercel 个人账号：`dist-jiajun.vercel.app`
- 用 `vc-personal deploy dist/ --prod --yes` 部署
