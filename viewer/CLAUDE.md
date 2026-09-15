# FBX Viewer / UV Transfer

把 OBJ 的 UV 和贴图转到带骨骼动画的 GLB 上，再预览。典型场景：Meshy AI 出的带贴图 OBJ + 现成动画 GLB → 合成带贴图的动画角色。

```bash
node transfer-uv.mjs --obj <obj> --glb <glb或目录> --texture <png> [--out <目录>]   # 重心哈希匹配 + 贪心配对，顺带生成 config.json
node bake-glb.mjs --glb <glb> --uv <uvfix.bin> --texture <png> [--out <路径>]      # 烘成自包含 GLB
python3 -m http.server 8765                                                        # 起 viewer
```

- 坐标对齐是自动的：从两边 bounding box 算 scale 和 Y offset
- **UV 用 per-corner + non-indexed geometry**，否则接缝会裂
- 代价是 baked GLB 很大（顶点 138K → 828K，约 48MB）——de-index 的必然结果，不是 bug
- Gaussian Splatting 场景用 Spark 库渲染，性能吃重
- `models/` 不提交 git
- 部署：`vc-personal deploy dist/ --prod --yes` → `dist-jiajun.vercel.app`
