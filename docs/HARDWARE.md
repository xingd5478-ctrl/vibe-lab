# STM32 serial protocol (host software)

## Scope

Real-time serial acquisition is handled by the host-side tooling, not by the web UI. The web lab accepts exported CSV files. The protocol below documents the firmware stream for host-side use.

## Transport

- Browser: Chrome / Edge, secure context (`https://` or `localhost`)
- STM32 firmware: USART1 at **460800** baud, 8N1
- Primary format: binary frames with CRC16-CCITT
- Legacy/optional: newline-delimited CSV

## Binary frames

```text
AA55  30 B  quaternion (4f) + accel (3i16)
AADD  20 B  accel (3i16) + gyro (3i16)
AACE  26 B  euler (3f) + accel (3i16)
BB66  32 B  node quaternion + accel + timestamp
CC77   6 B  sync
```

- Header: `type_hi type_lo payload_len seq_lo seq_hi extra`
- CRC: 2 B little-endian at end, over all bytes before CRC
- AADD raw gyro is scaled by `/16.4` to deg/s; accel by `/16384` to g

## Legacy CSV frames

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
