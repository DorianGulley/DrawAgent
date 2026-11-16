import { ComponentRef, Ref, useState } from "react";
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { colors, fonts, radius, type } from "../theme";

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  mono?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function Field({ label, error, mono, containerStyle, style, onFocus, onBlur, ref, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, mono && styles.mono, focused && styles.focused, error ? styles.invalid : null, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...type.eyebrow, marginBottom: 8 },
  input: { minHeight: 50, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: colors.well, paddingHorizontal: 16, paddingVertical: 13, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, borderWidth: 2, borderColor: "transparent" },
  mono: { fontFamily: fonts.mono, fontSize: 14 },
  focused: { borderColor: colors.accent },
  invalid: { borderColor: colors.danger },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginTop: 6, marginLeft: 4 },
});
