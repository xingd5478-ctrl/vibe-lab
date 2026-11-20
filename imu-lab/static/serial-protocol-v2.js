/* STM32 binary protocol, loaded under a cache-busting filename.
   Keeps the Web Serial path working even when an older data.js is cached. */
(function (root) {
  "use strict";
  const D = root.IMUData || {};
  const FRAMES = { 0xbadd: 40, 0xaa55: 30, 0xaadd: 20, 0xaace: 26, 0xbb66: 32, 0xcc77: 6 };

  D.crc16ccitt = function (bytes) {
    let crc = 0xffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
  };

  D.parseBinaryFrames = function (input, opts) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const fs = (opts && opts.fs) || 100;
    const baseT = (opts && opts.baseT) || 0;
    const rows = [];
    const stats = { frames: 0, crcErrors: 0, dropped: 0, seqGaps: 0, lastSeq: null, types: {} };
    let cursor = 0;
    while (cursor + 6 <= bytes.length) {
      const type = (bytes[cursor] << 8) | bytes[cursor + 1];
      const total = FRAMES[type];
      if (!total) {
        cursor++;
        stats.dropped++;
        continue;
      }
      if (cursor + total > bytes.length) break;
      const len = total - 2;
      const crc = bytes[cursor + len] | (bytes[cursor + len + 1] << 8);
      if (D.crc16ccitt(bytes.subarray(cursor, cursor + len)) !== crc) {
        stats.crcErrors++;
        cursor++;
        stats.dropped++;
        continue;
      }
      const dv = new DataView(bytes.buffer, bytes.byteOffset + cursor, total);
      const row = {
        t: baseT + rows.length / fs,
        crc: 1,
        seq: (bytes[cursor + 3] | (bytes[cursor + 4] << 8)) & 0x7fff,
      };
      if (type === 0xbadd) {
        row.yaw = dv.getInt16(3, true) / 10;
        row.target = dv.getInt16(5, true) / 10;
        row.motorL = dv.getInt16(7, true);
        row.motorR = dv.getInt16(9, true);
        row.ax = dv.getInt16(11, true) / 16384;
        row.ay = dv.getInt16(13, true) / 16384;
        row.az = dv.getInt16(15, true) / 16384;
        row.gx = dv.getInt16(17, true) / 131;
        row.gy = dv.getInt16(19, true) / 131;
        row.gz = dv.getInt16(21, true) / 131;
      } else if (type === 0xaa55) {
        row.q = [dv.getFloat32(6, true), dv.getFloat32(10, true), dv.getFloat32(14, true), dv.getFloat32(18, true)];
        row.ax = dv.getInt16(22, true) / 16384;
        row.ay = dv.getInt16(24, true) / 16384;
        row.az = dv.getInt16(26, true) / 16384;
      } else if (type === 0xaadd) {
        row.ax = dv.getInt16(6, true) / 16384;
        row.ay = dv.getInt16(8, true) / 16384;
        row.az = dv.getInt16(10, true) / 16384;
        row.gx = dv.getInt16(12, true) / 16.4;
        row.gy = dv.getInt16(14, true) / 16.4;
        row.gz = dv.getInt16(16, true) / 16.4;
      } else if (type === 0xaace) {
        row.roll = dv.getFloat32(6, true);
        row.pitch = dv.getFloat32(10, true);
        row.yaw = dv.getFloat32(14, true);
        row.ax = dv.getInt16(18, true) / 16384;
        row.ay = dv.getInt16(20, true) / 16384;
        row.az = dv.getInt16(22, true) / 16384;
      } else if (type === 0xbb66) {
        row.node = bytes[cursor + 5];
        row.q = [dv.getFloat32(6, true), dv.getFloat32(10, true), dv.getFloat32(14, true), dv.getFloat32(18, true)];
        row.ax = dv.getInt16(22, true) / 16384;
        row.ay = dv.getInt16(24, true) / 16384;
        row.az = dv.getInt16(26, true) / 16384;
      }
      const seqMask = type === 0xbadd ? 0xff : 0x7fff;
      if (stats.lastSeq != null && row.seq !== ((stats.lastSeq + 1) & seqMask)) stats.seqGaps++;
      stats.lastSeq = row.seq;
      stats.frames++;
      stats.types[type.toString(16)] = (stats.types[type.toString(16)] || 0) + 1;
      if (row.gx !== undefined) rows[rows.length] = row;
      cursor += total;
    }
    return { rows, rest: bytes.slice(cursor), stats };
  };

  root.IMUData = D;
})(window);
