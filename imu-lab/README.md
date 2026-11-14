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
- 原始 / 清洗后时域对比，坏帧计数
- 三轴 Allan 标准差（log-log，1-2-5 刻度）
- **拟合 ARW/RRW + R² + 95% 分位区间**，图上叠加虚线拟合段
- **一键把拟合值回填 R/Q**（log10 滑杆）
- 实时 KF：积分角度 vs 滤波输出
- **悬浮/触摸十字线读数**（时间/Allan/滤波图）
- **导出 CSV / 单图 PNG**（2×）
- **分享链接**：R/Q、通道、采样率写入 URL，可复现
- **上传校验**：缺少 `gx_dps/gy_dps/gz_dps`、超过 20 万行或 20 MB 时给出提示
- 页面顶部标注「演示数据」，避免把合成数据当标定结果

## 数据格式

| 列 | 必需 | 说明 |
|---|---|---|
| `t` | 否 | 秒；没有就按采样率自动补 |
| `gx_dps/gy_dps/gz_dps` | 是 | 角速度，°/s |
| `crc_ok` | 否 | 1 有效 / 0 坏帧 |

## 测试

```bash
npm test   # 在仓库根目录
```

## 部署

- GitHub Pages：仓库已带 workflow，推 `main` 自动部署到 `/imu/`；
- Vercel：Root Directory 选 `imu-lab/static`，Framework 选 Other。

## 说明

拟合是“短 τ 段取 N、长 τ 段取 K”的工程近似，R² 与区间用于判断可信度；60 s 数据不足以精确标定 RRW，真实标定请用 ≥2 h 静态数据。
