# STM32 Web Serial Protocol (v2.0)

## Transport

- Browser: Chrome / Edge, secure context (`https://` or `localhost`)
- Serial: 115200 baud, 8N1
- Newline-delimited CSV, one sample per line

## Supported frames

```text
gx,gy,gz
t,gx,gy,gz
```

- `t` in seconds
- `gx/gy/gz` in °/s
- Lines with fewer than 3 numeric fields are ignored
- No CRC in the serial path; CRC is only supported in CSV import

Also accepted by the v2.0 serial reader:

```text
t,gx,gy,gz,ax,ay,az,temp
```

- 3 fields: gx,gy,gz; timestamp synthesized from sample rate
- 4 fields: t,gx,gy,gz
- 6 fields: t,gx,gy,gz,ax,ay,az
- 7 fields: t,gx,gy,gz,ax,ay,az,temp

## Firmware checklist

1. Fixed sample rate, documented in the UI (`fs`).
2. Monotonic timestamp; do not reset mid-session.
3. Clamp/skip I2C read failures instead of emitting `NaN`.
4. Do not emit debug text on the same serial line as data.
5. Flush at least every 20 ms to avoid browser buffering.

## Acceptance test

1. Connect at 115200 and verify the status shows frames increasing.
2. Compare 60 s mean of each axis against a static reference.
3. Verify Allan deviation from serial capture matches CSV import of the same run.
4. Disconnect/reconnect and confirm no duplicate timestamps.
5. Confirm CSV export and calibration JSON include the captured run.

## Calibration workflow

1. Load static data, estimate gyro bias.
2. Six-face accelerometer capture, matrix calibration, quality grade A/B/F.
3. Temperature points or auto plateaus, robust fit, per-frame compensation.
4. Gyro scale with a known-rate fixture.
5. Apply combined compensation, export CSV + calibration JSON + PDF.

## Limits

- Browser cannot guarantee hard-real-time acquisition.
- Web Serial availability differs by browser/OS; Android support is not guaranteed.
- This is a teaching/engineering aid, not a certified calibration station.
