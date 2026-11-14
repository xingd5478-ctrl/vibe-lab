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
npm test            # 算法单测（10 个）
npm run smoke       # Edge headless DOM 冒烟
npm run e2e         # Edge CDP 端到端（拟合、报告下载、URL 恢复、PID）
npm run visual      # 截图对比基线
npm run visual:update  # 有意改版后更新基线
```

覆盖：Allan 方差、坏帧清洗、R/Q 映射、KF 收敛、积分、WLS 拟合、Worker；E2E 验证交互与下载；视觉回归对比 `tests/baselines/`（CI 用 `tests/baselines-ci/`）。

## 键盘操作

图表可用 Tab 聚焦，`←/→`（或 `↑/↓`）逐点移动，`Home/End` 跳到首尾，读数通过 `aria-live` 播报。

## 数据层

`imu-lab/static/data.js` 是列式核心（Float32Array/typed arrays）：

- `parseText / parseWithMapping`：表头识别、别名、列映射；
- `fromRows / toRows`：与现有 UI 的行对象互转；
- `cleanMask / stats`：按 CRC 与物理阈值生成掩码、统计；
- `allan / kf / csv`：Allan、KF、导出复用同一份列式数据。

小文件路径已切到该层（统计/Allan/CSV）；大文件仍走 Worker/Canvas 分支，后续把解析与 KF 也迁入 Worker。

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
