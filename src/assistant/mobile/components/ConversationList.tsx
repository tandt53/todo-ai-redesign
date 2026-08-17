// The conversation surface. Everything that is not one of the four states is a
// MESSAGE (F-001 Conversation model), and this component is the complete list
// of message renderings — it decides nothing, it draws what
// `_shared/model/messages.ts` already built.
//
// Which elements appear is `model/surface.ts`'s answer, not this file's: the
// same predicates back `expectedIds`, so the accessibility-id contract and the
// rendering cannot drift apart (F-003 AC-12).

import { ScrollView, Text, View } from 'react-native'
import { Pressable } from 'react-native'
import { Undo2 } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { formatClock } from '../../_shared/model/format.ts'
import type { DiffLine, Message } from '../../_shared/types.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { chipRole, showPermissionCta, showQueuedNotice, showRetry, showUndo } from '../model/surface.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'
import type { NewMessageFollow } from './useNewMessageFollow.ts'

function DiffRow({ line }: { line: DiffLine }) {
  const { styles } = useStyles()
  return (
    <View style={styles.diffRow}>
      <Text style={styles.diffTask}>{line.title}</Text>
      {line.chips.map((c, i) => (
        <View key={`${c.field}-${i}`} style={styles.diffRow}>
          {c.old !== null && (
            <Text {...a11yProps(A11Y_IDS.diffOld)} style={styles.chipOld}>
              {c.old}
            </Text>
          )}
          {c.old !== null && c.new !== null && <Text style={styles.miniLabel}>→</Text>}
          {c.new !== null && (
            <Text {...a11yProps(A11Y_IDS.diffNew)} style={styles.chipNew}>
              {c.new}
            </Text>
          )}
        </View>
      ))}
      {/* AC-4: diff and state are never colour-only — the text label rides
          every marker. */}
      <Text style={styles.miniLabel}>{line.label === 'new' ? 'NEW' : 'EDITED'}</Text>
    </View>
  )
}

function MessageView({
  m,
  undoableTurnId,
  controller,
  platform,
}: {
  m: Message
  undoableTurnId: string | null
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles, colors } = useStyles()
  const meta = formatClock(m.at)

  if (m.kind === 'user') {
    return (
      <View style={styles.msgUser}>
        <View style={[styles.bubble, styles.bubbleUser]}>
          <Text style={styles.bubbleText}>{m.text}</Text>
        </View>
        {showQueuedNotice(m) && (
          <View {...a11yProps(A11Y_IDS.queuedNotice)} style={styles.queuedNotice} accessible>
            <Text style={styles.queuedNoticeText}>Waiting for the network — will send again</Text>
          </View>
        )}
        <Text style={styles.msgMeta}>
          You · {meta}
          {m.via === 'voice' ? ' · voice' : ''}
        </Text>
      </View>
    )
  }

  if (m.kind === 'boundary') {
    // F-001 AC-28: exactly one marker per clean start.
    return (
      <View {...a11yProps(A11Y_IDS.boundaryMarker)} style={styles.boundary} accessible>
        <Text style={[styles.boundaryText, styles.bubbleHead]}>{m.head}</Text>
        {m.lines.map((line, i) => (
          <Text key={i} style={styles.boundaryText}>
            {line}
          </Text>
        ))}
      </View>
    )
  }

  const body = (() => {
    switch (m.kind) {
      case 'applied': {
        const undoTouch = touchProps(A11Y_IDS.undoButton, platform)
        return (
          <>
            <Text style={styles.bubbleHead}>{m.head}</Text>
            {m.lines.map((l, i) => (
              <DiffRow key={`${l.taskId}-${i}`} line={l} />
            ))}
            {m.deletedTitles.length > 0 && (
              <Text style={styles.bubbleText}>Deleted: {m.deletedTitles.join(', ')}.</Text>
            )}
            {showUndo(m, undoableTurnId) && (
              <Pressable
                {...a11yProps(A11Y_IDS.undoButton, { label: 'Undo', role: 'button' })}
                hitSlop={undoTouch.hitSlop}
                style={styles.undoButton}
                onPress={() => void controller.undoTap(m.turnId)}
              >
                <View style={styles.diffRow}>
                  <Undo2
                    size={tokens.icon.size.sm}
                    color={colors.primary}
                    strokeWidth={tokens.icon.stroke}
                  />
                  <Text style={styles.undoButtonText}>Undo</Text>
                </View>
              </Pressable>
            )}
            {m.undone && <Text style={styles.miniLabel}>Undone</Text>}
            {!m.undone && !showUndo(m, undoableTurnId) && m.mutated && (
              <Text style={styles.miniLabel}>Undo window passed</Text>
            )}
          </>
        )
      }
      case 'question': {
        return (
          <>
            <Text style={styles.bubbleHead}>{m.head}</Text>
            {m.body !== null && <Text style={styles.bubbleText}>{m.body}</Text>}
            <View style={styles.chips}>
              {m.options.map((opt, i) => {
                const role = chipRole(m.qkind, i)
                const id =
                  role === 'affirm'
                    ? A11Y_IDS.chipAffirm
                    : role === 'negative'
                      ? A11Y_IDS.chipNegative
                      : A11Y_IDS.optionChip
                const touch = touchProps(id, platform)
                return (
                  <Pressable
                    key={`${opt}-${i}`}
                    {...a11yProps(id, {
                      label: opt,
                      role: 'button',
                      state: { disabled: m.resolved },
                    })}
                    hitSlop={touch.hitSlop}
                    disabled={m.resolved}
                    style={[
                      styles.chip,
                      role === 'affirm' ? styles.chipDanger : null,
                      m.resolved ? styles.chipDisabled : null,
                    ]}
                    // AC-10/AC-13: the chip sends the option's LITERAL text.
                    onPress={() => void controller.chipTap(m.turnId, opt)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        role === 'affirm' ? styles.chipTextDanger : null,
                        m.resolved ? styles.chipTextDisabled : null,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        )
      }
      case 'error': {
        const touch = touchProps(A11Y_IDS.retryButton, platform)
        return (
          <>
            <Text style={[styles.bubbleHead, styles.bubbleHeadError]}>{m.head}</Text>
            {m.body.map((line, i) => (
              <Text key={i} style={styles.bubbleText}>
                {line}
              </Text>
            ))}
            {showRetry(m) && m.retryTurnId !== null && (
              <Pressable
                {...a11yProps(A11Y_IDS.retryButton, { label: 'Retry', role: 'button' })}
                hitSlop={touch.hitSlop}
                style={styles.primaryButton}
                onPress={() => void controller.retry(m.retryTurnId as string)}
              >
                <Text style={styles.primaryButtonText}>Retry</Text>
              </Pressable>
            )}
          </>
        )
      }
      case 'info': {
        const touch = touchProps(A11Y_IDS.permissionCta, platform)
        return (
          <>
            <Text style={styles.bubbleHead}>{m.head}</Text>
            {m.body.map((line, i) => (
              <Text key={i} style={styles.bubbleText}>
                {line}
              </Text>
            ))}
            {showPermissionCta(m) && (
              <Pressable
                {...a11yProps(A11Y_IDS.permissionCta, {
                  label: controller.permissionCtaLabel(),
                  role: 'button',
                })}
                hitSlop={touch.hitSlop}
                style={styles.primaryButton}
                onPress={() => controller.permissionCta()}
              >
                <Text style={styles.primaryButtonText}>{controller.permissionCtaLabel()}</Text>
              </Pressable>
            )}
          </>
        )
      }
      case 'reverted':
      case 'outcome':
        return (
          <>
            {m.head !== null && <Text style={styles.bubbleHead}>{m.head}</Text>}
            {m.body.map((line, i) => (
              <Text key={i} style={styles.bubbleText}>
                {line}
              </Text>
            ))}
          </>
        )
      case 'no-match':
        // F-001 AC-14: quote the heard transcript.
        return (
          <>
            <Text style={styles.bubbleText}>
              I heard “{m.heard}” — no task on the list matches that.
            </Text>
            <Text style={styles.bubbleText}>
              Nothing has changed. If I misheard, say it again or type it.
            </Text>
          </>
        )
      case 'unsupported':
        return (
          <>
            <Text style={styles.bubbleText}>
              I cannot answer questions about the list yet — nothing has changed.
            </Text>
            <Text style={styles.bubbleText}>Use {m.alternative} instead.</Text>
          </>
        )
    }
  })()

  const questionStyle = m.kind === 'question' ? styles.bubbleQuestion : null
  const errorStyle = m.kind === 'error' ? styles.bubbleError : null
  const undoneStyle = m.kind === 'applied' && m.undone ? styles.bubbleUndone : null

  return (
    <View style={styles.msgAi}>
      <View
        {...a11yProps(A11Y_IDS.messageBubble)}
        style={[styles.bubble, questionStyle, errorStyle, undoneStyle]}
      >
        {body}
      </View>
      <Text style={styles.msgMeta}>{meta}</Text>
    </View>
  )
}

export function ConversationList({
  state,
  controller,
  undoableTurnId,
  platform,
  scrollProps,
}: {
  state: AppState
  controller: MobileAssistantController
  undoableTurnId: string | null
  platform: MobilePlatform
  /** F-001 AC-30: the ref, `onScroll` and `onContentSizeChange` this list
   * rendered without until BUG-004 — supplied by `useNewMessageFollow`, which
   * owns the measurement and the decisions. Nothing here samples the viewport
   * itself; see that hook's header for why the (a) sample must be the
   * pre-append one. */
  scrollProps: NewMessageFollow['scrollProps']
}) {
  const { styles } = useStyles()
  return (
    <ScrollView
      {...scrollProps}
      style={styles.convPane}
      contentContainerStyle={styles.convContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* `components.md` § Message bubbles: the display line verbatim, then ONE
          muted hint line — the catalogue specifies exactly one, and "no
          fabricated sample messages", which is why the hint no longer demos an
          invented utterance. The hint's wording is not published; it is
          reported as a copy gap. */}
      {state.messages.length === 0 && (
        <View style={styles.invite}>
          <Text style={styles.inviteTitle}>Say it.{'\n'}I&#39;ll write it down.</Text>
          <Text style={styles.inviteBody}>
            Tap the mic and say what needs doing — typing works exactly the same.
          </Text>
        </View>
      )}
      {state.messages.map((m) => (
        <MessageView
          key={m.id}
          m={m}
          undoableTurnId={undoableTurnId}
          controller={controller}
          platform={platform}
        />
      ))}
    </ScrollView>
  )
}
