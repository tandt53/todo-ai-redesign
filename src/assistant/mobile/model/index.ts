// The mobile model barrel — and a deliberate anticlimax.
//
// There is NO mobile conversation reducer. F-003 AC-1 (the parity contract)
// exists precisely to forbid one: a second reducer would be a second place for
// the four-state rule, the message vocabulary, the undo window and the dedupe
// rule to drift. The conversation model re-exported below is
// `src/assistant/_shared/model/` — the same module the web client imports, the
// same objects at runtime, not a copy.
//
// What IS mobile lives beside it: the permission machine, the lifecycle rules,
// the announcement builders, the accessibility catalogue, the touch targets,
// and the surface predicates. Those are the twelve ACs F-003 owns.
//
// Node-safe: nothing reachable from here imports `react-native`.

// ---- the shared conversation model (one source, two clients) ----
export {
  initialState,
  reducer,
  micMode,
  undoableTurnId,
} from '../../_shared/model/reducer.ts'
export type { Action, AppState } from '../../_shared/model/reducer.ts'
export * from '../../_shared/model/messages.ts'
export * from '../../_shared/model/format.ts'
export { ClientStores } from '../../_shared/model/client-stores.ts'
export type {
  OutgoingTurn,
  PendingInput,
  PermissionState,
  PermissionStatus,
} from '../../_shared/model/client-stores.ts'
export type * from '../../_shared/types.ts'

// ---- what the OS adds (F-003's own twelve ACs) ----
export * from './a11y.ts'
export * from './announce.ts'
export * from './lifecycle.ts'
export * from './permissions.ts'
export * from './surface.ts'
export * from './theme.ts'
export * from './touch.ts'
