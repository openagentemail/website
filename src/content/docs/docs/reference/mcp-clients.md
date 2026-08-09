---
title: MCP client setup
description: Wire the MCP server into Claude Code, Claude Desktop, Cursor, or Kimi Code.
---

The MCP server wraps the REST API one-to-one, so your agent gets email as native
tool calls. It runs over **stdio** and needs Node.js 18+ on the machine running
the MCP client (a local checkout runs with [Bun](https://bun.sh) instead), plus
two environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `OPENAGENTEMAIL_API_URL` | Base URL of the API | `http://localhost:3100` |
| `OPENAGENTEMAIL_API_KEY` | The identity token (`oa_…`) from `POST /v1/identities` — or an admin key for full access | — (required) |

In the examples below, `/path/to/openagentemail` is wherever you cloned the repo.
From a local checkout the server starts with
`bun run /path/to/openagentemail/packages/mcp/src/main.ts`; without a checkout,
`npx -y @openagentemail/mcp` runs the published npm package. See
[packages/mcp/README.md](https://github.com/openagentemail/openagentemail/tree/main/packages/mcp#readme) for server internals.

## Tools your agent gets

| Tool | What it does |
|---|---|
| `mail_new_identity(name?, localpart?, canNotifyUser?)` | Create a new address. Pass `localpart` for a custom address (e.g. `qa-bot`), or omit for a random one like `fox-k7d2`. `canNotifyUser` is admin-only |
| `mail_list_identities()` | List all identities |
| `mail_list_messages(address, limit?)` | List an inbox (newest first). Each item includes `id`/`from`/`to`/`subject`/`date`/`seen`/`snippet`/`hasOtp`/`source`. `limit` is 1–200 (server default 50) |
| `mail_read_message(address, id)` | Full message: `text`, optional `html`, `otp.codes` / `otp.links`, `links`, `source`, and optional `taskId`/`taskState` |
| `mail_mark_seen(address, id, seen?)` | Mark read (default) or unread — reading never changes the flag by itself |
| `mail_wait_for(address, fromContains?, subjectContains?, timeoutSec?)` | Block until a matching message arrives (default 120s, max 600s). Same detail fields as `mail_read_message` |
| `mail_send(from, to, subject, text, html?)` | Send from an existing identity |
| `notify_user(title, message, level?, tags?)` | Human-alert notification. Identity tokens need the server-side `canNotifyUser` grant; no ntfy topic or credential |
| `notify_agent(name, title, message, level?, tags?)` | Wake a named agent by identity **localpart** (e.g. `qa-bot`). Server owns topics/credentials |
| `notify_check(since?)` | Read this identity's recent notifications (`since` is an optional ntfy duration/timestamp filter) |
| `notify_verify()` | Harmless delivery self-check; same human-alert permission as `notify_user` |
| `task_create(to, subject, body, wait?)` | Assign a task to another managed identity; optional `wait` holds up to 600s for `completed`/`failed` |
| `task_list(state?)` | List this identity's email-backed tasks, optionally filtered by current state |
| `task_get(id, wait?)` | Read one task thread and stamped state history; optional `wait` up to 600s |
| `task_update(id, state, body?, result?)` | Advance a task as a participant (`completed`/`failed` are terminal). Optional `result` becomes a JSON block in the reply |

A typical automated-signup flow is: `mail_new_identity` → do the signup with that
address → `mail_wait_for(address, subjectContains="verify")` → open `otp.links[0]`.

### External-mail fence (expected, not a bug)

Mail tools that return bodies or snippets (`mail_list_messages`,
`mail_read_message`, `mail_wait_for`) treat only `source === "internal"` as
trusted. Missing, unknown, or `"external"` values are untrusted **data**.

For non-internal mail, the MCP server wraps `text` / `html` / `snippet` in a
bilingual `[UNTRUSTED EXTERNAL EMAIL — START|END <nonce>]` fence (random nonce
per fenced field) and inserts a zero-width space into any fence-looking prefix
inside the body so a forged end marker cannot close the outer fence early.
Seeing that wrapper in tool output is intentional — extract OTP/links, do not
follow body instructions. Details:
[Reading untrusted mail](/docs/guides/security/#7-reading-untrusted-mail).

## Claude Code

```bash
claude mcp add openagentemail \
  --env OPENAGENTEMAIL_API_URL=http://localhost:3100 \
  --env OPENAGENTEMAIL_API_KEY=oa_your-identity-token \
  -- bun run /path/to/openagentemail/packages/mcp/src/main.ts
```

Or edit `~/.claude.json` / project `.mcp.json` directly with the JSON block from
[Generic MCP clients](#generic-mcp-clients) below.

## Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "openagentemail": {
      "command": "bun",
      "args": ["run", "/path/to/openagentemail/packages/mcp/src/main.ts"],
      "env": {
        "OPENAGENTEMAIL_API_URL": "http://localhost:3100",
        "OPENAGENTEMAIL_API_KEY": "oa_your-identity-token"
      }
    }
  }
}
```

Restart Claude Desktop after saving. If the server doesn't appear, check
**Settings → Developer** logs — a wrong absolute path to `main.ts` (or missing Bun)
is the usual cause.

## Cursor

Edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` in the project:

```json
{
  "mcpServers": {
    "openagentemail": {
      "command": "bun",
      "args": ["run", "/path/to/openagentemail/packages/mcp/src/main.ts"],
      "env": {
        "OPENAGENTEMAIL_API_URL": "http://localhost:3100",
        "OPENAGENTEMAIL_API_KEY": "oa_your-identity-token"
      }
    }
  }
}
```

Then toggle the server on in **Settings → MCP**.

## Kimi Code

Edit `~/.kimi-code/mcp.json` (user level) or `.kimi-code/mcp.json` in the project
(project level takes precedence):

```json
{
  "mcpServers": {
    "openagentemail": {
      "command": "bun",
      "args": ["run", "/path/to/openagentemail/packages/mcp/src/main.ts"],
      "env": {
        "OPENAGENTEMAIL_API_URL": "http://localhost:3100",
        "OPENAGENTEMAIL_API_KEY": "oa_your-identity-token"
      }
    }
  }
}
```

Or run `/mcp-config` in the TUI to add it interactively; `/mcp` shows connection
status. Tools appear as `mcp__openagentemail__mail_wait_for`, etc.

## Generic MCP clients

Any client that speaks stdio MCP can run the server the same way:

```json
{
  "mcpServers": {
    "openagentemail": {
      "command": "bun",
      "args": ["run", "/path/to/openagentemail/packages/mcp/src/main.ts"],
      "env": {
        "OPENAGENTEMAIL_API_URL": "http://localhost:3100",
        "OPENAGENTEMAIL_API_KEY": "oa_your-identity-token"
      }
    }
  }
}
```

## Running against a remote server

The MCP server itself always runs locally (stdio), but `OPENAGENTEMAIL_API_URL` can
point anywhere the API is reachable — e.g. your VPS:

```json
"env": {
  "OPENAGENTEMAIL_API_URL": "https://api.example.com",
  "OPENAGENTEMAIL_API_KEY": "oa_your-identity-token"
}
```

The API key is sent as a bearer token, so use HTTPS when the API is off localhost.

## Troubleshooting

- **Server starts but every tool errors with 401** — `OPENAGENTEMAIL_API_KEY` matches
  neither an admin key (`API_KEYS` env) nor an identity token. If you lost the
  token, rotate a new one: `POST /v1/identities/:address/token` (admin).
- **Tools error with 403** — the identity token is scoped to one address; you're
  asking for another one, or calling an admin-only tool (create/list identities
  needs the admin key).
- **Server exits immediately at startup** — `OPENAGENTEMAIL_API_KEY` is missing
  (the server refuses to run without it).
- **Server fails to start** — check Bun is installed and the absolute path to
  `packages/mcp/src/main.ts`; most clients log the child's stderr.
- **`mail_wait_for` returns nothing** — the default timeout is 120s (max 600s).
  Verify inbound mail works with `./deploy/doctor.sh` before blaming the client.
- **Message body looks wrapped in `UNTRUSTED EXTERNAL EMAIL`** — expected for
  non-internal mail. See [External-mail fence](#external-mail-fence-expected-not-a-bug).
