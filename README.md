# vibe-lab

传感器与控制的可视化实验室：把毕设里的数据、算法和“讲清楚一件事”的能力，做成三个可以玩、可以演示、可以继续长大的小项目。

> 一句话：**imu-lab 看数据，control-play 调节理论，sensor-story 讲故事。**

## 目录

```
vibe-lab/
├── imu-lab/
│   ├── static/          # ① 静态版（主）：双击即开，可部署 GitHub Pages
│   └── app.py           #    Streamlit 版（备份）
├── control-play/        # ② 控制理论 playground：Bode/阶跃/PID（单文件网页）
├── sensor-story/        # ③ 传感器数据故事：滚动叙事网页
├── shared/              # Python 共享算法：CSV、CRC、Allan、1D KF
├── data/sample/         # 合成样例数据
└── ROADMAP.md           # 两周计划 + 考研 guardrails
```

## 快速开始

### ① imu-lab

- 直接双击 `imu-lab/static/index.html`（无需服务器、无需 Python）；
- 或本地预览：`python -m http.server 8000 --directory imu-lab/static`；
- 部署：见 `imu-lab/README.md`（GitHub Pages / Vercel）。

### ② control-play

直接用浏览器打开 `control-play/index.html`，拖 ωn/ζ 滑杆。

### ③ sensor-story

先读 `sensor-story/README.md` 的分镜，再决定是否动代码。

## 约定

- 三个子项目各自独立，互不依赖；共享代码只放在 `shared/`。
- 数据不进 Git（`data/sample` 除外），真实数据用绝对路径或环境变量引用。
- 每个子项目一个 README：写“现在能做什么 / 下一步 / 怎么跑”。

## 命名

仓库名 `vibe-lab`（短、好记、适合放 GitHub）；中文可叫“传感器与控制可视化实验室”。
