# 产品化待办（需要站外账号/DNS 的部分）

代码侧已经完成：英文首页与英文方法页、`?lang=en` 工具 UI、反馈页/Issue 模板、404、结构化数据、Sitemap/hreflang、浅色/深色/390px 基线。

下面两项需要在你的账号里操作，代码仓库无法单独完成：

## 1. 自定义域名

1. 在域名 DNS 添加 `CNAME` 指向 `xingd5478-ctrl.github.io`（或 Apex 用 ALIAS/ANAME）。
2. GitHub → Settings → Pages → Custom domain 填域名，开启 Enforce HTTPS。
3. 仓库新增 `landing/CNAME`，内容为域名（部署脚本会把它带到站点根）。
4. 把 `landing/index.html`、`landing/en/index.html`、`about/*` 里的 canonical / `og:image` / sitemap / `robots.txt` 中的
   `https://xingd5478-ctrl.github.io/vibe-lab/` 替换为新域名。
5. 重新跑 `npm run visual:update`（页面 URL 变化不影响截图，但 canonical 会变）。

## 2. 统计

建议用隐私友好的 GoatCounter / Plausible，不收集个人数据：

1. 在服务商建站点，拿到站点代码。
2. 在 `landing/index.html`、`landing/en/index.html` 及各工具页 `</body>` 前加统计脚本。
3. 只统计页面路径与事件（如 `fit`、`export`、`course-next`），不记录 CSV 内容或 R/Q 参数。
4. 在 `/about/en.html` 的 Data availability 附近加一句“aggregate page views only”。

## 3. 真机验收（移动端/读屏）

代码侧已有 390×844 的 CDP 基线与触控目标检查，但这不等于真机：

- iPhone Safari / Android Chrome 各走一遍 IMU 上传、Control 滑杆、Simulink 切 tab、course 上下课；
- 用 VoiceOver / TalkBack 或 NVDA 走一条完整路径；
- 200% 缩放、横屏、减少动态效果各看一次。

在这些完成前，页面不宣称“移动端/读屏已验收”。
## 4. 一键切换域名（有域名后）

```bash
node scripts/set_domain.mjs https://vibe-lab.dev
git add -A && git commit -m "chore: switch to custom domain" && git push
```

脚本会改写 canonical / OG / Sitemap / robots / README 中的站点 URL，并生成 `landing/CNAME`。
随后在 GitHub → Settings → Pages 填同一个域名并勾选 Enforce HTTPS；DNS 用 CNAME 指到
`xingd5478-ctrl.github.io`（Apex 用 ALIAS/ANAME）。没有域名时可先用免费子域
`vibe-lab.dev`（约 $12/年）或 Cloudflare Pages 的 `vibe-lab.pages.dev`（免费、无内容审核）；is-a.dev 已因 not dev related 被拒，不再使用。

## 5. 统计（隐私友好，二选一）

### 方案 A：GoatCounter（免费、无 Cookie、适合静态站）

1. 在 https://www.goatcounter.com/ 注册一个站点，得到 `https://YOURCODE.goatcounter.com/count`。
2. 在每个页面的 `</body>` 前加：

```html
<script data-goatcounter="https://YOURCODE.goatcounter.com/count"
        async src="https://gc.zgo.at/count.js"></script>
```

3. 关键事件不要用自定义维度，直接发路径：

```js
if (window.goatcounter) goatcounter.count({ path: "event/imu-fit" });
if (window.goatcounter) goatcounter.count({ path: "event/export-report" });
if (window.goatcounter) goatcounter.count({ path: "event/course-next" });
```

### 方案 B：Cloudflare Web Analytics（域名托管在 Cloudflare 时免费）

在 Cloudflare Dashboard → Analytics → Web Analytics 添加站点，复制 beacon `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"..."}'></script>`。

- 两者都不记录 CSV、R/Q 参数或个人信息；不需要 cookie banner。
- GitHub Pages 自带的 Traffic 只有仓库管理员可见、14 天，不能当公开统计。
- 如果暂时不接第三方：至少每周从 GitHub Insights 记录 stars / issues / referrers 三项，作为反馈闭环的基线。

## 6. 反馈闭环（不写后端）

现有 `/feedback.html` + `.github/ISSUE_TEMPLATE/feedback.yml` 已经把反馈落到 GitHub Issues。建议补三件事：

1. **标签**：`bug`、`content`、`idea`、`question`、`wontfix`；每月统计 open/closed、首响时间、修复率。
2. **非 GitHub 用户**：加一个 Tally / Formspree 表单（免费档），提交后邮件通知；表单字段与 issue 模板一致（页面、浏览器、复现步骤、是否可公开）。
3. **公开回复**：每个 issue 关闭时写一句“改了什么/为什么不做”，这是“反馈闭环数据”里最有价值的部分。

如果以后要仪表盘，再把 Tally CSV 或 Issues 导出到 Sheets/Supabase；不要为了统计给静态站加后端。
