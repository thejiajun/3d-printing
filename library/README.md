# 打印库 (print-library)

线上：https://print.jiajun.site （公开）

打印过的模型集中展示：卡片墙 + 可旋转缩放的 3D 预览，合并拓竹云端的打印记录。

- 模型源文件留在 `../models/`，同步时转成轻量 GLB（3MF 1.4MB → 约 90KB），保留零件、耗材颜色和盘面缩略图
- 网页和数据由一个 Cloudflare Worker 提供：网页是静态文件，`/data/*` 从私有 R2 bucket `print-library` 读取
- 与 `../viewer/`（UV 转移工具）无关，互不影响

## 日常：打印了新东西之后

```bash
npm run sync      # 拉拓竹打印记录 → 生成目录 → 上传新文件到 R2
```

网页会在一分钟内看到更新，不用重新部署。只有改了网页代码才需要 `npm run deploy`。

## 首次设置

1. 仓库根目录已绑定 wrangler 个人 profile（`wrangler auth activate personal`），在这个仓库里执行 wrangler 会自动用个人账号，不需要 token
2. 建 bucket：`npx wrangler r2 bucket create print-library`
3. 登录拓竹（邮箱验证码，token 存进 `.env.local`，约 3 个月过期，过期重跑这一步）：
   ```bash
   npm run bambu:login -- --email you@example.com               # 发验证码
   npm run bambu:login -- --email you@example.com --code 123456 # 填验证码
   ```
4. `npm run sync && npm run deploy`

## 登录与备份

- `npm run upload` 会把整个 `models/`（含 scad/blend 源文件）镜像到 R2 的 `private/backup/`，只传有变化的文件
- 访客只能下载「自己设计」和 CC 授权的原文件；Standard Digital File License 的模型只跳转 MakerWorld
- 首页底部「登录」走 Cloudflare Access（邮箱验证码），登录后所有模型都能下载（从备份取）
- Access 设置（个人账号 Zero Trust）：Self-hosted 应用，域名 `print.jiajun.site`，路径 `owner` 和 `data/private` 两条，策略 Allow 邮箱 presjch@gmail.com，登录方式 One-time PIN。把 team domain（`xxx.cloudflareaccess.com`）和应用的 AUD 填进 `wrangler.jsonc` 的 `vars` 后 `npm run deploy`

## 部署

推送 `library/**` 或部署工作流的变更到 `main` 后，GitHub Actions 会自动运行 `npm ci` 和 `npm run deploy`。仓库需要配置 Actions Secret `CLOUDFLARE_API_TOKEN`；Token 仅需个人账号的 Workers Scripts 编辑权限，以及 `jiajun.site` 的 Workers Routes 编辑权限。

## 本地开发

```bash
npm run catalog   # 只扫本地 models/，不需要任何账号
npm run dev       # http://localhost:5173，直接读 data/
```

## 目录怎么生成

| 情况 | 结果 |
|---|---|
| `models/<项目>/` 下的多个 3MF/STL | 一个项目，多个版本（`final/` 和 vN 最大的排最前；同名 3MF 优先于 STL） |
| `models/downloads/` 下的每个文件 | 各自一个项目，标题和设计师取自 3MF |
| 打印记录的 `modelId` 等于 3MF 里的 `DesignModelId` | 挂到该项目，并加 MakerWorld 链接 |
| 打印记录标题等于项目名或版本文件名 | 挂到该项目 |
| 匹配不到本地文件的打印 | 「仅打印记录」项目，只有封面图没有 3D |

拓竹接口是非官方的（Bambu Studio 自己用的那套），字段参考 [Bambu-Lab-Cloud-API](https://github.com/coelacant1/Bambu-Lab-Cloud-API)。第一次真实同步后需要核对一下字段是否一致。
