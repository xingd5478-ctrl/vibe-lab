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
