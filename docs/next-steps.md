# 大道传媒网站：后续事项

最后更新：2026-11-10。目前状态：YouTube 优先的新版已上线，正式网址 **https://shenstudio.tv**（`www.shenstudio.tv` 会自动转过来），`https://shenstudio-site.vercel.app` 也是同一个网站。首页在访客打开时生成、缓存 10 分钟，她发片后约 10 分钟内就会显示。网页标题「大道传媒 Shen Studio｜沈琛琛」。搜索引擎收录已打开。旧版在 git 标签 `v1-podcast-site`。

## 改版：YouTube 优先（已上线）

规格：`docs/superpowers/specs/2026-11-09-youtube-first-redesign-design.md`。设计稿（白色版）：https://claude.ai/artifact/4aVdEghGcWXDrGJeQZtr2m

1. **YouTube Data API key：已完成（2026-11-09）。** 用项目负责人自己的 Google 账号（网站只读频道的公开资料，不需要创办人的账号）；Vercel 环境变量与 `.env.local` 都已设定。以后要交接，在 Google Cloud 项目里把创办人加为所有者，或换成她账号下的一把 key，网站本身不用改。以下步骤留作日后换 key 的参考。
   - 打开 https://console.cloud.google.com/ ，用自己的 Google 账号登录（第一次会要求同意 Terms of Service、选 Country）。
   - 顶部的项目选单（**Select a project**）→ **NEW PROJECT**，Project name 例如 `dadao-website` → **CREATE**，然后在项目选单里切换到这个项目。
   - 打开 https://console.cloud.google.com/apis/library/youtube.googleapis.com （YouTube Data API v3）→ **ENABLE**。
   - 左侧 **APIs & Services** → **Credentials** → **+ CREATE CREDENTIALS** → **API key**。在 **Create API key** 里：
     - **Name**：随意，例如 `dadao-website-youtube`。
     - 如果有 **Authenticate API calls through a service account** 勾选框：不要勾。
     - **Application restrictions**：**None**（Vercel 的服务器 IP 不固定）。
     - **API restrictions**：选 **Restrict key**，下拉选单只勾 **YouTube Data API v3**（找不到它表示上一步还没 ENABLE）。
     - 按 **Create**，在 **API key created** 视窗里复制密钥。之后也能在 Credentials 页点 **Show key** 再看。
   - 不需要绑信用卡，也不用开 **Free trial**（$300、90 天的赠送额度，开通当天才开始计时，以后需要再开）。YouTube Data API 每天有 10,000 单位的免费额度，网站每天用不到 100。
   - Vercel 项目 → **Settings** → **Environment Variables**：**Key** 填 `YOUTUBE_API_KEY`，**Value** 填那把密钥，**Environments** 选 **Production** 和 **Preview** → **Save**。
   - 本机测试：在 repo 根目录建一个 `.env.local`，内容一行 `YOUTUBE_API_KEY=那把密钥`。这个文件已列入 `.gitignore`，不会进 git。
   - 密钥外泄的最坏情况是额度被别人用光：到「凭证」页删掉、重建一把，再更新 Vercel 和 `.env.local`。
2. 实作已完成并上线（2026-11-09）：预览版在项目负责人的 Chrome 里点过，最新一期直接嵌入 YouTube 播放器，点一下就播；之后合并到 `main`，手动跑过一次 Rebuild site（含每月保活），两项都成功。
3. 合作邮箱暂用 `chenchenshentv@gmail.com`，创办人会申请一个更正式的，拿到后改设定档。
4. （可选）小红书、抖音的主页链接：请创办人在 App 里打开自己的主页 → 分享 → 复制链接，拿到后在 `src/site.json` 对应平台加 `"url"`。视频号没有网页版主页，只能保留「在微信搜索」，或改放她的视频号二维码图片。
5. 只有 YouTube 内容自动同步（2026-11-09 确认）；邮箱、各平台账号、简介都是手动更新。
6. **自动更新改为访客打开时生成（2026-11-10 上线）**：`/` 由 Vercel Function `api/home.mjs` 生成，Vercel CDN 缓存 10 分钟（上线时实测第一次 `MISS`、第二次 `HIT`）。读 YouTube 失败时回传部署时生成的备用页 `fallback/index.html`，60 秒后再试。规格见 spec 第 11 节，计划 `docs/superpowers/plans/2026-11-10-live-render.md`。
7. 请创办人在她 YouTube 频道的「链接」里加上 `https://shenstudio.tv`（项目负责人会转告，2026-11-10）。

## 正式上线（网域 shenstudio.tv）

网域在 Namecheap（账号 cici0416），网址主机是 Vercel 团队「ShenStudio」的项目 `shenstudio-site`。主网址用 **shenstudio.tv**（她买的就是这个，2026-11-10 由 www 改过来），`www.shenstudio.tv` 308 转到它。

1. **连接网域**
   - 已完成（2026-11-09）：Vercel → **Settings** → **Domains** 加了 `shenstudio.tv`（转到 www）和 `www.shenstudio.tv`（Production）；Namecheap → **Advanced DNS** 的 `www` CNAME 改为 `a0c271f10c5bf3b5.vercel-dns-017.com.`，`https://www.shenstudio.tv` 已经是新网站（HTTPS）。
   - `@` 记录：项目负责人把 **URL Redirect Record** 改成 **A Record** `216.198.79.1`（2026-11-10；Claude 改这一笔时被权限系统挡下）。Vercel 两个网域都已通过、SSL 证书已签发。
   - 2026-11-10 改主网址：Vercel **Domains** 里 `shenstudio.tv` 改为 **Connect to an environment: Production**，`www.shenstudio.tv` 改为 **Redirect to Another Domain: 308 → shenstudio.tv**。DNS 不用动。
   - 不要动 **MAIL SETTINGS**（Private Email）：那是这个网域的邮箱设定，跟网站无关。
2. **打开收录**：已完成。Vercel 环境变量 `SITE_URL=https://shenstudio.tv`（**Config** 类型，只设 Production；2026-11-10 从 www 改过来）。上线检查：canonical 为 `https://shenstudio.tv/`、没有 noindex，`/robots.txt` 允许收录并指向 sitemap，`/sitemap.xml` 已生成。预览版没有 `SITE_URL`，仍然不收录。
   - 在 Vercel 网页上按 **Redeploy**、或查看 / 修改环境变量的值，会要求输入寄到 shenstudio.ai@gmail.com 的验证码（由项目负责人输入）。只想重新部署时，到 GitHub → **Actions** → **Rebuild site** → **Run workflow** 不需要验证码。
3. **验证**：把 `https://shenstudio.tv` 贴到微信 / WhatsApp 确认分享卡片显示正常。
4. **提交给 Google**：暂时不做（项目负责人 2026-11-10 决定，需要时再说）。届时到 Google Search Console 添加网站，提交 `https://shenstudio.tv/sitemap.xml`；用 Domain 方式验证要在 Namecheap 加一条 TXT 记录。
5. **上线前检查**：
   - Vercel 免费的 Hobby 方案限非商业用途，这是公司的营销网站，考虑升级 Pro。
   - Vercel 账户与 GitHub 仓库目前在项目负责人名下，之后想把所有权交给创办人，可以把 GitHub 仓库和 Vercel 项目转移过去。
   - 页脚的 IG、FB：改版后换成小红书 / 视频号 / 抖音 / 播客（见上方改版一节）。
   - 正式合作邮箱：见上方改版一节第 3 条。

## 内容 / 功能，尚未决定或尚未开始

- **YouTube 播放列表 / 第一支影片**：由改版处理（栏目＝她自己的播放列表）。旧做法用的 YouTube RSS 已全面失效，改版改用 YouTube Data API。
- **价目表**：已放在 `parked/pricing.html`（没有导览入口，不部署）。等创办人确定真实报价和联络邮箱再做；恢复方法写在 `CLAUDE.md`。上线前还需要：商业实体与 Stripe 账户、隐私权政策（CCPA）、合作条款、FTC 赞助内容声明（详见 handoff 第九节）。
- **文章栏位**：已移除，等写作后台（CMS）决定后再加。CMS 二选一：Sanity + Next.js，或 Ghost（handoff 第七节）。
- **每支影片在本站的独立页面**（可选，SEO）：现在影片卡片都连到 YouTube，搜索某一期内容时排名会落在 YouTube。做独立页面（简介全文加嵌入播放器）能让网站自己有可被搜索到的内容，再把人带去看影片。页面本来就由 API 资料生成，技术上做得到，属于较大的改动。
- **banner 更新**：如果创办人换了 YouTube banner，告诉 Claude 重新下载、裁切（流程写在 `CLAUDE.md` 的 Brand 一条）。

## 需要留意的维护点

- **改栏目、邮箱、平台账号、简介**：都在 `src/site.json`，改完 commit 推上去即可（推到 `main` 会自动部署）。格式写错时 build 会报出是哪一项。
- **定时更新**：GitHub Actions 每 3 小时触发一次 Vercel Deploy Hook；每月 1 日自动提交一次 `.github/keepalive`，GitHub 就不会因 60 天没动静而暂停定时任务。
- **Deploy Hook 网址**是「触发部署的密码」，只存在 GitHub 的 Secrets（`VERCEL_DEPLOY_HOOK`），不要贴到别处。
- **YouTube API 读不到**（key 失效、额度用完、网络问题）时：访客看到的是部署时生成的备用页（内容停在上次部署时），错误记在 Vercel 项目的 **Logs**；部署本身也会失败，Vercel 继续用上一个好的版本。要换 key 见上方第 1 条的步骤。每次生成首页约用 4 个额度单位，免费额度每天 10,000。
- 要调整更新频率：改 `.github/workflows/rebuild.yml` 里的 `*/3`。
- 她换了 YouTube banner：把新图交给 Claude 重新裁切（流程写在 `CLAUDE.md`）。
- 分享图标目前来自正式 logo 的 3544px 原档，之后如果创办人提供矢量档（SVG / AI），可以重新生成更清晰的图标。

## 清理

- 旧的 GitHub 仓库 `miloopai/shenstudio-site`（建错账户）：在该仓库 Settings 最下方 Danger Zone 删除，由项目负责人自己操作。
- `archive/` 是本机的旧文件（已被 git 忽略），确定不需要就可以整个删除。
