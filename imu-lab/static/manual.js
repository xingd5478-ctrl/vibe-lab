/* IMU 实验手册：10 章新手讲义，章节锚定到页面上的实验控件 */
window.IMU_MANUAL = {
  chapters: [
    {
      n: 1, title: "IMU 到底在测什么", anchor: "chart-time",
      hook: "陀螺仪测「转得多快」，加速度计测「往哪边被推」；两者都不是直接告诉你角度。",
      concepts: [["陀螺仪", "输出角速度（°/s），积分才得到角度，但会漂。"], ["加速度计", "静止时测重力方向，可反推倾角，但运动会干扰。"]],
      formula: "θ(t) = θ₀ + ∫ω dt（陀螺积分，误差随时间长）",
      steps: ["看时域图的原始/清洗后波形", "分清单位 °/s 与 °", "想清楚你要的是角速度还是角度"],
      pitfall: "把陀螺输出直接当角度用；忽略零偏，积分几分钟就飘走。",
    },
    {
      n: 2, title: "采样率与时间戳", anchor: "fs",
      hook: "采样率就是「每秒拍几张照片」，拍得太慢会漏掉快速变化。",
      concepts: [["fs", "每秒采样点数；Allan 方差和 KF 都依赖它。"], ["时间戳", "t 列必须单调；缺失时按 fs 重建。"]],
      formula: "τ = k / fs；采样间隔 Δt = 1/fs",
      steps: ["确认硬件实际 fs", "检查 t 是否单调、单位是否秒", "改 fs 后重新看 Allan 曲线"],
      pitfall: "把 ms 当秒填；fs 填错会让 τ 和 R/Q 全错。",
    },
    {
      n: 3, title: "CRC 与坏帧清洗", anchor: "clean",
      hook: "坏帧就像快递里的破损件：先挑出来，别让它们污染统计。",
      concepts: [["CRC 坏帧", "校验失败或物理不可能的帧（如 |ω|>5°/s）。"], ["清洗", "默认剔除坏帧，也可关掉对比。"]],
      formula: "保留条件：crc_ok = 1 且 |gx|,|gy|,|gz| ≤ 5 °/s",
      steps: ["勾选/取消「CRC 物理坏帧清洗」", "看时域图尖峰是否消失", "对比 Allan 曲线变化"],
      pitfall: "阈值 5°/s 不是万能，量程大的场景要调整；清洗会改变样本数。",
    },
    {
      n: 4, title: "均值、噪声与频谱", anchor: "stat-frames",
      hook: "均值告诉你零偏，标准差告诉你有多吵。",
      concepts: [["均值", "静止时的零偏估计。"], ["标准差/频谱", "噪声强度与频率成分，白噪声 vs 低频漂移。"]],
      formula: "μ = Σx/N；σ = √(Σ(x−μ)²/N)",
      steps: ["看统计卡的均值", "观察时域波形是否平稳", "用 Allan 曲线判断噪声类型"],
      pitfall: "用含坏帧的数据算均值；把低频漂移当白噪声。",
    },
    {
      n: 5, title: "Allan 方差：看噪声随 τ 怎么变", anchor: "chart-allan",
      hook: "Allan 方差像给噪声做「体检」：不同时间尺度下，谁在主导一目了然。",
      concepts: [["τ", "平均时间；短 τ 看白噪声，长 τ 看漂移。"], ["σ(τ)", "Allan 标准差；双对数坐标下的斜率代表噪声类型。"]],
      formula: "ADEV(τ) = √( 1/(2(N−1)) Σ (x̄ᵢ₊₁ − x̄ᵢ)² )",
      steps: ["先看三轴曲线是否重合", "看短 τ 斜率（−1/2 白噪声）", "看长 τ 是否上翘（漂移）"],
      pitfall: "数据太短导致长 τ 不可信；重叠/非重叠算法不同，结果会有差异。",
    },
    {
      n: 6, title: "ARW / RRW 拟合", anchor: "fit-info",
      hook: "把 Allan 曲线的两头各总结成一个数：ARW 管短时，RRW 管长时。",
      concepts: [["ARW", "角度随机游走，短 τ 白噪声，单位 °/√h。"], ["RRW", "速率随机游走，长 τ 漂移，单位 (°/s)/√h。"]],
      formula: "σ²(τ) = N²/τ + K²τ/3",
      steps: ["点「从 Allan 拟合 R/Q」", "看 ARW/RRW 与 95% 区间", "换通道/清洗后重看"],
      pitfall: "R² 高不代表模型对；区间很宽说明数据不足，不要硬报。",
    },
    {
      n: 7, title: "R/Q 映射：把噪声变成滤波器参数", anchor: "sliders",
      hook: "R 是「多不信测量」，Q 是「多不信模型」，比值决定滤波器性格。",
      concepts: [["R", "测量噪声方差；R 大更信模型。"], ["Q", "过程噪声；Q 大更信测量。"]],
      formula: "R ≈ (ARW/60)²·Δt；Q ≈ (RRW/60)²·Δt",
      steps: ["用拟合值回填 R/Q", "拖滑杆看 KF 曲线", "保存 A/B 对比"],
      pitfall: "R/Q 是工程近似，不是物理真值；量纲/采样率变了要重算。",
    },
    {
      n: 8, title: "卡尔曼滤波：预测 + 更新", anchor: "chart-kf",
      hook: "KF 每一步先「猜」，再用测量「纠偏」，纠多少由 R/Q 决定。",
      concepts: [["预测", "用模型把状态推进一步，方差变大。"], ["更新", "用测量把状态拉回，方差变小。"]],
      formula: "K = P/(P+R)；x̂ ← x̂ + K(z−x̂)；P ← (1−K)P",
      steps: ["先看原始积分漂移", "调 R/Q 看 KF 平滑度", "对比 A/B 两组参数"],
      pitfall: "把 R/Q 调反；只看曲线平滑不看滞后。",
    },
    {
      n: 9, title: "互补滤波与姿态", anchor: "chart-kf",
      hook: "陀螺短期准、加速度计长期准，互补滤波就是「短期信陀螺、长期信加速度计」。",
      concepts: [["α", "越大越信陀螺（平滑但漂），越小越信加速度计。"], ["姿态", "单轴倾角只是最小案例，真正姿态需要三轴融合。"]],
      formula: "θ̂ ← α(θ̂ + ωΔt) + (1−α)θacc",
      steps: ["先用单轴倾角理解 α", "再考虑三轴/四元数", "对比互补 vs KF"],
      pitfall: "运动加速度会让加速度计失效；陀螺零偏不标定会一直漂。",
    },
    {
      n: 10, title: "标定与实验报告", anchor: "export-report",
      hook: "论文里的数字要能复现：标定、清洗、拟合、参数、图，一个都不能少。",
      concepts: [["零偏/标度因数", "静止多位置标定，温度会影响。"], ["报告", "写清数据来源、fs、清洗规则、拟合方法与区间。"]],
      formula: "ω_corr = (ω_raw − b)/s（b 零偏，s 标度因数）",
      steps: ["先标定再谈 Allan", "导出 CSV/报告留档", "写清局限与不确定度"],
      pitfall: "用未标定数据下结论；只报点估计不报区间；忽略温度/安装误差。",
    },
  ],
};

(function () {
  "use strict";
  const D = window.IMU_MANUAL;
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
