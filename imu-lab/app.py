"""IMU 数据实验室：上传 CSV → 清洗 → Allan → 调 R/Q → 看滤波。"""
from __future__ import annotations

import os
import sys

import numpy as np
import pandas as pd
import streamlit as st
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from shared.allan import AXES, AXIS_LABELS, allan_deviation, clean_crc, load_csv  # noqa: E402
from shared.kf import integrate, kf_1d  # noqa: E402

st.set_page_config(page_title="IMU Lab", page_icon="📈", layout="wide")

SAMPLE = os.path.join(ROOT, "data", "sample", "static_60s.csv")


@st.cache_data(show_spinner=False)
def load_sample() -> pd.DataFrame | None:
    if os.path.exists(SAMPLE):
        return load_csv(SAMPLE)
    return None


def fig_axes(nrows=1, figsize=(9, 3.2)):
    fig, axes = plt.subplots(nrows, 1, figsize=figsize, sharex=False)
    fig.tight_layout()
    return fig, np.atleast_1d(axes)


st.title("📈 IMU 数据实验室")
st.caption("上传 MPU6050 CSV → CRC 清洗 → Allan 方差 → 拖动 R/Q 看滤波效果")

with st.sidebar:
    st.header("数据")
    uploaded = st.file_uploader("上传 CSV（含 gx_dps/gy_dps/gz_dps，可选 crc_ok）", type=["csv"])
    fs = st.number_input("采样率 (Hz)", 10.0, 1000.0, 100.0, 10.0)
    do_clean = st.toggle("CRC / 物理坏帧清洗", value=True)
    axis = st.selectbox("主通道", AXES, format_func=lambda k: AXIS_LABELS[k])
    st.divider()
    st.caption("样例数据：data/sample/static_60s.csv")

if uploaded is not None:
    df = pd.read_csv(uploaded)
    df.columns = [str(c).strip() for c in df.columns]
    if "t" not in df.columns:
        df["t"] = np.arange(len(df)) / fs
else:
    df = load_sample()

if df is None:
    st.warning("还没有数据：请上传 CSV，或先生成 sample（见 data/README.md）。")
    st.stop()

need = [c for c in (axis,) if c not in df.columns]
if need:
    st.error(f"缺少列：{need}；可用列：{list(df.columns)}")
    st.stop()

clean = clean_crc(df) if do_clean else df.reset_index(drop=True)
bad = len(df) - len(clean)

c1, c2, c3, c4 = st.columns(4)
c1.metric("总帧数", f"{len(df):,}")
c2.metric("坏帧", f"{bad:,}", delta=f"-{bad/len(df):.2%}" if bad else "0")
c3.metric("时长", f"{len(df)/fs:.1f} s")
c4.metric("主通道均值", f"{clean[axis].mean():.3f} °/s")

tab1, tab2, tab3 = st.tabs(["时域", "Allan 方差", "调 R/Q"])

with tab1:
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(9, 5), sharex=True)
    ax1.plot(df["t"], df[axis], lw=0.6, color="#999999", label="原始")
    ax1.plot(clean["t"], clean[axis], lw=0.8, color="#1f77b4", label="清洗后")
    ax1.set_ylabel(f"{AXIS_LABELS[axis]} (°/s)")
    ax1.legend(loc="upper right", fontsize=8)
    ax2.plot(clean["t"], integrate(clean[axis].to_numpy(), fs), lw=0.8, color="#d62728")
    ax2.set_ylabel("积分角度 (°)")
    ax2.set_xlabel("时间 (s)")
    fig.tight_layout()
    st.pyplot(fig)

with tab2:
    taus = None
    fig, ax = plt.subplots(figsize=(9, 4.2))
    for col in AXES:
        if col not in clean.columns:
            continue
        a = allan_deviation(clean[col].to_numpy(), 1.0 / fs)
        if len(a):
            ax.loglog(a[:, 0], a[:, 1], lw=1.0, label=AXIS_LABELS[col])
    ax.set_xlabel("τ (s)")
    ax.set_ylabel("Allan 标准差 (°/s)")
    ax.grid(True, which="both", ls=":", alpha=0.4)
    ax.legend(fontsize=8)
    fig.tight_layout()
    st.pyplot(fig)
    st.caption("提示：yaw 通道在短 τ 处与其他轴同量级，长 τ 处上翘反映零偏/随机游走。")

with tab3:
    z = integrate(clean[axis].to_numpy(), fs)
    rexp = st.slider("log10(R)", -10, -2, -6, 1)
    qexp = st.slider("log10(Q)", -12, -4, -8, 1)
    r, q = 10.0 ** rexp, 10.0 ** qexp
    xs, _ = kf_1d(z, r, q, x0=float(z[0]), p0=1.0)
    st.write(f"R = {r:.2e}，Q = {q:.2e}，R/Q = {r/q:.1f}")
    fig, ax = plt.subplots(figsize=(9, 3.6))
    ax.plot(clean["t"], z - z[0], lw=0.8, color="#999999", label="原始积分")
    ax.plot(clean["t"], xs - xs[0], lw=1.0, color="#2ca02c", label="KF")
    ax.set_xlabel("时间 (s)")
    ax.set_ylabel("角度 (°)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    st.pyplot(fig)
    st.caption("把 Q 调大→更信观测、更抖；Q 调小→更平滑但滞后。R/Q 的工程意义就在这里。")

st.divider()
st.caption("下一步：多文件对比、跨器件、导出报告——见 ROADMAP.md。")
