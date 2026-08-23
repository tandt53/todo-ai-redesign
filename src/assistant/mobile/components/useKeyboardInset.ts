// Keyboard inset — the paddingBottom that keeps the composer above the
// software keyboard on both platforms.
//
// Why this replaces KeyboardAvoidingView: RN 0.86's KAV measures its own
// frame via `onLayout` (parent-relative coordinates) and compares against
// `keyboardFrame.screenY` (screen-absolute). Under Fabric + edge-to-edge
// the comparison is apples-to-oranges and the result is zero lift on both
// platforms. This hook uses the keyboard event's own height (always correct)
// and the safe-area bottom inset (from the context the shell already
// provides) to compute the overlap without measuring a View at all.
//
// iOS: `keyboardWillShow` / `keyboardWillHide` — the "will" variants fire
// before the animation so LayoutAnimation can match. The keyboard height
// includes the area below the safe area (home indicator), which SafeAreaView
// already pads, so we subtract `insets.bottom`.
//
// Android: `keyboardDidShow` / `keyboardDidHide`. With edge-to-edge +
// adjustResize, the system sends insets but ReactRootView does not always
// resize the flex tree correctly under Fabric. The keyboard height from the
// event includes the navigation bar area, so we subtract `insets.bottom`
// the same way.

import { useEffect, useState } from 'react'
import { Keyboard, LayoutAnimation, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Returns the `paddingBottom` (in dp/pt) needed to keep content above the
 *  software keyboard. Pair with a plain `<View style={{ flex: 1 }}>` where
 *  the old `KeyboardAvoidingView` was. */
export function useKeyboardInset(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const show = Keyboard.addListener(showEvent, (e) => {
      if (Platform.OS === 'ios' && e.duration) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { duration: e.duration, type: LayoutAnimation.Types.keyboard },
        })
      }
      setKeyboardHeight(e.endCoordinates.height)
    })

    const hide = Keyboard.addListener(hideEvent, (e) => {
      if (Platform.OS === 'ios' && e?.duration) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { duration: e.duration, type: LayoutAnimation.Types.keyboard },
        })
      }
      setKeyboardHeight(0)
    })

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  if (keyboardHeight === 0) return 0
  // The keyboard height includes the area below the safe area (home
  // indicator on iOS, navigation bar on Android). SafeAreaView already
  // accounts for that, so subtract it to avoid double-padding.
  return Math.max(0, keyboardHeight - insets.bottom)
}
