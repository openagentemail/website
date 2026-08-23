const approvedAgentmailHosts = new Set(['www.agentmail.to', 'docs.agentmail.to']);

export const agentmailLastChecked = '2026-08-22';

export const agentmailSources = [
  { href: 'https://www.agentmail.to/pricing', label: 'pricing' },
  { href: 'https://docs.agentmail.to/integrations/mcp', label: 'official MCP docs' },
  { href: 'https://www.agentmail.to/blog/agentmail-official-openclaw-plugin', label: 'official OpenClaw plugin' },
  { href: 'https://www.agentmail.to/blog/give-grok-bot-email-address', label: 'Grok Bot email / Cursor plugin' },
];

for (const source of agentmailSources) {
  const url = new URL(source.href);
  if (url.protocol !== 'https:' || !approvedAgentmailHosts.has(url.hostname)) {
    throw new Error(`AgentMail source must use HTTPS on an approved AgentMail host: ${source.href}`);
  }
}
