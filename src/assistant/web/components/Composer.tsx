// Composer — voice + text parity: typed input takes the same interpretation
// path as speech (AC-17). Never disabled: a pending question blocks nothing
// (AC-11), and offline the field still works through the local no-AI path
// (AC-25). components.md §Composer.
//
// The mic is a Radix Toggle so `aria-pressed` (4.1.2 name/role/value) and
// keyboard operation (2.1.1) come from the primitive rather than from
// hand-rolled ARIA. Its MODE is orthogonal to the four surface states
// (AC-20/21/22): hidden when there is no capability, dimmed on permission
// denial or transient failure — the message says which, the orb only dims.

import * as Toggle from '@radix-ui/react-toggle'
import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import { micMode } from '../../_shared/model/reducer.ts'
import { MicIcon, SendIcon } from './icons.tsx'

// Copy is English (ADR-008). docs/design/_shared/components.md §MicControl names the
// mic's accessible names and the composer placeholder verbatim; the mockup's
// state machine carries the dimmed-transient one.
const MIC_LABEL: Record<string, string> = {
  listening: 'Listening — tap to stop',
  'dimmed-permission': 'Microphone needs permission',
  'dimmed-transient': 'Microphone is temporarily unavailable',
  available: 'Tap to speak',
}

export function Composer({
  state,
  controller,
}: {
  state: AppState
  controller: AssistantController
}) {
  const mode = micMode(state)
  const listening = state.surface === 'listening'
  const canSend = state.composer.trim() !== '' && state.surface !== 'thinking'
  const micLabel = listening ? MIC_LABEL['listening'] : (MIC_LABEL[mode] ?? MIC_LABEL['available'])

  const submit = () => {
    if (!canSend) return
    void controller.send('typed')
  }

  return (
    <footer className="composer">
      <div className="composer-inner">
        <input
          className="composer-input"
          data-testid="assistant-composer-input"
          type="text"
          placeholder="Say or type what needs doing…"
          aria-label="Say or type what needs doing"
          value={state.composer}
          onChange={(e) => controller.composerChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        {mode !== 'hidden' && (
          <Toggle.Root
            className="mic"
            data-testid="assistant-mic-button"
            aria-label={micLabel}
            pressed={listening}
            onPressedChange={() => controller.tapMic()}
          >
            <MicIcon />
            {mode === 'dimmed-permission' && (
              <span className="mic-slash" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <line x1="14" y1="14" x2="38" y2="38" />
                </svg>
              </span>
            )}
          </Toggle.Root>
        )}
        <button
          className="send"
          data-testid="assistant-composer-send"
          aria-label="Send"
          aria-disabled={!canSend}
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>
    </footer>
  )
}
