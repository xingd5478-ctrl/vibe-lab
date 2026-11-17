# English review

## Automated checks

- `npm run e2e` fails on visible CJK in `/en/`, the English guide/lessons, `about/en.html`,
  `about/matlab-en.html`, and the `?lang=en` tool pages.
- The English guide test checks 43 lessons and no CJK.
- `npm run check:static` checks page title/lang/viewport/main/nav.

## Manual checklist (not yet signed off by a native reviewer)

- [ ] Read `/en/guide.html` end to end for tense, articles, and terminology.
- [ ] Check `imu`, `control`, `simulink` `?lang=en` labels against a glossary.
- [ ] Check `about/en.html` claims against `about/index.html`.
- [ ] Check `about/matlab-en.html` caveats and model names.
- [ ] Check the English 404 and feedback copy.
- [ ] Read on a phone; check line length and overflow.
- [ ] Confirm the Chinese source notes are described as source notes, not as English copy.

## Glossary to keep consistent

| Chinese | English |
|---|---|
| 自然频率 | natural frequency |
| 阻尼比 | damping ratio |
| 阶跃响应 | step response |
| 相位裕度 | phase margin |
| 状态反馈 | state feedback |
| 观测器 | observer |
| 卡尔曼滤波 | Kalman filter |
| 互补滤波 | complementary filter |
| 根轨迹 | root locus |
| 离散化 | discretization |

## Status

The English content was authored and machine-checked; it has **not** been reviewed by a
native speaker. Do not claim “native-reviewed” until that review is recorded here.
