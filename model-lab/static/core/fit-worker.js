/* Model fit worker: heavy time-domain fits off the UI thread. */
importScripts("data.js", "identify.js");

self.onmessage = function (e) {
  const { id, model, data, opts, abortBuffer } = e.data;
  try {
    const I = self.ModelIdentify;
    const progress = (p) => self.postMessage({ id, progress: Math.max(0, Math.min(1, p)) });
    const shouldAbort = abortBuffer ? () => Atomics.load(new Int32Array(abortBuffer), 0) !== 0 : null;
    const o = { ...opts, onProgress: progress, shouldAbort };
    const t = data.t,
      u = data.u,
      y = data.y;
    let fit;
    if (model === "OE") fit = I.fitOE(t, u, y, o);
    else if (model === "ARMAX") fit = I.fitARMAX(t, u, y, o);
    else if (model === "Hammerstein") fit = I.fitHammerstein(t, u, y, o);
    else if (model === "MIMO-ARX") fit = I.fitMIMOARX(t, data.U, data.Y, o);
    else throw new Error("Unsupported worker model: " + model);
    self.postMessage({ id, ok: true, fit });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
