/* postmark — S1「盖」：copy 成功后盖下一枚圆形邮戳（对抗合成终版）
   ------------------------------------------------------------------
   一份实现，两处共用：
     · 首页 hero 的 .copy-btn      → index.astro 里 import { pressPostmark } 手动调用
     · 文档站 expressive-code 的
       .copy button[data-code]     → initDocsCopyStamps() 代理监听（那按钮不是自家组件，
                                     复制逻辑是它自带的，我们只在"确认复制成功"后补一枚邮戳）
   样式在 src/styles/postmark.css（官网 global.css 与文档站 starlight-custom.css 各自 @import 同一份）。

   合成要点（两版对抗后的取舍，细节见 CONSOLIDATION.md）：
     · 邮戳 position: fixed 挂 document.body —— 不会被任何祖先 overflow 裁掉，
       也不会被按钮的 textContent 改写冲掉；边缘保护按「静止尺寸 × 峰值 scale」动态算。
     · 时序：点击即盖章 → 邮戳砸到纸面那一刻（SETTLE_MS）按钮进 copied 态 → 邮戳继续播到 1.2s 起淡出。
     · 活动态集中在 WeakMap + clearActive() 一处收口：连点时旧戳、旧定时器、按钮文字和绿色态一起还原。
     · 动效只碰 transform / opacity；节点动画结束就删（will-change 随节点一起消失）。 */

/* 月份表写死，不走 toLocaleString —— 免得跟着浏览器语言变成中文 */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/* 下面三个数必须和 postmark.css 的 postmark-press 关键帧对齐 */
const DURATION = 1520; // 关键帧总时长
const SETTLE_MS = 350; // 关键帧 23%（1520 × 0.23 ≈ 350ms）：邮戳砸到纸面那一下
const PEAK_SCALE = 2.2; // 关键帧 0% 的 scale，视口边缘保护按它算峰值半宽

/* 缩小的下限，写成"静止尺寸的几成"而不是一个绝对像素值。
   N1 返工的教训：邮戳放大到 96px 后，只要按钮离视口边不到 106px（= 96 × 2.2 ÷ 2，
   笔电视口下 hero 那颗 copy 按钮经常就是这样），旧的"先缩"逻辑会把它一路缩回 68px 上下，
   等于把"做大"当场缩没了。改成按比例保底：最多缩到八成（96→77、64→52、76→61），
   再不够就交给 clamp 把位置往视口里挪一点点（偏心几像素，肉眼几乎看不出），
   而不是继续把章缩小。写成比例还顺手修掉一个隐患：绝对下限一旦大于文档站的 64px，
   Math.max 会把文档站那枚反向"放大"到下限值。 */
const MIN_SHRINK = 0.8;

/* copied 态从出现算起停留多久（沿用站内原有的 1800ms 手感） */
const COPIED_MS = 1800;

/* 文档站等 expressive-code「复制成功」信号的上限：等不到就撤观察器 */
const WATCH_MS = 1200;

/* 每枚邮戳的 SVG filter / mask 需要全页唯一 id */
let seq = 0;

/* button → { stamp, stateClass, timers, copied, onReset }：一个按钮同时只有一份活动态 */
const active = new WeakMap();

/* 正在屏幕上的邮戳：stamp → { anchor 对准的按钮, size CSS 给的静止尺寸 }。
   滚动跟随和软导航清场都靠它 */
const onScreen = new Map();

/** 是否处于"减少动效"偏好下（JS 侧的那一轨） */
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 锯齿边：内外半径交替的折线环，做成邮票齿孔那种毛边 */
function serratedRing(teeth, rOuter, rInner) {
  const pts = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (Math.PI * i) / teeth;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

/** 今天的日期，postmark 上那圈"寄信日期" */
function postmarkDate(now = new Date()) {
  return `${String(now.getDate()).padStart(2, '0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/** 造一枚邮戳节点（inline SVG，做旧油墨质感靠两个 SVG filter） */
function buildStamp(anchor) {
  const id = `pm${++seq}`;
  const seed = Math.floor(Math.random() * 9000);
  // ±3.5°–9.5° 的随机微旋转：铁律是 ≤10°，同时避开 0° 附近（0° 看着像贴上去的）
  const rot = (Math.random() < 0.5 ? -1 : 1) * (3.5 + Math.random() * 6);

  const el = document.createElement('span');
  el.className = 'postmark';
  // 文档站的 copy 按钮比 hero 的小一号，尺寸差异留在 CSS 里（还要吃窄屏媒体查询），
  // 这里只负责认出"这是文档站"并挂上变体 class
  if (anchor && typeof anchor.closest === 'function' && anchor.closest('.expressive-code')) {
    el.classList.add('postmark-docs');
  }
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--pm-rot', `${rot.toFixed(2)}deg`);
  el.innerHTML = `
<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <defs>
    <!-- 手盖的章不可能是完美圆：拿噪声把整枚戳的边缘轻微推歪。
         N1 返工：scale 1.2 → 0.6、频率 0.28 → 0.22 —— 位移砍半、波长放长，
         笔画边缘只剩一点点手工毛糙，不再把字和环推成抖动的样子。 -->
    <filter id="${id}rough" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="${seed}" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0.6" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <!-- 做旧：噪声当遮罩用，让油墨浓淡不匀（纸吃墨不匀的感觉）。
         N1 返工（业主原话"缺墨的处理看得更加不清晰"）：从"成片掉色"改成"极轻的浓淡"。
         算一下就明白：out = slope × noise + intercept，fractalNoise 均值 ≈0.5、标准差 ≈0.12。
           旧参数 3.2 / -0.85 → 均值 0.75，noise<0.27 的地方直接归零（成片空洞、字被啃烂）
           新参数 1.35 / 0.45 → noise≥0.41（约八成面积）就压满 1.0＝满墨，
                                最暗的极端值也还有 0.45，平均墨量 ≈0.97 —— 九成墨以上，不出空洞。
         频率也放粗（0.16 0.26 → 0.09 0.14）：blotch 变大变柔，像纸的吸墨差异，
         而不是一层细灰点噪声（那才是"看不清"的元凶）。 -->
    <filter id="${id}wearF" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.09 0.14" numOctaves="2" seed="${seed + 17}" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncR type="linear" slope="1.35" intercept="0.45" />
        <feFuncG type="linear" slope="1.35" intercept="0.45" />
        <feFuncB type="linear" slope="1.35" intercept="0.45" />
        <feFuncA type="table" tableValues="1 1" />
      </feComponentTransfer>
    </filter>
    <mask id="${id}wear" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect x="0" y="0" width="100" height="100" filter="url(#${id}wearF)" />
    </mask>
    <path id="${id}top" d="M 17 50 A 33 33 0 0 1 83 50" fill="none" />
    <path id="${id}bot" d="M 9 50 A 41 41 0 0 0 91 50" fill="none" />
  </defs>
  <!-- 手盖的毛边（rough）套在最外层，让"纸面"和油墨共享同一条歪掉的轮廓。 -->
  <g filter="url(#${id}rough)">
    <!-- 纸面：一层很淡的同色底。放大到 96px 后，戳心正好压在按钮自己的
         "copied ✓" 绿字上，两层字叠在一起谁都读不清 —— 垫一层纸就把下面压住了，
         顺带让这枚章看着是"盖在表面上"而不是"画在上面"。颜色走 --pm-paper（亮色主题另给一版）。 -->
    <circle class="pm-paper" cx="50" cy="50" r="44.5" />
    <!-- 墨色 opacity 拉满（原来 0.95）：金色本来就不算重，再打折就更飘。
         线宽与字号同步加重一档（"做实"，viewBox 是 100 单位，等于整枚章按比例变粗）。 -->
    <g mask="url(#${id}wear)" fill="none" stroke="currentColor"
       stroke-linejoin="round" opacity="1">
      <path d="${serratedRing(38, 47.2, 44.4)}" stroke-width="1.5" />
      <circle cx="50" cy="50" r="43" stroke-width="2.8" />
      <circle cx="50" cy="50" r="27.5" stroke-width="1.8" />
      <path d="M 31 38.5 H 69 M 31 61.5 H 69" stroke-width="2" stroke-linecap="round" />
      <text font-size="8.8" letter-spacing="1" text-anchor="middle">
        <textPath href="#${id}top" startOffset="50%">OPENAGENT.EMAIL</textPath>
      </text>
      <text font-size="7.8" letter-spacing="1.1" text-anchor="middle">
        <textPath href="#${id}bot" startOffset="50%">${postmarkDate()}</textPath>
      </text>
      <text x="50" y="50" font-size="13" letter-spacing="0.6" text-anchor="middle"
        dominant-baseline="central">COPIED</text>
    </g>
  </g>
</svg>`;
  return el;
}

/* ── 定位：邮戳是 fixed overlay，摆到按钮正中，再做视口边缘保护 ──────── */

/** 单轴夹取。guard = 峰值那一帧的半宽；视口比邮戳还窄时干脆居中，别硬挤到一边 */
function clampAxis(center, guard, extent) {
  if (extent < guard * 2) return extent / 2;
  return Math.min(Math.max(center, guard), extent - guard);
}

/**
 * 摆位。
 * 视口边缘保护分两步，顺序很重要：
 *   1) 先「缩」：空间不够放下 scale(2.2) 的峰值时，把邮戳整体缩小到刚好放得下
 *      （下限是静止尺寸的 MIN_SHRINK 成）。缩小能同时保住"正对按钮"和"不被切"，
 *      比一味推开好 —— 推开会让"盖在按钮上"这件事直接不成立。
 *   2) 再「夹」：缩到下限仍放不下时才夹到视口内，这是最后一道兜底。
 *      N1 返工后邮戳大了一倍，这一步的分工也跟着变：宁可夹出几像素偏心，也不把章缩小。
 * @param {boolean} peak 是否按峰值帧算余量。只有刚盖下那 350ms 存在 scale(2.2)，
 *   之后邮戳一直是 scale(1)，跟随时按 1 倍算，位置才咬得住按钮。
 */
function place(stamp, entry, peak) {
  const box = entry.anchor.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let size = entry.size;
  if (peak) {
    // 按钮中心到最近视口边的距离 = 一半余量；能放下的最大静止尺寸 = 余量×2 ÷ 峰值倍数
    const room = Math.min(cx, vw - cx, cy, vh - cy);
    const fit = Math.max(size * MIN_SHRINK, Math.min(size, (room * 2) / PEAK_SCALE));
    if (fit < size) {
      size = Math.round(fit);
      stamp.style.setProperty('--pm-size', `${size}px`);
    }
  }

  const guard = (size * (peak ? PEAK_SCALE : 1)) / 2;
  stamp.style.left = `${clampAxis(cx, guard, vw)}px`;
  stamp.style.top = `${clampAxis(cy, guard, vh)}px`;
}

/* 滚动/改窗时让在播的邮戳跟着按钮走。
   为什么是"跟随"而不是"一滚就撤"：邮戳只活 1.5s，用户复制完顺手滚页很常见，
   一滚就消失会被当成 bug。代价只是这 1.5s 内每帧一次 getBoundingClientRect，
   而且监听器只在有邮戳在播时挂着，播完就摘。
   按钮中心滚出视口时才撤 —— 那时候再"跟随"只会把邮戳钉在视口边上，反而像 bug。 */
let followRaf = 0;

function follow() {
  followRaf = 0;
  onScreen.forEach((entry, stamp) => {
    const anchor = entry.anchor;
    if (!anchor.isConnected) {
      dropStamp(stamp); // 按钮被换掉了（软导航、代码块重渲染），没有可对准的目标了
      return;
    }
    const box = anchor.getBoundingClientRect();
    const cy = box.top + box.height / 2;
    const cx = box.left + box.width / 2;
    if (cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) {
      dropStamp(stamp);
      return;
    }
    place(stamp, entry, false);
  });
}

function onViewportChange() {
  if (!followRaf) followRaf = requestAnimationFrame(follow);
}

function watchViewport(on) {
  if (typeof window === 'undefined') return;
  if (on) {
    window.addEventListener('scroll', onViewportChange, { passive: true, capture: true });
    window.addEventListener('resize', onViewportChange, { passive: true });
  } else {
    window.removeEventListener('scroll', onViewportChange, { capture: true });
    window.removeEventListener('resize', onViewportChange);
  }
}

/** 摘掉一枚邮戳；屏幕上一枚都不剩时把视口监听也摘掉，不留常驻监听 */
function dropStamp(stamp) {
  if (!onScreen.has(stamp)) return;
  onScreen.delete(stamp);
  stamp.remove();
  if (onScreen.size === 0) {
    watchViewport(false);
    if (followRaf) {
      cancelAnimationFrame(followRaf);
      followRaf = 0;
    }
  }
}

/** 软导航后清场：上一页的邮戳没有对应按钮了 */
function dropAllStamps() {
  Array.from(onScreen.keys()).forEach(dropStamp);
}

/* ── 活动态：一个按钮同时只有一份，清理集中在这里 ────────────────────── */

function clearActive(button) {
  const rec = active.get(button);
  if (!rec) return;
  rec.timers.forEach((t) => window.clearTimeout(t));
  if (rec.stamp) dropStamp(rec.stamp);
  button.classList.remove(rec.stateClass);
  // 已经进过 copied 态才需要还原文案 —— 否则连点会留下"文字是 copied ✓ 但边框不是绿的"半截状态
  if (rec.copied && typeof rec.onReset === 'function') rec.onReset();
  active.delete(button);
}

/**
 * 盖章 + 按钮 copied 态。剪贴板成功之后才调它。
 * @param {HTMLElement} button 被盖的按钮（邮戳落在它正中，copied 态也加在它身上）
 * @param {{stateClass?: string, copiedFor?: number, onCopied?: () => void, onReset?: () => void}} [options]
 *   stateClass 默认 pm-copied（文档站用）；首页传 'copied' 复用站内既有的 .copy-btn.copied
 * @returns {HTMLElement|null} 邮戳节点；reduced-motion 下不造节点，返回 null
 */
export function pressPostmark(button, options = {}) {
  if (!button || typeof document === 'undefined') return null;

  const stateClass = options.stateClass || 'pm-copied';
  const copiedFor = typeof options.copiedFor === 'number' ? options.copiedFor : COPIED_MS;

  clearActive(button); // 连点：上一轮的戳、定时器、按钮状态一起收干净，再重新盖
  const rec = { stamp: null, stateClass, timers: [], copied: false, onReset: options.onReset };
  active.set(button, rec);

  const enterCopied = () => {
    rec.copied = true;
    button.classList.add(stateClass);
    if (typeof options.onCopied === 'function') options.onCopied();
    rec.timers.push(window.setTimeout(() => {
      button.classList.remove(stateClass);
      if (typeof options.onReset === 'function') options.onReset();
      active.delete(button);
    }, copiedFor));
  };

  // reduced-motion：没有邮戳要等，点击即静态 copied 态（CSS 那一轨也会把邮戳藏掉）
  if (prefersReducedMotion()) {
    enterCopied();
    return null;
  }

  const stamp = buildStamp(button);
  document.body.appendChild(stamp); // 先进 DOM 才量得到 CSS 给的尺寸
  const entry = { anchor: button, size: stamp.offsetWidth || 0 };
  if (onScreen.size === 0) watchViewport(true);
  onScreen.set(stamp, entry);
  place(stamp, entry, true); // 刚盖下这一下要按 scale(2.2) 的峰值算余量
  rec.stamp = stamp;

  // 邮戳砸到纸面那一刻按钮才变绿：既不是点击瞬间（抢了盖章的戏），
  // 也不是等淡出结束（那会有 1.45s 按钮毫无反应的死等）
  rec.timers.push(window.setTimeout(enterCopied, SETTLE_MS));

  // 用完即弃：动画一结束就删节点（连带它提升的图层）；animationend 不来时用定时器兜底，
  // 兜底句柄也记在 rec.timers 里，连点时能被 clearActive 取消
  const done = () => {
    rec.stamp = null;
    dropStamp(stamp);
  };
  stamp.addEventListener('animationend', done, { once: true });
  rec.timers.push(window.setTimeout(done, DURATION + 260));

  return stamp;
}

/* ── 文档站接线 ──────────────────────────────────────────────────────
   expressive-code 的 copy 按钮是它自带的（.copy > button[data-code] + [aria-live]）。
   它复制成功才会往 [aria-live] 里插一个 .feedback（失败分支直接 return，见其 copy-js-module），
   所以"插入 .feedback"就是可信的成功信号 —— 我们不重写它的复制逻辑，只在这个信号后补一枚邮戳。
   观察器只在点了按钮之后临时挂在那个 [aria-live] 小节点上，拿到信号或超时就 disconnect，
   不留常驻的全页面监听。 */

let docsWired = false;

function onDocsClick(ev) {
  const target = ev.target;
  if (!target || typeof target.closest !== 'function') return;
  const btn = target.closest('.expressive-code .copy button[data-code]');
  if (!btn) return;
  const region = btn.parentElement && btn.parentElement.querySelector('[aria-live]');
  if (!region || region.dataset.pmWatching === '1') return;
  region.dataset.pmWatching = '1';

  let observer = null;
  let timer = 0;
  const stop = () => {
    window.clearTimeout(timer);
    if (observer) observer.disconnect();
    delete region.dataset.pmWatching;
  };
  observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && node.classList.contains('feedback')) {
          stop();
          pressPostmark(btn);
          return;
        }
      }
    }
  });
  // 等不到成功信号（复制失败，或 expressive-code 因为上一个提示还在而跳过了插入）就撤
  timer = window.setTimeout(stop, WATCH_MS);
  observer.observe(region, { childList: true });
}

/** 文档站接线入口。幂等：重复调用只会挂一次 document 监听 */
export function initDocsCopyStamps() {
  if (typeof document === 'undefined' || docsWired) return;
  docsWired = true;
  // 捕获阶段：抢在 expressive-code 自己的 click 处理器之前把观察器架好
  document.addEventListener('click', onDocsClick, true);
  // Astro 软导航（ClientRouter）：body 会被换掉，上一页残留的 fixed 邮戳在这里清场
  document.addEventListener('astro:page-load', dropAllStamps);
}
