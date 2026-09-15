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
import { isIP } from 'node:net';

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

  await page.getByRole('button', { name: 'Sign up' }).click({ timeout: 10_000 });

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
unrelated navigation. Narrow `fromContains` / `subjectContains` so you do not consume
the wrong mail. A reused inbox must be fresh/cleared, or the test must use a per-run
unique subject correlation string in `subjectContains`, so a pre-existing/stale message
cannot satisfy the wait.

## Before you consume the result

Match the **expected sender** before using `otp.codes[0]` or `otp.links[0]`.
Do not log the mail body or the code.

For a verification link, require **HTTPS** and the **exact expected host**
before navigation. `page.goto` follows redirects, so validate the initial URL and
every top-level navigation in its redirect chain with the same helper. Block
Service Workers so request interception cannot be bypassed, install a temporary
`browserContext.route` handler before `goto`, and remove it in `finally`:

```typescript
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

  const expectedHost = process.env.OAE_EXPECTED_HOST ?? '';
  const link = assertTrustedOtpUrl(message.otp.links[0] as string, expectedHost);

  async function abortUntrustedOtpNavigation(route) {
    const request = route.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      try {
        assertTrustedOtpUrl(request.url(), expectedHost);
      } catch {
        await route.abort();
        return;
      }
    }
    await route.continue();
  }

  await page.context().route('**/*', abortUntrustedOtpNavigation);
  try {
    await page.goto(link.toString());
  } finally {
    await page.context().unroute('**/*', abortUntrustedOtpNavigation);
  }
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
