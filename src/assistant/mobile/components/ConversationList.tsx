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
      <Text style={styles.miniLabel}>{line.label === 'new' ? 'Mới' : 'Đã sửa'}</Text>
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
            <Text style={styles.queuedNoticeText}>Đang chờ mạng — sẽ gửi lại</Text>
          </View>
        )}
        <Text style={styles.msgMeta}>
          Bạn · {meta}
          {m.via === 'voice' ? ' · giọng nói' : ''}
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
              <Text style={styles.bubbleText}>Đã xóa: {m.deletedTitles.join(', ')}.</Text>
            )}
            {showUndo(m, undoableTurnId) && (
              <Pressable
                {...a11yProps(A11Y_IDS.undoButton, { label: 'Hoàn tác', role: 'button' })}
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
                  <Text style={styles.undoButtonText}>Hoàn tác</Text>
                </View>
              </Pressable>
            )}
            {m.undone && <Text style={styles.miniLabel}>Đã hoàn tác</Text>}
            {!m.undone && !showUndo(m, undoableTurnId) && m.mutated && (
              <Text style={styles.miniLabel}>Đã qua — không hoàn tác được nữa.</Text>
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
                {...a11yProps(A11Y_IDS.retryButton, { label: 'Thử lại', role: 'button' })}
                hitSlop={touch.hitSlop}
                style={styles.primaryButton}
                onPress={() => void controller.retry(m.retryTurnId as string)}
              >
                <Text style={styles.primaryButtonText}>Thử lại</Text>
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
              Tôi nghe được “{m.heard}” — không có việc nào trong danh sách khớp với câu đó.
            </Text>
            <Text style={styles.bubbleText}>
              Chưa có gì thay đổi. Nếu tôi nghe nhầm, bạn nói lại hoặc gõ vào giúp tôi nhé.
            </Text>
          </>
        )
      case 'unsupported':
        return (
          <>
            <Text style={styles.bubbleText}>
              Tôi chưa trả lời được câu hỏi về danh sách — chưa có gì thay đổi.
            </Text>
            <Text style={styles.bubbleText}>Bạn dùng {m.alternative} thay cho việc hỏi nhé.</Text>
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
}: {
  state: AppState
  controller: MobileAssistantController
  undoableTurnId: string | null
  platform: MobilePlatform
}) {
  const { styles } = useStyles()
  return (
    <ScrollView
      style={styles.convPane}
      contentContainerStyle={styles.convContent}
      keyboardShouldPersistTaps="handled"
    >
      {state.messages.length === 0 && (
        <View style={styles.invite}>
          <Text style={styles.inviteTitle}>Nói đi.{'\n'}Tôi ghi.</Text>
          <Text style={styles.inviteBody}>
            Chạm vào micro và thử nói “họp nhóm ngày mai lúc 2 giờ”.
          </Text>
          <Text style={styles.inviteBody}>Gõ chữ cũng dùng được y như vậy.</Text>
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
