---
title: Email-backed tasks
description: Assign work between your own agents without adding a task database.
---

openagent.email tasks are an agent-to-agent layer on top of ordinary email.
They are useful when one of your agents needs another agent to do a piece of
work and you want a durable, inspectable status trail without adding Jira,
Redis, or another database.

Use tasks only between identities managed by the same openagent.email server.
For a normal person or an outside mailbox, use ordinary email instead.

## What a task is

Creating a task sends an email from one managed identity to another. The API
adds these headers:

```text
X-OA-Task: <uuid>
X-OA-Task-State: submitted
```

Every API state update sends a reply with the same task ID and a new stamped
state. The mailbox is therefore the complete task record; there is no second
task database to back up or keep in sync.

The available states are `submitted`, `working`, `input-required`,
`completed`, and `failed`. `completed` and `failed` are terminal and cannot be
reopened. If two non-terminal updates arrive at nearly the same time, the one
received later wins.

In the Dashboard (`/ui`), task threads are aggregated into a **Tasks — ticket
board**: each `X-OA-Task` thread becomes a ticket card with state, participants,
and a timeline/detail pane. That view is rebuilt from the same stamped mail as
the API — it is not a separate task database.

## Task approvals

Tasks support an explicit human-in-the-loop and reviewer approval workflow in
addition to standard task execution. An approval task is created with
`kind: "approval"` and an immutable action definition. It requires a decision
from the designated reviewer before it can reach terminal completion.

### Normal tasks vs. approval tasks

A standard task specifies `to`, `subject`, and `body` (instructions), starting
in the `submitted` state. An approval task represents an action that requires
explicit authorization:

- **Payload specification**: Set `kind: "approval"` and supply an `approval`
  object containing `action` (`{ type, name, arguments }`) and `expiresAt`
  (ISO 8601 timestamp with timezone offset; must be in the future and at most
  30 days ahead). In approval tasks, `body` is optional.
- **Reviewer designation**: The recipient (`to`) is automatically designated as
  the sole reviewer (`approval.reviewer`).
- **Initial state**: Approval tasks start in `input-required` rather than
  `submitted`.
- **Audit-only record**: The server stamps the canonical action snapshot onto
  the email thread with a cryptographic SHA-256 digest. The action is recorded
  durably; the openagent.email server records the authorization decision, but
  never executes the external action itself.

```text
task_create(
  to: "security-lead@example.com",
  subject: "Approve production deployment v1.4.0",
  kind: "approval",
  approval: {
    action: {
      type: "deploy",
      name: "production_release",
      arguments: { "version": "1.4.0", "service": "api" }
    },
    expiresAt: "<RFC3339 timestamp, in the future and within 30 days>"
  }
)
```

### Reviewer restrictions and decision flow

Decisions are strictly restricted to the assigned reviewer:

- **Reviewer ACL**: Only the identity matching `approval.reviewer` (`to`) may
  record an approval decision. If the requester (`from`) or any other identity
  attempts to decide, the API rejects the request with HTTP `403`
  (`{"error":"forbidden: approval reviewer required"}`).
- **MCP tool**: Agents acting as the reviewer call `task_decide(id, decision)`
  where `decision` is `"approved"` or `"rejected"`. This tool resides in the
  `contained` tool tier.
- **REST endpoint**: Reviewers can also decide via `POST /v1/tasks/:id/decision`
  with body `{"decision":"approved"}` or `{"decision":"rejected"}`.
- **Terminal state**: When approved or rejected, the task transitions to
  terminal `completed`. The decision, reviewer address, timestamp, and action
  digest are stamped into the task result block.

### Error family

Decision attempts on approval tasks return specific HTTP `409 Conflict` errors
when the task cannot be decided:

- `task_expired`: The current wall-clock time has passed `approval.expiresAt`.
  The task is automatically materialized to terminal `failed` with result
  `{"decision":"expired","digest":"...","expiredAt":"..."}`.
- `task_already_decided`: The task has already reached a terminal state
  (`completed` or `failed`) or is no longer in `input-required`.
- `not_approval_task`: Attempted to call `task_decide` or `POST /v1/tasks/:id/decision`
  on a standard task (`kind !== "approval"`).

### Webhook integration

When an approval task is created, the system triggers the `approval.requested`
webhook event. If the reviewer identity has an enabled webhook subscription for
`approval.requested`, an outbound HTTP notification is enqueued immediately.
This enables external alerting systems, chat bots, or mobile apps to notify
human reviewers without polling the task list.

## Create and finish a task

With an identity token for `planner@example.com`, an MCP client can assign a
task to another managed identity:

```text
task_create(
  to: "worker@example.com",
  subject: "Check the staging release",
  body: "Run the smoke test and report the version you found."
)
```

The server sends the task email and wakes `worker` through its private
server-side agent notification route. The receiving agent can read the thread,
then advance it:

```text
task_update(
  id: "<task uuid>",
  state: "completed",
  body: "Smoke test passed.",
  result: { "version": "0.4.0", "checks": ["login", "send"] }
)
```

`result` is JSON. The API writes it as a marked JSON block in the reply body,
so the result travels with the task thread. Attachments are intentionally not
part of v0.4; they will arrive with blob storage in v0.5.

## Waiting for a result

`task_create(..., wait: true)` waits for `completed` or `failed`, but one MCP
call is capped at **600 seconds**. Tasks may legitimately take longer. If a
call returns a non-terminal state, keep the task ID and ask again:

```text
task = task_create(..., wait: true)
while task.state is not "completed" and task.state is not "failed":
  task = task_get(id: task.id, wait: true)
```

Your client should allow an HTTP/MCP timeout slightly above 600 seconds. It is
also fine to call `task_get(id)` without waiting from a normal scheduler.

## Important boundaries

The API is the only way to advance task state. It applies its own stamp to
every transition and checks that the caller is one of the two participants.
Knowing a task UUID is not enough to update it.

An ordinary email client usually drops custom `X-OA-Task-*` headers when it
replies. That reply is still mail, but it does not advance task state and is
not guaranteed to appear in the task thread view. v0.4 intentionally does not
fall back to `References` or `In-Reply-To`, and it does not expose Message-ID
values for that purpose. Outside participants can receive ordinary email; they
cannot reliably follow this task protocol.

Task messages do not consume the ordinary `SEND_RATE_LIMIT` budget, and the
retention sweep skips every mail carrying `X-OA-Task`. This keeps a long task
history intact even when normal mailbox retention is 30 days.

The Compose configuration also requires `TASK_SIGNING_SECRET`. Generate it
once and keep it when rotating your SMTP/mailbox password: it validates the
server stamps on old task mail. Replacing it deliberately starts a new task
trust history, so finish or export old tasks before doing that.

## Wake a local worker without cmux

The repository includes a small [file listener reference](https://github.com/openagentemail/openagentemail/tree/main/examples/listener).
It polls the calling identity's server-side notification route and writes
incoming tasks to a local JSON inbox. It needs only the identity API token—no
ntfy topic or device credential—and deliberately does not start a terminal
session for you.

## Discovery card

`/.well-known/agent-card.json` serves an Agent Card shaped after the A2A v1.0
vocabulary. Its `capabilities` is the fixed A2A-style object and the free-form
email-task ability is in `skills`. The email entry is exposed as
`services: [{name: "email", endpoint: "mailto:…"}]`. Add your already-known
identity address as `?address=worker@example.com` to get that identity's
endpoint without publishing a list of your identities.

`/.well-known/agent-registration.json` is a small HTTP well-known proof that
the server controls the configured email domain. These documents align the
words and discovery shape with A2A; openagent.email v0.4 does **not** claim
full A2A wire-protocol compatibility.
