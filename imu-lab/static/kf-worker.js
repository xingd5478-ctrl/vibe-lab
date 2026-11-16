/* KF Worker：积分 + 卡尔曼滤波在后台线程完成，返回抽稀后的绘图点 */
importScripts("kf.js");

let rate = null;
let fs = 100;

self.onmessage = function (e) {
  const m = e.data;
  if (m.type === "set") {
    rate = m.rate;
    fs = m.fs;
  } else if (m.type === "compute" && rate) {
    const angle = self.IMUKF.integrate(rate, fs);
    const kf = self.IMUKF.kf1d(angle, m.r, m.q, angle[0], 1);
    const comp = m.compare ? self.IMUKF.kf1d(angle, m.compare.r, m.compare.q, angle[0], 1) : null;
    const step = Math.max(1, Math.ceil(angle.length / 1500));
    const a = [],
      k = [],
      c = [];
    for (let i = 0; i < angle.length; i += step) {
      const t = i / fs;
      a.push([t, angle[i] - angle[0]]);
      k.push([t, kf[i] - kf[0]]);
      if (comp) c.push([t, comp[i] - comp[0]]);
    }
    self.postMessage({ id: m.id, angle: a, kf: k, comp: c });
  }
};
