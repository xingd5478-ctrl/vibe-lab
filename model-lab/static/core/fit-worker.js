/* Model fit worker: heavy time-domain fits off the UI thread. */
importScripts("data.js", "identify.js");

self.onmessage = function (e) {
  const { id, model, data, opts } = e.data;
  try {
    const I = self.ModelIdentify;
    const t = data.t,
      u = data.u,
      y = data.y;
    let fit;
    if (model === "OE") fit = I.fitOE(t, u, y, opts);
    else if (model === "ARMAX") fit = I.fitARMAX(t, u, y, opts);
    else if (model === "Hammerstein") fit = I.fitHammerstein(t, u, y, opts);
    else if (model === "MIMO-ARX") fit = I.fitMIMOARX(t, data.U, data.Y, opts);
    else throw new Error("Unsupported worker model: " + model);
    self.postMessage({ id, ok: true, fit });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
