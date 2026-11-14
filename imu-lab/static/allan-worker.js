/* Allan 方差 Worker：接收三轴 Float32Array，返回各轴 Allan 点 */
importScripts("allan.js");

self.onmessage = function (e) {
  const { id, gx, gy, gz, crc, fs, clean } = e.data;
  const axes = { gx, gy, gz };
  const dt = 1 / fs;
  const out = {};

  for (const key of Object.keys(axes)) {
    const src = axes[key];
    let arr;
    if (clean) {
      arr = new Float64Array(src.length);
      let k = 0;
      for (let i = 0; i < src.length; i++) {
        if ((!crc || crc[i] === 1) && Math.abs(src[i]) <= 5) arr[k++] = src[i];
      }
      arr = arr.subarray(0, k);
    } else {
      arr = src;
    }
    out[key] = self.IMUAllan.allanDeviation(arr, dt);
  }

  self.postMessage({ id, results: out });
};
