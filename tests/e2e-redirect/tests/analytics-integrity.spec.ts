// 本地浏览器：同源资产 200 且执行；pageview 拦截后不转发到生产统计。
// 旧脚本从 stats 主机加载，缺省投递就是该主机 /api/send。同源脚本靠 data-host-url 保持同一目的地。
import { expect, test } from '@playwright/test';

const BASE = process.env.ANALYTICS_BASE_URL;
const SHA = '1ad1145d19d4558c20f5469ca4a5fc50a1a46f860858c9c91bfcd56fd29a522a';
const SRC = `/vendor/umami-${SHA}.js`;
const ID = '86e6eaf7-473c-4c8d-a9bf-ea48c13742c5';
const SEND = 'https://stats.openagent.email/api/send';
const PAGES = ['/', '/docs/quickstart/', '/zh/'];

for (const path of PAGES) {
  test(`pageview ${path}`, async ({ page }) => {
    test.skip(!BASE, '设置 ANALYTICS_BASE_URL 才跑，避免 OTP CI 连接网站');
    const hits: { url: string; body: { type?: string; payload?: { website?: string; url?: string; hostname?: string } }; website: string | undefined }[] = [];
    let assetStatus = 0;
    // 先登记拦截，后登记的 /api/send 优先；fulfill 不访问生产。
    await page.route('https://stats.openagent.email/**', (route) => route.abort());
    await page.route(SEND, async (route) => {
      hits.push({
        url: route.request().url(),
        body: route.request().postDataJSON(),
        website: route.request().headers()['x-umami-website-id'],
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"disabled":true}' });
    });
    page.on('response', (res) => {
      if (new URL(res.url()).pathname === SRC) assetStatus = res.status();
    });
    // 首页资源多，tracker 要等到 readystate complete 才发 pageview。
    await page.goto(new URL(path, BASE).toString(), { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.umami?.track === 'function');
    await expect.poll(() => hits.length, { timeout: 15_000 }).toBeGreaterThan(0);
    console.log(JSON.stringify({ path, assetStatus, url: hits[0].url, type: hits[0].body.type, website: hits[0].body.payload?.website, header: hits[0].website, hostname: hits[0].body.payload?.hostname }));
    expect(assetStatus).toBe(200);
    expect(hits[0].url).toBe(SEND);
    expect(hits[0].body.type).toBe('event');
    expect(hits[0].body.payload?.website).toBe(ID);
    expect(hits[0].website).toBe(ID);
    expect(hits[0].body.payload?.hostname).toBeTruthy();
    expect(typeof hits[0].body.payload?.url).toBe('string');
  });
}

declare global {
  interface Window {
    umami?: { track?: () => void };
  }
}
