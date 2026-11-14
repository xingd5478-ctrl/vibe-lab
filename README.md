# vibe-lab

传感器与控制的可视化实验室：两个零依赖的浏览器工具 + 一个说明页。

**线上：** https://xingd5478-ctrl.github.io/vibe-lab/

## 目录

```
vibe-lab/
├── landing/             # 首页 + sw.js（PWA）
├── about/               # 方法说明与局限
├── imu-lab/
│   ├── static/          # ① IMU 数据实验室（部署到 /imu/）
│   └── app.py           #    Streamlit 备份
├── control-play/        # ② 二阶系统 + PID（部署到 /control/）
├── simulink/            # ③ Simulink 教程交互复现（部署到 /simulink/）
├── shared/              # Python 共享算法
├── tests/               # Node 单测 + 视觉基线
├── scripts/             # smoke / visual 检查
├── data/sample/         # 合成样例数据
└── .github/workflows/   # Pages 部署 + 单测 CI
```

## 快速开始

```bash
# 本地预览（推荐，避免 file:// 的浏览器限制）
python -m http.server 8000
# 首页：http://localhost:8000/landing/
# IMU：http://localhost:8000/imu-lab/static/
# 控制：http://localhost:8000/control-play/
```

也可以直接双击 `landing/index.html`（链接会自动切到本地路径）。

## 测试

```bash
npm test            # 算法/数据/Worker/Simulink 单测（28 个）
npm run smoke       # Edge CDP DOM 冒烟（5 页）
npm run e2e         # Edge CDP 端到端 + axe 无障碍
npm run bigtest     # 200k 行 Worker 全链路
npm run visual      # 截图对比基线
npm run visual:update  # 有意改版后更新基线
```

覆盖：Allan 方差、坏帧清洗、R/Q 映射、KF 收敛、积分、WLS/IRLS 拟合、Worker、列式数据层、Simulink 复现；E2E 验证交互/下载并跑 **axe-core**（WCAG 2 A/AA），要求 0 serious/critical；视觉回归对比 `tests/baselines/`（CI 用 `tests/baselines-ci/`）。

## 键盘操作

图表可用 Tab 聚焦，`←/→`（或 `↑/↓`）逐点移动，`Home/End` 跳到首尾，读数通过 `aria-live` 播报。

## 前端模块

```
imu-lab/static/
├── data.js     # 列式数据层：解析/清洗掩码/统计/Allan/KF/CSV
├── chart.js    # 图表模块：SVG plot + Canvas 大图 + hover/键盘
├── allan.js    # Allan 方差
├── kf.js       # R/Q 映射与 KF
├── fit.js      # WLS 拟合 + 回归区间
├── app.js      # 交互/状态/导出
└── index.html
```

`data.js` 与 `chart.js` 是独立模块，可被其它页面复用；`app.js` 只负责状态与交互。

## Simulink 教程页

`/simulink/` 把 [simulink-control-tutorial](https://github.com/xingd5478-ctrl/simulink-control-tutorial)（43 课 / 8 阶段）做成可检索目录，并提供 5 个浏览器内交互复现：

- t03 一阶系统（τ / K）
- t04 二阶系统（ωn / ζ）
- t10 状态反馈 / 极点配置
- t11 Luenberger 观测器（含测量噪声）
- t21 滑模控制（边界层与抖振）

仿真内核在 `simulink/control.js`（UMD，可单测），图表复用 `chart.js`。`.slx` 是 MATLAB 二进制模型，浏览器不能直接运行；页面复现的是同一套数学，并链接每课的 `.m` / `.slx`。

**完整讲义阅读器**：`/simulink/course.html` 提供 43 课讲义、注释、代码与结果图。为控制站点体积，课程内容按需从教程仓库的 jsDelivr CDN 读取（失败回退 raw GitHub；再失败保留源链接），本站负责排版、搜索与上下课导航。

**新手讲义（第一批）**：t01–t08 已重写为「傻瓜式」结构：生活类比 → 本课目标 → 关键概念 → 公式读法 → Simulink 步骤 → 运行后看什么 → 新手坑 → 自测。课程页会自动展示 `simulink/guide.js` 中的讲义。交互复现目前 7 个：t01/t02/t06（信号与增益）、t03、t04、t05 PID、t10、t11、t21。其余课程按每批 8 课继续重写。

**模型下载**：43 个 `.slx` 已托管在 `simulink/models/`（约 3.8 MB，MIT，见 `NOTICE.md`），每课讲义页提供同源 `download` 链接，`npm run smoke/e2e` 会校验下载文件是 zip。更新模型用 `node scripts/vendor_models.mjs`。

## 数据层

`imu-lab/static/data.js` 是列式核心（Float32Array/typed arrays）：

- `parseText / parseWithMapping`：表头识别、别名、列映射；
- `fromRows / toRows`：与现有 UI 的行对象互转；
- `cleanMask / stats`：按 CRC 与物理阈值生成掩码、统计；
- `allan / kf / csv`：Allan、KF、导出复用同一份列式数据。

小文件路径已切到该层（统计/Allan/CSV）；大文件（>150k 帧）在 `data-worker.js` 解析、`allan-worker.js`/`kf-worker.js` 计算，主线程只负责渲染（Canvas 大图）。

- ≤100k 帧：全部 SVG 渲染；
- >100k 帧：时域图改 Canvas（逐像素 min/max），>150k 帧时 Allan 交给 `allan-worker.js`，主线程不阻塞；
- 2 h 数据（~720k 帧）可直接上传，K/V 仍在主线程（约 45 ms）。

## 离线 / PWA

页面在 https 下注册 `sw.js`，缓存静态资源；IMU/Control/about 可离线打开（数据 CSV 不缓存）。`manifest.webmanifest` 提供安装信息与图标，支持“添加到主屏幕”。

## 许可

代码与设计采用 MIT（见 `LICENSE`）；实验数据不包含在许可内，不得再发布。

## 线上结构

| 路径 | 内容 |
|---|---|
| `/` | 首页（landing） |
| `/imu/` | IMU 数据实验室 |
| `/control/` | Control Play |
| `/about/` | 方法说明与局限 |

## 约定

- 三个子项目各自独立；共享 JS 只有 `allan.js / kf.js / fit.js`。
- 数据不进 Git（`data/sample` 除外）。
- 每个子项目一个 README：写“现在能做什么 / 下一步 / 怎么跑”。
