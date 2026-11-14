# control-play

控制理论 playground：二阶系统 Bode + 阶跃响应，拖 ωn/ζ 实时变化。**零依赖、自定义 SVG**，视觉与 imu-lab 统一。

## 跑起来

直接双击 `index.html`，或本地起服务：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/control-play/
```

## 功能

- ωn（0.5–20 rad/s）、ζ（0.05–2）滑杆
- Bode 幅频/相频（双 Y 轴，自定义 SVG）
- 阶跃响应（数值积分），显示超调、峰值时间、调节时间（±2%）
- 参数可写进 URL：`?wn=4&zeta=0.4`

## 文件

```
control-play/
├── index.html
├── app.js      # 计算 + SVG 绘图
└── style.css
```

## 下一步

- [ ] PID 三滑杆 + 闭环阶跃
- [ ] 根轨迹 / Nyquist 二选一
- [ ] 把“自控复习卡片”链接到页面
- [ ] 导出参数组合为 PNG

## 说明

这是教学/复习演示，不是控制系统设计软件；数值积分步长 2 ms，高频参数下精度有限。
