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
