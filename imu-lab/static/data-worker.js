/* CSV 解析 Worker：大文件解析在后台线程完成，返回列式 typed arrays */
importScripts("data.js");

self.onmessage = function (e) {
  const { id, text } = e.data;
  try {
    const cols = self.IMUData.parseText(text);
    if (!cols) {
      self.postMessage({ id, ok: false });
      return;
    }
    const t = cols.t.slice();
    const gx = cols.gx.slice();
    const gy = cols.gy.slice();
    const gz = cols.gz.slice();
    const crc = cols.crc.slice();
    self.postMessage({ id, ok: true, n: cols.n, t, gx, gy, gz, crc }, [
      t.buffer,
      gx.buffer,
      gy.buffer,
      gz.buffer,
      crc.buffer,
    ]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
