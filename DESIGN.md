# DESIGN.md — openagent.email 设计系统

> 给 AI 编码 agent 和人类贡献者的单一设计事实来源。
> 改任何页面**之前**先读本文件；新页面必须复用这里的令牌、组件和动效语言，不许另起炉灶。
> 正源代码：`src/styles/global.css`（官网，`@import` `upgrade.css` / `postmark.css`）与 `src/styles/starlight-custom.css`（文档站覆盖）。
> 本文件若与代码冲突，**以代码为准并当场修正本文件**。

---

## 1. 品牌性格（Overview）

**深夜邮局。**

画布是午夜——`#0c0d12`，近黑带一丝蓝。金色 `#fbbf24` 是柜台上那盏灯：照着信封、邮戳和等待被取走的验证码。产品做的是"给 AI agent 的邮局"，所以视觉语言全部从邮政隐喻里长出来：**信封、邮戳、分拣、航线、烫金、取件窗口**。

气质：工程师的精确 + 老邮局的可靠。密集、诚实、不堆形容词；界面像一份打印清晰的单据，但偶尔让你会心一笑（一枚盖下来的邮戳）。我们展示真实的终端输出和真实的产品截图，不做概念插画。

三条永远成立的判断依据：

1. **诚实高于好看**——数字、状态、错误都如实呈现（`Unknown` 是合法显示值）。
2. **金色是灯，不是墙漆**——强调色只用于引导和标记，绝不用于装饰性铺满。
3. **动效讲故事，不挡路**——所有动效从邮政隐喻出发（飞、盖、分拣、发光），且在 `prefers-reduced-motion` 下完全退场。

---

## 2. 机器可读令牌（YAML）

```yaml
colors:
  bg: "#0c0d12"            # 页面底（午夜）
  bg-raise: "#12141c"      # 终端栏、代码块、步骤圆点底
  bg-card: "#14161f"       # 卡片底
  ink: "#f3f4f6"           # 主文字
  ink-dim: "#9ca3af"       # 次文字
  ink-faint: "#6b7280"     # 弱化文字/脚注
  gold: "#fbbf24"          # 主点缀（灯）
  gold-soft: "#fde68a"     # 代码内嵌、终端命令色
  gold-dim: "rgba(251,191,36,.14)"  # 金色光晕/mark 底
  line: "rgba(255,255,255,.08)"     # 默认发丝边框
  line-strong: "rgba(255,255,255,.16)"  # 强调边框
  green: "#34d399"         # 成功/✓/copied
  red: "#f87171"           # 失败/✗
  json-blue: "#93c5fd"     # 唯一蓝色例外，仅限终端/JSON 语境

typography:
  display:  { size: "clamp(2.4rem,6vw,4.2rem)", weight: 700, leading: 1.15, tracking: "-0.02em" }
  h2:       { size: "clamp(1.8rem,4vw,2.6rem)", weight: 700, leading: 1.15, tracking: "-0.02em" }
  h3:       { size: "1.15rem", weight: 700, leading: 1.15, tracking: "-0.02em" }
  sub:      { size: "1.12rem", weight: 400, leading: 1.6, color: "ink-dim" }
  body:     { size: "1rem",    weight: 400, leading: 1.6 }
  card-body:{ size: "0.95rem", weight: 400, leading: 1.6, color: "ink-dim" }
  caption:  { size: "0.85rem", weight: 400, leading: 1.6, color: "ink-faint" }
  button:   { size: "0.95rem", weight: 700, leading: 1.2 }
  kicker:   { size: "0.8rem",  weight: 500, leading: 1.3, tracking: "0.14em", transform: "uppercase", family: "mono", color: "gold" }
  stat-num: { size: "2.6rem",  weight: 700, variant: "tabular-nums", color: "gold" }
  mono:     { size: "0.84-0.88rem", weight: 400, family: "mono" }

spacing:  # 4px 基准；现存近似值按就近刻度靠拢
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px      # 卡片内边距（现 1.6rem≈26px，向 24 靠拢）
  xl: 32px
  xxl: 48px
  section: 88px # 现 5.5rem；新页面用 88px

rounded:
  chip: 6-8px   # 小芯片/代码内嵌
  button: 10px  # 按钮、命令行
  card: 14px    # 卡片、终端（= --radius）
  pill: 9999px  # OSS 徽章、状态丸

motion:
  ease-out: "cubic-bezier(0.16,1,0.3,1)"   # 入场/展开
  ease-ui: "ease"                           # hover 微交互
  fast: 150ms    # hover
  enter: 550-700ms  # 入场/reveal
  shimmer: 4.5s    # 金箔扫光循环（S3，N1 定稿）
  ambient: 9-28s    # 环境光循环
```

---

## 3. 令牌用途（不只要值，还要知道不该用在哪）

- `gold`：kicker、主按钮、关键数字、链接 hover、提取出的验证码。**禁**：大面积填充背景、装饰性色块、与金色底叠金字。
- `gold-soft`：代码/命令行里的文字（`.t-cmd`、内嵌 `code`）。比 gold 亮，保证在 `bg-raise` 上可读。
- `gold-dim`：光晕、mark 底色、聚光灯。只做"光"，不做"形"。
- `green/red`：严格语义化（成功/失败、✓/✗、copied 态），不做品牌装饰。
- `json-blue #93c5fd`：全站唯一蓝色，**只允许出现在终端和 JSON 语境**（`.t-json`、`.mailbox-json`）。
- `line/line-strong`：深度的主要表达手段（见 §6）。深底上不要用灰色块代替边框来分层。

## 4. 字体

- **Satoshi**（Fontshare 免费许可），自托管 woff2 latin 子集：`/fonts/Satoshi-{Regular,Medium,Bold,Black}.woff2`，字重 400/500/700/900，`font-display: swap`。
- 栈：`'Satoshi', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', 'PingFang SC', 'Noto Sans SC', sans-serif` —— **CJK 回退链不许动**。
- 等宽：`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`——kicker、徽章、终端、验证码、命令行。
- 标题统一 `line-height:1.15; letter-spacing:-0.02em; font-weight:700`。
- 可选特效 `.outline-gold`（透明填充 + 1.5px 金色描边），仅用于大标题局部词。

## 5. 组件清单 + 状态矩阵

> class 名与 `global.css` / `upgrade.css` 一一对应（v0.4 大卡、Hero 徽章、邮票墙在 `upgrade.css`）。Focus 统一：**3px `gold` outline**（官网全局 `:focus-visible` 与 /ui 均已实现）。

| 组件 | default | hover | focus/disabled |
|---|---|---|---|
| `.btn-gold` | 金底黑字 #111 | 变 gold-soft、上浮 1px | focus 金框；disabled 50% 透明 |
| `.btn-ghost` | 透明 + line-strong 描边 | 描边/字变金、上浮 1px | 同上 |
| `.copy-btn` | mono 小按钮 | 描边/字变金 | copied：绿 + scale(1.06)，同时盖邮戳（S1，见 §7 已实现） |
| `.card` | bg-card + line | 描边变金(35%)、上浮 3px、聚光灯点亮、光标跟随 3D 倾斜（S2） | — |
| `.card-cockpit` | 2 列宽 + 等距截图 | 截图转正、金箔边缘加亮 | 窄屏改单列 |
| `.hero-chips` | 副标题下 mono 小丸 | — | — |
| `.stamp-wall` | 四枚倾斜邮戳 | 回正 | 窄屏 2×2 |
| `.terminal` | 底 `#0a0b10` + 大投影 + 三色圆点 `#ff5f57/#febc2e/#28c840` | — | 着色 class：`.t-cmd .t-ok .t-json .t-key .t-dim .t-wait` |
| `.cmdline` | bg-raise + line | — | `.cmd` 部分可全选 |
| `.step` | line 左边框 + 圆点数字 | — | `.lit`：金底黑字 + 金光晕 |
| `.cmp` 对比表 | line 行线 | — | 自家列 `.us`：金顶线 + 6% 金底；`.yes/.no` 绿红 |
| `.code-chip` | gold-dim 底 + 金框金字 mono 大字距 | — | 验证码/OTP 专用 |
| `.marquee` | 两侧渐隐 mask | 悬停暂停 | item hover 变金 |

## 6. 空间层级模型

**深度 = 发丝边框 + 金色光晕，不堆投影。**

| 层级 | 手段 |
|---|---|
| 0 页面底 | `bg` |
| 1 浮起 | `bg-card` 或 `bg-raise` + 1px `line` |
| 2 强调 | 描边升级 `line-strong` 或描边变金(35%) |
| 3 发光 | `gold-dim` 光晕/聚光灯（引导视线的最高级） |
| 唯一例外 | `.terminal` 用 `0 30px 80px rgba(0,0,0,.5)` 大投影——终端是"窗口"，可以有窗外的纵深 |

导航另有一套：毛玻璃 `backdrop-filter: blur(12px)` + 75% 透明底色。

## 7. 动效语言（Motion Language）

**动机词汇表：飞、盖、分拣、发光。** 每个动效必须能说出它在邮局隐喻里是什么。

硬规则（全部动效适用）：

1. 只动 `transform` 和 `opacity`；需要 `will-change` 时按需加、用完即弃。
2. `prefers-reduced-motion: reduce` 时**全部静止**且内容完整可读（global.css 已内置，新动效必须兼容）。
3. 缓动惯用 `cubic-bezier(0.16,1,0.3,1)`；时长 150ms（hover）/ 550-700ms（入场）/ 4.5s（装饰扫光循环）/ 9-28s（环境光）。
4. 移动端（≤900px）重型场景直接不渲染（沿用 `.envs` 模式）。

### 已实现（现状）

- **飞（2D）**：hero 信封 JS 弹簧跟随，CSS 只负责淡入（`.envs/.env`）。
- **盖（邮戳，S1）**：copy 成功盖下一枚圆形邮戳（`src/scripts/postmark.js` + `src/styles/postmark.css`；docs 经 `src/components/DocsHead.astro` 挂载）。静止直径首页 **96px** / docs **64px**，窄屏（≤640px）76/52px；峰值 scale 2.2、press 1520ms；做旧为九成墨（N1 定稿"做大做实"）；视口边缘由 JS 按比例保底收缩（最多八成），不再缩小戳本体。
- **卡片 3D 倾斜（S2）**：`.card` 朝向光标倾斜 `perspective(800px) rotateX/Y ±7°`（`src/pages/index.astro` spotlight 脚本；pointer:fine 限定、触摸/笔不触发、rAF 合帧、离开 0.3s 回正）。±7° 为 N1 业主拍板（原规格 ≤3° 无感）。`.card-cockpit` 除外——大卡内层自己做等距微缩 + hover 转正，不再叠光标倾斜。
- **Dashboard 等距微缩（v0.4）**：`.cockpit-shot` 静止 `rotateX(7°) rotateY(-7°) rotateZ(2°)`，hover 微转正，金箔边缘泛光。截图只用 `public/images/dashboard-overview.webp`（Overview，零内部内容）；inbox 截图默认不用。
- **Standards 邮票墙（v0.4）**：`src/components/StampWall.astro` + `src/styles/upgrade.css`。四枚做旧邮戳（齿孔/双圈/缺墨，沿用 S1 语言做大做实），静止 ±7°，大小错落；hover 回正。A2A 小字注解放在邮票下方。
- **特性微缩图（v0.4）**：Phone 三档出境 / Sent 虚线航线+账本行 / MCP 终端↔云+钥匙。hover 只做一次微位移或金点泛光，不新开循环动画。
- **金箔标题（S3）**：hero 标题金字扫光（`global.css` `.foil-wrap/.foil`，纯 CSS）。定稿 **A 版 `.foil-fill`**（实心金箔填充，`foil-sweep 4.5s linear infinite`；暗部 `#d99c14` 在画布上 ≈8:1 对比度合格）。B 版 `.foil-outline` 保留可切换——描边必须走独立兄弟层 `.foil-stroke`：background-clip:text 与 text-stroke 同元素会夹坏 Satoshi "y" 下勾。
- **页尾 Lottie 信封**：Final CTA 区 `#lottie-final`（`src/pages/index.astro`）。动画 `public/animations/email-sent.json`（LottieFiles "contact-email"，Simple License，已改色品牌金）；播放器 lottie-web v5.13.0 vendored `public/vendor/lottie_svg.min.js`。IO 懒加载、离屏暂停、reduced-motion 静态帧。**这是"不引外部库"的唯一先例**（2026-07-30 业主点名），条件：本地 vendored 不走 CDN、懒加载不进首屏、reduce 下有完整静态形态。后来者不算惯例，仍需单独提案。
- **发光**：`.hero-glow` 呼吸、`.aurora-1/2/3` 光斑摇曳、卡片聚光灯、`.cursor` 终端光标闪烁。
- **入场**：`.reveal` 滚动显现、`.stagger-1..5` hero 阶梯入场、终端打字。
- **跑马灯**：`.marquee` logo 墙。

### 规划中（未实现——动手前先看这里）

> 动效 backlog，按优先级排。实现后把条目挪到"已实现"并注明源文件。

- **B1 OTP 分拣机**：otp-demo 区滚动驱动——邮件卡过金色扫描门，验证码吸出落进 JSON 面板。（批 3，暂停中）
- **B2 终端 scrub**：终端打字进度绑定滚动位置（reduced-motion 直接全播）。（批 3，暂停中）
- **C1 页脚航线**：SVG 虚线自绘 + 尽头小信封。C2 hero 金色尘埃微粒（canvas ≤40 粒）。

### 已决策不做（留档，别再提）

- **A1 3D 信封航线 / A2 CSS 3D 信封**：2026-07-30 业主拍板原 hero 不动，自绘 CSS 3D 路线废弃，由页尾 Lottie 方案替代（参考代码留 website/.arena/wtA1-codex、wtA2-codex，不合并）。

## 8. 3D 规则（立法）

1. **白名单**：3D 只允许出现在官网营销页（`src/pages/`）。**禁区**：文档站、法律页、/ui Dashboard 一律 2D。
2. 参数上限：`perspective` 800–1200px；**光标跟随互动倾斜 ≤7°**（S2 卡片，N1 业主拍板）；**装饰性静止摆放旋转 ≤7°**（otp-demo `.fan-card` 扇形静止位）；其他静态倾斜 ≤4°；飞过弯侧倾 ≤15°。
3. 一律 CSS 3D 或轻量 canvas；任何 3D 库（Three.js/Spline 等）需要单独提案讨论。
4. 性能预算：同屏动画元素 ≤50；帧预算内不允许 layout 读写抖动。
5. 降级链完整：无 JS / reduced-motion / 移动端三种情况下，内容以静态形态完整成立。

## 9. 无障碍

- 正文对比度 ≥4.5:1；大标题/控件 ≥3:1（/ui 的 `--line-control` 即为此设）。
- **焦点永远可见**：`:focus-visible` = 3px `gold` outline（官网 global.css 全局规则与 /ui 均已实现）。
- 动效不携带信息：动效停止时，内容含义不变。
- 金底上只放 `#111` 黑字；深底上金色文字仅限 kicker/数字/链接。

## 10. 页面清单（线上路由 → 源文件）

| 路由 | 源文件 | 说明 |
|---|---|---|
| `/` | `src/pages/index.astro` | 首页：hero（命令行 + npm 徽章 + 信封 + 低调小徽章）、logo 墙、终端、特性卡（Dashboard 2 倍宽大卡）、Standards 邮票墙、步骤、统计、OTP 演示、对比表、OSS CTA、页脚 |
| `/alternatives/agentmail`、`/alternatives/mailslurp` | `src/pages/alternatives/*.astro` | 竞品对比页（承接 P4 目录外链） |
| `/privacy`、`/terms` | `src/pages/*.astro` + `src/layouts/Legal.astro` | 法律页 |
| `/docs/*` | `src/content/docs/docs/`（Starlight） | 文档站 |

文档站主题覆盖：`src/styles/starlight-custom.css`（暗色 accent `#fbbf24`、画布 `#0c0d12`；**亮色主题 accent 用 `#b45309`**——全站唯一金色变体，仅此处，为链接可读性）。

## 11. 资产位置

- logo：`public/logo.svg`（星眼信封，深色圆角方底）；favicon：`public/favicon.svg`；OG 图：`public/og.png`。
- 大号 PNG 衍生品（1024/512/400，供目录站/marketplace）在 app 仓库 `docs/images/` 与营销工作区 `marketing/assets/`（不进任何仓库）。
- /ui Dashboard 设计分册：app 仓库 `DESIGN.md`（令牌与本文件同值，唯一偏差 `--line-control`）。

## 12. Agent 守则（do / don't）

- ✅ 新页面先复用 §5 组件；新组合也必须吃 §2 令牌；动效从 §7 词汇表里选。
- ✅ 文案：工程师口吻；代码/命令一律 mono；数字/状态如实。
- ❌ 不加新强调色、不引外部字体/样式 CDN、不动 CJK 回退链。
- ❌ 不做无降级的动效、不做依赖 JS 才能理解的内容、不在禁区用 3D。
- ❌ 不把金色文字放金色底上；不用投影堆叠代替边框分层。
- ⚠️ 特批例外：页脚 `.badges-row` 里的目录站验证徽章（AI Agents Directory / AgentHunter / Fazier）是对方免费收录的回链要求（2026-07-30 业主拍板），HTML 须保持对方原始代码（含热链图片），只许在外层 CSS 收敛视觉，**不许删**。再增新徽章需业主点头。
