#!/usr/bin/env node
// Design mockup checker.
//
// Two halves, deliberately separated:
//
//   1. Token drift  — no browser needed. Compares the CSS variables a mockup
//                     inlines against {design}/_shared/tokens.json. Mockups are
//                     told to generate `:root{}` "from tokens.json"; nothing
//                     verified that they still match.
//   2. Render checks — needs a browser. Opens each mockup and asserts things
//                      that are invisible to every source-code grep: layout
//                      overflow, states that do not switch, testids that never
//                      appear, unreadable contrast.
//
// Half 1 always runs. Half 2 degrades to a skip when Playwright is not
// installed, so a review never breaks for lack of a browser — it just says so.
//
// Thresholds and breakpoints are READ FROM THE PROJECT, never hardcoded here:
// breakpoints come from tokens.json, the contrast ratio from DESIGN.md. A
// project that declares neither gets those checks skipped with a note rather
// than measured against a number this script invented.
//
// Usage:
//   node check-design.mjs --design-root design [--screenshots <dir>] [--json]
//
// Exit: 0 = no failures, 1 = at least one failure, 2 = bad invocation.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const DESIGN_ROOT = opt('--design-root', 'design');
const SHOTS = opt('--screenshots', null);
const AS_JSON = args.includes('--json');

const results = [];
const add = (level, check, message) => results.push({ level, check, message });
const pass = (c, m) => add('pass', c, m);
const fail = (c, m) => add('fail', c, m);
const skip = (c, m) => add('skip', c, m);

if (!fs.existsSync(DESIGN_ROOT)) {
  console.error(`design root not found: ${DESIGN_ROOT}`);
  process.exit(2);
}

// ── Inputs from the project ────────────────────────────────────────────────
const sharedDir = path.join(DESIGN_ROOT, '_shared');
const tokensPath = path.join(sharedDir, 'tokens.json');
const designMdPath = path.join(sharedDir, 'DESIGN.md');

let tokens = null;
if (fs.existsSync(tokensPath)) {
  try {
    tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  } catch (e) {
    fail('tokens', `tokens.json does not parse: ${e.message}`);
  }
}

// Breakpoints: whatever the project declared. Accepts a flat map of
// name -> number|"NNNpx" under a "breakpoints" (or "breakpoint") key.
function readBreakpoints(t) {
  if (!t) return [];
  const block = t.breakpoints ?? t.breakpoint ?? null;
  if (!block || typeof block !== 'object') return [];
  const out = [];
  for (const [name, raw] of Object.entries(block)) {
    const v = typeof raw === 'object' && raw !== null ? (raw.value ?? raw.px) : raw;
    const px = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(px) && px > 0) out.push({ name, px });
  }
  return out.sort((a, b) => a.px - b.px);
}

// Contrast threshold: a ratio the project states in DESIGN.md, e.g.
// "contrast ratio: 4.5" or "minimum contrast 4.5:1". No default — an unstated
// threshold means the check is skipped, not that a number is assumed.
function readContrastThreshold(md) {
  if (!md) return null;
  const m = md.match(/contrast[^\n]*?([0-9]+(?:\.[0-9]+)?)\s*(?::\s*1)?/i);
  return m ? parseFloat(m[1]) : null;
}

const designMd = fs.existsSync(designMdPath) ? fs.readFileSync(designMdPath, 'utf8') : null;
const BREAKPOINTS = readBreakpoints(tokens);
const CONTRAST_MIN = readContrastThreshold(designMd);

// ── Find mockups ───────────────────────────────────────────────────────────
function findMockups(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findMockups(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
const mockups = findMockups(DESIGN_ROOT).filter(p => p.split(path.sep).includes('screens'));

if (mockups.length === 0) {
  skip('mockups', `no screen mockups under ${DESIGN_ROOT}/**/screens/`);
  report();
  process.exit(0);
}

// ── Half 1: token drift ────────────────────────────────────────────────────
// Flatten tokens.json into the CSS-variable names a mockup would generate.
// Accepts nested groups: {color:{primary:"#fff"}} -> --color-primary.
function flattenTokens(node, prefix = []) {
  const out = new Map();
  if (node === null || typeof node !== 'object') {
    out.set(`--${prefix.join('-')}`, String(node));
    return out;
  }
  if (Array.isArray(node)) return out;
  // A leaf may be {value: x} in Design Tokens format.
  if ('value' in node && typeof node.value !== 'object') {
    out.set(`--${prefix.join('-')}`, String(node.value));
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    for (const [kk, vv] of flattenTokens(v, [...prefix, k])) out.set(kk, vv);
  }
  return out;
}

const declared = tokens ? flattenTokens(tokens) : new Map();

function rootVars(html) {
  const out = new Map();
  // Every :root block in the file, not just the first.
  for (const block of html.matchAll(/:root\s*\{([^}]*)\}/g)) {
    // Split on ";" rather than matching declarations that end in one. The final
    // declaration in a block usually has no trailing semicolon, and a regex
    // requiring one drops it silently — the drift check then never sees the
    // last variable of every :root block.
    for (const chunk of block[1].split(';')) {
      const m = chunk.match(/(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+)/);
      if (m) out.set(m[1].trim(), m[2].trim());
    }
  }
  return out;
}

if (!tokens) {
  skip('token-drift', 'no tokens.json — nothing to compare mockups against');
} else if (declared.size === 0) {
  skip('token-drift', 'tokens.json declares no leaf values');
} else {
  for (const file of mockups) {
    const used = rootVars(fs.readFileSync(file, 'utf8'));
    if (used.size === 0) {
      fail('token-drift', `${file}: no :root CSS variables — mockup is not built from tokens.json`);
      continue;
    }
    let drift = 0;
    for (const [name, value] of used) {
      if (!declared.has(name)) {
        fail('token-drift', `${file}: ${name} is not in tokens.json`);
        drift++;
      } else if (norm(declared.get(name)) !== norm(value)) {
        fail('token-drift', `${file}: ${name} is "${value}", tokens.json says "${declared.get(name)}"`);
        drift++;
      }
    }
    if (drift === 0) pass('token-drift', `${file}: ${used.size} variables match tokens.json`);
  }
}
function norm(v) {
  return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Half 2: render checks ──────────────────────────────────────────────────
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
  skip('render', 'Playwright not installed — layout, state and contrast checks not run');
  report();
  process.exit(results.some(r => r.level === 'fail') ? 1 : 0);
}

// A browser that fails to launch must skip the check, never crash the review.
// The common cause is a Playwright package newer than the browsers on disk —
// "installed" and "runnable" are not the same state. DESIGN_CHECK_BROWSER lets
// a sandbox or CI point at a browser it already has instead of downloading one.
let browser;
try {
  const executablePath = process.env.DESIGN_CHECK_BROWSER || undefined;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
} catch (e) {
  skip('render', `browser would not launch — layout, state and contrast checks not run (${String(e.message).split('\n')[0]})`);
  report();
  process.exit(results.some(r => r.level === 'fail') ? 1 : 0);
}

try {
  for (const file of mockups) {
    const url = 'file://' + path.resolve(file);
    const html = fs.readFileSync(file, 'utf8');

    // States are read from the mockup itself — whatever it declares by calling
    // showState('x'). Nothing here names a state.
    const states = [...new Set([...html.matchAll(/showState\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]))];

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(String(e.message)));
    page.on('console', m => m.type() === 'error' && consoleErrors.push(m.text()));

    const widths = BREAKPOINTS.length ? BREAKPOINTS : [{ name: 'default', px: 1280 }];
    if (!BREAKPOINTS.length) {
      skip('overflow', `${file}: tokens.json declares no breakpoints — checked at the browser default only`);
    }

    for (const bp of widths) {
      await page.setViewportSize({ width: bp.px, height: 900 });
      await page.goto(url, { waitUntil: 'load' });

      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return { scroll: de.scrollWidth, client: de.clientWidth };
      });
      if (overflow.scroll > overflow.client + 1) {
        fail('overflow', `${file} @${bp.name} (${bp.px}px): content is ${overflow.scroll}px wide, viewport ${overflow.client}px`);
      } else {
        pass('overflow', `${file} @${bp.name} (${bp.px}px): no horizontal overflow`);
      }
    }

    await page.setViewportSize({ width: widths[widths.length - 1].px, height: 900 });
    await page.goto(url, { waitUntil: 'load' });

    if (consoleErrors.length) {
      fail('console', `${file}: ${consoleErrors.length} error(s) — first: ${consoleErrors[0]}`);
    } else {
      pass('console', `${file}: renders with no console error`);
    }

    // A declared state must actually change the DOM. A state switcher that
    // does nothing looks identical to one that works, in source.
    if (states.length === 0) {
      skip('states', `${file}: no showState() calls — mockup declares no switchable states`);
    } else {
      const seen = new Map();
      for (const s of states) {
        const snapshot = await page.evaluate(state => {
          if (typeof window.showState === 'function') window.showState(state);
          return document.body.innerHTML.length + '|' + document.body.innerText.slice(0, 400);
        }, s);
        seen.set(s, snapshot);
      }
      const distinct = new Set(seen.values());
      if (distinct.size === 1 && states.length > 1) {
        fail('states', `${file}: ${states.length} states declared (${states.join(', ')}) but all render identically`);
      } else {
        pass('states', `${file}: ${states.length} state(s), ${distinct.size} distinct rendering(s)`);
      }
    }

    // testids: unique, and each visible in at least one declared state.
    const ids = [...html.matchAll(/data-testid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
    if (ids.length === 0) {
      skip('testid', `${file}: no data-testid attributes`);
    } else {
      const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
      if (dupes.length) {
        fail('testid', `${file}: duplicate testid(s): ${[...new Set(dupes)].join(', ')}`);
      } else {
        pass('testid', `${file}: ${ids.length} testids, all unique`);
      }

      const statesToTry = states.length ? states : [null];
      const neverVisible = [];
      for (const id of new Set(ids)) {
        let visibleSomewhere = false;
        for (const s of statesToTry) {
          if (s) await page.evaluate(st => typeof window.showState === 'function' && window.showState(st), s);
          const vis = await page.evaluate(testid => {
            const el = document.querySelector(`[data-testid="${testid}"]`);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
          }, id);
          if (vis) { visibleSomewhere = true; break; }
        }
        if (!visibleSomewhere) neverVisible.push(id);
      }
      if (neverVisible.length) {
        fail('testid', `${file}: testid(s) never visible in any state: ${neverVisible.join(', ')} — QA will build selectors that cannot resolve`);
      } else {
        pass('testid', `${file}: every testid is visible in at least one state`);
      }
    }

    // Contrast, only against a ratio the project stated.
    if (CONTRAST_MIN === null) {
      skip('contrast', `${file}: DESIGN.md states no contrast ratio — not measured`);
    } else {
      const bad = await page.evaluate(min => {
        const lum = c => {
          const [r, g, b] = c.map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const parse = s => {
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1].split(',').map(x => parseFloat(x));
          if (p.length > 3 && p[3] === 0) return null; // fully transparent
          return [p[0], p[1], p[2]];
        };
        const bgOf = el => {
          let n = el;
          while (n && n !== document.documentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (c) return c;
            n = n.parentElement;
          }
          return [255, 255, 255];
        };
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          const text = (el.textContent || '').trim();
          if (!text || el.children.length > 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const fg = parse(getComputedStyle(el).color);
          if (!fg) continue;
          const bg = bgOf(el);
          const l1 = lum(fg), l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          if (ratio < min) {
            out.push({ text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100 });
          }
        }
        return out.slice(0, 5);
      }, CONTRAST_MIN);

      if (bad.length) {
        fail('contrast', `${file}: ${bad.length}+ text node(s) below ${CONTRAST_MIN}:1 — e.g. "${bad[0].text}" at ${bad[0].ratio}:1`);
      } else {
        pass('contrast', `${file}: all text meets the declared ${CONTRAST_MIN}:1`);
      }
    }

    // Screenshots for the judgment half — one per breakpoint per state.
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const base = path.basename(file, '.html');
      for (const bp of widths) {
        await page.setViewportSize({ width: bp.px, height: 900 });
        for (const s of states.length ? states : ['default']) {
          await page.evaluate(st => typeof window.showState === 'function' && window.showState(st), s);
          const out = path.join(SHOTS, `${base}-${bp.name}-${s}.png`);
          await page.screenshot({ path: out, fullPage: true });
        }
      }
      pass('screenshots', `${file}: captured to ${SHOTS}/`);
    }

    await page.close();
  }
} finally {
  await browser.close();
}

report();
process.exit(results.some(r => r.level === 'fail') ? 1 : 0);

function report() {
  if (AS_JSON) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }
  const f = results.filter(r => r.level === 'fail').length;
  const p = results.filter(r => r.level === 'pass').length;
  const s = results.filter(r => r.level === 'skip').length;
  for (const r of results) {
    const tag = r.level === 'fail' ? 'FAIL' : r.level === 'pass' ? 'ok  ' : '--  ';
    console.log(`  ${tag}  [${r.check}] ${r.message}`);
  }
  console.log(`\ndesign-check: ${p} passed, ${f} failed, ${s} skipped`);
}
