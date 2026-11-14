# imu-lab

IMU 数据实验室：上传 CSV → CRC 清洗 → Allan 方差 → 拟合 ARW/RRW → 调 R/Q 看滤波。**静态版（主）** 零依赖、无后端。

**线上：** https://xingd5478-ctrl.github.io/vibe-lab/imu/

## 跑起来

```bash
# 直接双击也行
start imu-lab/static/index.html

# 或本地预览
python -m http.server 8000
# 打开 http://localhost:8000/imu-lab/static/
```

## 功能

- 示例数据（合成，含 10 个坏帧）自动加载；上传 CSV：`gx_dps/gy_dps/gz_dps`，可选 `crc_ok`、`t`
- **加载 10 min 真实片段**（论文在审，仅演示；含 5 个坏帧；完整数据待录用后按期刊政策公开；gzip 传输 515 KB，自动解压）
- **拖拽上传**、读取进度、列名自动识别（`gx/gy/gz`、`gyro_x` 等别名）
- **导出 CSV / 单图 PNG / HTML 报告**（报告含三张图、统计与拟合结果）
- **A/B 对比**：保存一组 R/Q，与当前滤波曲线叠加
- **大文件**：>100k 帧时域走 Canvas，>150k 帧 Allan 走 Worker
- **PWA/离线**：Service Worker 缓存静态资源（数据文件不缓存），支持安装到主屏幕
- 原始 / 清洗后时域对比，坏帧计数
- 三轴 Allan 标准差（log-log，1-2-5 刻度）
- **拟合 ARW/RRW**：对 σ²=A/τ+K²τ/3 做 Huber IRLS 稳健最小二乘，R² 与 95% 回归区间；失败回退中位数法
- **单位/坐标系校验**：量级、三轴一致性、时间单位异常时提示
- **一键把拟合值回填 R/Q**（log10 滑杆）
- **导出 Allan CSV**（τ 与三轴 σ）
- **列名映射**：未识别时可选列；时间戳非单调会自动重建并提示
- **大文件**：>4 MB 在 `data-worker.js` 解析（主线程只分片建行）；>100k 帧时域走 Canvas；>150k 帧 Allan/`kf-worker.js` 走 Worker
- 实时 KF：积分角度 vs 滤波输出
- **加载真实样例**：10 min 真实片段（论文在审，仅演示）
- **悬浮/触摸/键盘十字线读数**：指针拖动，或 Tab 聚焦后用 `←/→`、`Home/End`（Canvas 大图同样支持）
- **导出 CSV / 单图 PNG**（2×）
- **分享链接**：R/Q、通道、采样率写入 URL，可复现
- **上传校验**：缺列/超过 100 万行/20 MB 时提示
- 页面顶部标注「演示数据」，避免把合成数据当标定结果

## 模块

- `data.js`：列式解析/清洗/统计/Allan/KF/CSV；
- `data-worker.js` / `kf-worker.js` / `allan-worker.js`：大文件解析、KF、Allan 的 Worker；
- `chart.js`：SVG 图 + Canvas 大图 + hover/键盘；
- `fit.js`：WLS 拟合；`allan.js`/`kf.js`：算法；`app.js`：交互与导出。

## 数据格式

| 列 | 必需 | 说明 |
|---|---|---|
| `t` | 否 | 秒；没有就按采样率自动补 |
| `gx_dps/gy_dps/gz_dps` | 是 | 角速度，°/s |
| `crc_ok` | 否 | 1 有效 / 0 坏帧 |

## 测试

```bash
npm test        # 算法/数据层/Worker 单测
npm run smoke   # DOM 冒烟
npm run e2e     # Edge CDP + axe 无障碍
npm run bigtest # 200k 行 Worker 全链路
npm run visual  # 截图回归
```

## 部署

- GitHub Pages：仓库已带 workflow，推 `main` 自动部署到 `/imu/`；
- Vercel：Root Directory 选 `imu-lab/static`，Framework 选 Other。

## 说明

拟合是“短 τ 段取 N、长 τ 段取 K”的工程近似，R² 与区间用于判断可信度；60 s 数据不足以精确标定 RRW，真实标定请用 ≥2 h 静态数据。
