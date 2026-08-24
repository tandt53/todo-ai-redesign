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
import { installProbe } from '../../lib/probe.mjs';

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

// ── Half 1b: token-literal check ──────────────────────────────────────────
// A CSS variable named --color-* or --motion-* that holds a raw literal (#hex,
// rgb(), a bare number) instead of a value that exists in tokens.json.  This
// catches the defect class where a token is removed from tokens.json and its
// value reappears as a hardcoded literal in a client or mockup stylesheet.
//
// This check reads CSS files under src/ as well as mockup :root blocks — it is
// deliberately broader than the existing token-drift check, which only reads
// mockups.  The patterns it looks for:
//   --color-*  holding #hex or rgb()/rgba() that is not a tokens.json value
//   --motion-* holding a bare number that is not a tokens.json value
//
// Static — no browser required.

const tokenColorValues = new Set();
const tokenMotionValues = new Set();
if (tokens) {
  for (const [k, v] of declared) {
    const nv = norm(v);
    if (k.startsWith('--color')) tokenColorValues.add(nv);
    if (k.startsWith('--motion')) tokenMotionValues.add(nv);
  }
}

function findCssFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      out.push(...findCssFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

// Collect all CSS variable declarations from :root or top-level rule blocks
function cssVarDecls(cssText) {
  const out = [];
  // Match --variable: value patterns across the entire file (inside any rule)
  for (const m of cssText.matchAll(/(--(?:color|motion)[A-Za-z0-9_-]*)\s*:\s*([^;}\n]+)/g)) {
    out.push({ name: m[1].trim(), value: m[2].trim() });
  }
  return out;
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const RGB_RE = /^rgba?\(/;
const BARE_NUMBER_RE = /^[0-9]+(?:\.[0-9]+)?$/;

if (!tokens) {
  skip('token-literal', 'no tokens.json — cannot check for escaped literals');
} else {
  // Check CSS files under src/
  const srcCss = findCssFiles('src');
  // Also check mockup files (they may inline <style> with var decls)
  const allTargets = [...srcCss, ...mockups];
  let totalLiterals = 0;
  const literalFindings = [];

  for (const file of allTargets) {
    const content = fs.readFileSync(file, 'utf8');
    const decls = cssVarDecls(content);
    for (const { name, value } of decls) {
      const nv = norm(value);
      if (name.match(/--color/i)) {
        // A color variable holding a literal hex or rgb that is NOT in tokens
        if ((HEX_RE.test(value) || RGB_RE.test(value)) && !tokenColorValues.has(nv)) {
          totalLiterals++;
          if (literalFindings.length < 10) {
            literalFindings.push({ file, name, value });
          }
        }
      } else if (name.match(/--motion/i)) {
        // A motion variable holding a bare number not in tokens
        if (BARE_NUMBER_RE.test(value) && !tokenMotionValues.has(nv)) {
          totalLiterals++;
          if (literalFindings.length < 10) {
            literalFindings.push({ file, name, value });
          }
        }
      }
    }
  }

  if (totalLiterals > 0) {
    for (const f of literalFindings) {
      fail('token-literal', `${f.file}: ${f.name} holds literal "${f.value}" which is not in tokens.json`);
    }
    if (totalLiterals > literalFindings.length) {
      fail('token-literal', `… and ${totalLiterals - literalFindings.length} more literal(s) not shown`);
    }
  } else if (allTargets.length > 0) {
    pass('token-literal', `${allTargets.length} file(s) checked: no --color-* / --motion-* literals outside tokens.json`);
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
    // One definition of "visible", shared with every other probe in the project.
    // A hidden element measured as if it were on screen retracted a correct
    // finding once; the fix is not to re-type the filter carefully each time.
    await installProbe(page);
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
            return !!el && window.__probe.visible(el);
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

    // ── Check (a): adjacent painted grounds fusing ──────────────────────────
    // Two sibling elements within the app frame that both paint a
    // non-transparent background on their ::before pseudo must have at least
    // space.2 (8px) vertical gap between them.  This catches the "fused blob"
    // defect where two selected rows touch and read as one shape.
    //
    // Scope: only elements INSIDE .app (the mockup frame), so the dev toolbar
    // and stage wrappers are excluded.  Only checks ::before pseudo grounds,
    // which is how rows paint their hover/selected/focus backgrounds.
    {
      const spaceFloor = typeof (tokens?.space?.['2']) === 'string' ? parseInt(tokens.space['2']) : (tokens?.space?.['2'] ?? 8);
      const statesToCheck = states.length ? states : [null];
      let fusedPairs = 0;
      const fusedExamples = [];

      for (const s of statesToCheck) {
        if (s) await page.evaluate(st => typeof window.showState === 'function' && window.showState(st), s);

        const fused = await page.evaluate((floor) => {
          const appEl = document.querySelector('.app, [id="app"]');
          if (!appEl) return [];

          // Find elements inside the app whose ::before has a painted ground
          const painted = [];
          for (const el of appEl.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            // Check ::before pseudo background (the row ground pattern)
            const bcs = getComputedStyle(el, '::before');
            const bbg = bcs?.backgroundColor;
            const hasPseudoBg = bbg && bbg !== 'rgba(0, 0, 0, 0)' && bbg !== 'transparent';
            if (!hasPseudoBg) continue;
            // Verify the pseudo is actually rendered (has content)
            const bc = bcs?.content;
            if (!bc || bc === 'none') continue;

            // The painted ground is the pseudo, not the element.  If the
            // pseudo is position:absolute with top/bottom insets, the painted
            // area is smaller than the element's bounding box.  Compute the
            // pseudo's rendered vertical extent.
            let groundTop = r.top;
            let groundBottom = r.bottom;
            if (bcs.position === 'absolute') {
              const insetTop = parseFloat(bcs.top);
              const insetBottom = parseFloat(bcs.bottom);
              if (Number.isFinite(insetTop)) groundTop = r.top + insetTop;
              if (Number.isFinite(insetBottom)) groundBottom = r.bottom - insetBottom;
            }

            painted.push({ el, groundTop, groundBottom, cls: el.className || el.tagName });
          }

          // Group by parent and check adjacency
          const byParent = new Map();
          for (const p of painted) {
            if (!p.el.parentElement) continue;
            if (!byParent.has(p.el.parentElement)) byParent.set(p.el.parentElement, []);
            byParent.get(p.el.parentElement).push(p);
          }

          const results = [];
          for (const [parent, children] of byParent) {
            if (children.length < 2) continue;
            children.sort((a, b) => a.groundTop - b.groundTop);
            for (let i = 0; i < children.length - 1; i++) {
              const gap = children[i + 1].groundTop - children[i].groundBottom;
              // Flag when the gap between painted grounds is too small
              if (gap >= 0 && gap < floor) {
                results.push({
                  gap: Math.round(gap * 10) / 10,
                  a: children[i].cls,
                  b: children[i + 1].cls,
                });
              }
            }
          }
          return results.slice(0, 5);
        }, spaceFloor);

        if (fused.length > 0) {
          fusedPairs += fused.length;
          if (fusedExamples.length < 3) {
            fusedExamples.push(...fused.map(f => ({ ...f, state: s })));
          }
        }
      }

      if (fusedPairs > 0) {
        for (const ex of fusedExamples.slice(0, 3)) {
          fail('ground-fuse', `${file} state "${ex.state}": adjacent painted grounds gap ${ex.gap}px < ${spaceFloor}px (${ex.a} / ${ex.b})`);
        }
      } else {
        pass('ground-fuse', `${file}: no adjacent painted grounds fusing`);
      }
    }

    // ── Check (b): overlay container with no visible content ────────────
    // An overlay CONTAINER is an element that:
    //   1. covers a large area (position:fixed/absolute, inset:0 or similar)
    //   2. has a scrim background (semi-transparent)
    //   3. has children in the DOM (it wraps content, unlike a bare scrim div)
    //
    // The defect: the container is visible but none of its children render.
    // This catches the case where a confirm dialog's scrim draws and the
    // dialog itself does not — the scrim is part of the container, and the
    // dialog is a child that should be visible.
    //
    // A standalone scrim element with NO children (like <div class="scrim">)
    // is a deliberate dimming layer whose content is a SIBLING, and is
    // excluded from this check.
    {
      const statesToCheck = states.length ? states : [null];
      let emptyOverlays = 0;
      const emptyExamples = [];

      for (const s of statesToCheck) {
        if (s) await page.evaluate(st => typeof window.showState === 'function' && window.showState(st), s);

        const empty = await page.evaluate(() => {
          const results = [];
          // Look for overlay containers: elements with scrim background that
          // HAVE children (i.e. they wrap content, not just dim).
          for (const el of document.querySelectorAll('*')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            // Must be full-screen-ish (position fixed/absolute)
            if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
            const r = el.getBoundingClientRect();
            if (r.width < 200 || r.height < 200) continue;

            // Must have a scrim-like background (semi-transparent or opaque)
            const bg = cs.backgroundColor;
            if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;

            // Must have DOM children — a bare <div class="scrim"></div> with
            // zero children is a deliberate dimming backdrop, not a container
            if (el.children.length === 0) continue;

            // Now check: does any child actually render visible content?
            let hasVisibleChild = false;
            for (const child of el.querySelectorAll('*')) {
              const cr = child.getBoundingClientRect();
              if (cr.width === 0 || cr.height === 0) continue;
              const ccs = getComputedStyle(child);
              if (ccs.display === 'none' || ccs.visibility === 'hidden') continue;
              // Leaf text node with content
              const text = (child.textContent || '').trim();
              if (text && child.children.length === 0) {
                hasVisibleChild = true;
                break;
              }
              // Interactive element
              if (child.matches('button, input, select, textarea, img, svg, [role="dialog"]')) {
                hasVisibleChild = true;
                break;
              }
            }

            if (!hasVisibleChild) {
              results.push({
                selector: el.className || el.tagName,
                childCount: el.children.length,
              });
            }
          }
          return results.slice(0, 5);
        });

        if (empty.length > 0) {
          emptyOverlays += empty.length;
          for (const ex of empty) {
            if (emptyExamples.length < 5) {
              emptyExamples.push({ ...ex, state: s });
            }
          }
        }
      }

      if (emptyOverlays > 0) {
        for (const ex of emptyExamples) {
          fail('empty-overlay', `${file} state "${ex.state}": overlay ".${ex.selector}" (${ex.childCount} children) renders scrim with no visible content inside`);
        }
      } else {
        pass('empty-overlay', `${file}: no overlay containers render with empty content`);
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
