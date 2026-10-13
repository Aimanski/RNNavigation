// Auth

import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { TextInput } from "./AppText";
import { Colors, useTheme } from "../../providers/ThemeProvider";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  editable?: boolean;
};

export default function AuthField({
  icon,
  placeholder,
  value,
  onChangeText,
  secure = false,
  keyboardType,
  autoCapitalize = "none",
  autoCorrect = false,
  editable = true,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={[s.wrap, focused && s.wrapFocused, !editable && s.wrapDisabled]}>
      <Ionicons
        name={icon}
        size={20}
        color={focused ? colors.accent : colors.textMuted}
      />
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure && hidden}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {secure && (
        <Pressable
          onPress={() => setHidden((h) => !h)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Show password" : "Hide password"}
        >
          <Ionicons
            name={hidden ? "eye-outline" : "eye-off-outline"}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      width: "100%",
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 56,
      marginBottom: 14,
    },
    wrapFocused: { borderColor: c.accent },
    wrapDisabled: { opacity: 0.6 },
    input: { flex: 1, fontSize: 16, color: c.textPrimary, paddingVertical: 0 },
  });
