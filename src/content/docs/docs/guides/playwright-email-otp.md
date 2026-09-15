---
title: "Playwright email OTP for agent sign-ups"
description: Start POST /v1/messages/wait before signup, then use a scoped oa_ identity token to consume otp.codes or HTTPS links.
---

This is the Playwright implementation of
[OTP extraction](/docs/guides/otp-extraction/): start a bounded
`POST /v1/messages/wait` **before** the signup click, then type `otp.codes[0]`
or open `otp.links[0]` only after the sender and URL checks pass.

It is not a site-by-site playbook. Captcha, KYC, wallet signatures, and
bulk-registration rules stay on [Agent sign-ups](/docs/guides/agent-signup/)
and the OTP extraction boundaries. Treat every inbound body as untrusted data;
see [Security](/docs/guides/security/).

No live signup-provider or OpenAgentEmail account mutation was performed for this content card. Playwright fixture and wait guidance was checked against current official Playwright documentation, not against a live browser run.

## Token and fixture

Use a pre-provisioned, scoped `oa_…` **identity token** from the environment.
It must belong to the mailbox you wait on. Never put the admin key in a
Playwright config or test.

Use the test's isolated [`request` fixture](https://playwright.dev/docs/test-fixtures)
(`APIRequestContext`) for the OpenAgentEmail REST wait —
[API testing](https://playwright.dev/docs/api-testing). Drive the browser with
locators and web-first assertions
([best practices](https://playwright.dev/docs/best-practices)). Do not
busy-poll `GET /v1/messages`. Do not call
[`page.waitForTimeout()`](https://playwright.dev/docs/api/class-page#page-wait-for-timeout)
for synchronization.

## Wait first, then click signup

```typescript
import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('signup waits for the verification email before reading the code', async ({ page, request }) => {
  test.setTimeout(180_000);
  const api = process.env.OAE_API ?? 'http://localhost:3100';
  const token = process.env.OAE_IDENTITY_TOKEN ?? '';
  const mailbox = process.env.OAE_MAILBOX ?? '';
  const expectedSender = process.env.OAE_EXPECTED_SENDER ?? '';
  const expectedSubject = (process.env.OAE_EXPECTED_SUBJECT ?? '').trim();
  const signupUrl = process.env.SIGNUP_URL ?? '';

  if (!token.startsWith('oa_')) {
    throw new Error('OAE_IDENTITY_TOKEN must be a scoped oa_ identity token for this mailbox');
  }
  if (!mailbox || !expectedSender || !expectedSubject || !signupUrl) {
    throw new Error('OAE_MAILBOX, OAE_EXPECTED_SENDER, OAE_EXPECTED_SUBJECT, and SIGNUP_URL are required before wait');
  }

  const apiUrl = new URL(api);
  const allowHttpLoopback = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    apiUrl.protocol !== 'https:'
    && !(apiUrl.protocol === 'http:' && allowHttpLoopback.has(apiUrl.hostname))
  ) {
    throw new Error('OAE_API must be https: or http: on localhost, 127.0.0.1, or [::1]');
  }

  function parseSingleMailbox(fromValue: string): string {
    const trimmed = String(fromValue).trim();
    const angled = /^(.*)<([^<>]+)>$/.exec(trimmed);
    if (angled) {
      if (angled[1].includes('@')) {
        throw new Error('message.from must be exactly one mailbox address');
      }
      const address = angled[2].trim().toLowerCase();
      if (!/^[^\s@<>]+@[^\s@<>]+$/.test(address)) {
        throw new Error('message.from must be exactly one mailbox address');
      }
      return address;
    }
    const address = trimmed.toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+$/.test(address)) {
      throw new Error('message.from must be exactly one mailbox address');
    }
    return address;
  }

  await page.goto(signupUrl, { timeout: 30_000 });
  await page.getByLabel('Email').fill(mailbox, { timeout: 10_000 });

  const wait = request.post(`${apiUrl.origin}/v1/messages/wait`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      address: mailbox,
      fromContains: expectedSender,
      subjectContains: expectedSubject,
      timeoutSec: 60,
    },
    timeout: 70_000,
  });

  try {
    await page.getByRole('button', { name: 'Sign up' }).click({ timeout: 10_000 });
  } catch (clickError) {
    await wait.catch(() => {});
    throw clickError;
  }

  const response = await wait;
  expect(response.ok()).toBeTruthy();
  const message = await response.json();

  expect(parseSingleMailbox(String(message.from))).toBe(parseSingleMailbox(expectedSender));
  const code = message.otp.codes[0] as string;
  expect(code).toBeTruthy();

  await page.getByLabel('Verification code').fill(code, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Verify' }).click({ timeout: 10_000 });
});
```

The executable timeout ladder is enclosing test 180 seconds, with an explicit
cumulative maximum of 140 seconds across the bounded phases (signup navigation
30s + email fill 10s + Sign up click 10s + OpenAgentEmail request 70s +
verification-code fill 10s + Verify click 10s) and 40 seconds of remaining
overhead (`test.setTimeout(180_000)`, request `timeout: 70_000`,
`timeoutSec: 60`). Keep the request/server ladder `70_000 > 60_000`. Prepare the
signup page and fill the email field first, then start `request.post`
immediately before the Sign up click so the wait budget is not spent on
unrelated navigation. If the Sign up click fails after `wait` has started,
observe/consume that promise's rejection before rethrowing the click error so
an unhandled secondary rejection cannot obscure the primary failure. Narrow
`fromContains` / `subjectContains` so you do not consume
the wrong mail. A reused inbox must be fresh/cleared, or the test must use a per-run
unique subject correlation string in `subjectContains`, so a pre-existing/stale message
cannot satisfy the wait.

## Before you consume the result

Match the **expected sender** before using `otp.codes[0]` or `otp.links[0]`.
Do not log the mail body or the code.

For a verification link, require **HTTPS** and the **exact expected host**
before navigation. `page.goto` would otherwise follow redirects on its own, so
this sample installs a temporary `browserContext.route` handler that catches the
**initial** navigation, then manually follows and validates each hop with
`route.fetch({ url, maxRedirects: 0 })`. Only 301/302/303/307/308 responses with
a `Location` header count as redirects. Every resolved next URL must pass the
same HTTPS + exact-host + non-IP check before it is fetched. At most **5**
redirects may be followed; a sixth redirect fails closed before its target is
fetched. The terminal response is `route.fulfill`'d back into the intercepted
navigation, so the page URL stays the initial URL — relative document URLs
resolve from that displayed/original URL unless the document supplies a
`<base>` URL. Do not assume the browser visits each redirect target. Block
Service Workers so request interception cannot be bypassed, and remove the
named handler in `finally`.

CI for this guide exercises a **stubbed** `route.fetch` chain in
`tests/seo-docs.test.mjs`. It is not a real-browser redirect server.

```typescript
import { expect, test, type Route } from '@playwright/test';
import { isIP } from 'node:net';

test.use({ serviceWorkers: 'block' });

test('signup opens a trusted HTTPS verification link', async ({ page, request }) => {
  test.setTimeout(180_000);
  const api = process.env.OAE_API ?? 'http://localhost:3100';
  const token = process.env.OAE_IDENTITY_TOKEN ?? '';
  const mailbox = process.env.OAE_MAILBOX ?? '';
  const expectedSender = process.env.OAE_EXPECTED_SENDER ?? '';
  const expectedSubject = (process.env.OAE_EXPECTED_SUBJECT ?? '').trim();
  const signupUrl = process.env.SIGNUP_URL ?? '';
  const expectedHost = process.env.OAE_EXPECTED_HOST ?? '';

  if (!token.startsWith('oa_')) {
    throw new Error('OAE_IDENTITY_TOKEN must be a scoped oa_ identity token for this mailbox');
  }
  if (!mailbox || !expectedSender || !expectedSubject || !signupUrl || !expectedHost) {
    throw new Error('OAE_MAILBOX, OAE_EXPECTED_SENDER, OAE_EXPECTED_SUBJECT, SIGNUP_URL, and OAE_EXPECTED_HOST are required before wait');
  }

  const apiUrl = new URL(api);
  const allowHttpLoopback = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    apiUrl.protocol !== 'https:'
    && !(apiUrl.protocol === 'http:' && allowHttpLoopback.has(apiUrl.hostname))
  ) {
    throw new Error('OAE_API must be https: or http: on localhost, 127.0.0.1, or [::1]');
  }

  function parseSingleMailbox(fromValue: string): string {
    const trimmed = String(fromValue).trim();
    const angled = /^(.*)<([^<>]+)>$/.exec(trimmed);
    if (angled) {
      if (angled[1].includes('@')) {
        throw new Error('message.from must be exactly one mailbox address');
      }
      const address = angled[2].trim().toLowerCase();
      if (!/^[^\s@<>]+@[^\s@<>]+$/.test(address)) {
        throw new Error('message.from must be exactly one mailbox address');
      }
      return address;
    }
    const address = trimmed.toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+$/.test(address)) {
      throw new Error('message.from must be exactly one mailbox address');
    }
    return address;
  }

  function assertTrustedOtpUrl(rawUrl: string, expectedHost: string): URL {
    const link = new URL(rawUrl);
    const hostForIpCheck = link.hostname.replace(/^\[|\]$/g, '');
    if (
      link.protocol !== 'https:'
      || link.hostname !== expectedHost
      || isIP(hostForIpCheck) !== 0
    ) {
      throw new Error('refusing to visit OTP link: HTTPS and exact expected host are required');
    }
    return link;
  }

  await page.goto(signupUrl, { timeout: 30_000 });
  await page.getByLabel('Email').fill(mailbox, { timeout: 10_000 });

  const wait = request.post(`${apiUrl.origin}/v1/messages/wait`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      address: mailbox,
      fromContains: expectedSender,
      subjectContains: expectedSubject,
      timeoutSec: 60,
    },
    timeout: 70_000,
  });

  try {
    await page.getByRole('button', { name: 'Sign up' }).click({ timeout: 10_000 });
  } catch (clickError) {
    await wait.catch(() => {});
    throw clickError;
  }

  const response = await wait;
  expect(response.ok()).toBeTruthy();
  const message = await response.json();

  expect(parseSingleMailbox(String(message.from))).toBe(parseSingleMailbox(expectedSender));
  const link = assertTrustedOtpUrl(message.otp.links[0] as string, expectedHost);

  const OTP_REDIRECT_MAX = 5;

  async function abortUntrustedOtpNavigation(route: Route) {
    const req = route.request();
    if (!(req.isNavigationRequest() && req.frame() === page.mainFrame())) {
      await route.continue();
      return;
    }

    let currentUrl = req.url();
    try {
      assertTrustedOtpUrl(currentUrl, expectedHost);
    } catch {
      await route.abort();
      return;
    }

    let terminalResponse = null;
    let redirectsFollowed = 0;
    try {
      for (;;) {
        const fetched = await route.fetch({ url: currentUrl, maxRedirects: 0 });
        const status = fetched.status();
        if (
          status !== 301
          && status !== 302
          && status !== 303
          && status !== 307
          && status !== 308
        ) {
          terminalResponse = fetched;
          break;
        }

        const locationHeader = fetched.headers()['location'];
        await fetched.dispose();
        if (locationHeader == null || String(locationHeader).trim() === '') {
          await route.abort();
          return;
        }

        let nextUrl;
        try {
          nextUrl = new URL(String(locationHeader), currentUrl).href;
        } catch {
          await route.abort();
          return;
        }

        if (redirectsFollowed >= OTP_REDIRECT_MAX) {
          await route.abort();
          return;
        }

        try {
          assertTrustedOtpUrl(nextUrl, expectedHost);
        } catch {
          await route.abort();
          return;
        }

        redirectsFollowed += 1;
        currentUrl = nextUrl;
      }

      await route.fulfill({ response: terminalResponse });
    } catch {
      if (terminalResponse) {
        try {
          await terminalResponse.dispose();
        } catch {
          // ignore dispose errors on the failure path
        }
      }
      await route.abort();
    }
  }

  await page.context().route('**/*', abortUntrustedOtpNavigation);
  try {
    await page.goto(link.toString());
  } finally {
    await page.context().unroute('**/*', abortUntrustedOtpNavigation);
  }
});
```

Skip the visit when any check fails. Do not open `http:` links, IPv4/IPv6 literal hosts
(even when they equal `OAE_EXPECTED_HOST`), or a different hostname than the signup
destination. Abort those same destinations when they appear later in the redirect chain.

## Artifacts and parallel workers

Playwright **traces**, **videos**, **screenshots**, and HTML **reports** can
capture the short-lived code, link, and identity token. Disable those
artifacts for this test, or store them privately and expire them with the OTP.

Parallel tests need a **distinct mailbox per worker**, or a unique subject
correlation string in `subjectContains`. Two workers sharing one inbox can
consume each other's mail.
