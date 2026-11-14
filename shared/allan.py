"""CSV 加载、CRC 坏帧清洗、Allan 方差（重叠式）。"""
from __future__ import annotations

import numpy as np
import pandas as pd

AXES = ("gx_dps", "gy_dps", "gz_dps")
AXIS_LABELS = {"gx_dps": "GX (roll rate)", "gy_dps": "GY (pitch rate)", "gz_dps": "GZ (yaw rate)"}


def load_csv(path, rate: float = 100.0) -> pd.DataFrame:
    """读取 CSV，规范化列名；没有时间列就按采样率补。"""
    df = pd.read_csv(path)
    df.columns = [str(c).strip() for c in df.columns]
    if "t" not in df.columns and "time" not in df.columns:
        df["t"] = np.arange(len(df)) / float(rate)
    elif "time" in df.columns and "t" not in df.columns:
        df["t"] = df["time"]
    return df


def clean_crc(df: pd.DataFrame, max_abs: float = 5.0) -> pd.DataFrame:
    """剔除 crc_ok != 1 的帧，以及任一角速度超过 max_abs 的物理不可能帧。"""
    if "crc_ok" in df.columns:
        df = df[df["crc_ok"].astype(float) == 1]
    cols = [c for c in AXES if c in df.columns]
    if cols:
        df = df[(df[cols].abs() <= max_abs).all(axis=1)]
    return df.reset_index(drop=True)


def allan_deviation(x, dt: float, taus=None) -> np.ndarray:
    """重叠式 Allan 标准差，返回 (tau, adev) 数组。"""
    x = np.asarray(x, dtype=float)
    n = len(x)
    if n < 10:
        return np.empty((0, 2))
    if taus is None:
        taus = np.logspace(np.log10(dt * 10), np.log10(n * dt / 10), 40)
    cs = np.cumsum(np.insert(x, 0, 0.0))
    out = []
    for tau in taus:
        m = max(1, int(round(tau / dt)))
        if m * 2 >= n:
            break
        cnt = n // m
        means = (cs[m: cnt * m + 1: m] - cs[: cnt * m: m]) / m
        d = np.diff(means)
        out.append((tau, float(np.sqrt(0.5 * np.mean(d ** 2)))))
    return np.array(out)


def allan_three_axes(df: pd.DataFrame, rate: float = 100.0) -> dict:
    dt = 1.0 / float(rate)
    return {c: allan_deviation(df[c].to_numpy(), dt) for c in AXES if c in df.columns}
