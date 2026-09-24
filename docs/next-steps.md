# 大道传媒网站：后续事项

最后更新：2026-09-23。目前状态：网站已上线在 Vercel 的临时网址，内容自动从 Podbean / YouTube 更新，网域尚未连接，网站设为「不让搜索引擎收录」，等创办人内容齐全再对外。

## 等创办人内容齐全后要做（正式上线）

1. **连接网域**（Namecheap 由项目负责人自己操作，Claude 不代输密码）
   - Vercel 项目 → Settings → Domains → 添加网域，Vercel 会列出要填的 DNS 记录（通常是一条 A 记录和一条 CNAME，以 Vercel 页面显示的为准）。
   - 到 Namecheap → Domain List → Manage → Advanced DNS，照抄那几条记录，等生效。
2. **打开收录**：Vercel 项目 → Settings → Environment Variables，新增 `SITE_URL`，值填 `https://她的网域`（Production 环境），然后重新部署（Deployments → 最新一笔 → Redeploy；或到 GitHub Actions 手动跑一次 Rebuild site）。
   - 之后网站会自动加上 canonical、og:url、`sitemap.xml`，`robots.txt` 改为允许收录，并拿掉 noindex。
3. **验证**：网页源码里能看到 canonical；打开 `/robots.txt`、`/sitemap.xml`；把网址贴到微信 / WhatsApp 确认分享卡片显示正常。
4. **提交给 Google**：到 Google Search Console 添加网站（网域验证要在 Namecheap 加一条 TXT 记录），提交 `sitemap.xml`。
5. **上线前检查**：
   - Vercel 免费的 Hobby 方案限非商业用途，这是公司的营销网站，考虑升级 Pro。
   - Vercel 账户与 GitHub 仓库目前在项目负责人名下，之后想把所有权交给创办人，可以把 GitHub 仓库和 Vercel 项目转移过去。
   - 页脚的 IG、FB 目前只是文字，没有链接：向创办人要账号链接，没有就删掉。
   - 有没有正式的联络邮箱要放在网站上。

## 内容 / 功能，尚未决定或尚未开始

- **YouTube 两个 playlist**：创办人的频道有两个播放列表，版面还没决定。需要：两个 playlist 的链接和名称；决定是分区显示还是混在同一个列表里用小标签区分。YouTube 每个 playlist 有自己的 RSS（`feeds/videos.xml?playlist_id=`），技术上不难。
- **第一支影片上线后验证**：影片会自动出现在列表里（目前 0 支，这条路径还没实测过）。若没出现，检查 `scripts/build.mjs` 里的 `parseYoutube` 和 YouTube feed 是否可读。
- **价目表**：已放在 `parked/pricing.html`（没有导览入口，不部署）。等创办人确定真实报价和联络邮箱再做；恢复方法写在 `CLAUDE.md`。上线前还需要：商业实体与 Stripe 账户、隐私权政策（CCPA）、合作条款、FTC 赞助内容声明（详见 handoff 第九节）。
- **文章栏位**：已移除，等写作后台（CMS）决定后再加。CMS 二选一：Sanity + Next.js，或 Ghost（handoff 第七节）。
- **每一集在本站的独立页面**（可选，SEO）：现在每集标题都连到 Podbean，搜索某一集内容时排名会落在 Podbean。做独立页面（简介全文加 Podbean 播放器）能让网站自己有可被搜索到的内容。因为页面本来就由 feed 生成，技术上做得到，属于较大的改动。
- **banner 更新**：如果创办人换了 YouTube banner（例如不再写「硅谷C位」），把新图交给 Claude 重新裁一次（流程写在 `CLAUDE.md` 的 hero 一条）。

## 需要留意的维护点

- **定时更新**：GitHub Actions 每 3 小时触发一次 Vercel Deploy Hook。GitHub 规定公开仓库 60 天内没有任何动静，定时工作会被暂停，会收到邮件通知，到仓库 Actions 页面点一下重新启用即可。
- **Deploy Hook 网址**是「触发部署的密码」，只存在 GitHub 的 Secrets（`VERCEL_DEPLOY_HOOK`），不要贴到别处。
- Podbean 读不到时，那次部署会失败，网站继续显示上一个好的版本；YouTube 读不到只是那次不显示影片。
- 要调整更新频率：改 `.github/workflows/rebuild.yml` 里的 `*/3`。
- 每集显示几个 hashtag：`scripts/build.mjs` 里的 `MAX_TAGS`（现在是 6）。
- 分享图标目前来自正式 logo 的 3544px 原档，之后如果创办人提供矢量档（SVG / AI），可以重新生成更清晰的图标。

## 清理

- 旧的 GitHub 仓库 `miloopai/shenstudio-site`（建错账户）：在该仓库 Settings 最下方 Danger Zone 删除，由项目负责人自己操作。
- `archive/` 是本机的旧文件（已被 git 忽略），确定不需要就可以整个删除。
