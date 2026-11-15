# 全免费上线方案（0 元）

目标：保留现在的 GitHub Pages 托管，用免费子域 + 免费统计 + 免费反馈，不买服务器、不买数据库。

| 项 | 选型 | 费用 | 需要谁操作 |
|---|---|---|---|
| 域名 | `vibe-lab.is-a.dev` | 0 元 | 你手动提 PR（is-a.dev 明确不接受 AI 代提） |
| 托管 | GitHub Pages | 0 元 | 已就绪 |
| 统计 | GoatCounter 托管版 | 0 元 | 你注册，把 site code 给我 |
| 反馈 | GitHub Issues + Tally | 0 元 | 已有 Issues；Tally 免费注册 |
| 反馈数据 | `/feedback.html` 实时读 Issues | 0 元 | 已上线 |

## 1. 免费域名：`vibe-lab.is-a.dev`

我查了 `is-a-dev/register` 的 `domains/vibe-lab.json`，目前不存在，名字看起来可用（以 PR 合并时为准）。

按官方 [GitHub Pages 指南](https://docs.is-a.dev/guides/github-pages/)：

1. Fork [is-a-dev/register](https://github.com/is-a-dev/register)。
2. 新建 `domains/vibe-lab.json`，内容照官方模板：

```json
{
  "owner": {
    "username": "xingd5478-ctrl"
  },
  "records": {
    "CNAME": "xingd5478-ctrl.github.io"
  }
}
```

3. 提交 PR，标题写 `Add vibe-lab.is-a.dev`，等合并。
4. **合并后**再执行：

```bash
node scripts/set_domain.mjs https://vibe-lab.is-a.dev
git add -A && git commit -m "chore: switch to vibe-lab.is-a.dev" && git push
```

5. GitHub → Settings → Pages → Custom domain 填 `vibe-lab.is-a.dev`，勾选 Enforce HTTPS。

> 不要在 PR 合并前改 canonical/CNAME，否则 GitHub Pages 会 404。  
> is-a.dev 的 README 写明“不要用 AI 生成申请”，所以这一步需要你本人提交；代码侧我已把 `set_domain` 和一键改写准备好。

## 2. 免费统计：GoatCounter

[GoatCounter](https://www.goatcounter.com/) 是开源、无 Cookie、无个人追踪的托管统计，个人站免费。

1. 注册后得到 `https://YOURCODE.goatcounter.com/count`。
2. 在页面 `</body>` 前加：

```html
<script data-goatcounter="https://YOURCODE.goatcounter.com/count"
        async src="https://gc.zgo.at/count.js"></script>
```

3. 关键事件直接发路径：

```js
goatcounter.count({ path: "event/imu-fit" });
goatcounter.count({ path: "event/export-report" });
goatcounter.count({ path: "event/course-next" });
```

4. 把 YOURCODE 给我，我可以统一加到首页、三个工具、课程页，并在 e2e 里验证只发事件、不采集 CSV/参数。

备选：Cloudflare Web Analytics（免费，但需要把域名托管到 Cloudflare）；不推荐 Google Analytics（Cookie/同意横幅，和“零依赖”定位冲突）。

## 3. 免费反馈：GitHub Issues + Tally

本站当前已接：GoatCounter site `xingdong`（`https://xingdong.goatcounter.com/count`），Tally 表单 `https://tally.so/r/9N98bY`。

- GitHub Issues 已经可用，标签已建：`bug` / `content` / `idea` / `question` / `wontfix` / `feedback`；
- `/feedback.html` 已实时读取公开 Issues，0 条时如实显示 0，不需要数据库；
- 非 GitHub 用户用 [Tally](https://tally.so/pricing) 免费版（无限表单/提交），建一个 4 字段表单：
  页面 URL、问题类型、复现步骤、是否可公开；
- 把 Tally 链接加到 `/feedback.html` 的 “没有 GitHub 账号？” 位置即可。Tally 免费版有品牌标识，但不需要付款。

## 总成本与时间

- 现金：**0 元**
- 时间：域名 PR 10 分钟 + 等审核；GoatCounter 10 分钟；Tally 10 分钟
- 你需要给我的只有两个值：`is-a.dev` PR 合并后的域名、GoatCounter 的 site code（Tally 链接可选）。

## 备选：完全不想提 PR

用 Cloudflare Pages 的免费 `vibe-lab.pages.dev` + Cloudflare Web Analytics。  
优点：一个免费账号解决域名和统计；缺点：要从 GitHub Pages 迁到 Cloudflare Pages，canonical 全改，且 `pages.dev` 仍是子域而不是独立域名。当前 GitHub Pages 方案更省事。
