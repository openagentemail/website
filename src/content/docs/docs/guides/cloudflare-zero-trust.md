---
title: Cloudflare Zero Trust for MCP and the Dashboard
description: Publish OpenAgentEmail through a Cloudflare Tunnel while keeping browser Access separate from machine API authentication.
---

This guide publishes one HTTPS hostname through Cloudflare Tunnel and uses
Cloudflare Access only for the browser Dashboard. It is intentionally narrower
than putting Access in front of the entire hostname: Access is an
identity-aware proxy that evaluates a request before the application
([Cloudflare Access HTTP applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/)).
That extra browser-oriented gate commonly does not work for headless MCP and
REST clients.

Cloudflare Tunnel still carries every path below. “Outside Access” means only
that Access is not the authentication gate for that path; OpenAgentEmail's own
Bearer and OAuth checks still apply. This is a Cloudflare deployment option,
not a requirement. Start with [Exposing MCP publicly](/docs/guides/public-mcp/),
keep the credential rules in the [security guide](/docs/guides/security/), and
use the [MCP client reference](/docs/reference/mcp-clients/) for client setup.

## The three OpenAgentEmail auth surfaces

| Surface | Paths | OpenAgentEmail authentication | Why its Cloudflare treatment differs |
|---|---|---|---|
| Health | `GET /healthz` | None | Useful to confirm the Tunnel reaches the application. |
| API and MCP | `/v1/*`, `POST /mcp` | `Authorization: Bearer <admin, identity, or audience-bound OAuth access token>` | Headless clients must send their own Bearer token; they usually cannot complete a browser Access login. MCP discovery is public at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`. |
| Browser owner flow | `/ui`, `/ui/*`, plus the OAuth owner consent reached from `/authorize` | `/ui/api/session` exchanges an admin or identity token for the `HttpOnly`, `SameSite=Strict`, `/ui`-scoped `oae_ui` cookie; subsequent UI APIs use that cookie | This is the appropriate place for a browser Access session. An OAuth access token cannot create a UI session. |

OpenAgentEmail also exposes the OAuth authorization-server metadata at
`/.well-known/oauth-authorization-server`, `/authorize`, `/oauth/token`, and
`/oauth/revoke`. `/authorize` redirects the owner browser to
`/ui/oauth/authorize`. Keep these protocol routes reachable for OAuth/MCP
clients as described below.

## Recommended path layout

Create **one self-hosted Access application only for the Dashboard paths**.
Do not create an Access application or Allow policy for the entire hostname.

| Path | Access treatment | Application authentication |
|---|---|---|
| `/ui` and `/ui/*` | Access Allow policy for authorized browser users | Dashboard session cookie after `/ui/api/session` |
| `/healthz` | Outside Access | None |
| `/mcp`, `/v1/*` | Outside Access (or narrowly scoped Bypass if account default-deny requires it) | OpenAgentEmail Bearer token |
| `/.well-known/*`, `/authorize`, `/oauth/*` | Outside Access (or narrowly scoped Bypass if account default-deny requires it) | Public discovery / OAuth protocol flow; owner consent remains in `/ui` |

When a separate, more-specific Access application/rule exists, it takes
precedence and does not inherit the parent rule; otherwise, a child path
inherits the parent-path rule. Also, `https://host.example/ui/*` does **not**
match the parent `https://host.example/ui`; configure both `/ui` and `/ui/*`,
or explicitly verify that the dashboard representation covers both. See
[Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/).

## 1. Publish the local API with a Tunnel

Keep the API origin local (normally `127.0.0.1:3100`) and set the public
OpenAgentEmail origin as already required by the [public MCP guide](/docs/guides/public-mcp/):

```bash
MCP_PUBLIC_URL=https://mcp.example.com
OAE_PUBLIC_EDGE=true
```

Configure the DNS hostname in Cloudflare to route to the Tunnel. Cloudflare's
[published-application guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/)
explains the hostname-to-local-service mapping. A safe locally-managed
`cloudflared` configuration has one matching hostname and a final catch-all:

```yaml
# ~/.cloudflared/config.yml
tunnel: <existing-tunnel-uuid>
credentials-file: /home/<user>/.cloudflared/<existing-tunnel-uuid>.json

ingress:
  - hostname: mcp.example.com
    service: http://127.0.0.1:3100
  - service: http_status:404
```

Do not invent credentials or paste secrets into this file. Ingress rules match
top to bottom, and locally managed configurations need a final catch-all; see
Cloudflare's [configuration-file reference](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/).

## 2. Put Access on the UI only

In Cloudflare Zero Trust, create a self-hosted application for
`https://mcp.example.com/ui` and `https://mcp.example.com/ui/*`, then attach an
Allow policy for the people who may use the Dashboard. Browser access to a
protected application uses Cloudflare's authorization cookie; requests without
a valid Access cookie are blocked before the origin
([authorization cookie behavior](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)).

Leave `/mcp`, `/v1/*`, `/.well-known/*`, `/authorize`, and `/oauth/*` out of
that application. This avoids placing a browser login in front of protocol
requests that need OpenAgentEmail's own `Authorization: Bearer ...` header.
It does **not** assert that Cloudflare strips or rewrites that header; the
documented behavior relevant here is that Access adds a
`Cf-Access-Jwt-Assertion` header to authenticated origin requests
([validating JSON web tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)).

## 3. Account default-deny changes the exception

If the account-level **Require Access protection** setting is enabled,
uncovered paths are default-denied. In that case, create narrowly scoped path
applications for each protocol path group above with a `Bypass / Everyone`
policy so requests can reach OpenAgentEmail. The setting and its default-deny
effect are documented under [Require Access protection](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/require-access-protection/).

Keep Bypass scopes as small as possible. Cloudflare documents that Bypass
disables Access enforcement **and Access request logging**
([Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)).
The OpenAgentEmail Bearer gate remains in force after the request reaches the
origin; Bypass is not anonymous API access.

## Optional: Service Auth for capable machine clients

Use this only when every relevant MCP/REST client can send arbitrary extra
headers. The simple recommendation is to apply Service Auth only to `/mcp` and
selected `/v1/*` routes used with a pre-issued OpenAgentEmail admin or identity
token. Create a Cloudflare service token and a Service Auth policy for those
machine routes, then send both required Cloudflare headers **in addition to**
the OpenAgentEmail Bearer token:

```bash
export OAE_URL='https://mcp.example.com'

# Prompts do not echo values or put them on the command line/history.
read -rsp 'OpenAgentEmail admin token: ' OAE_ADMIN_TOKEN; echo
read -rp 'Cloudflare service-token client ID: ' CF_ACCESS_CLIENT_ID
read -rsp 'Cloudflare service-token client secret: ' CF_ACCESS_CLIENT_SECRET; echo

# GET /v1/identities is admin-only, so this positive example uses an admin token.
# Feed curl's protected configuration on stdin: secrets are not in curl argv.
{
  printf '%s\n' 'fail-with-body' 'include'
  printf 'url = "%s/v1/identities"\n' "$OAE_URL"
  printf 'header = "CF-Access-Client-Id: %s"\n' "$CF_ACCESS_CLIENT_ID"
  printf 'header = "CF-Access-Client-Secret: %s"\n' "$CF_ACCESS_CLIENT_SECRET"
  printf 'header = "Authorization: Bearer %s"\n' "$OAE_ADMIN_TOKEN"
} | curl --config -
unset OAE_ADMIN_TOKEN CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET
```

These are independent credential layers. Cloudflare service tokens require the
paired `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers, and a
Service Auth policy must permit them; see [service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
and Cloudflare's [agent authentication instructions](https://developers.cloudflare.com/cloudflare-one/access-controls/authenticate-agents/).
Do **not** use Cloudflare's single-header service-token mode on
`Authorization`: it collides with OpenAgentEmail's required Bearer header. If
a client cannot send both CF headers, use the recommended outside-Access (or
narrow Bypass) layout instead. The stdin config above keeps the CF secret and
OpenAgentEmail token out of the `curl` argument list; do not type real values
into an inline command or shell history. A secret manager may inject the same
config on stdin instead.

Keep `/authorize` browser-reachable outside Service Auth (or behind the UI's
human Allow flow): its owner-browser redirect cannot rely on the machine
client's custom headers. For OAuth clients, apply Service Auth to discovery,
`/oauth/token`, or `/oauth/revoke` only after proving that the particular
client sends both CF headers on **every** request to each protected endpoint.
Otherwise leave those paths outside Service Auth as in the recommended layout.

## Validate the layers

The literal `OAE_URL` export below is a non-secret placeholder; do not replace
an inline shell command with a real token or service-token secret. Use the
non-echoing `read` prompts above (or a protected secret manager/environment
file) for real credentials. First confirm the Tunnel and origin route:

```bash
export OAE_URL='https://mcp.example.com'
curl --fail-with-body -i "$OAE_URL/healthz"
```

Then confirm an application-protected route reaches OpenAgentEmail rather than
an Access login page. The exact status/body depends on the route and token
state, so do not treat a particular MCP JSON response as universal:

```bash
# Expected: an OpenAgentEmail authentication failure/challenge, not an Access HTML/login response.
curl -i -X POST "$OAE_URL/mcp" -H 'Content-Type: application/json' --data '{}'

# A REST route should likewise reach its Bearer check without a token.
curl -i "$OAE_URL/v1/identities"
```

For each response, inspect `Content-Type` and the first part of the body. An
Access block or login commonly presents an HTML/login response; an
OpenAgentEmail failure is an application JSON/RFC authentication challenge.
With optional Service Auth enabled, repeat the request with both CF headers
and the appropriate OpenAgentEmail Bearer token (the admin-only example above
uses `$OAE_ADMIN_TOKEN`). With an ordinary Bearer-only deployment, use just
the OpenAgentEmail Bearer header.

Troubleshooting clue: the UI can work because the browser has an Access
session while MCP receives an Access login/block response before
OpenAgentEmail. That is a likely explanation for an unobserved deployment
such as dslovin's, not proof of its exact policy or rules.

## Not yet tested

- Exact Cloudflare dashboard clicks and labels can drift.
- No live Cloudflare-account end-to-end test was performed for this guide.
- Client-specific support for arbitrary Cloudflare headers must be verified.
- dslovin's exact Access policies and rules are unknown.

The documented Cloudflare behavior cited above is not itself marked untested.
