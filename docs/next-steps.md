# 大道传媒网站：后续事项

最后更新：2026-11-09。目前状态：YouTube 优先的新版已在分支 `youtube-redesign` 做好（规格与计划见 `docs/superpowers/`），等预览确认后合并到 `main`。合并之前线上仍是旧版（git 标签 `v1-podcast-site`）。网域尚未连接，网站设为「不让搜索引擎收录」。

## 改版：YouTube 优先（进行中，分支 `youtube-redesign`）

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
2. 实作已完成（分支 `youtube-redesign`）。下一步：推到 GitHub，在 Vercel 预览网址确认（特别是点最新一期能在页面内播放），再合并到 `main`。
3. 合作邮箱暂用 `chenchenshentv@gmail.com`，创办人会申请一个更正式的，拿到后改设定档。
4. （可选）小红书、抖音的主页链接。目前网站上只放账号名称。
5. 只有 YouTube 内容自动同步（2026-11-09 确认）；邮箱、各平台账号、简介都是手动更新。

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
- **YouTube API 读不到**（key 失效、额度用完、网络问题）时，那次部署会失败，网站继续显示上一个好的版本。到 Vercel 的部署记录看错误讯息；要换 key 见上方第 1 条的步骤。
- 要调整更新频率：改 `.github/workflows/rebuild.yml` 里的 `*/3`。
- 她换了 YouTube banner：把新图交给 Claude 重新裁切（流程写在 `CLAUDE.md`）。
- 分享图标目前来自正式 logo 的 3544px 原档，之后如果创办人提供矢量档（SVG / AI），可以重新生成更清晰的图标。

## 清理

- 旧的 GitHub 仓库 `miloopai/shenstudio-site`（建错账户）：在该仓库 Settings 最下方 Danger Zone 删除，由项目负责人自己操作。
- `archive/` 是本机的旧文件（已被 git 忽略），确定不需要就可以整个删除。
