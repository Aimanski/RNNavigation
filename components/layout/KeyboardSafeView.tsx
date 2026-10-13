// Keyboard
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  KeyboardAvoidingViewProps,
  Platform,
  StyleSheet,
  View,
} from "react-native";

// Keyboard
function AndroidKeyboardSafeView({
  style,
  children,
  behavior: _behavior,
  keyboardVerticalOffset: _offset,
  enabled: _enabled,
  contentContainerStyle: _contentStyle,
  ...rest
}: KeyboardAvoidingViewProps) {
  const ref = useRef<View>(null);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      ref.current?.measure((_x, _y, _w, height, _pageX, pageY) => {
        if (!Number.isFinite(pageY) || !Number.isFinite(height)) return;
        // Overlap
        const overlap = Math.max(0, pageY + height - e.endCoordinates.screenY);
        setLift(overlap);
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const basePadding = StyleSheet.flatten(style)?.paddingBottom;
  return (
    <View
      {...rest}
      ref={ref}
      collapsable={false}
      style={[style, { paddingBottom: (typeof basePadding === "number" ? basePadding : 0) + lift }]}
    >
      {children}
    </View>
  );
}

function IosKeyboardSafeView(props: KeyboardAvoidingViewProps) {
  return <KeyboardAvoidingView behavior="padding" {...props} />;
}

const KeyboardSafeView: (props: KeyboardAvoidingViewProps) => React.JSX.Element =
  Platform.OS === "android" ? AndroidKeyboardSafeView : IosKeyboardSafeView;

export default KeyboardSafeView;
