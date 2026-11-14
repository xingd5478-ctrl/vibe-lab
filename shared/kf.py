"""Allan 系数 → R/Q 映射，以及一维卡尔曼滤波。"""
from __future__ import annotations

import numpy as np


def rq_from_allan(arw: float, rrw: float, fs: float = 100.0):
    """ARW [deg/sqrt(h)]、RRW [(deg/s)/sqrt(h)] → R [deg^2]、Q [deg^2/s^2]。

    采用工程近似：R = (ARW/60)^2 * dt，Q = (RRW/60)^2 * dt。
    """
    dt = 1.0 / float(fs)
    r = (arw / 60.0) ** 2 * dt
    q = (rrw / 60.0) ** 2 * dt
    return r, q, (r / q if q > 0 else float("inf"))


def kf_1d(z, r: float, q: float, x0: float = 0.0, p0: float = 1.0):
    """一维随机游走模型的卡尔曼滤波，返回 (估计, 方差)。"""
    z = np.asarray(z, dtype=float)
    x, p = float(x0), float(p0)
    xs = np.empty_like(z)
    ps = np.empty_like(z)
    for k, zk in enumerate(z):
        p += q
        k_gain = p / (p + r)
        x += k_gain * (zk - x)
        p = (1.0 - k_gain) * p
        xs[k] = x
        ps[k] = p
    return xs, ps


def integrate(rate_dps, fs: float = 100.0):
    """角速度积分成角度（度）。"""
    return np.cumsum(np.asarray(rate_dps, dtype=float)) / float(fs)
