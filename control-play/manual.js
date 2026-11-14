/* Control Play 实验手册：10 章新手讲义 */
window.CONTROL_MANUAL = {
  chapters: [
    {
      n: 1, title: "一阶与二阶：系统怎么「记住」输入", anchor: "step",
      hook: "一阶像水池慢慢蓄水；二阶像弹簧车，会冲过头再回弹。",
      concepts: [["一阶", "只有一个储能元件，响应单调，时间常数 τ。"], ["二阶", "两个储能元件，可能振荡，ωn 和 ζ 决定快慢与超调。"]],
      formula: "一阶 τẏ + y = Ku；二阶 ÿ + 2ζωnẏ + ωn²y = ωn²u",
      steps: ["先看阶跃响应形状", "一阶读 63.2% 时间", "二阶看超调和振荡次数"],
      pitfall: "把 ωn 当「响应速度」全部；ζ 太大会变慢。",
    },
    {
      n: 2, title: "传递函数与极点", anchor: "step",
      hook: "传递函数是系统的「身份证」，极点位置决定它是快、慢、稳还是振。",
      concepts: [["极点", "分母根；越靠左衰减越快。"], ["零点", "分子根；会影响超调和形状。"]],
      formula: "G(s)=ωn²/(s²+2ζωn s+ωn²)；极点 −ζωn±jωn√(1−ζ²)",
      steps: ["从 ωn/ζ 算极点", "看 ζ<1 时共轭复极点", "理解极点实部=衰减，虚部=振荡"],
      pitfall: "只看极点不看零点；把「稳定」当「性能好」。",
    },
    {
      n: 3, title: "PID：三个环节各管什么", anchor: "kp",
      hook: "P 看现在、I 记过去、D 猜未来——分别解决「不够快、有误差、超调大」。",
      concepts: [["P", "增大响应，但会留稳态误差。"], ["I", "消稳态误差，太大会积分饱和。"], ["D", "抑制超调，放大噪声。"]],
      formula: "u=Kp e + Ki∫e + Kd de/dt",
      steps: ["先把 Ki、Kd 调 0 只看 P", "加 I 消误差", "加 D 压超调", "同图对比"],
      pitfall: "积分饱和；D 对噪声敏感；调参顺序反了。",
    },
    {
      n: 4, title: "Bode：系统对不同频率的态度", anchor: "bode",
      hook: "低频跟得上、高频跟不上，中间可能共振——Bode 一眼看穿。",
      concepts: [["幅频", "增益随频率变化，单位 dB。"], ["相频", "输出滞后多少度。"]],
      formula: "20log10|G(jω)|；二阶谐振峰随 ζ 减小而升高",
      steps: ["看低频增益", "找 −3 dB 带宽", "看谐振峰与相位下降"],
      pitfall: "dB 用 20log10；横轴是对数坐标。",
    },
    {
      n: 5, title: "稳定性裕度", anchor: "bode",
      hook: "裕度就是「离翻车还有多远」：增益还能加多少、相位还能迟多少。",
      concepts: [["增益裕度", "相位 −180° 处，增益还能放大多少。"], ["相位裕度", "增益 0 dB 处，相位离 −180° 还有多少。"]],
      formula: "PM = 180° + ∠G(jωc)（ωc 为穿越频率）",
      steps: ["找 0 dB 穿越频率", "读相位裕度", "一般目标 45°–60°"],
      pitfall: "只看幅频不看相频；裕度够但时域仍可能超调。",
    },
    {
      n: 6, title: "状态空间：从「输入输出」到「内部状态」", anchor: "step",
      hook: "传递函数只看外面，状态空间能看见里面每个储能元件的状态。",
      concepts: [["状态", "决定未来演化的最少变量，如位置+速度。"], ["A/B/C/D", "系统演化、输入、输出、直通。"]],
      formula: "ẋ=Ax+Bu；y=Cx+Du",
      steps: ["把二阶系统写成位置/速度", "写出 A/B/C/D", "用状态反馈设计"],
      pitfall: "状态选得不可控/不可观；矩阵维度错。",
    },
    {
      n: 7, title: "极点配置与 LQR", anchor: "wn",
      hook: "极点配置是「把极点搬到想要的位置」；LQR 是「用代价函数自动选位置」。",
      concepts: [["极点配置", "直接指定闭环极点。"], ["LQR", "调 Q/R，解 Riccati 得到最优 K。"]],
      formula: "u=−Kx；K 由 (A,B,Q,R) 解 Riccati",
      steps: ["先极点配置理解 K", "再用 Q/R 比较", "注意控制量限幅"],
      pitfall: "K 太大致饱和；参考前馈缺失导致稳态不到目标。",
    },
    {
      n: 8, title: "观测器：只看输出，猜内部状态", anchor: "step",
      hook: "像老司机听声音猜转速：用模型预测 + 输出误差修正。",
      concepts: [["Luenberger", "线性观测器，L 决定收敛速度。"], ["分离原理", "控制器和观测器可分开设计。"]],
      formula: "x̂'=Ax̂+Bu+L(y−Cx̂)",
      steps: ["复制对象模型作观测器", "用 y−ŷ 修正", "观测器极点比控制器快 2–5 倍"],
      pitfall: "L 太大致噪声放大；只测位置时速度估计会抖。",
    },
    {
      n: 9, title: "离散化与采样", anchor: "step",
      hook: "数字控制器是「按节拍」工作的，连续设计必须按 Ts 离散化。",
      concepts: [["Ts", "采样周期；Ts 太大性能下降甚至不稳定。"], ["c2d", "把连续 A/B 变成离散 Ad/Bd。"]],
      formula: "x[k+1]=Ad x[k]+Bd u[k]；Ad=e^{ATs}",
      steps: ["确定 Ts", "c2d 离散化", "检查离散闭环极点是否在单位圆内"],
      pitfall: "Ts 与硬件中断不一致；忘记离散化直接抄连续 K。",
    },
    {
      n: 10, title: "抗饱和、噪声与工程取舍", anchor: "kp",
      hook: "理论调好的控制器，一上限幅/噪声就现原形——工程细节决定成败。",
      concepts: [["积分饱和", "执行器到顶后积分继续累积，退饱和会过冲。"], ["噪声", "D 项和观测器会放大高频噪声。"]],
      formula: "抗饱和：积分只在未饱和时累积（clamping/back-calculation）",
      steps: ["给控制量加限幅", "加抗饱和逻辑", "给 D/观测器加低通", "在噪声下复测"],
      pitfall: "只做仿真不加限幅；用理想传感器评估性能。",
    },
  ],
};

(function () {
  "use strict";
  const D = window.CONTROL_MANUAL;
  const grid = document.getElementById("manual-grid");
  if (!D || !grid) return;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  D.chapters.forEach((c) => {
    const d = el("details", "manual-card");
    d.appendChild(el("summary", "", `${c.n}. ${c.title}`));
    const body = el("div", "manual-body");
    body.appendChild(el("p", "manual-hook", c.hook));
    const cons = el("div", "manual-concepts");
    c.concepts.forEach(([t, v]) => {
      const item = el("div", "manual-concept");
      item.appendChild(el("b", "", t));
      item.appendChild(document.createTextNode(v));
      cons.appendChild(item);
    });
    body.appendChild(cons);
    body.appendChild(el("div", "manual-formula", c.formula));
    const ol = el("ol", "manual-steps");
    c.steps.forEach((s) => ol.appendChild(el("li", "", s)));
    body.appendChild(ol);
    body.appendChild(el("p", "manual-pitfall", "坑：" + c.pitfall));
    if (c.anchor) {
      const a = el("a", "manual-anchor", "→ 到对应实验");
      a.href = "#" + c.anchor;
      body.appendChild(a);
    }
    d.appendChild(body);
    grid.appendChild(d);
  });
})();
