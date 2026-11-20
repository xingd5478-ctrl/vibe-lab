# Selectable-text PDF

## What is implemented

`IMU Lab → 可选中 PDF / 打印` opens a print-ready HTML report containing:

- data source / fs / valid frames
- gyro bias
- Allan ARW/RRW/R²
- R/Q
- temperature slope
- six-face bias / scale / quality / per-face table
- complementary-filter chart

This report is rendered by the browser, so **text remains selectable and searchable** when saved with:

```text
Ctrl + P → 另存为 PDF
```

This is the supported selectable-text PDF path.

## What is not implemented

`IMU Lab → 下载图像 PDF` uses a canvas JPEG embedded in a minimal PDF. The file downloads directly, but its text is **not selectable**.

Reason:

- the page is zero-dependency and does not bundle a CJK font
- embedding a Chinese font subset would add a large binary asset and font-license surface
- the browser print path already produces selectable text without a font bundle

This is a documented print-based equivalent, not a fake text PDF.

## Acceptance

1. Generate or load data and complete some calibration.
2. Click `可选中 PDF / 打印`.
3. In the print dialog choose `另存为 PDF`.
4. Open the PDF and select a heading or table cell.
5. Confirm text can be searched for `IMU` or `gx`.

## Scope

- Browser/OS fonts determine exact rendering.
- Print margins and page size are user-controlled.
- The direct image PDF remains available for a one-click artifact.
