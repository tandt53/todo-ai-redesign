// Shared measurement probe for anything that inspects a rendered page.
//
// Two defects motivated this, both from one session, and neither errored.
//
// A probe read `.row-due,.row-time` to compare time formats. `.row-time` is
// `display:none` and holds the full-format string, so a hidden element was
// measured — and a CORRECT finding was retracted on the strength of it. The
// number looked fine. Nothing was there to say the element could not be seen.
//
// Then six sweeps were written to find visual defects. All six returned nothing
// and all six were wrong: predicates guessed at class names the codebase does
// not use, at markup shapes that do not occur, at off-canvas content read as
// clipping. Six zeroes were reported as six clean bills of health.
//
// So this module does two things, and the second matters more:
//
//   1. One definition of "visible", used by every probe instead of retyped.
//   2. A sweep cannot report CLEAN unless it has proved it can find something.
//      Zero hits and no canary is INCONCLUSIVE — which is what six zeroes
//      actually were.
//
// Usage with Playwright:
//
//   import { installProbe } from '../lib/probe.mjs';
//   await installProbe(page);
//   const r = await page.evaluate(() => window.__probe.sweep({
//     name: 'rows clipped by the pinned bar',
//     selector: '.row',
//     test: el => el.getBoundingClientRect().bottom > barTop,
//     canary: () => {                       // must be findable by the same test
//       const el = document.createElement('div');
//       el.className = 'row';
//       el.style.cssText = 'position:fixed;top:99999px;height:10px';
//       document.body.appendChild(el);
//       return el;
//     },
//   }));

export const PROBE_SOURCE = String.raw`
(() => {
  const reasonHidden = (el) => {
    if (!el || !el.isConnected) return 'detached';
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return 'display:none';
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return 'visibility:' + cs.visibility;
    if (parseFloat(cs.opacity) === 0) return 'opacity:0';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 'zero box';
    return null;
  };

  // Deliberately NOT part of the definition: being outside the viewport. A
  // panel parked off-canvas is visible content that happens to be elsewhere,
  // and treating it as hidden is how off-canvas markup got reported as
  // clipping. If a probe cares about position, it must say so itself.
  const visible = (el) => reasonHidden(el) === null;

  const all = (selector, root) =>
    Array.from((root || document).querySelectorAll(selector)).filter(visible);

  // What was excluded and why. A probe returning nothing should be able to say
  // whether its selector matched hidden things or matched nothing at all.
  const excluded = (selector, root) =>
    Array.from((root || document).querySelectorAll(selector))
      .map(el => ({ el, why: reasonHidden(el) }))
      .filter(x => x.why !== null);

  const describe = (el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className || null,
      testid: el.getAttribute && el.getAttribute('data-testid'),
      text: (el.textContent || '').trim().slice(0, 60),
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
  };

  // sweep({name, selector, test, canary}) -> {name, verdict, hits, ...}
  //
  // verdict:
  //   found         the test matched something real
  //   clean         nothing matched, AND the canary proved the sweep can match
  //   inconclusive  nothing matched and nothing proved it could
  //
  // A sweep with no canary can never return clean. That is the whole point: a
  // predicate written against markup that does not exist returns zero forever,
  // and zero reads like good news.
  const sweep = ({ name, selector, test, canary }) => {
    const candidates = all(selector);
    const hits = candidates.filter(el => { try { return !!test(el); } catch { return false; } });

    if (hits.length > 0) {
      return {
        name, verdict: 'found', hits: hits.length,
        examples: hits.slice(0, 5).map(describe),
        candidates: candidates.length,
      };
    }

    if (typeof canary !== 'function') {
      return {
        name, verdict: 'inconclusive', hits: 0, candidates: candidates.length,
        excluded: excluded(selector).length,
        why: 'no canary: a zero from an unproven predicate is not evidence of absence',
      };
    }

    let planted = null, found = false;
    try {
      planted = canary();
      found = !!(planted && visible(planted) && test(planted));
    } catch {
      found = false;
    } finally {
      if (planted && planted.remove) planted.remove();
    }

    return {
      name,
      verdict: found ? 'clean' : 'inconclusive',
      hits: 0,
      candidates: candidates.length,
      excluded: excluded(selector).length,
      why: found
        ? null
        : 'the canary was not detected — this predicate cannot find what it claims to look for',
    };
  };

  window.__probe = { visible, reasonHidden, all, excluded, describe, sweep };
})();
`;

/** Install the probe into every document the page loads. */
export async function installProbe(page) {
  await page.addInitScript(PROBE_SOURCE);
}
