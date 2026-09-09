// 以冻结数组导出供测试精确钉住；freeze + ESM 只读导入绑定，导入方无法在运行时放宽白名单。
export const approvedMailslurpHosts = Object.freeze(['app.mailslurp.com', 'www.mailslurp.com']);

// 用 UTC 日期，不是本地日期：新鲜度闸门按构建机的 UTC 时钟判定，未来日期同样 fail closed。
export const mailslurpLastChecked = '2026-09-03';

export const mailslurpSources = [
  // 2026-09-03 一手事实：定价页自述 Free $0 / Pro $49.99/mo / Team $129.99/mo，各档为封顶套餐，
  // 超出额度后按量计费（$3.00 / 1,000 inboxes、$0.99 / 1,000 emails）。
  // www.mailslurp.com/pricing/ 会 301 到 app.mailslurp.com/pricing/，这里引用最终地址，两个 host 都在白名单内。
  { href: 'https://app.mailslurp.com/pricing/', label: 'pricing' },
  // 2026-09-10 一手事实：官方 MCP 文档页自述托管端点 https://api.mailslurp.com/mcp（stateless Streamable HTTP），
  // OAuth 或按 inbox 收窄的最小权限 agent key 认证；只链官方自述，不连接、不建凭证、不演绎。
  { href: 'https://www.mailslurp.com/docs/mcp/', label: 'official MCP docs' },
];

export function assertOfficialMailslurpSources(sources) {
  for (const source of sources) {
    let url;
    try {
      url = new URL(source.href);
    } catch {
      throw new Error(`MailSlurp source must use HTTPS on an approved MailSlurp host: ${source.href}`);
    }
    if (url.protocol !== 'https:' || !approvedMailslurpHosts.includes(url.hostname)) {
      throw new Error(`MailSlurp source must use HTTPS on an approved MailSlurp host: ${source.href}`);
    }
  }
}

assertOfficialMailslurpSources(mailslurpSources);
