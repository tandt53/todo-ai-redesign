// The permission machine — F-003 AC-2 (iOS), AC-3 (Android), AC-4 (offline /
// missing language pack). Pure TS, node-testable: it maps the OS-reported
// permission surface onto the ONE mic-mode vocabulary the shared reducer
// already renders (`SpeechCapability` → `micMode`), so a denied grant on a
// phone dims exactly the same mic the browser dims (F-001 AC-21).
//
// Two platform facts drive everything here and are the reason this file exists
// at all:
//   iOS      needs TWO grants — microphone AND speech recognition — and the OS
//            never re-shows either dialog once the user has answered it.
//   Android  needs ONE grant (RECORD_AUDIO) and distinguishes a first denial
//            (askable again) from a permanent one (the OS will not show the
//            prompt again, ever). Asking again in that state is a no-op the
//            user experiences as a dead button, which is why `ctaTarget`
//            exists: the CTA must route to app settings instead.
//
// Nothing here reads the network. Being offline does not dim the mic (AC-4):
// on-device recognition may still work, so connectivity is not an input.

import type { PermissionState, PermissionStatus } from '../../_shared/model/client-stores.ts'
import type { SpeechCapability } from '../../_shared/ports/transcript-source.ts'
import type { NewMsg } from '../../_shared/model/messages.ts'

export type MobilePlatform = 'ios' | 'android'

/** The permission slots this app can require. `speech_recognition` is iOS-only
 * (Android folds recognition into RECORD_AUDIO). */
export type Grant = 'microphone' | 'speech_recognition'

export interface CaptureSignals {
  platform: MobilePlatform
  permissions: PermissionState
  /** false = this device has no recognizer at all → mic HIDDEN (F-001 AC-20) */
  recognizerAvailable: boolean
  /** false = recognizer present but no pack for the interface language →
   * TRANSIENT, dimmed with a stated cause (F-001 AC-22, F-003 AC-4) */
  languagePackAvailable: boolean
}

/** iOS requires both grants before the first talk attempt; Android one. */
export function requiredGrants(platform: MobilePlatform): Grant[] {
  return platform === 'ios' ? ['microphone', 'speech_recognition'] : ['microphone']
}

export function statusOf(perms: PermissionState, grant: Grant): PermissionStatus {
  if (grant === 'microphone') return perms.microphone
  return perms.speech_recognition ?? 'undetermined'
}

/** Grants that are actually refused. `undetermined` is NOT missing: permission
 * is requested at the first talk attempt, never at app open (F-001 AC-21), so
 * an app that has not asked yet still shows a normal, undimmed mic. */
export function deniedGrants(platform: MobilePlatform, perms: PermissionState): Grant[] {
  return requiredGrants(platform).filter((g) => {
    const s = statusOf(perms, g)
    return s === 'denied' || s === 'permanently_denied'
  })
}

export function allGranted(platform: MobilePlatform, perms: PermissionState): boolean {
  return requiredGrants(platform).every((g) => statusOf(perms, g) === 'granted')
}

/**
 * The single mapping from OS state → the mic mode the shared reducer renders.
 * Precedence is deliberate and ordered by how permanent the cause is:
 *
 *   no recognizer      → 'none'              mic hidden, no error (F-001 AC-20)
 *   any grant refused  → 'permission-denied' mic dimmed + slash (AC-2 / AC-3)
 *   no language pack   → 'transient-failure' mic dimmed, stated cause (AC-4)
 *   otherwise          → 'available'
 *
 * A partial denial on iOS ("either one denied") lands in the same bucket as a
 * full one: AC-2 says **any** partial denial produces the dimmed mic, not a
 * hidden one, and the message names which capability is missing.
 */
export function speechCapabilityFrom(sig: CaptureSignals): SpeechCapability {
  if (!sig.recognizerAvailable) return 'none'
  if (deniedGrants(sig.platform, sig.permissions).length > 0) return 'permission-denied'
  if (!sig.languagePackAvailable) return 'transient-failure'
  return 'available'
}

/**
 * May the app still put an OS dialog on screen?
 *
 * Android: `undetermined` (never asked) and `denied` (asked once, refused,
 * not permanent) are both askable — AC-3 explicitly allows re-requesting on
 * the next talk attempt. `permanently_denied` is not: the OS will never show
 * the prompt again.
 *
 * iOS: only `undetermined`. Once the user has answered either dialog, iOS
 * records the decision and `requestAuthorization` returns it without showing
 * anything — a "request" would be an invisible no-op, so AC-2 routes the user
 * to Settings instead.
 */
export function canRequest(platform: MobilePlatform, perms: PermissionState): boolean {
  const required = requiredGrants(platform)
  if (platform === 'ios') return required.some((g) => statusOf(perms, g) === 'undetermined')
  return required.some((g) => {
    const s = statusOf(perms, g)
    return s === 'undetermined' || s === 'denied'
  })
}

/** What activating the dimmed mic (or its CTA) must do. `null` = nothing to
 * do; the mic is not in a permission-blocked mode. */
export function ctaTarget(
  platform: MobilePlatform,
  perms: PermissionState,
): 'request' | 'settings' | null {
  if (deniedGrants(platform, perms).length === 0) return null
  // iOS: ANY denial routes to Settings, and this deliberately does NOT ask
  // `canRequest`. In the mic-denied · speech-undetermined tuple iOS would still
  // show the speech dialog, so "is some grant still askable" is true and yields
  // the wrong button (catalogue § CTA). Speech recognition is inert without the
  // microphone: prompting for it changes nothing the user can perceive and
  // spends iOS's one remaining dialog on the wrong question. Settings is the
  // only action that restores the feature.
  if (platform === 'ios') return 'settings'
  return canRequest(platform, perms) ? 'request' : 'settings'
}

// ---------------------------------------------------------------------------
// Copy — NOT owned by this file.
//
// Every string below is quoted verbatim from the catalogue at
// `design/_shared/components.md` § MicControl → "Permission copy — the seven
// combinations", cited by its row ID. Design owns the strings; this file owns
// only the SELECTION — which permission tuple maps to which row, combinatorics
// driven by AC-2 / AC-3 rather than by wording.
//
// The rule that keeps that split real: nothing here may derive a body. An
// earlier version interpolated the two iOS partial-denial rows from a template
// over the grant labels, which produced the right sentence and the wrong
// ownership — copy that is computed is copy design cannot change without
// editing this file. Each row is now a literal, so a wording change is a
// catalogue edit plus a byte-for-byte transcription, and a combination with no
// row is a missing branch here instead of a sentence this file invented.
// ---------------------------------------------------------------------------

/** The catalogue's row IDs. Not a local vocabulary — these are design's. */
export type PermissionCopyRow =
  | 'IOS-ASK'
  | 'IOS-MIC'
  | 'IOS-MIC-UNASKED'
  | 'IOS-SPEECH'
  | 'IOS-BOTH'
  | 'AND-ASK'
  | 'AND-DENIED'
  | 'AND-PERMANENT'

interface CopyRow {
  head: string
  /** Line 1 is the row's Body column; line 2 is the fixed closer the catalogue
   * states above the table (typing is unaffected in EVERY combination, AC-2:
   * denial rows close on one sentence, request rows on the other). */
  body: [string, string]
  /** The row's CTA label, or null where the row has none. */
  cta: string | null
}

const DENIAL_CLOSER = 'Gõ tay vẫn dùng bình thường.'
const REQUEST_CLOSER = 'Gõ tay vẫn dùng bình thường nếu bạn không muốn cấp quyền.'

const CATALOGUE: Record<PermissionCopyRow, CopyRow> = {
  'IOS-ASK': {
    head: 'Xin phép dùng micro',
    body: [
      'todo-ai cần quyền Micro và Nhận dạng giọng nói để nghe và ghi lại lời bạn nói. Lời nói được chuyển thành chữ ngay trên máy.',
      REQUEST_CLOSER,
    ],
    cta: null,
  },
  'IOS-MIC': {
    head: 'Micro cần quyền truy cập',
    body: [
      'Quyền Micro đang tắt (Nhận dạng giọng nói đã được cho phép). Bật Micro trong Cài đặt là micro sáng lại ngay.',
      DENIAL_CLOSER,
    ],
    cta: 'Mở Cài đặt',
  },
  // The one row that deliberately does NOT close on "là micro sáng lại ngay":
  // enabling the microphone alone does not restore the feature here, so the row
  // promises the remaining question instead — which is what actually happens on
  // the next talk attempt.
  'IOS-MIC-UNASKED': {
    head: 'Micro cần quyền truy cập',
    body: [
      'Quyền Micro đang tắt — không có micro thì không nghe được gì, nên todo-ai chưa hỏi đến Nhận dạng giọng nói. Bật Micro trong Cài đặt, lần nói tiếp theo sẽ hỏi nốt quyền còn lại.',
      DENIAL_CLOSER,
    ],
    cta: 'Mở Cài đặt',
  },
  'IOS-SPEECH': {
    head: 'Micro cần quyền truy cập',
    body: [
      'Quyền Nhận dạng giọng nói đang tắt (Micro đã được cho phép). Bật Nhận dạng giọng nói trong Cài đặt là micro sáng lại ngay.',
      DENIAL_CLOSER,
    ],
    cta: 'Mở Cài đặt',
  },
  'IOS-BOTH': {
    head: 'Micro cần quyền truy cập',
    body: [
      'Cả quyền Micro và Nhận dạng giọng nói đều đang tắt. Bật cả hai trong Cài đặt là micro sáng lại ngay.',
      DENIAL_CLOSER,
    ],
    cta: 'Mở Cài đặt',
  },
  'AND-ASK': {
    head: 'Xin phép dùng micro',
    body: [
      'todo-ai cần quyền Micro để nghe và ghi lại lời bạn nói. Lời nói được chuyển thành chữ ngay trên máy.',
      REQUEST_CLOSER,
    ],
    cta: null,
  },
  'AND-DENIED': {
    head: 'Micro cần quyền truy cập',
    body: [
      'Quyền Micro của todo-ai đang tắt. Chạm “Cấp quyền micro” rồi chọn Cho phép là micro sáng lại ngay.',
      DENIAL_CLOSER,
    ],
    cta: 'Cấp quyền micro',
  },
  'AND-PERMANENT': {
    head: 'Micro cần quyền truy cập',
    body: [
      'Quyền Micro của todo-ai đang tắt và Android sẽ không hỏi lại nữa. Bật trong Thông tin ứng dụng → Quyền là micro sáng lại ngay.',
      DENIAL_CLOSER,
    ],
    cta: 'Mở cài đặt ứng dụng',
  },
}

/** Read a row as design published it. Exported so tests can hold the selection
 * and the catalogue to each other without re-typing either. */
export function permissionCopyRow(id: PermissionCopyRow): CopyRow {
  return CATALOGUE[id]
}

/** SELECTION — the ask rows. One message covering every grant the platform
 * requires, at the first talk attempt, never at app open (AC-2 / F-001 AC-21). */
export function explanationRowFor(platform: MobilePlatform): PermissionCopyRow {
  return platform === 'ios' ? 'IOS-ASK' : 'AND-ASK'
}

/**
 * SELECTION — the denial rows. Keyed on the FULL TUPLE, never on the denied set
 * alone: `denied` and `undetermined` are different facts and the copy
 * distinguishes them (catalogue § Selection key).
 *
 * `null` means no message at all. A tuple with nothing denied is not a failure
 * — mic `granted` · speech `undetermined` is the normal mid-flow state between
 * the two dialogs, and `undetermined` is never "missing" (permission is asked
 * at the first talk attempt, never at app open — F-001 AC-21).
 *
 * Android has one grant, so its split is the one AC-3 draws: will the OS still
 * prompt, or never again.
 */
export function deniedRowFor(
  platform: MobilePlatform,
  perms: PermissionState,
): PermissionCopyRow | null {
  if (deniedGrants(platform, perms).length === 0) return null
  if (platform === 'android') {
    return statusOf(perms, 'microphone') === 'permanently_denied' ? 'AND-PERMANENT' : 'AND-DENIED'
  }
  const mic = statusOf(perms, 'microphone')
  const speech = statusOf(perms, 'speech_recognition')
  const refused = (s: PermissionStatus): boolean => s === 'denied' || s === 'permanently_denied'
  if (refused(mic) && refused(speech)) return 'IOS-BOTH'
  if (refused(mic)) {
    // Mic refused, speech not: either the speech dialog was answered (IOS-MIC)
    // or it was never reached, because the mic refusal ended the sequence.
    return speech === 'granted' ? 'IOS-MIC' : 'IOS-MIC-UNASKED'
  }
  // Speech refused, mic not. `granted` is IOS-SPEECH; mic `undetermined` cannot
  // occur while the mic dialog precedes the speech one (catalogue § Selection
  // key: "speech cannot be answered before the mic dialog it precedes"), and
  // IOS-BOTH is the only row that would claim no grant the user never gave.
  return mic === 'granted' ? 'IOS-SPEECH' : 'IOS-BOTH'
}

function messageFrom(row: PermissionCopyRow, at: string, cta: 'permission' | null): NewMsg {
  const copy = CATALOGUE[row]
  return { kind: 'info', head: copy.head, body: [...copy.body], cta, at }
}

/** The one short explanation shown before the first request — covering BOTH
 * grants on iOS, in one message, at the first talk attempt (AC-2 / F-001
 * AC-21). Never shown at app open. */
export function permissionExplanationMessage(platform: MobilePlatform, at: string): NewMsg {
  return messageFrom(explanationRowFor(platform), at, null)
}

/**
 * The dimmed-mic guidance message (F-001 AC-21's mobile face). Carries the
 * `permission` CTA, which the catalogue renders as `assistant-permission-cta`;
 * `ctaTarget` decides whether that button re-requests or opens settings.
 *
 * `null` when nothing is denied — see `deniedRowFor`. Callers must not render a
 * denial for a tuple that has none.
 */
export function permissionDeniedMessageFor(
  platform: MobilePlatform,
  perms: PermissionState,
  at: string,
): NewMsg | null {
  const row = deniedRowFor(platform, perms)
  return row === null ? null : messageFrom(row, at, 'permission')
}

/**
 * Label for `assistant-permission-cta` — "open settings" vs "ask again" are
 * different promises, so they never share wording (AC-3).
 *
 * The label follows `ctaTarget`, not the row, so the button always says what it
 * is about to do — and with iOS routing every denial to Settings the two now
 * agree on every published row, which a test pins against the catalogue.
 */
export function permissionCtaLabel(platform: MobilePlatform, perms: PermissionState): string {
  // The rows these three labels are read from are the rows they belong to:
  // "Cấp quyền micro" exists only on AND-DENIED (the one row where the OS will
  // still prompt), and the two settings labels on their platforms' rows.
  if (ctaTarget(platform, perms) === 'request') return ctaOf('AND-DENIED')
  return platform === 'ios' ? ctaOf('IOS-BOTH') : ctaOf('AND-PERMANENT')
}

function ctaOf(row: PermissionCopyRow): string {
  const label = CATALOGUE[row].cta
  if (label === null) throw new Error(`catalogue row ${row} publishes no CTA label`)
  return label
}

/**
 * The transient message for a recognizer with no pack for the interface
 * language (AC-4's explicit carve-out: transient, not no-capability).
 *
 * Same ownership, same catalogue: the adjacent row published directly below the
 * table ("Chưa có gói ngôn ngữ cho giọng nói"). It is deliberately not one of
 * the rows — it is not a permission combination — so design left it unnamed and
 * this file does not mint an ID for it.
 */
export function languagePackMessage(at: string): NewMsg {
  return {
    kind: 'info',
    head: 'Chưa có gói ngôn ngữ cho giọng nói',
    body: [
      'Máy có nhận dạng giọng nói nhưng chưa tải gói tiếng Việt, nên tạm thời chưa nghe được. Tải gói trong cài đặt hệ thống là micro sáng lại.',
      DENIAL_CLOSER,
    ],
    cta: null,
    at,
  }
}

// ---------------------------------------------------------------------------
// RESOLVED — the mic-denied · speech-undetermined tuple (was an open question)
//
// Design ruled it a row rather than a state to design away: IOS-MIC-UNASKED.
// The reasoning is worth keeping, because it is the reason `ctaTarget` above
// looks like it contradicts `canRequest` and does not.
//
// iOS asks for the microphone first and this client stops there when it is
// refused — spending the one dialog iOS has left on speech recognition, which
// is inert without a microphone, would change nothing the user can perceive.
// So the tuple is a legitimate resting state and gets copy, and the row's body
// deliberately breaks the other rows' "là micro sáng lại ngay" ending: enabling
// the microphone alone does not restore the feature, so the row promises the
// remaining question instead, which is what the next talk attempt does.
//
// Two consequences are already implemented above, and both are selection, not
// copy: `ctaTarget` returns 'settings' for ANY iOS denial (never derived from
// "is some grant still askable", which is true here and yields a button
// promising the wrong prompt), and `deniedRowFor` keys on the full tuple so
// `denied` and `undetermined` stay different facts.
//
// One phrasing question is still open upstream and does NOT change this file:
// AC-2's "Both are requested before the first talk attempt" reads as though the
// flow must always resolve both grants, which the early exit correctly does
// not. spec-agent is clarifying the wording; the behaviour is the ruled one.
// ---------------------------------------------------------------------------
