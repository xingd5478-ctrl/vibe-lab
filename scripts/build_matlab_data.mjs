/* Build data/matlab-probes.json from MATLAB's raw probe output.
   Adds model SHA-256 provenance, lesson titles/demo links and curated metric/note text.
   The table generator (build_matlab_table.mjs) reads this file. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "artifacts", "simulink", "probes.json");
const OUT = path.join(ROOT, "data", "matlab-probes.json");

if (!fs.existsSync(RAW)) {
  console.error("missing artifacts/simulink/probes.json; run: matlab -batch \"addpath('tools'); probe_all\"");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
const lessonSource = fs.readFileSync(path.join(ROOT, "simulink", "lessons.js"), "utf8");
const lessonRe = /\{ id: "(t\d+)", n: (\d+), title: "([^"]+)", desc: "([^"]+)", file: "([^"]+)", model: "([^"]+)"(?:, demo: "([^"]+)")? \}/g;
const lessons = [...lessonSource.matchAll(lessonRe)].map((m) => ({
  id: m[1], n: Number(m[2]), title: m[3], demo: m[7] || null, model: m[6],
}));
if (lessons.length !== 43) throw new Error(`expected 43 lessons, parsed ${lessons.length}`);
lessons.sort((a, b) => a.n - b.n);

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const PRIMARY = {
  t01: ["gain_out"], t02: ["Demux3"], t03: ["TF_tau_0p5"], t04: ["TF_zeta0.2"],
  t05: ["y_out"], t06: ["saved_data"], t07: ["NestedOut"], t08: ["sig_out1", "sig_out2"],
  t09: ["y_ss", "y_tf"], t10: ["y_PP"], t11: ["x1_true", "x1_hat"],
  t12: ["y_Kalman", "y_noisy_data"], t13: ["omega_PI"], t14: ["w_FOC", "w_DC"],
  t15: ["probe_s1_p1"], t16: ["probe_s1_p1"], t17: ["probe_s1_p1", "probe_s1_p2"],
  t18: ["y_plant"], t19: ["probe_s1_p1"], t20: ["probe_s1_p1"],
  t21: ["probe_s1_p1", "probe_s1_p2"], t22: ["y_out"],
  t23: ["probe_s1_p1", "probe_s1_p2", "probe_s1_p3"],
  t24: ["y_fuzzy", "y_pid"], t25: ["y_phys"], t26: ["fk_x", "fk_y", "fk_z"],
  t27: ["y_ss_sim", "y_tf_sim"], t28: ["probe_s1_p1"],
  t29: ["probe_s1_p1", "probe_s1_p2"], t30: ["probe_s1_p1"],
  t31: ["y_noisy", "x1_true"], t32: ["x1_true"], t33: ["x1_true"],
  t34: ["demo_x1true"], t35: ["theta_cf_sim"], t36: ["mode_data", "speed_data"],
  t37: ["cont_out", "en_out"], t38: ["pos_out", "spd_out", "torque_out"],
  t39: ["plant_y_sub"], t40: ["y_data"], t41: ["probe_s1_p1"],
  t42: ["sfcn_in", "sfcn_out"], t43: ["advisor_out"],
};

const METRIC_OVERRIDES = {
  t03: "峰值 1.000，终值 1.000",
  t04: "ζ=0.2 峰值 1.520，终值 0.996",
  t05: "峰值 0.978，终值 0.978",
  t10: "峰值 0.065，终值 0.063（PP）",
  t11: "最大误差 0.300，末值 0.000",
  t12: "Kalman RMSE 0.455，测量 1.149",
  t13: "峰值 192.44，终值 137.09",
  t16: "Plant 4/(s²+0.5s+4)：Gm=∞，PM=20.4°",
  t20: "峰值 0.562，10 s 终值 0.562",
  t21: "SMC 峰值 0.724，终值 0.600；PID 峰值 0.636，终值 0.636",
  t22: "峰值 1.289，终值 0.825",
  t24: "模糊输出 0.983，PID 末值 0.747",
  t26: "末端 (0.452, -0.150, 1.304)",
  t31: "测量 RMSE 0.053；EKF x₁ RMSE 0.049（按讲义离线）",
  t32: "峰值 0.500，末值 0.014",
  t35: "互补滤波末值 3.479；t_mdl 0–10 s",
};

const LABELS = {
  t08: { sig_out1: "输出1", sig_out2: "输出2" },
  t26: { fk_x: "末端 x", fk_y: "末端 y", fk_z: "末端 z" },
  t17: { probe_s1_p1: "校正后", probe_s1_p2: "参考" },
  t19: { probe_s1_p1: "输出" },
  t21: { probe_s1_p1: "SMC", probe_s1_p2: "PID" },
  t23: { probe_s1_p1: "参考", probe_s1_p2: "对象", probe_s1_p3: "控制" },
  t29: { probe_s1_p1: "PID", probe_s1_p2: "LQR" },
  t30: { probe_s1_p1: "车身位移" },
  t40: { y_data: "变体输出" },
  t41: { probe_s1_p1: "PI 输出" },
};

const NOTES = {
  t01: "信号、增益、示波器；结构课",
  t02: "Sum/Product/Mux/Demux；结构课",
  t03: "与网页 demo 一致",
  t04: "与网页 demo 一致（ζ=0.2）",
  t05: "模型参考/限幅与 demo 不同",
  t06: "Workspace 导入导出；探针需初始化 u_input",
  t07: "子系统层级；结构课",
  t08: "Mask 参数化；三路输出",
  t09: "TF/SS/MA 三种实现对比",
  t10: "原模型无参考前馈，稳态约 1/16",
  t11: "估计误差收敛；与 demo 一致",
  t12: "Kalman 明显优于 Luenberger/测量",
  t13: "速度 PI 有超调，稳态有差",
  t14: "FOC 与 DC 对比；末值差异大",
  t15: "代码生成模型；固定步长 1 ms",
  t16: "Plant 4/(s²+0.5s+4)；PM 20.4°",
  t17: "Lead/Lag 校正；输入/输出稳态",
  t18: "阶跃辨识；输出饱和/限幅需注意",
  t19: "H∞ 鲁棒控制；输出稳态 0.5",
  t20: "原 .slx 实为 PID，不是 MPC；10 s 仍在上升",
  t21: "原 .slx 是符号继电器：u 仅 0→3，无抖振",
  t22: "对应当前 K 的稳态偏差",
  t23: "MRAC 参考/对象跟踪；控制量 3",
  t24: "FIS 按讲义重建（Sugeno，25 条规则）；模糊输出 0.983",
  t25: "Simscape 物理模型；位移有超调",
  t26: "DH 正运动学；探针记录末端 x/y/z",
  t27: "TF/SS 数值积分对比；两者重合",
  t28: "DSP 采样/FFT；5.6k 点",
  t29: "PID vs LQR；PID 超调大",
  t30: "1/4 车主动悬挂；位移峰值 10",
  t31: "模型只输出真值/含噪测量；EKF 按讲义离线实现",
  t32: "模型已加 PD 状态反馈（K1=20, K2=8），角度 0.5→0.014 rad",
  t33: "UKF 数据采集；模型无 UKF 模块",
  t34: "EKF vs UKF 数据；模型无滤波器模块",
  t35: "已修复时间通道：t_mdl 由 Clock 记录；互补滤波输出正常",
  t36: "Stateflow 状态机；模式 0/1/2",
  t37: "触发/使能子系统；保持/复位",
  t38: "Bus 打包/拆解；三路信号",
  t39: "模型引用；refs/ 下附带两个子模型",
  t40: "变体子系统；ctrl_type=1 选 PID",
  t41: "PreLoad/Init/StopFcn；InitFcn 需 Kp/Ki",
  t42: "Level-2 MATLAB S-Function；deadzone_sfcn",
  t43: "Model Advisor/代数环；仿真通过",
};

const fmt = (v) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a < 1e-9) return "0";
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1);
  if (a >= 10) return v.toFixed(2);
  if (a >= 1) return v.toFixed(3);
  return v.toFixed(4);
};

function signalMetric(sig) {
  if (!sig) return null;
  const peak = sig.max, final = sig.final;
  if (Math.abs(peak - final) > 1e-6) return `峰值 ${fmt(peak)}，末值 ${fmt(final)}`;
  return `范围 ${fmt(sig.min)}–${fmt(peak)}，末值 ${fmt(final)}`;
}

function autoMetric(id, signals) {
  const names = PRIMARY[id] || [];
  if (!names.length) return "运行通过；无记录信号";
  const labels = LABELS[id] || {};
  const parts = [];
  for (const name of names) {
    const s = signals.find((x) => x.name === name);
    if (!s) continue;
    const label = labels[name];
    parts.push(`${label ? label + " " : ""}${signalMetric(s)}`);
  }
  return parts.length ? parts.join("；") : "运行通过；无匹配信号";
}

const rawById = new Map(raw.models.map((m) => [m.id.replace(/^t(\d{2})_.*$/, "t$1"), m]));
const rows = [];
const problems = [];
for (const lesson of lessons) {
  const m = rawById.get(lesson.id);
  if (!m) { problems.push(`${lesson.id}: missing raw probe`); continue; }
  if (m.model !== lesson.model) problems.push(`${lesson.id}: model mismatch ${m.model} != ${lesson.model}`);
  const modelPath = path.join(ROOT, "simulink", "models", lesson.model);
  if (!fs.existsSync(modelPath)) { problems.push(`${lesson.id}: missing ${modelPath}`); continue; }
  const signals = Array.isArray(m.signals) ? m.signals : (m.signals ? [m.signals] : []);
  const row = {
    id: lesson.id,
    n: lesson.n,
    title: lesson.title,
    model: lesson.model,
    demo: lesson.demo,
    sha256: sha256(modelPath),
    status: m.status,
    solver: m.solver,
    stop_time: m.stop_time,
    samples: m.samples,
    signals_count: signals.length,
    metric: METRIC_OVERRIDES[lesson.id] || autoMetric(lesson.id, signals),
    note: NOTES[lesson.id] || "",
    spark: (signals.find((x) => x.name === (PRIMARY[lesson.id] || [])[0])?.spark || []).map(Number),
    signals: signals.map((s) => ({
      name: s.name,
      n: s.n,
      min: Number(s.min.toFixed(6)),
      max: Number(s.max.toFixed(6)),
      final: Number(s.final.toFixed(6)),
      spark: (s.spark || []).map(Number),
    })),
  };
  if (lesson.id === "t39") {
    row.refs = [];
    for (const ref of ["tutorial39_controller.slx", "tutorial39_plant.slx"]) {
      const p = path.join(ROOT, "simulink", "models", "refs", ref);
      if (fs.existsSync(p)) row.refs.push({ model: ref, sha256: sha256(p) });
    }
  }
  rows.push(row);
}

if (problems.length) {
  console.error("probe data problems:");
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}
const ok = rows.filter((r) => r.status === "ok").length;
if (rows.length !== 43) throw new Error(`expected 43 rows, got ${rows.length}`);

const doc = {
  schema: 1,
  generated_at: raw.generated_at,
  matlab_version: raw.matlab_version,
  probe_script: "tools/probe_all.m",
  model_count: rows.length,
  ok_count: ok,
  toolbox_count: raw.toolboxes.length,
  models: rows,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${ok}/${rows.length} ok, ${doc.toolbox_count} toolboxes`);
