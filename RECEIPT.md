# RECEIPT — website homepage FAQ copy

日期：2026-08-14  
工位：`<worktree>`  
基线：`origin/main` **`992e48a`**  
head：`6fbee19`  
禁动 main / 禁碰 openagentemail 主仓 / 禁止自 merge。合并权属 MBP。业主授权 MBP 终审后直接合并。

## 交付

清掉上轮记债「FAQ 旧 Dashboard 口径」。首页 FAQ 8→9 条，文案业主逐字锁定，未改措辞。

## faqJsonLd 属哪种

**引用 `faq` 数组，自动同步。** 不是独立写死的问答。

```94:102:src/pages/index.astro
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};
```

可见 FAQ 区（约 623 行）也 `faq.map`。改数组即页面 + JSON-LD 一起变。`dist/index.html` 可见 9 条 `<details>` 与 FAQPage `mainEntity` 9 条逐字一致。

## 范围对账

| # | 范围 | 结果 | 证据 |
|---|---|---|---|
| 1 | 「Is it really free?」仅尾句 `coming soon` → `launching soon` | **过** | 其余字节与 `origin/main` 相同 |
| 2 | 「Is there a UI for humans?」整答换成 cockpit 清单 | **过** | 旧句 `Every install ships a built-in dashboard…` 已不在 |
| 3 | 「Can agents hand work to each other?」末尾追加工单句 | **过** | 原文保留 + `From the board you can page through history, nudge a stuck task, or close one out.` |
| 4 | 「What agents and clients does it work with?」整答替换 | **过** | Kimi Code + dated MCP 2026-07-28 + OAuth RFC 9728 + dashboard 可撤销 + REST |
| 5 | 新增「Can I get alerts on my phone?」紧接工单条之后 | **过** | 第 8 条；安全围栏仍是第 9 条 |
| 6 | AgentMail / 域名 / spam / 安全围栏 不动 | **过** | 与 `origin/main` 字节相同（4 条；派单写「其余 3 条」但点了这 4 项） |
| 7 | faqJsonLd 同步 | **过** | 同源 `faq.map`，非独立副本 |

## 验收对账

| 项 | 结果 | 证据 |
|---|---|---|
| 文案零改写 | **过** | Python 9 条逐字 `==`；自审再核 |
| `npm run build` | **过** | 23 pages Complete（既有 Starlight `Entry docs → 404` / caddyfile 高亮警告，非本单引入） |
| FAQ 区 9 条 1280+375 | **过** | `<acceptance>/2026-08-14-website-faq/` |
| 未改 `.env` | **过** | 本仓无 `.env` 改动 |
| 未自 merge | **过** | PR #10 仍 OPEN |

## 独立自审

| 轮 | Subagent ID | 结论 | P0/P1/P2 | 过程 |
|---|---|---|---|---|
| 初审（新 agent，禁止自审自） | `9a54fb64` | **mergeable** | **0 / 0 / 0** | 逐字 9 条、顺序、faqJsonLd 同源映射、旧 Dashboard 口径已清、未改 4 条与 main 字节相同。No findings。 |

ZCode MCP `zcode_pr_review` / `zcode_review` 两次超时（与上轮相同）。用上述独立 Cursor subagent 代替。

## 记债

Codex 云端 4 条 P2 都要求改 FAQ 措辞。**文案业主逐字锁定，不得改。** 文档站已有更细口径，FAQ 保持业主批准的营销长度。

| # | 来源 | 问题 | 处置 |
|---|---|---|---|
| 1 | Codex inline `3785930135` | 「Sign in once and stay signed in for 30 days.」未写 Trust this device 勾选 | **记债。** `quickstart.md:112-113` 已写勾选才延 30 日。业主锁定本句。 |
| 2 | Codex inline `3785930144` | 扫码配对未写 ntfy 须先公开 HTTPS | **记债。** `phone-notifications.md:6-18` 已写该前提。业主锁定短答。 |
| 3 | Codex inline `3785930147` | `OAuth (RFC 9728)` 把 RFC 9728 写成 OAuth 本身；文档里 RFC 9728 是 PRM | **记债。** 技术上对，但业主锁定该括注。 |
| 4 | Codex inline `3785930151` | 远程不只 OAuth，还有 `oa_…` / admin bearer；那些不进可撤销客户端表 | **记债。** `mcp-clients.md:30-38` 已列三种 Bearer。业主锁定本句。 |

上轮记债「FAQ 旧 Dashboard 口径」**本单关闭**（业主已批新答）。umami / CSP 仍是存量，不扩 scope。

## 四闸（head `6fbee19`）

PR：https://github.com/openagentemail/website/pull/10

| 闸 | 状态 | 处置 |
|---|---|---|
| CI build | 本仓无 GitHub Actions；本地 `npm run build` 23 pages Complete | 过 |
| CodeRabbit | 「No actionable comments were generated.」Pre-merge 5/5；Merge Risk Minimal | 过，无修 |
| Codex 云端 connector | 先一条 security-review usage limit；随后 4 条 P2 inline | **有理记债**（见上），不改锁定文案 |
| Codex Local `6fbee19` | ✅ pass · P0/P1/P2/P3=0 | 过（FAQ 码提交） |
| Codex Local `d690bad` | ⚠️ 4×P2，与云端 4 条同题 | **同一组有理记债**，不改锁定文案。回执提交触发复审，不另开修。 |
| ZCode | MCP 两次超时 | 独立自审 `9a54fb64` 代替 |

## 工位截屏

目录：`<acceptance>/2026-08-14-website-faq/`  
`astro preview` + Chrome。9 条全开特写。md5 全唯一，见该目录 README。

```
abf78994f5499c9b4bc2fcfd3deb319c  01-faq-1280.png
aaf287129faff066d4460e9d9271db4b  02-faq-375.png
```

停等指挥终审。不合并。
