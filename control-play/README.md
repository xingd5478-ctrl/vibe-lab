# control-play

控制理论 playground：二阶系统的 Bode、阶跃响应与 PID 闭环。**零依赖、自定义 SVG**，视觉与 imu-lab 统一。

**线上：** https://xingd5478-ctrl.github.io/vibe-lab/control/

## 跑起来

直接双击 `index.html`，或：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/control-play/
```

## 功能

- ωn（0.5–20 rad/s）、ζ（0.05–2）滑杆
- PID 三滑杆（Kp/Ki/Kd），闭环数值仿真（含积分限幅、控制量限幅）
- 开环 vs 闭环阶跃对比
- 指标：超调、峰值时间、调节时间（±2%）、稳态误差
- Bode 双 Y 轴（开环）
- 悬浮/触摸/键盘十字线读数（Tab 聚焦，`←/→`、`Home/End`）
- 参数同步到 URL（footer 实时显示当前参数）：`?wn=4&zeta=0.4&kp=1.5&ki=0.5&kd=0.05`

## 文件

```
control-play/
├── index.html
├── app.js      # 计算 + SVG 绘图
└── style.css
```

## 下一步

- [ ] 根轨迹 / Nyquist 二选一
- [ ] 抗积分饱和（back-calculation）
- [ ] 导出参数组合为 PNG

## 说明

教学/复习演示，不是控制系统设计软件；仿真步长 2 ms，高频参数下精度有限。
