# imu-lab

IMU 数据实验室：上传 CSV → CRC 清洗 → Allan 方差 → 拖动 R/Q 看滤波。**静态版（主）** 零依赖、无后端；**Streamlit 版** 作为本地分析备份。

## 静态版（推荐）

```bash
# 直接双击也行
start imu-lab/static/index.html

# 或本地预览
python -m http.server 8000 --directory imu-lab/static
# 打开 http://localhost:8000
```

功能：

- 示例数据（合成，含 10 个坏帧）自动加载，无需准备文件
- 上传 CSV：`gx_dps/gy_dps/gz_dps`，可选 `crc_ok`、`t`
- 原始 / 清洗后时域对比，坏帧计数
- 三轴 Allan 标准差（log-log，1-2-5 刻度）
- **Allan 自动拟合 ARW/RRW → 一键回填 R/Q**（短 τ 取 N，长 τ 取 K，图上叠加虚线拟合段）
- log10(R)、log10(Q) 滑杆，实时看积分角度与 KF
- **导出 CSV**（清洗后数据 + 角度 + KF 输出）与 **单图 PNG**（2× 分辨率）
- **分享链接**：R/Q、通道、采样率写入 URL，复制即可复现
- 全部在浏览器内计算，离线可用

## 部署到 GitHub Pages

仓库已带 `.github/workflows/pages.yml`：

1. 把 `vibe-lab` 推到 GitHub；
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**；
3. 推送 `imu-lab/static/**` 的改动会自动部署；
4. 地址：`https://<用户名>.github.io/<仓库名>/`。

> 如果 Pages 没触发，检查 Actions 里 “Deploy imu-lab to GitHub Pages” 是否成功。

## 部署到 Vercel（更简单）

- 打开 vercel.com → Add New → Project → 选仓库；
- **Root Directory** 填 `imu-lab/static`，Framework 选 **Other**；
- Deploy，得到 `https://xxx.vercel.app`。

## Streamlit 版（备份）

```bash
cd vibe-lab/imu-lab
pip install -r requirements.txt
streamlit run app.py
```

适合本地批量看数据；依赖 Python，不适合对外分享。

## 数据格式

| 列 | 必需 | 说明 |
|---|---|---|
| `t` | 否 | 秒；没有就按采样率自动补 |
| `gx_dps/gy_dps/gz_dps` | 是 | 角速度，°/s |
| `crc_ok` | 否 | 1 有效 / 0 坏帧 |

## 目录

```
imu-lab/
├── static/            # 静态版（部署这个）
│   ├── index.html
│   ├── app.js
│   ├── allan.js
│   ├── kf.js
│   └── style.css
├── app.py             # Streamlit 版
└── requirements.txt
```
