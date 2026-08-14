# Progress — website v0.4 文案+视觉

## 2026-08-14 施工

### 我们实现了哪些功能？
1. 首页特性卡按业主逐字文案更新：Dashboard 升 2 倍宽主角卡（Overview WebP 等距微缩 + hover 转正 + 金箔边缘）、Phone push 重写 + 三档出境 SVG、Sent box 新卡 + 航线账本、MCP 重写 + 双态小图、Tasks 保留原文并补 dispatcher 尾句；其余六卡正文不动。
2. 新增 Standards 邮票墙（四枚做旧邮戳、±7°、大小错落）；Hero 副标题下加 MCP 2026-07-28 / Apache-2.0 / Self-hosted first 低调徽章。
3. Pricing：badge「Launching soon」；Notes 句改为 Waitlist first access 句。
4. `phone-notifications.md` 补 Dashboard Add device → QR → revoke 捷径，CLI 手工流程保留为底层参考。quickstart Trust-30d 句 main 上已有，未重复添加。
5. 截图选用 `/home/ops/acceptance/assets/dashboard-overview.webp`（零内部内容），未用 inbox 备选。

### 我们遇到了哪些错误？
1. `upgrade.css` 经 `@import` 挂在 `global.css` 顶部，`.card-cockpit { overflow: visible }` 与后写的 `.card { overflow: hidden }` 同特异度，大卡等距光晕会被裁切。
2. `npm install` 改写了 `package-lock.json` 里可选依赖的 `libc` 字段，与本单无关。
3. `quickstart.md` 的 Trust-30d 句在 origin/main 已经存在，若再补会重复。

### 我们是如何解决这些错误的？
1. 选择器改为 `.card.card-cockpit`（0,2,0），特异度压过 `.card`。初审 agent `2774902e` P2；复审新 agent `840e1a53` 确认关闭。
2. `git restore package-lock.json`，不把 npm 版本噪音带进 PR。
3. Trust-30d 不改文件，回执记「main 已有」。
