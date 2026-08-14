# RECEIPT — website v0.4 copy + visual

日期：2026-08-14  
工位：website `tizerluo/worker-34-site-upgrade`  
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
| F1 | Overview WebP，不用 inbox | **过** | `public/images/dashboard-overview.webp` md5 `41fc54d11efc3e63cecdddb2b2dfce35` = 验收源文件 |
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

初审 P2 已修：选择器改为 `.card.card-cockpit`。

## 记债

1. `src/content/docs/docs/guides/notifications.md` 仍写 “v0.3.1 deliberately does not generate a QR code.” 本单只改 phone-notifications；通知总览那句与 Dashboard QR 捷径不一致，未扩 scope。
2. FAQ「Is there a UI for humans?」仍是旧 Dashboard 口径，业主未批新 FAQ 文案，未改。
3. 备选 inbox 截图（内部探针邮件 + 过期 OTP）默认未用；若要换图须 MBP 终审明示。

## 四闸

（push/PR 后回填）

## 工位截屏

目录：`/home/ops/acceptance/2026-08-14-website-visual/`（push 后 `astro preview` 实机拍，见该目录 README）
