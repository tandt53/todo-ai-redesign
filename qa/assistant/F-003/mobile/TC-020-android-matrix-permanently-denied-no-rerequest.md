# TC-020: Android permission matrix row 3/3 — permanently denied → must NOT re-request; CTA goes to App info → Permissions

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-020 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-3, F-001 AC-21 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | android |
| Tier | node-headless (no-re-request assertion) + device-lab (App info deep link) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Android's permanently-denied state is a **distinct path**, not a harder denial. The OS will not show the prompt again, so activating the dimmed mic must not re-request — a request that Android silently drops looks to the user like a broken button. The CTA sends the user to App info → Permissions and the message says the grant has to be made there.

## Preconditions
- Account `qamob-tc020@qa.example.com`; `client.permission_state = {microphone: permanently_denied}`; request spy installed.

## Test steps
1. Open the surface; read the mic mode and message.
2. Activate the dimmed mic. Read the spy.
3. Read the CTA and its target.
4. Type and send a turn.
5. Simulate the user granting in system settings and returning to foreground; read the mic mode.

## Expected behaviour
- Mic is **dimmed** (present, non-capturing).
- Step 2: the spy records **zero** permission requests. This is the assertion that separates this row from TC-019 and it must fail if the implementation re-requests.
- `assistant-permission-cta` is present, targets App info → Permissions (mockup label `Mở cài đặt ứng dụng`), and the message says the grant has to be made there (`Bật trong Thông tin ứng dụng → Quyền là micro sáng lại ngay.`).
- Typing fully works.
- Step 5: the foreground transition re-reads the permission state and the mic returns to available — the user must not have to restart the app after granting in Settings.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc020@qa.example.com |
| matrix row | `PM-AND-3` |

## Notes
Step 5 couples this row to AC-8: permission state is re-read on foreground, exactly like the session read. A client that caches permission state at launch fails here even though every other row passes.
