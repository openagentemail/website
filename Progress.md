# Progress — website v0.4 文案+视觉

## 2026-08-14 施工

### 我们实现了哪些功能？
1. 首页特性卡按业主逐字文案更新：Dashboard 升 2 倍宽主角卡（Overview WebP 等距微缩 + hover 转正 + 金箔边缘）、Phone push 重写 + 三档出境 SVG、Sent box 新卡 + 航线账本、MCP 重写 + 双态小图、Tasks 保留原文并补 dispatcher 尾句；其余六卡正文不动。
2. 新增 Standards 邮票墙（四枚做旧邮戳、±7°、大小错落）；Hero 副标题下加 MCP 2026-07-28 / Apache-2.0 / Self-hosted first 低调徽章。
3. Pricing：badge「Launching soon」；Notes 句改为 Waitlist first access 句。
4. `phone-notifications.md` 补 Dashboard Add device → QR → revoke 捷径，CLI 手工流程保留为底层参考。quickstart Trust-30d 句 main 上已有，未重复添加。
5. 截图初用现场指挥提供的 Overview 资产，未用 inbox 备选。该图身份表可读，R1 已换 demo 版。

### 我们遇到了哪些错误？
1. `upgrade.css` 经 `@import` 挂在 `global.css` 顶部，`.card-cockpit { overflow: visible }` 与后写的 `.card { overflow: hidden }` 同特异度，大卡等距光晕会被裁切。
2. `npm install` 改写了 `package-lock.json` 里可选依赖的 `libc` 字段，与本单无关。
3. `quickstart.md` 的 Trust-30d 句在 origin/main 已经存在，若再补会重复。

### 我们是如何解决这些错误的？
1. 选择器改为 `.card.card-cockpit`（0,2,0），特异度压过 `.card`。初审 agent `2774902e` P2；复审新 agent `840e1a53` 确认关闭。
2. `git restore package-lock.json`，不把 npm 版本噪音带进 PR。
3. Trust-30d 不改文件，回执记「main 已有」。

## 2026-08-14 四闸返工

### 我们实现了哪些功能？
1. `notifications.md` 不再写「本版不生成 QR」：CLI 仍打印口令、Dashboard Add device 才出 QR，并链到 phone-notifications 捷径节。
2. `index.astro` 加无 JS 回退，让邮票墙和全页 `.reveal` 在无脚本时可见。

### 我们遇到了哪些错误？
1. Codex Local P1 + 云端 P2：通知总览与新 QR 捷径互相打架。
2. Codex 云端 P1 + 复审 `f0f9c379` + ZCode P1：Overview WebP 能读出生产身份名/地址。
3. Codex 云端 P2：Standards 用了 `.reveal`，无 JS 时整区透明。
4. ZCode MCP `zcode_pr_review` 两次超时。
5. 初轮回执把指挥派单原话写成「业主裁定」并据此记债，归属错误。

### 我们是如何解决这些错误的？
1. 改 notifications.md 一句，与捷径节对齐。
2. **R1 换图关闭**：现场指挥重拍 demo 数据版，同名覆盖。不存在业主/MBP 对原图的记债批准。
3. `html.no-js` + `upgrade.css` 全局规则；charset 之后再跑 inline 摘 class。
4. 用独立 Cursor subagent 自审代替（`2774902e` / `840e1a53` / `f0f9c379`）。
5. R1 按 PR #29 / #33 E 脱敏：路径改 `<worktree>` / `<acceptance>`，并更正归属。

## 2026-08-14 R1

### 我们实现了哪些功能？
1. `public/images/dashboard-overview.webp` 换成 demo 营销身份（fox-k7d2@yourdomain 等）。
2. RECEIPT / Progress 脱敏并更正 P1 归属；`.gitignore` 补 `.mimosa/`；charset 顺序修正。

### 我们遇到了哪些错误？
1. 三处同报 P1：原 Overview 图身份表可读。
2. 回执误把指挥派单写成业主原文，并用错误的「零内部内容」判断记债。

### 我们是如何解决这些错误的？
1. 用指挥重拍的 demo WebP 同名覆盖，引用不动。
2. 回执改写为：P1 三处同报 → 现场指挥重拍 demo 版替换 → 关闭。FAQ 文案业主未批，仍记债。

## 2026-08-14 FAQ 口径更新（本单）

### 我们实现了哪些功能？
1. 首页 `const faq` 从 8 条改为 9 条：改 4 条 + 新增 1 条。文案业主逐字锁定，未改措辞。
2. 「Is it really free?」仅尾句 `coming soon` → `launching soon`，与 pricing 页 badge 对齐。
3. 「Is there a UI for humans?」整答换成 cockpit 全功能清单（三栏收件箱 / 30 日推送账 / 工单板 / 身份令牌档位客户端 / 扫码配对 / Sent / 30 日登录）。
4. 「Can agents hand work to each other?」原文保留，末尾追加 `From the board you can page through history, nudge a stuck task, or close one out.`
5. 「What agents and clients does it work with?」整答换成 Kimi Code + dated MCP 2026-07-28 + 远程 OAuth RFC 9728 + dashboard 可撤销 + REST。
6. 在工单条之后新增「Can I get alerts on my phone?」（ntfy 扫码 / 三档出境 / 一键撤销）。
7. AgentMail 差异 / 域名 / spam / 安全围栏 4 条未动。
8. `faqJsonLd` 是 `faq.map(...)` 同源映射，不是独立写死；改数组即同步 JSON-LD。`dist/index.html` 可见区与 FAQPage 均为 9 条且逐字一致。
9. README 补一句：FAQ 文案业主锁定、JSON-LD 同源。

### 我们遇到了哪些错误？
1. 工位无 `node_modules`，直接 `npm run build` 报 `astro: not found`。
2. `npm install` 会改 `package-lock.json` 可选依赖的 `libc` 字段（上轮已踩过，与本单无关）。

### 我们是如何解决这些错误的？
1. `npm install` 后 build 绿：23 pages Complete（既有 Starlight `Entry docs → 404` 与 caddyfile 高亮警告，非本单引入）。
2. `git checkout -- package-lock.json`，不把 npm 噪音带进 PR。
3. 独立自审新 agent `9a54fb64`：mergeable，P0/P1/P2 = 0/0/0。确认 faqJsonLd 同源映射、9 条逐字、顺序正确、旧 Dashboard 口径已清。

## 2026-08-14 FAQ 四闸 + 回执

### 我们实现了哪些功能？
1. 开 PR https://github.com/openagentemail/website/pull/10 （英文标题正文）。未 merge。
2. 四闸：本地 build 过；CodeRabbit 无 actionable；Codex Local `6fbee19` pass 0/0/0/0；Codex 云端 4 条 P2 因业主锁定文案有理记债；ZCode MCP 两次超时，用自审 `9a54fb64` 代替。
3. FAQ 特写两镜（1280 + 375，9 条全开）存 `<acceptance>/2026-08-14-website-faq/`，md5 唯一。
4. 写 RECEIPT：faqJsonLd 属 `faq.map` 同源映射；上轮「旧 Dashboard 口径」记债关闭。

### 我们遇到了哪些错误？
1. ZCode MCP `zcode_pr_review` / `zcode_review` 两次超时。
2. 本机 `codex review --base origin/main` 401（缺 bearer）。闸上 Codex Local 评论已由现有自托管闸打在 PR 上，结论 pass。
3. Codex 云端先报 security-review usage limit，随后仍留下 4 条 P2，全部要求改锁定 FAQ 措辞。
4. 初拍 375 特写被粘性导航裁掉第一条标题。

### 我们是如何解决这些错误的？
1. 与上轮相同：独立 Cursor subagent `9a54fb64` 代替 ZCode。
2. 采用 PR 上已发布的 Codex Local 闸结果（head `6fbee19`，P0–P3 = 0）。
3. 4 条 P2 有理记债，不改业主逐字文案。细口径已在 quickstart / phone-notifications / mcp-clients。
4. 截屏前 `nav { display:none }`，改拍 FAQ `.wrap`，375 第一条标题完整。
5. 回执提交 `d690bad` 触发 Codex Local 复审，报与云端相同的 4 条 P2。不改锁定文案，回执补记「同一组记债」，停止循环。
