/* Lightweight English UI layer (beta) for the Chinese tool pages.
   Activated by ?lang=en or localStorage("vibe-lang")==="en".
   It translates visible text/attributes in place and leaves lesson prose in Chinese. */
(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  let lang = params.get("lang");
  try {
    if (lang === "en" || lang === "zh") localStorage.setItem("vibe-lang", lang);
    else lang = localStorage.getItem("vibe-lang");
  } catch (e) { /* private mode */ }
  if (lang !== "en") {
    document.documentElement.lang = "zh-CN";
    addSwitch("en");
    return;
  }
  if (/\/about\/(index\.html)?$/.test(location.pathname)) {
    location.replace("en.html");
    return;
  }
  document.documentElement.lang = "en";
  document.documentElement.classList.add("lang-en");

  const TITLES = {
    "信号基础": "Signals", "数学运算": "Math blocks", "一阶系统": "First order",
    "二阶系统": "Second order", "PID 控制": "PID control", "信号源与输出": "Sources & sinks",
    "子系统": "Subsystems", "Mask 封装": "Masks", "状态空间模型": "State space",
    "状态反馈 / LQR": "State feedback / LQR", "状态观测器": "Observer",
    "Kalman 滤波": "Kalman filter", "系统辨识": "System ID", "H∞ 鲁棒控制": "H-infinity",
    "模型预测控制 MPC": "MPC", "滑模控制 SMC": "Sliding mode", "根轨迹法": "Root locus",
    "MRAC 自适应": "MRAC", "模糊逻辑控制": "Fuzzy logic", "DC 电机控制": "DC motor",
    "PMSM + FOC": "PMSM + FOC", "Simscape 物理建模": "Simscape", "代码生成": "Code generation",
    "机器人运动学": "Robot kinematics", "MSD 系统建模": "MSD modeling",
    "DSP 基础": "DSP basics", "MSD 控制对比": "MSD control compare",
    "主动悬挂": "Active suspension", "EKF 基础": "EKF basics", "EKF 倒立摆": "EKF pendulum",
    "UKF": "UKF", "EKF vs UKF": "EKF vs UKF", "IMU 融合": "IMU fusion",
    "Stateflow 状态机": "Stateflow", "触发/使能子系统": "Triggered / enabled",
    "Bus 信号": "Bus signals", "模型引用": "Model reference", "变体子系统": "Variant subsystem",
    "模型回调": "Model callbacks", "S-Function": "S-Function", "Model Advisor": "Model Advisor",
  };

  const DEMO_TITLES = {
    "信号与增益": "Signals & gain", "PID 控制": "PID control", "Kalman 滤波": "Kalman filter",
    "频域 Bode": "Frequency / Bode", "MPC 模型预测控制": "MPC", "根轨迹": "Root locus",
    "模糊控制": "Fuzzy control", "质量-弹簧-阻尼": "Mass-spring-damper",
    "机器人运动学": "Robot kinematics", "采样与混叠": "Sampling & aliasing",
    "IMU 融合": "IMU fusion", "Bus 信号": "Bus signals", "DC 电机": "DC motor",
    "触发子系统": "Triggered subsystem", "超前-滞后校正": "Lead-lag", "系统辨识": "System ID",
    "MRAC 自适应": "MRAC", "MSD：PID vs LQR": "MSD: PID vs LQR", "主动悬挂": "Active suspension",
    "EKF": "EKF", "倒立摆 EKF": "Pendulum EKF", "PMSM / FOC": "PMSM / FOC",
    "一阶系统": "First order", "二阶系统": "Second order",
    "状态反馈 / 极点配置": "State feedback / pole placement",
    "Luenberger 观测器": "Luenberger observer", "滑模控制 SMC": "Sliding mode SMC",
    "Stateflow 状态机": "Stateflow", "变体切换": "Variant switch",
  };

  const EN = {
    "跳到内容": "Skip to content", "全站导航": "Site navigation", "首页": "Home", "方法": "Method",
    "方法说明": "Method", "方法说明与局限": "Methods & limitations",
    "IMU 数据实验室": "IMU data lab", "Control Play · 二阶系统": "Control Play · second-order systems",
    "上传 MPU6050 CSV → CRC 清洗 → Allan 方差 → 拖动 R/Q 看滤波。全部在浏览器内计算，无后端。":
      "Upload MPU6050 CSV → CRC cleaning → Allan deviation → drag R/Q to filter. Everything runs in your browser; no backend.",
    "演示数据": "Demo data",
    "43 课 / 8 阶段的 MATLAB + Simulink 教程。.slx 是 MATLAB 二进制模型，浏览器无法直接运行；":
      "A 43-lesson / 8-stage MATLAB + Simulink tutorial. `.slx` is a binary MATLAB model the browser cannot run;",
    "43 课 / 8 阶段的 MATLAB + Simulink 教程。.slx 是 MATLAB 二进制模型，浏览器无法直接运行； 本页用":
      "A 43-lesson / 8-stage MATLAB + Simulink tutorial. `.slx` is a binary MATLAB model the browser cannot run; this page uses",
    "本页用": "this page uses",
    "做可交互复现，并链接到每课的": " to reproduce the same math interactively, with links to each lesson's",
    "与": "and",
    "同一套控制数学": "the same control math",
    "输出 y=K·u": "Output y=K·u",
    "y(t)=Ku(t)。先看输入，再看放大后的输出；打开噪声模拟真实传感器。":
      "y(t)=Ku(t). Compare the input and the scaled output; enable noise to model a real sensor.",
    "y(t)=Ku(t). 先看输入，再看放大后的输出；打开噪声模拟真实传感器。":
      "y(t)=Ku(t). Compare the input and the scaled output; enable noise to model a real sensor.",
    "GitHub 仓库 →": "GitHub repo →",
    "Phase 1 · Simulink 基础与动力学": "Phase 1 · Simulink & dynamics",
    "Phase 2 · 经典控制设计": "Phase 2 · Classical control",
    "Phase 3 · 现代控制": "Phase 3 · Modern control",
    "Phase 4 · 高级控制": "Phase 4 · Advanced control",
    "Phase 5 · 机电系统与部署": "Phase 5 · Mechatronics & deployment",
    "Phase 6 · 综合案例": "Phase 6 · Case studies",
    "Phase 7 · 非线性滤波": "Phase 7 · Nonlinear filtering",
    "Phase 8 · Simulink 进阶": "Phase 8 · Advanced Simulink",
    "增益 K": "Gain K", "频率 (Hz)": "Frequency (Hz)", "叠加噪声": "Add noise",
    "y(t)=Ku(t). 先看输入，再看放大后的输出；打开噪声模拟真实传感器。":
      "y(t)=Ku(t). Compare the input and the scaled output; enable noise to model a real sensor.",
    "Simulink 控制教程 · 交互复现": "Simulink control tutorial · interactive",
    "IMU 数据实验室 · vibe-lab": "IMU data lab · vibe-lab",
    "Control Play · 二阶系统 · vibe-lab": "Control Play · second-order systems · vibe-lab",
    "Simulink 控制教程 · 交互复现 · vibe-lab": "Simulink control tutorial · interactive · vibe-lab",
    "方法说明 · vibe-lab": "Methods & limitations · vibe-lab",
    "43 课讲义 · Simulink 控制教程 · vibe-lab": "43 lessons · Simulink control tutorial · vibe-lab",
    "数据文件": "Data file", "当前：": "Current: ", "示例数据（合成）": "Sample data (synthetic)",
    "也可以把 CSV 直接拖到这个面板。": "You can also drop a CSV onto this panel.",
    "列名未识别，请手动映射：": "Columns not recognized; map them manually:",
    "应用映射": "Apply mapping", "加载 10 min 真实片段": "Load 10-min real excerpt",
    "下载片段 CSV": "Download excerpt CSV", "采样率 (Hz)": "Sample rate (Hz)",
    "主通道": "Primary channel", "CRC / 物理坏帧清洗": "CRC / physical bad-frame cleaning",
    "从 Allan 拟合 R/Q": "Fit R/Q from Allan", "导出 CSV": "Export CSV",
    "导出报告": "Export report", "保存对比": "Save comparison", "清除对比": "Clear comparison",
    "复制链接": "Copy link", "导出 Allan CSV": "Export Allan CSV",
    "重置为示例数据": "Reset to sample data", "总帧数": "Frames", "坏帧": "Bad frames",
    "时长": "Duration", "主通道均值": "Channel mean", "时域": "Time domain",
    "Allan 方差": "Allan deviation", "滤波对比": "Filter comparison",
    "IMU 实验手册 · 10 章": "IMU lab manual · 10 chapters",
    "实验台": "Workbench", "10 章手册": "10-chapter manual",
    "检测到列名无法识别，请手动映射。": "Columns not recognized; map them manually.",
    "角速度 (°/s)": "Angular rate (°/s)", "时间 (s)": "Time (s)",
    "Allan 标准差 (°/s)": "Allan deviation (°/s)", "Allan 方差数据（抽样）": "Allan deviation data (sampled)", "角度 (°)": "Angle (°)",
    "幅值 (dB)": "Magnitude (dB)", "相位 (°)": "Phase (°)",
    "幅值": "Mag.", "相位": "Phase", "频率": "Frequency",
    "自然频率 ωn": "Natural frequency ωn", "阻尼比 ζ": "Damping ratio ζ",
    "比例增益 Kp": "Proportional gain Kp", "积分增益 Ki": "Integral gain Ki",
    "微分增益 Kd": "Derivative gain Kd", "超调量（闭环）": "Overshoot (closed loop)",
    "峰值时间": "Peak time", "调节时间（±2%）": "Settling time (±2%)",
    "稳态误差": "Steady-state error", "Bode 图": "Bode plot", "阶跃响应": "Step response",
    "更多控制实验 · 4 个": "More control labs · 4", "扩展实验": "Extra labs",
    "14 章手册": "14-chapter manual", "Control Play 实验手册 · 10 章": "Control Play manual · 10 chapters",
    "课程阶段 · 8 个": "Course stages · 8", "阅读 43 课完整讲义 →": "Read all 43 lessons →",
    "交互复现": "Interactive reproduction", "怎么在 MATLAB 里跑原版": "Run the originals in MATLAB",
    "ARW 拟合": "ARW fit", "RRW 拟合": "RRW fit", "原始": "Raw", "清洗后": "Clean",
    "原始积分": "Raw", "卡尔曼": "KF", "真值": "Truth", "测量": "Measurement",
    "估计": "Estimate", "参考": "Reference", "输入 u": "Input u", "输出 y": "Output y",
    "测量 z": "Measurement z", "估计 x̂": "Estimate x̂", "测量误差": "Meas. err",
    "滤波误差": "Filter err", "加速度计": "Accel", "互补输出": "Complementary",
    "加速度计误差": "Accel err", "互补误差": "Comp err",
    "连续输入": "Continuous input", "保持输出": "Held output", "实测": "Measured", "拟合": "Fit",
    "参考模型": "Ref model", "对象 y": "Plant y", "位置": "Position", "速度": "Speed",
    "力矩": "Torque", "转速": "Speed", "电流": "Current", "误差": "Error",
    "超调量": "Overshoot", "末值误差": "Final error", "贴限幅比例": "Saturation ratio",
    "测量 RMSE": "Meas. RMSE", "滤波 RMSE": "Filter RMSE", "EKF RMSE": "EKF RMSE",
    "抖振指标 mean|Δu|": "Chattering mean|Δu|", "t>1s 最大误差": "Max error after 1 s",
    "输入幅度": "Input amplitude", "输出幅度": "Output amplitude", "输入幅值": "Input amplitude", "输出幅值": "Output amplitude", "噪声": "Noise",
    "无": "none", "有": "yes", "开环": "Open", "闭环": "Closed loop", "闭环 PID": "PID",
    "连续 PID": "Cont. PID", "离散 PID": "Disc. PID", "真实": "True", "估计值": "Estimate",
    "采样点连线": "S&H", "真实正弦": "True sine", "重建": "Reconstructed",
    "上升时间": "Rise time", "峰值": "Peak", "终值": "Final value", "稳态": "Steady state",
    "计算中…": "Computing…", "Allan 计算中…": "Computing Allan…",
    "拟合失败：数据太短或曲线异常": "Fit failed: data too short or curve abnormal",
    "下载": "Download", "本课讲义 →": "Lesson notes →", "教程仓库": "Tutorial repo",
    "站内模型": "Site model", "交互复现与 Simulink 的差异：": "Differences from Simulink: ",
    "本页不运行 Simulink，只复现数学；原版模型请按下面三步运行（MATLAB R2020a+）。":
      "This page does not run Simulink; it reproduces the math. Run the originals in MATLAB (R2020a+) with the three steps below.",
    "这里只放交互实验；完整讲义、结果图和 .slx 下载在讲义页。":
      "Only interactive labs live here; full notes, figures and .slx downloads are on the reader page.",
    "状态反馈、Luenberger 观测器、根轨迹、离散化；每个都可独立调参。":
      "State feedback, Luenberger observer, root locus and discretization; each can be tuned independently.",
    "论文在审，仅作演示；完整数据待录用后按期刊政策公开，版权归作者/实验室。":
      "Under review; demo only. Full data will follow the journal policy after acceptance; copyright remains with the authors/lab.",
    "CSV 列名：": "CSV columns: ",
    "没有表头时按 t,gx,gy,gz,crc 解析。": "Without a header, rows are parsed as t,gx,gy,gz,crc.",
    "数据与算法在浏览器内运行": "Data and algorithms run in your browser",
    "仅用于教学/演示，真实标定以论文流程为准。":
      "Teaching/demo only; use the paper's procedure for real calibration.",
    "方法说明": "Method", "返回方法说明": "Back to method", "本站不运行 Simulink": "This site does not run Simulink",
  };

  const PATTERNS = [
    [/^(\d[\d,]*) 帧 · (\d[\d,]*) 坏帧（尖峰已截断）$/, "$1 frames · $2 bad frames (spikes clipped)"],
    [/^(\d[\d,]*) 帧$/, "$1 frames"],
    [/^(\d+) 章手册$/, "$1-chapter manual"],
    [/^(\d+) 课$/, "$1 lessons"],
    [/^(\d+) 课 · (.+)$/, "$1 lessons · $2"],
    [/^(\d+) 个交互$/, "$1 interactive demos"],
    [/^(\d+) 个$/, "$1"],
    [/^(?:t|T)(\d+) · (.+)$/, (m, n, title) => `${m.startsWith("T") ? "T" : "t"}${n} · ${DEMO_TITLES[title] || TITLES[title] || title}`],
    [/^(.+)（95% (.+)）$/, (m, a, b) => `${a} (95% ${b})`],
  ];

  function translateString(value) {
    if (!value) return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    let out = EN[trimmed] || EN[trimmed.replace(/\s+/g, " ")];
    if (!out) {
      for (const [re, rep] of PATTERNS) {
        if (re.test(trimmed)) {
          out = typeof rep === "function" ? trimmed.replace(re, rep) : trimmed.replace(re, rep);
          break;
        }
      }
    }
    if (!out) {
      // Replace known inner phrases in long dynamic strings.
      out = trimmed
        .replace(/检测到列名无法识别，请手动映射。/g, "Columns not recognized; map them manually.")
        .replace(/坏帧/g, "bad frames")
        .replace(/帧/g, "frames")
        .replace(/章手册/g, "-chapter manual");
    }
    if (!out || out === trimmed) return value;
    return value.replace(trimmed, out);
  }

  const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);
  window.VibeI18n = { lang: "en", translate: translateString };
  function skipNode(node) {
    let p = node.nodeType === 1 ? node : node.parentElement;
    while (p) {
      if (SKIP.has(p.tagName) || p.hasAttribute("data-i18n-skip")) return true;
      p = p.parentElement;
    }
    return false;
  }

  function translateText(node) {
    if (skipNode(node)) return;
    const v = node.nodeValue;
    if (node.parentElement && node.parentElement.id === "sr-summary" && /[\u4e00-\u9fff]/.test(v)) {
      node.nodeValue = "Summary: chart values update with the selected channel and R/Q.";
      return;
    }
    const t = translateString(v);
    if (t !== v) node.nodeValue = t;
  }

  function translateAttrs(el) {
    if (skipNode(el)) return;
    ["placeholder", "title", "aria-label", "alt"].forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const v = el.getAttribute(attr);
      const t = translateString(v);
      if (t !== v) el.setAttribute(attr, t);
    });
  }

  function walk(root) {
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1) return;
    translateAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => SKIP.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) translateText(n);
      else translateAttrs(n);
    }
  }

  let queued = false;
  const mo = new MutationObserver((muts) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const m of muts) {
        if (m.type === "characterData") translateText(m.target);
        else if (m.type === "attributes") translateAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
  });

  function addSwitch(target) {
    const nav = document.querySelector(".topnav");
    if (!nav) return;
    let a = nav.querySelector(".lang-switch");
    if (!a) {
      a = document.createElement("a");
      a.className = "lang-switch";
      nav.appendChild(a);
    }
    a.hreflang = target === "en" ? "en" : "zh-CN";
    a.lang = target === "en" ? "en" : "zh-CN";
    a.textContent = target === "en" ? "EN" : "Chinese";
    const url = new URL(location.href);
    url.searchParams.set("lang", target);
    a.href = target === "en" && /\/about\//.test(location.pathname) ? "en.html" : url.href;
    a.setAttribute("data-i18n-skip", "");
  }

  function addBanner() {
    const wrap = document.querySelector(".wrap");
    if (!wrap || document.querySelector(".lang-banner")) return;
    const d = document.createElement("div");
    d.className = "lang-banner";
    d.setAttribute("data-i18n-skip", "");
    d.style.cssText = "margin:10px 0 0;padding:7px 10px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-size:12px;border-radius:2px";
    d.innerHTML = "English UI: tools and charts are translated. Chinese-only manuals and long lesson notes are hidden; switch to <a href=\"?lang=zh\">Chinese</a> for the full content.";
    wrap.insertBefore(d, wrap.querySelector("header"));
  }

  let curated = false;
  function enIndexHref() {
    return location.protocol === "file:" ? "../landing/en/lessons.html" : "../en/lessons.html";
  }
  function addNote(text, after) {
    const p = document.createElement("p");
    p.className = "hint en-scope-note";
    p.setAttribute("data-i18n-skip", "");
    p.textContent = text;
    const main = document.querySelector("main");
    if (after && after.parentNode) after.parentNode.insertBefore(p, after.nextSibling);
    else if (main) main.appendChild(p);
  }
  function repointCourseLinks() {
    const href = enIndexHref();
    document.querySelectorAll('a[href*="course.html"]').forEach((a) => {
      if (a.closest("[data-i18n-skip]")) return;
      a.href = href;
    });
  }
  function englishCuration() {
    if (curated) return;
    if (document.getElementById("lesson-body")) {
      location.replace(enIndexHref());
      return;
    }
    const isImu = !!(document.getElementById("chart-allan") && document.getElementById("chart-time"));
    const isCtrl = !!(document.getElementById("bode") && document.getElementById("step"));
    const isSim = !!(document.getElementById("tabs") && document.getElementById("phases"));
    if (!isImu && !isCtrl && !isSim) return;
    curated = true;
    const footer = document.querySelector("footer");
    if (footer) {
      footer.innerHTML = 'vibe-lab · static site · <a href="../">Home</a> · <a href="../about/en.html">Method</a> · <a href="https://github.com/xingd5478-ctrl/vibe-lab" target="_blank" rel="noreferrer">Source</a>';
    }
    if (isImu) {
      const sub = document.querySelector("header .sub");
      if (sub) {
        const badge = sub.querySelector(".badge");
        sub.textContent = "Upload MPU6050 CSV → CRC cleaning → Allan deviation → drag R/Q to filter. Everything runs in your browser; no backend. ";
        if (badge) { badge.textContent = "Demo data"; sub.appendChild(badge); }
      }
      const csv = [...document.querySelectorAll(".hint")].find((h) => h.textContent.includes("CSV 列名") || h.textContent.includes("gx_dps") || h.textContent.includes("CSV columns"));
      if (csv) csv.innerHTML = "CSV columns: <code>gx_dps/gy_dps/gz_dps</code>, optional <code>crc_ok</code>, <code>t</code>. Without a header, rows are parsed as t,gx,gy,gz,crc.";
      const file = document.getElementById("file");
      if (file && !document.getElementById("file-en")) {
        const b = document.createElement("button");
        b.type = "button";
        b.id = "file-en";
        b.className = "mini";
        b.style.cssText = "width:100%;margin:0 0 6px;padding:8px;font-size:12px";
        b.textContent = "Choose CSV";
        b.addEventListener("click", () => file.click());
        file.style.display = "none";
        file.parentNode.insertBefore(b, file);
      }
      addNote("The 10-chapter lab manual is Chinese-only and hidden in English mode; switch to Chinese for the full manual.");
    }
    if (isCtrl) {
      const sub = document.querySelector("header .sub");
      if (sub) sub.textContent = "G(s)=ωn²/(s²+2ζωn·s+ωn²). Drag the sliders to see the Bode plot and step response in real time.";
      const hint = document.querySelector(".controls .hint");
      if (hint) hint.textContent = "Kp speeds up the response but increases overshoot; Ki removes steady-state error but can oscillate; Kd reduces overshoot and amplifies noise. Drag the sliders to compare open and closed loop.";
      addNote("Extended labs and the 14-chapter manual are Chinese-only and hidden in English mode; switch to Chinese for them.");
    }
    if (isSim) {
      const sub = document.querySelector("header .sub");
      if (sub) {
        sub.innerHTML = 'A 43-lesson / 8-stage MATLAB + Simulink tutorial. <code>.slx</code> files are binary models the browser cannot run; this page reproduces the same control math interactively. <a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">GitHub repo →</a>';
      }
      repointCourseLinks();
      const note = document.getElementById("demo-note");
      addNote("Interactive reproduction. The Chinese lesson notes are linked from the English lesson index; use the lesson index for .m/.slx downloads.", note);
    }
  }

  window.vibeTrack = function (name) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "event/" + name });
    } catch (e) {}
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      walk(document.body);
      addBanner();
      addSwitch("zh");
      setTimeout(englishCuration, 0);
      window.addEventListener("load", englishCuration);
      mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label", "alt"] });
      document.title = translateString(document.title);
    });
  } else {
    walk(document.body);
    addBanner();
    addSwitch("zh");
    setTimeout(englishCuration, 0);
    window.addEventListener("load", englishCuration);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label", "alt"] });
    document.title = translateString(document.title);
  }
})();
