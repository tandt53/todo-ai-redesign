/**
 * QA Toast & Alert Interceptor
 * ─────────────────────────────
 * Injected on every page via playwright-cli initScript.
 * Passively watches for ephemeral UI feedback using 3 strategies:
 *   1. ARIA roles (framework-agnostic, most reliable)
 *   2. Ephemeral DOM nodes (appears + disappears within 6s = notification)
 *   3. Console errors (catches silent failures)
 *
 * No knowledge of CSS classes or UI framework required.
 * Results stored in window.__qaAlerts — read before navigating away.
 */

(function () {
  if (window.__qaInterceptorInstalled) return;
  window.__qaInterceptorInstalled = true;
  window.__qaAlerts = [];

  // ─── Helpers ────────────────────────────────────────────

  function getNodeText(node) {
    return (node.innerText || node.textContent || '').trim().slice(0, 300);
  }

  function getAriaRole(node) {
    return node.getAttribute?.('role') || '';
  }

  function getAriaLive(node) {
    return node.getAttribute?.('aria-live') || '';
  }

  function isEphemeralByStyle(node) {
    try {
      const style = window.getComputedStyle(node);
      const position = style.position;
      const zIndex = parseInt(style.zIndex) || 0;
      // Fixed/absolute + high z-index = likely overlay/toast
      return (position === 'fixed' || position === 'absolute') && zIndex > 100;
    } catch {
      return false;
    }
  }

  function classifyAlert(node, reason) {
    const text = getNodeText(node);
    if (!text || text.length < 2) return null;

    // Guess type from content and attributes
    const ariaRole = getAriaRole(node);
    const combined = (
      text +
      (node.className || '') +
      (node.getAttribute?.('data-type') || '') +
      (node.getAttribute?.('data-variant') || '') +
      ariaRole
    ).toLowerCase();

    let type = 'unknown';
    if (/error|danger|fail|invalid|wrong|incorrect/.test(combined)) type = 'error';
    else if (/success|saved|created|updated|done|complete|confirm/.test(combined)) type = 'success';
    else if (/warn|caution|attention/.test(combined)) type = 'warning';
    else if (/info|notice|tip|hint/.test(combined)) type = 'info';
    else if (ariaRole === 'alert') type = 'error'; // alerts default to error
    else if (ariaRole === 'status') type = 'info';

    return {
      text,
      type,
      reason,
      ariaRole: ariaRole || null,
      ariaLive: getAriaLive(node) || null,
      timestamp: new Date().toISOString()
    };
  }

  function recordAlert(alert) {
    if (!alert) return;
    // Deduplicate by text
    const exists = window.__qaAlerts.some(a => a.text === alert.text);
    if (!exists) {
      window.__qaAlerts.push(alert);
    }
  }

  // ─── Strategy 1: ARIA Roles ─────────────────────────────
  // role=alert, role=status, aria-live=assertive/polite
  // These are framework-agnostic and universally used for notifications

  const ARIA_ALERT_ROLES = new Set(['alert', 'status', 'alertdialog']);
  const ARIA_LIVE_VALUES = new Set(['assertive', 'polite']);

  function checkAriaNode(node) {
    if (node.nodeType !== 1) return;
    const role = getAriaRole(node);
    const live = getAriaLive(node);
    if (ARIA_ALERT_ROLES.has(role) || ARIA_LIVE_VALUES.has(live)) {
      const alert = classifyAlert(node, 'aria-role');
      recordAlert(alert);
    }
    // Also check children
    node.querySelectorAll?.('[role="alert"],[role="status"],[role="alertdialog"],[aria-live]')
      .forEach(child => {
        const alert = classifyAlert(child, 'aria-role');
        recordAlert(alert);
      });
  }

  // ─── Strategy 2: Ephemeral DOM nodes ────────────────────
  // Any node that appears AND disappears within 6 seconds
  // = almost certainly a toast/notification
  // No CSS class knowledge needed

  const appearedNodes = new Map(); // node → timestamp

  function onNodeAdded(node) {
    if (node.nodeType !== 1) return;
    const text = getNodeText(node);
    if (!text || text.length < 3) return;

    // Check ARIA immediately
    checkAriaNode(node);

    // Track appearance time for ephemeral detection
    if (isEphemeralByStyle(node) || getAriaRole(node)) {
      appearedNodes.set(node, Date.now());
    } else {
      // Still track any new node — check if it disappears fast
      appearedNodes.set(node, Date.now());
    }
  }

  function onNodeRemoved(node) {
    if (!appearedNodes.has(node)) return;
    const appearedAt = appearedNodes.get(node);
    const lifespan = Date.now() - appearedAt;
    appearedNodes.delete(node);

    // Appeared and disappeared within 6 seconds = ephemeral notification
    if (lifespan > 100 && lifespan < 6000) {
      const text = getNodeText(node);
      if (text && text.length > 2) {
        const alert = classifyAlert(node, 'ephemeral-dom');
        recordAlert(alert);
      }
    }
  }

  // ─── Strategy 3: Console errors ─────────────────────────
  // Catches silent failures where UI shows nothing but JS errors occur

  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);

  console.error = function (...args) {
    const message = args.map(a => String(a)).join(' ').trim().slice(0, 300);
    if (message) {
      recordAlert({
        text: message,
        type: 'error',
        reason: 'console-error',
        ariaRole: null,
        ariaLive: null,
        timestamp: new Date().toISOString()
      });
    }
    originalConsoleError(...args);
  };

  console.warn = function (...args) {
    const message = args.map(a => String(a)).join(' ').trim().slice(0, 300);
    if (message) {
      recordAlert({
        text: message,
        type: 'warning',
        reason: 'console-warn',
        ariaRole: null,
        ariaLive: null,
        timestamp: new Date().toISOString()
      });
    }
    originalConsoleWarn(...args);
  };

  // ─── MutationObserver ───────────────────────────────────
  // Watches the entire DOM for additions and removals

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(onNodeAdded);
      mutation.removedNodes.forEach(onNodeRemoved);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // ─── Also scan existing ARIA elements on load ───────────
  document.querySelectorAll('[role="alert"],[role="status"],[role="alertdialog"],[aria-live]')
    .forEach(node => checkAriaNode(node));

  // ─── Expose read + clear API ────────────────────────────

  window.__qaReadAlerts = function () {
    return JSON.stringify(window.__qaAlerts);
  };

  window.__qaClearAlerts = function () {
    window.__qaAlerts = [];
  };

  console.log('[QA Interceptor] Installed — watching for alerts, toasts, and errors');
})();
