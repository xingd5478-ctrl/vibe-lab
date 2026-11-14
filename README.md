# vibe-lab

传感器与控制的可视化实验室：三个零依赖的浏览器工具 + 方法页 + 英文首页 + 43/43 MATLAB 对照。

**线上：** https://xingd5478-ctrl.github.io/vibe-lab/

## 目录

```
vibe-lab/
├── landing/             # 首页 + en/ 英文首页 + 404/反馈 + sw.js（PWA）
├── about/               # 方法说明、en.html、matlab.html（43/43 对照）
├── imu-lab/
│   ├── static/          # ① IMU 数据实验室（部署到 /imu/）
│   └── app.py           #    Streamlit 备份
├── control-play/        # ② 二阶系统 + PID（部署到 /control/）
├── simulink/            # ③ Simulink 教程交互复现（部署到 /simulink/）
├── shared/              # Python 共享算法 + i18n.js
├── data/                # 样例数据 + matlab-probes.json（模型哈希/求解器/信号）
├── tests/               # Node 单测 + 浅色/深色视觉基线
├── scripts/             # smoke / visual / perf / MATLAB 数据检查
└── .github/workflows/   # Pages 部署 + 单测 CI
```

## 快速开始

```bash
# 本地预览（推荐，避免 file:// 的浏览器限制）
python -m http.server 8000
# 首页：http://localhost:8000/landing/
# 英文首页：http://localhost:8000/landing/en/
# IMU：http://localhost:8000/imu-lab/static/
# 控制：http://localhost:8000/control-play/
```

也可以直接双击 `landing/index.html`（链接会自动切到本地路径）。

## 测试

```bash
npm test            # 算法/数据/Worker/Simulink/图表配色/MATLAB 数据单测（62 个）
npm run smoke       # Edge CDP DOM 冒烟（11 项）
npm run e2e         # Edge CDP 端到端 + axe（浅色/深色/英文 UI）
npm run perf        # 运行时预算：ready/LCP/CLS/长任务/交互延迟
npm run check:matlab# 校验 43 个模型哈希与 matlab.html 是否同步
npm run bigtest     # 200k 行 Worker 全链路
npm run visual      # 浅色截图对比基线
npm run visual:dark # 深色截图对比基线
npm run visual:update / visual:dark:update  # 有意改版后更新基线
```

覆盖：Allan 方差、坏帧清洗、R/Q 映射、KF 收敛、积分、WLS/IRLS 拟合、Worker、列式数据层、Simulink 复现；E2E 验证交互/下载、英文 UI，并跑 **axe-core**（WCAG 2 A/AA，浅色 + 深色），要求 0 serious/critical；运行时预算含 ready/LCP/CLS/长任务，CI 用 `PERF_SCALE=2` 放宽；浅色与深色截图分别对比 `tests/baselines*`。

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

**页面分工**：`/simulink/` 只放 19 个交互实验 + 8 个阶段入口；`/simulink/course.html` 是唯一的 43 课讲义目录（含搜索、上下课、下载、交互实验直达）。不再维护两份课程列表。

**讲义结构**：43 课统一为「生活类比 → 目标 → 概念卡 → 公式读法 → Simulink 步骤 → 运行后看什么 → 新手坑 → 自测」；交互 19 个，覆盖 21 课。

**模型下载**：43 个 `.slx` 已托管在 `simulink/models/`（约 3.8 MB，MIT，见 `NOTICE.md`），每课讲义页提供同源 `download` 链接，`npm run smoke/e2e` 会校验下载文件是 zip。更新模型用 `node scripts/vendor_models.mjs`。

## 三个工具

- **IMU 数据实验室**（`/imu/`）：CSV → CRC 清洗 → Allan → ARW/RRW → R/Q → KF，附 **10 章实验手册**；页面用「实验台 / 手册」标签切换；
- **Control Play**（`/control/`）：二阶 Bode/阶跃/PID + **状态反馈、观测器、根轨迹、离散化 4 个扩展实验**，附 **14 章实验手册**；页面用「实验台 / 扩展实验 / 手册」标签切换；
- **Simulink 教程**（`/simulink/`）：43 课讲义 + 19 个交互实验 + 43 个 `.slx` 下载；课程按 **精读 / 合格 / 概念** 分级。

首页提供「从哪开始」三条路径 + 全站顶栏；`/en/` 是英文概览页（工具与讲义仍为中文），带 hreflang 与语言切换；9 门「概念」课带可计算的小例子；`npm run check:chart` 在 CI 中保证三份 `chart.js` 不漂移。

## MATLAB 43/43 对照

- `tools/probe_all.m` 对 43 个 `.slx` 逐一仿真；t39 的引用子模型放在 `simulink/models/refs/`，t42 的 S-Function 在 `tools/deadzone_sfcn.m`。
- `artifacts/simulink/probes.json` 是 MATLAB 原始输出（gitignore）；`node scripts/build_matlab_data.mjs` 加上 **SHA-256、MATLAB 版本、solver、停止时间、信号统计**，写出 `data/matlab-probes.json`。
- `node scripts/build_matlab_table.mjs` 从 JSON 生成 `about/matlab.html`，不再手抄表格；`npm run check:matlab` 校验模型哈希与表格同步。
- 43/43 全部可仿真；t24 的 FIS 是探针占位、t35 的输出疑似连线问题、t32 的倒立摆未闭环稳定等差异都在表里写明。

## 英文 UI（beta）

`?lang=en` 或 `localStorage("vibe-lang")` 启用 `shared/i18n.js`：翻译导航、控件标签、图表轴/图例、指标名与 43 课标题；讲义正文与部分长提示仍为中文，页面顶部有明确提示。英文首页 `/en/`、英文方法页 `/about/en.html`；中文页面顶部自动出现 EN/中文切换。`npm run e2e` 会验证英文 UI 与 axe。

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

## 深色模式

跟随系统 `prefers-color-scheme`：面板、代码块、提示框用 CSS 变量统一切换；SVG/Canvas 图表通过 `--chart-*` 变量换色，系统主题切换时实时重绘。`npm run e2e` 在深色仿真下再跑一遍 axe；`npm run visual:dark` 对比 `tests/baselines-dark/`；`tests/contrast.test.js` 校验深色图表系列/坐标轴和控件边框的 **WCAG 1.4.11 ≥3:1**。

## 离线 / PWA

页面在 https 下注册 `sw.js`，缓存静态资源；IMU/Control/about/MATLAB 对照/英文页可离线打开（数据 CSV 不缓存）。`manifest.webmanifest` 提供安装信息与图标，支持“添加到主屏幕”。

## 许可

代码与设计采用 MIT（见 `LICENSE`）；实验数据不包含在许可内，不得再发布。

## 线上结构

| 路径 | 内容 |
|---|---|
| `/` | 首页（landing） |
| `/en/` | 英文首页（English overview） |
| `/about/matlab.html` | MATLAB 43/43 对照（哈希/求解器/信号） |
| `/about/en.html` | 英文方法说明 |
| `/feedback.html` | 反馈入口（GitHub issue 模板） |
| `/imu/` | IMU 数据实验室 |
| `/control/` | Control Play |
| `/about/` | 方法说明与局限 |

## 约定

- 三个子项目各自独立；共享 JS 只有 `allan.js / kf.js / fit.js`。
- 数据不进 Git（`data/sample` 除外）。
- 每个子项目一个 README：写“现在能做什么 / 下一步 / 怎么跑”。
