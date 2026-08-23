// Keyboard inset — the paddingBottom that keeps the composer above the
// software keyboard.
//
// Why this replaces KeyboardAvoidingView: RN 0.86's KAV measures its own
// frame via `onLayout` (parent-relative coordinates) and compares against
// `keyboardFrame.screenY` (screen-absolute). Under Fabric the comparison
// is apples-to-oranges and the result is zero lift.
//
// iOS: `keyboardWillShow` / `keyboardWillHide` — the "will" variants fire
// before the animation so LayoutAnimation can match. The keyboard height
// includes the area below the safe area (home indicator), which SafeAreaView
// already pads, so we subtract `insets.bottom`.
//
// Android: `keyboardDidShow`'s `endCoordinates.height` reports only the key
// area, not the IME toolbar strip (Gboard, Samsung, etc). Using it lands
// the composer inside the toolbar. But `endCoordinates.screenY` is the
// visible-area bottom from `getWindowVisibleDisplayFrame`, which IS the
// keyboard's visual top including toolbar. So on Android the correct
// calculation is `(screenHeight - safeAreaBottom) - screenY` rather than
// `height - safeAreaBottom`.

import { useEffect, useState } from 'react'
import { Dimensions, Keyboard, LayoutAnimation, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Returns the `paddingBottom` (in dp/pt) needed to keep content above the
 *  software keyboard. Pair with a plain `<View style={{ flex: 1 }}>` where
 *  the old `KeyboardAvoidingView` was. */
export function useKeyboardInset(): number {
  const [keyboardInset, setKeyboardInset] = useState(0)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const show = Keyboard.addListener('keyboardWillShow', (e) => {
        if (e.duration) {
          LayoutAnimation.configureNext({
            duration: e.duration,
            update: { duration: e.duration, type: LayoutAnimation.Types.keyboard },
          })
        }
        // endCoordinates.height includes the home indicator area that
        // SafeAreaView already pads, so subtract insets.bottom.
        setKeyboardInset(Math.max(0, e.endCoordinates.height - insets.bottom))
      })
      const hide = Keyboard.addListener('keyboardWillHide', (e) => {
        if (e?.duration) {
          LayoutAnimation.configureNext({
            duration: e.duration,
            update: { duration: e.duration, type: LayoutAnimation.Types.keyboard },
          })
        }
        setKeyboardInset(0)
      })
      return () => { show.remove(); hide.remove() }
    }

    // Android: use screenY (visible-area bottom = keyboard visual top
    // including toolbar), not height (key area only).
    const screenHeight = Dimensions.get('screen').height
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const keyboardTop = e.endCoordinates.screenY
      const contentBottom = screenHeight - insets.bottom
      setKeyboardInset(Math.max(0, contentBottom - keyboardTop))
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardInset(0)
    })
    return () => { show.remove(); hide.remove() }
  }, [insets.bottom])

  return keyboardInset
}
