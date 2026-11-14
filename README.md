# vibe-lab

传感器与控制的可视化实验室：两个零依赖的浏览器工具 + 一个说明页。

**线上：** https://xingd5478-ctrl.github.io/vibe-lab/

## 目录

```
vibe-lab/
├── landing/             # 首页：两个工具的入口
├── about/               # 方法说明与局限
├── imu-lab/
│   ├── static/          # ① IMU 数据实验室（部署到 /imu/）
│   └── app.py           #    Streamlit 备份
├── control-play/        # ② 二阶系统 + PID（部署到 /control/）
├── shared/              # Python 共享算法
├── tests/               # Node 单测（Allan / KF / 拟合）
├── scripts/smoke.ps1    # Edge headless DOM 冒烟测试
├── data/sample/         # 合成样例数据
└── .github/workflows/   # Pages 部署
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
npm test            # 算法单测（8 个）
npm run smoke       # Edge headless DOM 冒烟（四页渲染 + 拟合 + PID URL + 键盘可聚焦）
npm run visual      # 截图对比基线（桌面 + 窄屏，差异 >0.3% 失败）
npm run visual:update  # 有意改版后更新基线
```

覆盖：Allan 方差、坏帧清洗、R/Q 映射、KF 收敛、积分、拟合恢复 ARW/RRW 与 R²；冒烟测试检查页面 SVG、拟合信息、PID 参数、Bode 轴与键盘焦点；视觉回归对比 `tests/baselines/`，截图输出到 `artifacts/visual/`。

## 键盘操作

图表可用 Tab 聚焦，`←/→`（或 `↑/↓`）逐点移动，`Home/End` 跳到首尾，读数通过 `aria-live` 播报。

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
