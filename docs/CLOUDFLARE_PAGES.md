# Cloudflare Pages 免费部署（推荐，无内容审核）

目标：拿到 `https://vibe-lab.pages.dev`，同时免费使用 Cloudflare Web Analytics。  
GitHub Pages 可以继续保留作为备份。

## 1. 生成静态目录

仓库已经包含构建脚本：

```bash
npm run build:site
```

它会把站点组装到 `_site/`（HTML、CSS、JS、预览图、data、shared），不会包含 `CNAME`。

## 2. 注册/登录 Cloudflare

打开 https://dash.cloudflare.com/sign-up ，用邮箱注册免费账号（不需要付款方式）。

## 3. 创建 Pages 项目

1. 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权 GitHub，选择仓库 `xingd5478-ctrl/vibe-lab`
3. 项目名填 `vibe-lab`（决定 `vibe-lab.pages.dev`）
4. 构建设置：
   - **Framework preset**：None
   - **Build command**：`node scripts/build_site.mjs`
   - **Build output directory**：`_site`
5. 点 **Save and Deploy**

第一次构建完成后会得到：

```
https://vibe-lab.pages.dev
```

`pages.dev` 是 Cloudflare 免费子域，不需要买域名，也不需要 DNS 配置。

## 4. 打开免费统计

Cloudflare Dashboard → **Analytics & Logs** → **Web Analytics** → **Add a site**  
选择刚创建的 Pages 项目，开启即可。它是无 Cookie 的聚合统计，不需要 cookie banner。

GoatCounter 也可以继续保留；两套统计不冲突。

## 5. 切换 canonical（可选，但推荐）

部署成功、`pages.dev` 能打开后：

```bash
node scripts/set_domain.mjs https://vibe-lab.pages.dev --no-cname
git add -A && git commit -m "chore: point canonical to vibe-lab.pages.dev" && git push
```

`--no-cname` 不会写 `landing/CNAME`（Cloudflare Pages 不需要）；它会改 canonical / OG / Sitemap / robots / README。  
改完后在 Cloudflare Pages 上点一次 **Retry deployment**，让新 canonical 生效。

## 6. 验证

- `https://vibe-lab.pages.dev/` → 200
- `https://vibe-lab.pages.dev/en/guide.html` → 200
- `https://vibe-lab.pages.dev/imu/?lang=en` → 英文
- `https://vibe-lab.pages.dev/feedback.html` → 反馈看板
- Cloudflare Web Analytics 里出现第一次访问

## 说明

- 这不是独立域名，是 `pages.dev` 子域；免费、稳定、无内容审核。
- 如果以后买 `vibe-lab.dev`，在 Cloudflare Pages → Custom domains 绑定，再跑一次 `set_domain` 即可。
- 不想迁移：继续用 `xingd5478-ctrl.github.io/vibe-lab/`，功能完全一样，只是 URL 长一点。
