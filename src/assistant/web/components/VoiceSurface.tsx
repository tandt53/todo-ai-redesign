// The voice surface — the ONE place `gradient.voice` is legal (DESIGN.md
// colour rule 4). It exists only while the surface is listening or thinking,
// which is what makes AC-29's exclusivity observable: idle and error render
// no state indicator at all, so "at most one non-idle cue-set" holds by
// construction rather than by CSS.
//
// The Cancel pill is the AC-3 thinking-state cancel and is CLIENT-LOCAL:
// there is no cancel endpoint, the sent turn still runs to completion
// server-side, and its late outcome renders honestly as a message.

import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'

export function VoiceSurface({
  state,
  controller,
}: {
  state: AppState
  controller: AssistantController
}) {
  if (state.surface !== 'listening' && state.surface !== 'thinking') return null
  const listening = state.surface === 'listening'
  return (
    <div className="voice-surface">
      <div className="aurora-band" />
      <div className="state-indicator" data-testid="assistant-state-indicator" aria-live="polite">
        {listening ? (
          <span className="si-listening">
            <span className="waveform" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="state-word">Đang nghe…</span>
          </span>
        ) : (
          <span className="si-thinking">
            <span className="state-word">Đang xử lý…</span>
            <button
              className="cancel-btn"
              data-testid="assistant-cancel-button"
              aria-label="Hủy — lời bạn vừa nói vẫn còn trong ô nhập"
              onClick={() => controller.cancelThinking()}
            >
              Hủy
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
