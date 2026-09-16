import { test, expect, type Route } from '@playwright/test';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cert = fs.readFileSync(path.join(__dirname, '../fixtures/cert.pem'));
const key = fs.readFileSync(path.join(__dirname, '../fixtures/key.pem'));

interface RequestLog {
  url: string;
  method: string;
  timestamp: string;
  headers: http.IncomingHttpHeaders;
}

interface HopLog {
  hop: number;
  url: string;
  status: number;
  location?: string;
  timestamp: string;
  action: string;
}

let httpsServer: https.Server;
let httpServer: http.Server;
let httpsPort: number;
let httpPort: number;

const httpsRequests: RequestLog[] = [];
const httpRequests: RequestLog[] = [];

test.beforeAll(async () => {
  // Start HTTP fixture server (representing unsafe HTTP destination)
  httpServer = http.createServer((req, res) => {
    httpRequests.push({
      url: req.url || '/',
      method: req.method || 'GET',
      timestamp: new Date().toISOString(),
      headers: req.headers,
    });

    if (req.url === '/unsafe-destination') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Unsafe HTTP Landing</h1></body></html>');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address();
      if (addr && typeof addr === 'object') {
        httpPort = addr.port;
      }
      resolve();
    });
  });

  // Start HTTPS fixture server (representing trusted OpenAgentEmail / destination host)
  httpsServer = https.createServer({ key, cert }, (req, res) => {
    httpsRequests.push({
      url: req.url || '/',
      method: req.method || 'GET',
      timestamp: new Date().toISOString(),
      headers: req.headers,
    });

    const parsedUrl = new URL(req.url || '/', `https://localhost:${httpsPort}`);

    if (parsedUrl.pathname === '/trusted-start-to-http') {
      res.writeHead(302, {
        Location: `http://127.0.0.1:${httpPort}/unsafe-destination`,
      });
      res.end();
      return;
    }

    if (parsedUrl.pathname === '/trusted-start-to-diff-host') {
      // Redirect to IP literal host (which fails non-IP / expectedHost check)
      res.writeHead(302, {
        Location: `https://127.0.0.1:${httpsPort}/unsafe-ip-destination`,
      });
      res.end();
      return;
    }

    if (parsedUrl.pathname === '/same-host-redirect-1') {
      res.writeHead(302, {
        Location: `https://localhost:${httpsPort}/same-host-redirect-2`,
      });
      res.end();
      return;
    }

    if (parsedUrl.pathname === '/same-host-redirect-2') {
      res.writeHead(302, {
        Location: `https://localhost:${httpsPort}/verified`,
      });
      res.end();
      return;
    }

    if (parsedUrl.pathname === '/verified') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Verified Destination</h1></body></html>');
      return;
    }

    if (parsedUrl.pathname === '/hop-chain') {
      const step = parseInt(parsedUrl.searchParams.get('step') || '1', 10);
      const max = parseInt(parsedUrl.searchParams.get('max') || '5', 10);
      if (step < max) {
        res.writeHead(302, {
          Location: `https://localhost:${httpsPort}/hop-chain?step=${step + 1}&max=${max}`,
        });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Reached step ${step}</h1></body></html>`);
      return;
    }

    if (parsedUrl.pathname === '/unsafe-ip-destination') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Unsafe IP Landing</h1></body></html>');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    httpsServer.listen(0, '127.0.0.1', () => {
      const addr = httpsServer.address();
      if (addr && typeof addr === 'object') {
        httpsPort = addr.port;
      }
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await new Promise<void>((resolve) => httpsServer.close(() => resolve()));
});

test.beforeEach(() => {
  httpRequests.length = 0;
  httpsRequests.length = 0;
});

// Faithful implementation of assertTrustedOtpUrl from playwright-email-otp.md
function assertTrustedOtpUrl(rawUrl: string, expectedHost: string): URL {
  const link = new URL(rawUrl);
  const hostForIpCheck = link.hostname.replace(/^\[|\]$/g, '');
  if (
    link.protocol !== 'https:' ||
    link.hostname !== expectedHost ||
    isIP(hostForIpCheck) !== 0
  ) {
    throw new Error(
      `[${new Date().toISOString()}] refusing to visit OTP link: HTTPS and exact expected host (${expectedHost}) are required — got: ${rawUrl}`
    );
  }
  return link;
}

// Faithful implementation of R5 manual redirect loop from playwright-email-otp.md
function createR5RedirectHandler(options: {
  page: any;
  expectedHost: string;
  maxRedirects?: number;
  onHop?: (hop: HopLog) => void;
  onDispose?: () => void;
}) {
  const { page, expectedHost, maxRedirects = 5, onHop, onDispose } = options;

  return async function abortUntrustedOtpNavigation(route: Route) {
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

    let terminalResponse: any = null;
    let redirectsFollowed = 0;
    try {
      for (;;) {
        const fetched = await route.fetch({ url: currentUrl, maxRedirects: 0 });
        const status = fetched.status();

        if (
          status !== 301 &&
          status !== 302 &&
          status !== 303 &&
          status !== 307 &&
          status !== 308
        ) {
          onHop?.({
            hop: redirectsFollowed,
            url: currentUrl,
            status,
            timestamp: new Date().toISOString(),
            action: 'terminal_response_ready',
          });
          terminalResponse = fetched;
          break;
        }

        const locationHeader = fetched.headers()['location'];
        await fetched.dispose();
        onDispose?.();

        if (locationHeader == null || String(locationHeader).trim() === '') {
          onHop?.({
            hop: redirectsFollowed,
            url: currentUrl,
            status,
            timestamp: new Date().toISOString(),
            action: 'abort_missing_location',
          });
          await route.abort();
          return;
        }

        let nextUrl: string;
        try {
          nextUrl = new URL(String(locationHeader), currentUrl).href;
        } catch {
          onHop?.({
            hop: redirectsFollowed,
            url: currentUrl,
            status,
            location: String(locationHeader),
            timestamp: new Date().toISOString(),
            action: 'abort_invalid_url',
          });
          await route.abort();
          return;
        }

        onHop?.({
          hop: redirectsFollowed,
          url: currentUrl,
          status,
          location: nextUrl,
          timestamp: new Date().toISOString(),
          action: 'redirect_discovered',
        });

        if (redirectsFollowed >= maxRedirects) {
          onHop?.({
            hop: redirectsFollowed,
            url: currentUrl,
            status,
            location: nextUrl,
            timestamp: new Date().toISOString(),
            action: 'abort_max_redirects_exceeded',
          });
          await route.abort();
          return;
        }

        try {
          assertTrustedOtpUrl(nextUrl, expectedHost);
        } catch {
          onHop?.({
            hop: redirectsFollowed,
            url: currentUrl,
            status,
            location: nextUrl,
            timestamp: new Date().toISOString(),
            action: 'abort_untrusted_target',
          });
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
          onDispose?.();
        } catch {
          // ignore dispose errors on failure path
        }
      }
      await route.abort();
    }
  };
}

test.describe('Real-browser OTP redirect regression smoke (web#60)', () => {
  // ① 旧失败复现：仅 context.route(...continue()) 时浏览器托管重定向直抵不安全目标、路由只见首 URL
  test('1. Baseline reproduction: unmanaged context.route(...continue()) sees only initial URL and follows to unsafe HTTP target', async ({
    page,
    context,
  }) => {
    const interceptedUrls: string[] = [];

    await context.route('**/*', async (route) => {
      interceptedUrls.push(route.request().url());
      await route.continue();
    });

    try {
      const initialUrl = `https://localhost:${httpsPort}/trusted-start-to-http`;
      await page.goto(initialUrl);

      // Verify Playwright routing blindspot:
      // 1. Only the initial HTTPS URL was intercepted by route handler
      expect(interceptedUrls).toHaveLength(1);
      expect(interceptedUrls[0]).toBe(initialUrl);

      // 2. The unsafe HTTP target was reached by the browser-managed redirect
      expect(httpRequests.length).toBeGreaterThanOrEqual(1);
      expect(httpRequests[0].url).toBe('/unsafe-destination');

      // 3. Browser page landed on the unsafe HTTP landing page
      const content = await page.content();
      expect(content).toContain('Unsafe HTTP Landing');
    } finally {
      await context.unroute('**/*');
    }
  });

  // ② 不可信重定向目标在请求触达前被验证拒绝
  test('2. Untrusted redirect target is validated and rejected before any request reaches it', async ({
    page,
    context,
  }) => {
    const hops: HopLog[] = [];
    const expectedHost = 'localhost';

    const handler = createR5RedirectHandler({
      page,
      expectedHost,
      onHop: (h) => hops.push(h),
    });

    await context.route('**/*', handler);

    try {
      const initialUrl = `https://localhost:${httpsPort}/trusted-start-to-http`;

      // page.goto must fail closed (navigation aborted)
      let navigationFailed = false;
      try {
        await page.goto(initialUrl);
      } catch (err: any) {
        navigationFailed = true;
        expect(err.message).toMatch(/ERR_ABORTED|net::ERR_FAILED/);
      }
      expect(navigationFailed).toBe(true);

      // CRITICAL SECURITY PROPERTY:
      // Zero requests must have reached the unsafe HTTP server!
      expect(httpRequests).toHaveLength(0);

      // Verify failure log is actionable (URL, status, hop, timestamp)
      expect(hops.length).toBeGreaterThanOrEqual(1);
      const abortHop = hops.find((h) => h.action === 'abort_untrusted_target');
      expect(abortHop).toBeDefined();
      expect(abortHop?.status).toBe(302);
      expect(abortHop?.location).toContain(`http://127.0.0.1:${httpPort}/unsafe-destination`);
      expect(abortHop?.timestamp).toBeTruthy();
    } finally {
      await context.unroute('**/*', handler);
    }
  });

  // ② (变体) IP 目标在请求触达前被拒绝
  test('2b. Untrusted IP literal redirect target is validated and rejected before request reaches it', async ({
    page,
    context,
  }) => {
    const hops: HopLog[] = [];
    const expectedHost = 'localhost';

    const handler = createR5RedirectHandler({
      page,
      expectedHost,
      onHop: (h) => hops.push(h),
    });

    await context.route('**/*', handler);

    try {
      const initialUrl = `https://localhost:${httpsPort}/trusted-start-to-diff-host`;

      let navigationFailed = false;
      try {
        await page.goto(initialUrl);
      } catch (err: any) {
        navigationFailed = true;
        expect(err.message).toMatch(/ERR_ABORTED|net::ERR_FAILED/);
      }
      expect(navigationFailed).toBe(true);

      // Verify no request reached /unsafe-ip-destination
      const ipLandingRequests = httpsRequests.filter((r) => r.url === '/unsafe-ip-destination');
      expect(ipLandingRequests).toHaveLength(0);

      const abortHop = hops.find((h) => h.action === 'abort_untrusted_target');
      expect(abortHop).toBeDefined();
      expect(abortHop?.location).toContain('/unsafe-ip-destination');
    } finally {
      await context.unroute('**/*', handler);
    }
  });

  // ③ 同 Host HTTPS 跳转被跟随
  test('3. Same-host HTTPS hops are faithfully followed to terminal response', async ({
    page,
    context,
  }) => {
    const hops: HopLog[] = [];
    const expectedHost = 'localhost';

    const handler = createR5RedirectHandler({
      page,
      expectedHost,
      onHop: (h) => hops.push(h),
    });

    await context.route('**/*', handler);

    try {
      const initialUrl = `https://localhost:${httpsPort}/same-host-redirect-1`;
      await page.goto(initialUrl);

      // Verify page content is terminal verified page
      const content = await page.content();
      expect(content).toContain('Verified Destination');

      // Verify the redirect hops were tracked
      expect(hops.length).toBe(3); // hop 0 (302), hop 1 (302), hop 2 (200)
      expect(hops[0].status).toBe(302);
      expect(hops[1].status).toBe(302);
      expect(hops[2].status).toBe(200);
      expect(hops[2].action).toBe('terminal_response_ready');
    } finally {
      await context.unroute('**/*', handler);
    }
  });

  // ④ 跳数上限溢出 fail-closed
  test('4. Hop-limit overflow fails closed without fetching the exceeding target', async ({
    page,
    context,
  }) => {
    const hops: HopLog[] = [];
    const expectedHost = 'localhost';
    const maxRedirects = 5;

    const handler = createR5RedirectHandler({
      page,
      expectedHost,
      maxRedirects,
      onHop: (h) => hops.push(h),
    });

    await context.route('**/*', handler);

    try {
      // Chain with max=8 steps (which would need 7 redirects, exceeding 5)
      const initialUrl = `https://localhost:${httpsPort}/hop-chain?step=1&max=8`;

      let navigationFailed = false;
      try {
        await page.goto(initialUrl);
      } catch (err: any) {
        navigationFailed = true;
        expect(err.message).toMatch(/ERR_ABORTED|net::ERR_FAILED/);
      }
      expect(navigationFailed).toBe(true);

      // Verify abort occurred at max redirects
      const overflowHop = hops.find((h) => h.action === 'abort_max_redirects_exceeded');
      expect(overflowHop).toBeDefined();
      expect(overflowHop?.hop).toBe(5);

      // CRITICAL: step 7 must NEVER have been fetched!
      const step7Requests = httpsRequests.filter((r) => r.url.includes('step=7'));
      expect(step7Requests).toHaveLength(0);
    } finally {
      await context.unroute('**/*', handler);
    }
  });

  // ⑤ 成功与失败路径清理都执行
  test('5. Cleanup executes on both success and failure paths', async ({
    page,
    context,
  }) => {
    let disposeCount = 0;
    const expectedHost = 'localhost';

    const handler = createR5RedirectHandler({
      page,
      expectedHost,
      onDispose: () => {
        disposeCount++;
      },
    });

    // Sub-case 5a: Success path cleanup
    await context.route('**/*', handler);
    try {
      const initialUrl = `https://localhost:${httpsPort}/same-host-redirect-1`;
      await page.goto(initialUrl);
      expect(await page.content()).toContain('Verified Destination');
      // 2 redirects = 2 intermediate responses disposed
      expect(disposeCount).toBe(2);
    } finally {
      await context.unroute('**/*', handler);
    }

    // Verify handler is unrouted: subsequent requests don't trigger disposeCount
    const prevDisposeCount = disposeCount;
    await page.goto(`https://localhost:${httpsPort}/verified`);
    expect(disposeCount).toBe(prevDisposeCount);

    // Sub-case 5b: Failure path cleanup
    disposeCount = 0;
    const failHandler = createR5RedirectHandler({
      page,
      expectedHost,
      onDispose: () => {
        disposeCount++;
      },
    });

    await context.route('**/*', failHandler);
    try {
      await page.goto(`https://localhost:${httpsPort}/trusted-start-to-http`);
    } catch {
      // expected abort
    } finally {
      await context.unroute('**/*', failHandler);
    }

    // Intermediate 302 response was disposed before aborting
    expect(disposeCount).toBe(1);

    // Context is clean after unroute
    await page.goto(`https://localhost:${httpsPort}/verified`);
    expect(await page.content()).toContain('Verified Destination');
  });
});
