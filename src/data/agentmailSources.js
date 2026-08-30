const approvedAgentmailHosts = new Set(['www.agentmail.to', 'docs.agentmail.to']);

export const agentmailLastChecked = '2026-08-30';

export const agentmailSources = [
  { href: 'https://www.agentmail.to/pricing', label: 'pricing' },
  { href: 'https://docs.agentmail.to/integrations/mcp', label: 'official MCP docs' },
  { href: 'https://www.agentmail.to/blog/agentmail-official-openclaw-plugin', label: 'official OpenClaw plugin' },
  { href: 'https://www.agentmail.to/blog/give-grok-bot-email-address', label: 'Grok Bot email / Cursor plugin' },
  // 2026-08-30 卫生：官方 Codex 插件落地页（对方自述，非我方评测）
  { href: 'https://www.agentmail.to/build/codex', label: 'official Codex plugin' },
  // 2026-08-30 卫生：8-19 出站中断官方 incident 页（只链自述，不演绎）
  { href: 'https://www.agentmail.to/incidents/2026-08-19-outbound-email-disruption', label: '19 Aug 2026 outbound incident' },
];

export function assertOfficialAgentmailSources(sources) {
  for (const source of sources) {
    let url;
    try {
      url = new URL(source.href);
    } catch {
      throw new Error(`AgentMail source must use HTTPS on an approved AgentMail host: ${source.href}`);
    }
    if (url.protocol !== 'https:' || !approvedAgentmailHosts.has(url.hostname)) {
      throw new Error(`AgentMail source must use HTTPS on an approved AgentMail host: ${source.href}`);
    }
  }
}

assertOfficialAgentmailSources(agentmailSources);
