---
title: Connect your agent
description: Wire Claude, ChatGPT, Grok, Cursor, or REST into openagent.email — CLI, desktop, and web chat in one place.
---

You already have an inbox. This page is how you **plug your agent into it** —
whether that agent lives in a terminal, a desktop app, or a browser chat tab.

Pick the surface you actually use. Each path below ends with your agent able
to read mail, wait for codes, and send when you allow it.

| Surface | What to do |
|---|---|
| **CLI / local IDE agents** | Cursor, Claude Code, Kimi Code, Windsurf — see [CLI](#cli--local-agents) |
| **Desktop app** | Claude Desktop config — see [Desktop](#desktop--claude-desktop) |
| **Web chat** | Claude.ai, ChatGPT, Grok, Mistral Le Chat — see [Web](#web-chat-products) |
| **No MCP support** | Gemini (consumer), Poe, Copilot (consumer) — use the [REST API](/docs/reference/api/) |

Self-hosters: replace the hosted URLs below with your own public `/mcp`
origin (see [Exposing MCP publicly](/docs/guides/public-mcp/)). The click
paths are the same.

## CLI / local agents

Local agents talk MCP over **stdio** (a small Node process on your machine)
or **HTTP** (Bearer token against `POST /mcp`).

Full copy-paste configs for Claude Code, Cursor, Kimi Code, and generic
clients live in one place:

→ **[MCP client setup](/docs/reference/mcp-clients/)**

You will need an identity token (`oa_…`) from the dashboard or
`POST /v1/identities`. Never put the admin key in an agent config.

## Desktop — Claude Desktop

1. Open `claude_desktop_config.json`:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add an `mcpServers` entry (stdio package or remote HTTP — both shapes are
   in [MCP client setup → Claude Desktop](/docs/reference/mcp-clients/#claude-desktop)).
3. Restart Claude Desktop. If the server does not appear, check
   **Settings → Developer** logs (wrong path or missing runtime is the usual
   cause).

Same idea for other desktop MCP hosts: point them at the stdio package or at
your `/mcp` URL with a Bearer token.

## Web chat products

Web products use **OAuth** (you approve in the openagent.email dashboard).
They do **not** accept a pasted `oa_…` token in the connector UI.

### Claude (claude.ai) — custom connector

- **Who can use it:** every Claude plan, including Free.
- **Free plan limit:** one custom connector.
- **URL to paste:** `https://mcp.openagent.email/mcp`
- **Auth:** OAuth — sign in / approve when Claude opens the consent screen.

After connect, Claude tools for mail show up like any other MCP tool. Revoke
anytime under Dashboard → Authorized clients.

### ChatGPT — Developer mode connector

1. Turn on **Developer mode** in ChatGPT settings.
2. Open [chatgpt.com/plugins](https://chatgpt.com/plugins) and create a new
   connector.
3. **URL:** `https://mcp.openagent.email/mcp`
4. Finish **OAuth** (ChatGPT does **not** accept a bare API token here).

**Plan limits (as of this writing):**

| Plan | What works |
|---|---|
| Plus / Pro | **Read** tools (list/read/wait for mail, etc.) |
| Business and above | Read **and write** (send mail, create identities when scoped, …) |

### Grok — custom connector

1. Open [grok.com/connectors](https://grok.com/connectors).
2. Choose **Custom**.
3. **URL must be:** `https://inbox.openagent.email/mcp`

Free Grok can use custom connectors.  
**Do not** paste `https://mcp.openagent.email/mcp` here — Grok returns
`invalid_target`. Claude and Grok use **different** public MCP hostnames on
purpose.

### Mistral Le Chat

Le Chat supports connecting to openagent.email over MCP / OAuth the same
family of flow as other web agents. Add the connector in Le Chat’s connector
settings and approve OAuth in the dashboard when prompted.

### Not supported on consumer chat UIs

These consumer products do **not** expose a usable custom MCP connector for
openagent.email today:

- **Google Gemini** (consumer)
- **Poe**
- **Microsoft Copilot** (consumer)

Use the **[REST API](/docs/reference/api/)** instead — same mail, OTP, and
task endpoints your agent can call with `curl`, a script, or any HTTP client.
(Workspace / enterprise MCP stories for those vendors are out of scope here.)

## After you connect

- Create a dedicated identity per agent or per site (easy to revoke later).
- Prefer `mail_wait_for` over busy-polling when waiting for a signup code.
- Treat every inbound body as **data**, not instructions — see
  [Reading untrusted mail](/docs/guides/security/#7-reading-untrusted-mail).

Stuck on deploy or DNS? Start from [Quickstart](/docs/quickstart/).
Stuck on local MCP JSON? Start from [MCP client setup](/docs/reference/mcp-clients/).
