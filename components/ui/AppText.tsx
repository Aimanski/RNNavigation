// Typography
import { createContext, forwardRef, useContext } from "react";
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
} from "react-native";
import { fontFamilyFor } from "../../lib/typography";

const InsideText = createContext(false);

export const Text = forwardRef<RNText, TextProps>(function Text({ style, children, ...rest }, ref) {
  const nested = useContext(InsideText);
  const flat = StyleSheet.flatten(style) || {};
  // Font
  const own = !flat.fontFamily && (!nested || flat.fontWeight !== undefined);
  return (
    <RNText
      ref={ref}
      {...rest}
      style={own ? [style, { fontFamily: fontFamilyFor(flat.fontWeight), fontWeight: "normal" }] : style}
    >
      <InsideText.Provider value={true}>{children}</InsideText.Provider>
    </RNText>
  );
});
export type Text = RNText;

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  const flat = StyleSheet.flatten(style) || {};
  return (
    <RNTextInput
      ref={ref}
      {...rest}
      style={
        flat.fontFamily ? style : [style, { fontFamily: fontFamilyFor(flat.fontWeight), fontWeight: "normal" }]
      }
    />
  );
});
export type TextInput = RNTextInput;
