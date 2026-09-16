# Real-browser OTP Redirect Regression Smoke (web#60)

This directory contains the independent regression smoke test suite for the Playwright email OTP redirect guard documented in `/docs/guides/playwright-email-otp/` (issue #60, follow-up from #45 / PR #59 R5).

## Execution Model

To respect Commander ruling #3183 and protect the root website dependency tree and lockfile scope:
- This test suite is isolated in `tests/e2e-redirect/` as an independent subproject with its own `package.json` and `package-lock.json`.
- The root `package.json` and `package-lock.json` remain completely unmodified.
- `@playwright/test` is pinned to exact version `1.61.1` (matching Chromium 149 used in the FC R5 reproduction).
- CI runs an independent workflow job `otp-redirect-smoke` in `.github/workflows/ci.yml` without modifying or affecting the main documentation `build` job.

## Covered Properties (All Local Fixtures, Zero Production/Public Network)

1. **Baseline Failure Reproduction (Blind spot)**: Proves that browser-managed redirects with `context.route('**/*', route => route.continue())` only intercept the initial navigation request; subsequent redirect hops bypass request routing and reach unsafe destinations directly.
2. **Pre-flight Validation & Fail-Closed Behavior**: Proves that the manual R5 loop (`route.fetch({ maxRedirects: 0 })` + `assertTrustedOtpUrl`) intercepts every hop and aborts before any HTTP request reaches untrusted destinations (such as HTTP or IP-literal targets).
3. **Same-host HTTPS Traversal**: Follows valid same-host HTTPS redirects to terminal status (200 OK) and fulfills the final response into the browser context.
4. **Hop-limit Enforcement**: Enforces `OTP_REDIRECT_MAX = 5` and aborts on the 6th redirect hop without fetching exceeding targets.
5. **Resource Cleanup**: Ensures intermediate responses are disposed and route handlers are unrouted in both success and failure execution paths.

## Running Locally

```bash
cd tests/e2e-redirect
npm ci
npx playwright install chromium
npm test
```
