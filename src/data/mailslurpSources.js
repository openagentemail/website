// 以冻结数组导出供测试精确钉住；校验用的 Set 保持模块私有，导入方无法在运行时放宽白名单。
export const approvedMailslurpHosts = Object.freeze(['app.mailslurp.com', 'www.mailslurp.com']);
const approvedMailslurpHostSet = new Set(approvedMailslurpHosts);

// 用 UTC 日期，不是本地日期：新鲜度闸门按构建机的 UTC 时钟判定，未来日期同样 fail closed。
export const mailslurpLastChecked = '2026-09-03';

export const mailslurpSources = [
  // 2026-09-03 一手事实：定价页自述 Free $0 / Pro $49.99/mo / Team $129.99/mo，各档为封顶套餐，
  // 超出额度后按量计费（$3.00 / 1,000 inboxes、$0.99 / 1,000 emails）。
  // www.mailslurp.com/pricing/ 会 301 到 app.mailslurp.com/pricing/，这里引用最终地址，两个 host 都在白名单内。
  { href: 'https://app.mailslurp.com/pricing/', label: 'pricing' },
];

export function assertOfficialMailslurpSources(sources) {
  for (const source of sources) {
    let url;
    try {
      url = new URL(source.href);
    } catch {
      throw new Error(`MailSlurp source must use HTTPS on an approved MailSlurp host: ${source.href}`);
    }
    if (url.protocol !== 'https:' || !approvedMailslurpHostSet.has(url.hostname)) {
      throw new Error(`MailSlurp source must use HTTPS on an approved MailSlurp host: ${source.href}`);
    }
  }
}

assertOfficialMailslurpSources(mailslurpSources);
