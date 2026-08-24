// Visual check — the criteria a render can settle, and nothing else can.
//
// Two moments in the pipeline need this, and until now neither had a tool:
//
//   1. after design-agent writes a mockup, and
//   2. after the implementers build the screen  (reviewer's C16)
//
// C16 was three paragraphs of prose telling the reviewer to "render each screen
// and put it beside the mockup". No command, no criteria, nothing that could
// fail — the same shape as design-agent's screenshot step, which turned out to
// depend on a CLI this template never installs and had therefore never run once.
//
// WHAT THIS IS NOT. It does not judge whether a screen is any good. Every
// criterion below is a predicate over the DOM at render time: it returns a list,
// and a non-empty list is a defect that can be named. Taste stays with the
// owner, exactly as `ORCHESTRATION.md` says it does. A tool that scored a design
// would produce an opinion that sounds reasonable, is not reliable, and — worse —
// manufactures the feeling that someone judged it.
//
// WHAT IT DELIBERATELY LEAVES OUT. Per-element "is it outside the viewport" is
// not here. `lib/probe.mjs` carries the scar: six sweeps once read off-canvas
// markup as clipping, and a drawer parked off-screen is content that happens to
// be elsewhere, not content that is broken. Horizontal overflow is a
// document-level question and `check-design.mjs` already answers it.
//
// THE CANARY RULE. Every criterion must find a planted positive before it may
// report clean. A predicate written against markup the page does not use returns
// zero forever, and zero reads like good news. Three checks in this template
// reported PASS while doing nothing; that is the defect this rule exists for.
// `inconclusive` therefore exits non-zero: "we could not tell" must never be
// filed next to "we looked and it was fine".
//
// Usage:
//   node visual-check.mjs --target <file-or-url> [--target ...]
//                         [--against <mockup.html>]   # testid parity, moment 2
//                         [--state <name>]            # calls showState() first
//
//   # measure mode — the agent saw something and wants the numbers for it
//   node visual-check.mjs --target <t> --measure '.card .title' --relative-to '.card'
//                         [--tokens <tokens.json>]    # for control.minTarget
//                         [--screenshots <dir>] [--json]
//
// Exit: 0 = every criterion clean, 1 = a finding or an unproven criterion,
//       2 = bad invocation. No browser is a skip, never a crash: a checker that
//       breaks every review over a missing browser gets removed from the review.

import fs from 'node:fs';
import path from 'node:path';
import { installProbe } from '../../lib/probe.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const many = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));

const TARGETS = many('--target');
const AGAINST = opt('--against', null);
const STATE = opt('--state', null);
const TOKENS_PATH = opt('--tokens', null);
// Measure mode. The agent looked at the render, formed a suspicion, and named
// the elements it wants numbers for. This mode answers exactly that and judges
// nothing: no thresholds, no verdict, always exit 0. An instrument that decides
// what is wrong is back to being the brain, which is the arrangement that made
// the alignment sweep both noisy and blind — it clustered absolute page
// coordinates, so a sidebar item and a card title were compared for having
// similar x values while a label and its own input never were.
const MEASURE = many('--measure');
const RELATIVE_TO = opt('--relative-to', null);
const SHOTS = opt('--screenshots', null);
const AS_JSON = args.includes('--json');

if (TARGETS.length === 0) {
  console.error('visual-check: --target <file-or-url> is required');
  process.exit(2);
}
if (RELATIVE_TO && MEASURE.length === 0) {
  console.error('visual-check: --relative-to needs --measure <selector>');
  process.exit(2);
}

const results = [];
const SHOT_PATHS = [];
const add = (level, check, message, detail) => results.push({ level, check, message, detail });
const pass = (c, m, d) => add('pass', c, m, d);
const fail = (c, m, d) => add('fail', c, m, d);
const skip = (c, m, d) => add('skip', c, m, d);

// ── The one threshold, and the project owns it ─────────────────────────────
// A tap-target floor differs per platform (a phone is not a mouse), so this
// script does not invent one. tokens.json declares `control.minTarget`; where it
// does not, the criterion is skipped and says so. A number this file made up
// would be a rule nobody agreed to, enforced against every project that copies
// the template.
let MIN_TARGET = null;
const num = (v) => {
  const n = parseFloat(v?.value ?? v);
  return Number.isNaN(n) ? null : n;
};
if (TOKENS_PATH && fs.existsSync(TOKENS_PATH)) {
  try {
    const t = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    MIN_TARGET = num(t?.control?.minTarget);
  } catch {
    /* a malformed tokens.json is check-design's finding, not this one's */
  }
}

const toUrl = (t) => (/^https?:\/\//.test(t) ? t : 'file://' + path.resolve(t));

// ── Browser ────────────────────────────────────────────────────────────────
let chromium = null;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    chromium = null;
  }
}
if (!chromium) {
  skip('render', 'Playwright not installed — no criterion was evaluated');
  report();
  process.exit(0);
}

let browser;
try {
  const executablePath =
    process.env.VISUAL_CHECK_BROWSER || process.env.DESIGN_CHECK_BROWSER || undefined;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
} catch (e) {
  skip('render', `browser would not launch — no criterion was evaluated (${String(e.message).split('\n')[0]})`);
  report();
  process.exit(0);
}

// ── Measure mode ───────────────────────────────────────────────────────────
// Boxes for the elements named, and the two comparisons an eye cannot make
// accurately: how far apart the values on each edge are, and — with
// --relative-to — where each element sits inside its own container. That second
// one is what makes repeated components comparable at all. Two cards in
// different containers have no reason to share an absolute position and every
// reason to have the same internal spacing, so absolute coordinates answer the
// wrong question.
const MEASURE_PROBE = String.raw`
(sels, relSel) => {
  const P = window.__probe;
  const groups = sels.map(sel => ({
    selector: sel,
    items: Array.from(document.querySelectorAll(sel)).map((el, i) => {
      const r = el.getBoundingClientRect();
      const d = { i, hidden: P.reasonHidden(el), ...P.describe(el) };
      if (relSel) {
        const c = el.closest(relSel);
        if (c) {
          const cr = c.getBoundingClientRect();
          d.within = {
            left: Math.round(r.left - cr.left),
            top: Math.round(r.top - cr.top),
            right: Math.round(cr.right - r.right),
            bottom: Math.round(cr.bottom - r.bottom),
          };
        }
      }
      return d;
    }),
  }));
  return { groups, viewport: { w: window.innerWidth, h: window.innerHeight } };
}
`;

const spread = (values) => (values.length < 2 ? 0 : Math.max(...values) - Math.min(...values));
const line = (label, values) => {
  const uniq = [...new Set(values)];
  const sp = spread(values);
  return `      ${label.padEnd(7)} spread ${String(sp).padStart(3)}px   ${uniq.join(', ')}`;
};

async function measure(url, label) {
  const page = await browser.newPage();
  await installProbe(page);
  await page.goto(url, { waitUntil: 'load' });
  if (STATE) {
    await page.evaluate((st) => typeof window.showState === 'function' && window.showState(st), STATE);
  }
  const data = await page.evaluate(
    `(${MEASURE_PROBE})(${JSON.stringify(MEASURE)}, ${JSON.stringify(RELATIVE_TO)})`,
  );

  console.log(`\n${label}  (viewport ${data.viewport.w}\u00d7${data.viewport.h})`);
  for (const g of data.groups) {
    console.log(`\n  ${g.selector} \u2014 ${g.items.length} element(s)`);
    if (!g.items.length) {
      console.log('      nothing matched. A selector that matches nothing measures nothing —');
      console.log('      check it against the render before reading this as agreement.');
      continue;
    }
    for (const it of g.items) {
      const b = it.box;
      const rel = it.within
        ? `   within ${RELATIVE_TO}: l=${it.within.left} t=${it.within.top} r=${it.within.right} b=${it.within.bottom}`
        : '';
      const hid = it.hidden ? `   [hidden: ${it.hidden}]` : '';
      console.log(`      #${it.i}  x=${b.x} y=${b.y} w=${b.w} h=${b.h}${rel}${hid}` +
                  (it.text ? `   "${it.text}"` : ''));
    }
    if (g.items.length > 1) {
      const v = g.items.map((it) => it.box);
      console.log('    absolute:');
      console.log(line('left', v.map((b) => b.x)));
      console.log(line('right', v.map((b) => b.x + b.w)));
      console.log(line('top', v.map((b) => b.y)));
      console.log(line('width', v.map((b) => b.w)));
      console.log(line('height', v.map((b) => b.h)));
      const withins = g.items.filter((it) => it.within).map((it) => it.within);
      if (withins.length > 1) {
        console.log(`    within ${RELATIVE_TO}:`);
        for (const side of ['left', 'top', 'right', 'bottom']) {
          console.log(line(side, withins.map((w) => w[side])));
        }
      }
      const rows = [...g.items].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
      const gaps = rows.slice(1).map((it, i) => {
        const prev = rows[i].box;
        return Math.round(it.box.y - (prev.y + prev.h));
      });
      console.log(`    gaps (document order, vertical): ${gaps.join(', ')}`);
    }
  }

  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const base = label.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'target';
    const out = path.join(SHOTS, `${base}${STATE ? '-' + STATE : ''}.png`);
    await page.screenshot({ path: out, fullPage: true });
    SHOT_PATHS.push(out);
  }
  await page.close();
}

if (MEASURE.length) {
  try {
    for (const t of TARGETS) await measure(toUrl(t), t);
  } finally {
    await browser.close();
  }
  if (SHOT_PATHS.length) {
    console.log(`\nRendered output:`);
    for (const shot of SHOT_PATHS) console.log(`  ${shot}`);
  }
  // Numbers, not a verdict. What they mean is the reading agent's call.
  console.log('\nvisual-check: measured. No verdict \u2014 a spread is a number, not a defect.');
  process.exit(0);
}

// ── The criteria ───────────────────────────────────────────────────────────
// Everything below runs in the page. `check` mirrors probe.sweep's verdict
// contract — found / clean / inconclusive — but takes a collector rather than a
// selector, because two criteria here are about elements that are hidden or
// about pairs of elements, and sweep's candidate set is visible singletons by
// design.
const CRITERIA = String.raw`
({ minTarget }) => {
  const P = window.__probe;
  const box = el => el.getBoundingClientRect();
  const vw = () => document.documentElement.clientWidth;
  const vh = () => document.documentElement.clientHeight;
  const out = [];

  const check = ({ name, why, collect, canary }) => {
    const hits = collect();
    if (hits.length) {
      return { name, why, verdict: 'found', hits: hits.length, examples: hits.slice(0, 5) };
    }
    if (typeof canary !== 'function') {
      return { name, why, verdict: 'inconclusive', hits: 0,
               note: 'no canary: a zero from an unproven predicate is not evidence of absence' };
    }
    let planted = null, proved = false;
    try { planted = canary(); proved = collect().length > 0; }
    catch (e) { proved = false; }
    finally { if (planted && planted.remove) planted.remove(); }
    return { name, why, verdict: proved ? 'clean' : 'inconclusive', hits: 0,
             note: proved ? null
               : 'the canary was not detected — this predicate cannot find what it claims to look for' };
  };

  const describe = el => P.describe(el);
  const interactive = 'button,a[href],input,select,textarea,[role=button],[role=link],[tabindex]';

  // Canaries are planted INTO the page under test, so the page's own CSS
  // applies to them. A stylesheet with \`button { min-height: 44px }\` silently
  // inflated the tap-target canary until it was no longer small, and the check
  // reported UNPROVEN on a clean page — which is the canary rule working, and
  // the reason every planted style below is !important. A canary the page can
  // reshape proves nothing about the predicate.
  const style = (el, css) => {
    for (const decl of css.split(';')) {
      const i = decl.indexOf(':');
      if (i === -1) continue;
      el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim(), 'important');
    }
    return el;
  };
  const RESET = 'margin:0;padding:0;border:0;min-width:0;min-height:0;max-width:none;max-height:none;transform:none';

  // 1 — a declared element is covered by something else. The element is in the
  // DOM, passes every visibility rule, and a user still cannot touch it: an
  // overlay left open, a sticky bar over the primary action, a z-index race.
  // Nothing in a file can show this; it exists only where things are laid out.
  out.push(check({
    name: 'covered',
    why: 'present, visible, and something else receives the click',
    collect: () => P.all('[data-testid]').filter(el => {
      const r = box(el);
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > vw() || y > vh()) return false;   // not this criterion's question
      const hit = document.elementFromPoint(x, y);
      if (!hit) return false;
      return !(hit === el || el.contains(hit) || hit.contains(el));
    }).map(describe),
    canary: () => {
      const el = document.createElement('div');
      el.setAttribute('data-testid', '__canary-covered');
      style(el, RESET + ';position:fixed;left:8px;top:8px;width:40px;height:40px;background:#ccc;display:block;opacity:1;visibility:visible');
      const lid = document.createElement('div');
      style(lid, RESET + ';position:fixed;left:0;top:0;width:120px;height:120px;background:#999;z-index:2147483647;display:block;opacity:1;visibility:visible');
      document.body.appendChild(el);
      document.body.appendChild(lid);
      // The occluder must not be a descendant or the test would exempt it, so
      // cleanup travels with the element the sweep knows about.
      el.remove = function () { lid.remove(); Element.prototype.remove.call(this); };
      return el;
    },
  }));

  // 2 — text cut off by its own container. The string is right in the DOM and
  // the user reads half of it. This is the failure a longest-realistic-name
  // fixture is for, and it is invisible to every assertion made on text content.
  out.push(check({
    name: 'clipped',
    why: 'content is larger than the box that clips it — the user reads part of it',
    collect: () => P.all('*').filter(el => {
      if (el === document.body || el === document.documentElement) return false;
      const cs = getComputedStyle(el);
      if (!/hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY)) return false;
      if (!(el.textContent || '').trim()) return false;
      return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    }).map(describe),
    canary: () => {
      const el = document.createElement('div');
      style(el, RESET + ';position:fixed;left:8px;bottom:8px;width:30px;height:14px;overflow:hidden;white-space:nowrap;font-size:12px;display:block;opacity:1;visibility:visible');
      el.textContent = 'a name far longer than thirty pixels';
      document.body.appendChild(el);
      return el;
    },
  }));

  // 3 — two things a user can act on sit on top of each other. One of them is
  // unreachable and which one is a matter of paint order, not intent.
  out.push(check({
    name: 'overlap',
    why: 'two interactive elements occupy the same pixels',
    collect: () => {
      const els = P.all(interactive);
      const hits = [];
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const a = els[i], b = els[j];
          if (a.contains(b) || b.contains(a)) continue;    // nesting is not collision
          const ra = box(a), rb = box(b);
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (w > 1 && h > 1) hits.push({ a: describe(a), b: describe(b), overlap: Math.round(w * h) });
        }
      }
      return hits;
    },
    canary: () => {
      const wrap = document.createElement('div');
      const mk = () => { const b = document.createElement('button'); b.textContent = 'x';
        return style(b, RESET + ';position:fixed;left:20px;top:20px;width:44px;height:44px;display:block;opacity:1;visibility:visible'); };
      wrap.appendChild(mk()); wrap.appendChild(mk());
      document.body.appendChild(wrap);
      return wrap;
    },
  }));

  // 4 — a control smaller than the floor this project declared. Skipped, loudly,
  // when no floor is declared: a number invented here would be a rule nobody
  // agreed to. Inline links inside running text are exempt — they are text.
  if (minTarget) {
    out.push(check({
      name: 'tap-target',
      why: 'smaller than the control floor tokens.json declares (' + minTarget + 'px)',
      collect: () => P.all(interactive).filter(el => {
        if (getComputedStyle(el).display === 'inline') return false;
        const r = box(el);
        return r.width > 0 && Math.min(r.width, r.height) < minTarget;
      }).map(describe),
      canary: () => {
        const b = document.createElement('button');
        style(b, RESET + ';position:fixed;left:4px;top:4px;width:8px;height:8px;display:block;opacity:1;visibility:visible');
        document.body.appendChild(b);
        return b;
      },
    }));
  }

  // 5 — a control with no accessible name (WCAG 4.1.2). An icon button whose
  // only content is a glyph announces nothing at all.
  out.push(check({
    name: 'unnamed-control',
    why: 'interactive and announces nothing (WCAG 4.1.2)',
    collect: () => P.all('button,a[href],input,select,textarea,[role=button]').filter(el =>
      !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
        (el.labels && el.labels.length) || (el.textContent || '').trim() ||
        el.getAttribute('title') || el.getAttribute('placeholder'))
    ).map(describe),
    canary: () => {
      const b = document.createElement('button');
      style(b, RESET + ';position:fixed;left:4px;bottom:4px;width:20px;height:20px;display:block;opacity:1;visibility:visible');
      document.body.appendChild(b);
      return b;
    },
  }));

  // 6 — the announced name does not contain the visible one (WCAG 2.5.3). A
  // voice-control user says what they can read; "Submit" on a button that reads
  // "Send" is a control they cannot operate by name.
  out.push(check({
    name: 'label-mismatch',
    why: 'the announced name does not contain the visible label (WCAG 2.5.3)',
    collect: () => P.all('button,a[href],[role=button]').filter(el => {
      const seen = (el.textContent || '').trim();
      const said = el.getAttribute('aria-label');
      return seen && said && !said.toLowerCase().includes(seen.toLowerCase());
    }).map(el => ({ ...describe(el), announced: el.getAttribute('aria-label') })),
    canary: () => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'Dispatch');
      b.textContent = 'Send';
      style(b, RESET + ';position:fixed;right:4px;top:4px;width:60px;height:24px;display:block;opacity:1;visibility:visible');
      document.body.appendChild(b);
      return b;
    },
  }));

  // 7 — hidden and still in the tab order. A keyboard user tabs into a screen
  // nobody can see and has no way back. This one has to look at hidden
  // elements, which is why it collects directly instead of through P.all.
  out.push(check({
    name: 'hidden-focusable',
    why: 'not visible, still reachable by keyboard',
    collect: () => Array.from(document.querySelectorAll(
      '[tabindex]:not([tabindex="-1"]),button,a[href],input,select,textarea'))
      .filter(el => {
        const hiddenWhy = P.reasonHidden(el);
        if (!hiddenWhy || hiddenWhy === 'detached') return false;
        if (el.closest('[inert]')) return false;
        return el.tabIndex >= 0 && !el.hasAttribute('disabled');
      })
      .map(el => ({ ...P.describe(el), hidden: P.reasonHidden(el) })),
    canary: () => {
      const wrap = document.createElement('div');
      style(wrap, 'display:none');
      const b = document.createElement('button');
      b.textContent = 'ghost';
      wrap.appendChild(b);
      document.body.appendChild(wrap);
      return wrap;
    },
  }));

  return {
    criteria: out,
    testids: P.all('[data-testid]').map(el => el.getAttribute('data-testid')),
  };
}
`;

async function inspect(url, label) {
  const page = await browser.newPage();
  await installProbe(page);
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  await page.goto(url, { waitUntil: 'load' });
  if (STATE) {
    await page.evaluate(
      (s) => typeof window.showState === 'function' && window.showState(s),
      STATE,
    );
  }
  const cfg = JSON.stringify({ minTarget: MIN_TARGET });
  const data = await page.evaluate(`(${CRITERIA})(${cfg})`);

  for (const c of data.criteria) {
    const where = `${label}: ${c.name}`;
    if (c.verdict === 'found') {
      fail(c.name, `${where} — ${c.hits} × ${c.why}`, c.examples);
    } else if (c.verdict === 'clean') {
      pass(c.name, `${where} — none, and the canary proved the check can fire`);
    } else {
      fail(c.name, `${where} — UNPROVEN: ${c.note}`);
    }
  }
  if (MIN_TARGET === null) {
    skip('tap-target', `${label}: tokens.json declares no control.minTarget — no floor to measure against`);
  }
  if (consoleErrors.length) {
    fail('console', `${label}: ${consoleErrors.length} console error(s) — first: ${consoleErrors[0]}`);
  }

  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const base = label.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'target';
    const out = path.join(SHOTS, `${base}${STATE ? '-' + STATE : ''}.png`);
    await page.screenshot({ path: out, fullPage: true });
    SHOT_PATHS.push(out);
  }

  await page.close();
  return data.testids;
}

try {
  const seen = [];
  for (const t of TARGETS) seen.push(await inspect(toUrl(t), t));

  // ── Moment 2: does the built screen carry what the design declared ────────
  // C14 compares testids by grepping source. That proves the strings exist. It
  // cannot show that the element ever reaches a user — a testid can be present
  // in the file, rendered, and covered, or never mounted in the state under
  // test. This compares what is actually on screen on both sides.
  if (AGAINST) {
    const want = await inspect(toUrl(AGAINST), `design:${path.basename(AGAINST)}`);
    const got = new Set(seen.flat());
    const missing = [...new Set(want)].filter((id) => !got.has(id));
    const extra = [...got].filter((id) => !want.includes(id));
    if (missing.length) {
      fail('parity', `built screen never shows ${missing.length} testid(s) the design declares: ${missing.slice(0, 8).join(', ')}`);
    } else {
      pass('parity', `every testid visible in the design is visible in the build`);
    }
    // An extra id is a note. Pushing implementers to strip hooks the design has
    // not caught up with costs more than it saves — same call C14 makes.
    if (extra.length) {
      skip('parity', `build shows ${extra.length} testid(s) the design does not declare: ${extra.slice(0, 8).join(', ')}`);
    }
  }
} finally {
  await browser.close();
}

report();
process.exit(results.some((r) => r.level === 'fail') ? 1 : 0);

function report() {
  if (AS_JSON) {
    console.log(JSON.stringify({ results, screenshots: SHOT_PATHS }, null, 2));
    return;
  }
  const f = results.filter((r) => r.level === 'fail').length;
  const p = results.filter((r) => r.level === 'pass').length;
  const s = results.filter((r) => r.level === 'skip').length;
  for (const r of results) {
    const tag = r.level === 'fail' ? 'FAIL' : r.level === 'pass' ? 'ok  ' : '--  ';
    console.log(`  ${tag}  [${r.check}] ${r.message}`);
    for (const ex of (r.detail || []).slice(0, 3)) {
      console.log(`          ${JSON.stringify(ex)}`);
    }
  }
  console.log(`\nvisual-check: ${p} passed, ${f} failed, ${s} skipped`);
  if (SHOT_PATHS.length) {
    console.log(`\nRendered output — read every one of these before judging the screen:`);
    for (const shot of SHOT_PATHS) console.log(`  ${shot}`);
  }
}
