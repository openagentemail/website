# RECEIPT — website v0.4 copy + visual

日期：2026-08-14  
工位：`<worktree>`  
基线：`origin/main` **`9b90939`**  
禁动 main / 禁碰 openagentemail 主仓 / 禁止自 merge。合并权属 MBP。

## 交付

官网叙事补到 Dashboard 大改版 / 设备管理 / Sent box / dated MCP。文案业主逐字批准，未改措辞。视觉同 PR。

## 范围对账

| # | 范围 | 结果 | 证据 |
|---|---|---|---|
| A1 | Dashboard 升主角 2 倍宽；标题/正文逐字 | **过** | `src/pages/index.astro` `.card-cockpit` |
| A2 | Phone push 重写逐字 + 三档出境 SVG | **过** | 同文件 `.viz-phone` |
| A3 | Sent box 新卡逐字 + 航线账本 | **过** | `.viz-sent` |
| A4 | MCP 重写逐字 + 双态小图 | **过** | `.viz-mcp` |
| A5 | Tasks 保留原文 + 批准尾句 | **过** | 原段未改，尾句 `Watch the board…` |
| A6 | 其余六卡正文不动 | **过** | 与 `origin/main` 逐字相同（仅序号 06–11） |
| B | Standards 邮票墙四枚 + A2A 小字在戳下 | **过** | `src/components/StampWall.astro` |
| C | Hero 布局不动；副标题下三枚低调徽章 | **过** | `.hero-chips`；CTA 行未改 |
| D | Pricing badge + Notes 句 | **过** | `Launching soon`；Waitlist 句逐字 |
| E1 | phone-notifications Dashboard 扫码捷径；手工流程保留 | **过** | 新节「Pair from the dashboard」 |
| E2 | quickstart Trust-30d | **过（已有）** | `origin/main` 已有 `Tick **Trust this device**…30 days.` 未重复 |
| F1 | Overview WebP（R1 起为 demo 身份） | **过** | `public/images/dashboard-overview.webp` md5 `ac455a38998a760e4038e0877e83d3ac`（现场指挥重拍 demo 版覆盖同名） |
| F2–5 | Phone / Sent / MCP / 邮票造型 | **过** | CSS/SVG；邮票 ±7°、大小错落、缺墨滤镜 |
| F6 | 新动效从简；375；WebP；reduced-motion | **过** | hover-only transform/opacity；无新循环；`upgrade.css` reduce 段 |

## 验收对账

| 项 | 结果 | 证据 |
|---|---|---|
| 文案零改写 | **过** | 施工后 Python 逐句 `in` 核对；复审再核 |
| `npm run build` | **过** | 23 pages，Complete（既有 Starlight `Entry docs → 404` 警告，非本单引入） |
| 375 单列 / 邮票 2×2 | **过** | `@media (max-width: 900px)` / `420px` |
| inbox 截图未用 | **过** | 源码无 `dashboard-inbox` |
| 未改 `.env` | **过** | 本仓无 `.env` 改动 |

## 独立自审

| 轮 | Subagent ID | 结论 | P0/P1/P2 | 过程 |
|---|---|---|---|---|
| 初审 | `2774902e` | mergeable after fix | 0 / 0 / **1** | P2：`.card-cockpit { overflow: visible }` 被后写 `.card { overflow: hidden }` 盖掉，等距金箔被裁。 |
| 复审（新 agent，禁止自审自） | `840e1a53` | **mergeable** | **0 / 0 / 0** | 独立核 cascade：`.card.card-cockpit` 特异度 0,2,0 压过 `.card` 0,1,0。文案/资产/375/reduce 再过。No findings。 |
| 闸后复审（新 agent） | `f0f9c379` | **block（截图）** | 0 / **1** / 0 | QR 与 noscript **closed**。P1：当时 Overview 能读出生产身份表。该 P1 在 R1 换 demo 图后关闭（见下），不记债。 |

初审 P2 已修：选择器改为 `.card.card-cockpit`。

## 记债

1. FAQ「Is there a UI for humans?」仍是旧 Dashboard 口径，FAQ 文案业主未批，未改。（ZCode P2-4 存量：FAQ 旧口径 / umami 脚本 / CSP 一并保留，不扩 scope。）

## 四闸（初轮，head `0a7cdb7`）

PR：https://github.com/openagentemail/website/pull/9

| 闸 | 状态 | 处置 |
|---|---|---|
| CI build | 本仓无 GitHub Actions；本地 `npm run build` 23 pages Complete | 过 |
| CodeRabbit | 首轮 4 条 inline（对 `f0bb17f`） | DESIGN 归属注 **已修**；QR 矛盾 **已在 c68cee2 关闭**（评过时）；主题名口径 **已修**；`currentcolor` **已修**。后续 commit 触发 review limit，记外部。 |
| Codex 云端 connector | usage limit 一条；仍留下 3 条 inline | P2 QR **已修**；P1 截图 **R1 换图关闭**；P2 no-JS **已修** |
| Codex Local `6a82594` | ✅ pass · P0/P1/P2=0 | 过 |
| Codex Local `9000dd6` | P1：noscript style 被 Astro scope，StampWall `.reveal` 吃不到 | **已修**：`html.no-js` + `upgrade.css` 全局规则 + `style is:global` |
| Codex Local `0a7cdb7` | ✅ pass · P0/P1/P2=0 | 过 |
| ZCode | P1×1 + P2×4 在案 | P1 截图 **R1 换图关闭**；P2-1 回执脱敏 **R1 修**；P2-2 `.mimosa/` **R1 修**；P2-3 charset 顺序 **R1 修**；P2-4 存量 **记债** |

## 工位截屏

目录：`<acceptance>/2026-08-14-website-visual/`  
`astro preview` 真 Chrome（非 headless）+ 滚页触发 reveal + 真 hover。md5 全唯一，见该目录 README。R1 重拍含 Dashboard 卡的首页镜头。

---

## R1（2026-08-14 · PR #9 复审返工）

同一分支就地修。未新开分支、未动 `main`、未自 merge。

### 评论对账

| # | 来源 | 问题 | 处置 | 证据 |
|---|---|---|---|---|
| 1 | Codex 云端 inline `3785104791`（`index.astro`「Replace the production dashboard screenshot」）+ 自审 `f0f9c379` + ZCode P1 | 当时 Overview 图身份表可读（生产名/地址） | **已修。** 现场指挥重拍 demo 数据版，同名覆盖 `public/images/dashboard-overview.webp`。引用路径不动。 | 新 md5 `ac455a38998a760e4038e0877e83d3ac`；身份为 fox-k7d2@yourdomain 等营销口径 |
| 2 | ZCode P2-1 + 指挥 R1 + 主仓 PR #33 E / PR #29 回执纪律 | 回执含主机绝对路径 / 显示号 / 工位名；且把派单原话误写成「业主裁定」并据此记债 | **已修。** 路径改 `<worktree>` / `<acceptance>`。P1 三处同报 → 现场指挥重拍 demo 版替换 → **关闭**。不存在业主/MBP 对原图的记债批准，已删该表述。 | 本文件；`Progress.md` |
| 3 | ZCode P2-2 | 未忽略 `.mimosa/` | **已修。** | `.gitignore` |
| 4 | ZCode P2-3 | head inline script 在 `<meta charset>` 之前 | **已修。** 一行挪到 charset 之后。 | `src/pages/index.astro` |
| 5 | ZCode P2-4 | FAQ 旧口径 / umami / CSP | **记债，不改码。** FAQ 文案业主未批。 | 见上「记债」 |

### 更正（原回执错误归属）

初轮把「首选 dashboard-overview.webp…零内部内容」写成业主原文并据此记债，**归属错**。那是现场指挥派单原话，不是业主裁定；且「零内部内容」判断有误（身份名/地址清晰可读，正是本次 P1）。R1 按如实纪律改写，不再引用该表述。
