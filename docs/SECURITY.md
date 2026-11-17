# Security and external dependencies

## Current posture

- No backend, no database, no auth, no secrets in the repository.
- CSV and sensor data stay in the browser; nothing is uploaded by the tools.
- Third-party endpoints: GoatCounter, Tally, jsDelivr/GitHub raw for optional course sources.
- GitHub Pages cannot set response headers; the Cloudflare Worker can, but no CSP is enforced yet.

## CSP plan (not yet enforced)

A report-only policy is impossible via a `<meta>` tag; it requires an HTTP header. On a
header-capable host, start with report-only:

```text
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' https://gc.zgo.at 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://cdn.jsdelivr.net https://raw.githubusercontent.com;
  connect-src 'self' https://cdn.jsdelivr.net https://raw.githubusercontent.com https://gc.zgo.at https://tally.so;
  frame-src https://tally.so;
  base-uri 'none';
  form-action 'self' https://tally.so;
```

Then remove `'unsafe-inline'` by moving the GoatCounter bootstrap and SW registration to
external files, and add hashes/nonces. Do not switch to enforce until the console is clean.

## SRI / self-hosting

- GoatCounter's `count.js` is versionless; SRI is not practical. Prefer self-hosting a pinned
  copy, or accept the third-party script as a documented exception.
- Tally is a link/iframe, not a script; constrain it with `frame-src`.
- jsDelivr/GitHub raw are optional reads; `course.js` already falls back LOCAL → CDN → RAW and
  shows a user-visible failure message.

## Dependency policy

- Runtime: no npm dependencies. Keep it that way unless a measured requirement appears.
- Dev: `axe-core`, `eslint`, `prettier`, `globals`. Update deliberately; run `npm ci` and the full test suite.
- Do not add an external font/animation library for a visual effect.
- Review third-party scripts for privacy and add them to the CSP plan before shipping.

## Reporting

Open a GitHub issue (no secrets, no personal data). For a security-sensitive report, use the
repository's private security advisory flow if available.
