# Simulink 模型文件

本目录包含 43 个 `.slx` 模型，来自：

- 仓库：https://github.com/xingd5478-ctrl/simulink-control-tutorial
- 作者：邢栋
- 许可：MIT，全文见 `LICENSE-simulink-tutorial.txt`

`refs/` 下的两个模型是 `tutorial39_top.slx` 的模型引用子模块（t39 模型引用课），同样来自上述仓库与许可。

本站对两个模型做了可复现的修正（见 `tools/patch_models.m`）：
- `tutorial32_pendulum.slx`：加入 PD 状态反馈（K1=20, K2=8），使倒立摆角度从 0.5 rad 收敛；
- `tutorial35_imu.slx`：`t_mdl` 改接 Clock，修复原模型两个 To Workspace 都接 SumFusion 的问题。

这些模型随本站一起分发，便于在课程讲义页直接下载后在 MATLAB/Simulink 中打开。
本站不运行 Simulink；浏览器内的交互复现使用 `simulink/control.js` 中同一套数学。

MATLAB 与 Simulink 是 The MathWorks, Inc. 的商标。
