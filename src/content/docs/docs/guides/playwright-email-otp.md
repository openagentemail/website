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

test('signup waits for the verification email before reading the code', async ({ page, request }) => {
  test.setTimeout(90_000);
  const api = process.env.OAE_API ?? 'http://localhost:3100';
  const token = process.env.OAE_IDENTITY_TOKEN ?? '';
  const mailbox = process.env.OAE_MAILBOX ?? '';
  const expectedSender = process.env.OAE_EXPECTED_SENDER ?? '';
  const signupUrl = process.env.SIGNUP_URL ?? '';

  if (!token.startsWith('oa_')) {
    throw new Error('OAE_IDENTITY_TOKEN must be a scoped oa_ identity token for this mailbox');
  }
  if (!mailbox || !expectedSender || !signupUrl) {
    throw new Error('OAE_MAILBOX, OAE_EXPECTED_SENDER, and SIGNUP_URL are required before wait');
  }

  const wait = request.post(`${api}/v1/messages/wait`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      address: mailbox,
      fromContains: expectedSender,
      subjectContains: 'verify',
      timeoutSec: 60,
    },
    timeout: 70_000,
  });

  await page.goto(signupUrl);
  await page.getByLabel('Email').fill(mailbox);
  await page.getByRole('button', { name: 'Sign up' }).click();

  const response = await wait;
  expect(response.ok()).toBeTruthy();
  const message = await response.json();

  expect(String(message.from).toLowerCase()).toContain(expectedSender.toLowerCase());
  const code = message.otp.codes[0] as string;
  expect(code).toBeTruthy();

  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();
});
```

The executable timeout ladder is enclosing test 90 seconds > request 70 seconds >
server wait 60 seconds (`test.setTimeout(90_000)`, request `timeout: 70_000`,
`timeoutSec: 60`). Narrow `fromContains` / `subjectContains` so you do not consume
the wrong mail.

## Before you consume the result

Match the **expected sender** before using `otp.codes[0]` or `otp.links[0]`.
Do not log the mail body or the code.

For a verification link, require **HTTPS** and the **exact expected host**
before navigation:

```typescript
  const expectedHost = process.env.OAE_EXPECTED_HOST ?? '';
  const raw = message.otp.links[0] as string;
  const link = new URL(raw);
  if (link.protocol !== 'https:' || link.hostname !== expectedHost) {
    throw new Error('refusing to visit OTP link: HTTPS and exact expected host are required');
  }
  await page.goto(link.toString());
```

Skip the visit when either check fails. Do not open `http:` links, IP hosts,
or a different hostname than the signup destination.

## Artifacts and parallel workers

Playwright **traces**, **videos**, **screenshots**, and HTML **reports** can
capture the short-lived code, link, and identity token. Disable those
artifacts for this test, or store them privately and expire them with the OTP.

Parallel tests need a **distinct mailbox per worker**, or a unique subject
correlation string in `subjectContains`. Two workers sharing one inbox can
consume each other's mail.
