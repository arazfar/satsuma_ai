import { ReactNode } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";

export const colors = {
  cream: "#FFF7EC",
  ink: "#302637",
  apricot: "#FF967D",
  lilac: "#CDBCF2",
  mint: "#B9DDC6",
  paper: "#FFFCF7",
  muted: "#716579",
  line: "#DFD3C9",
};

export function Action({
  children,
  onPress,
  disabled,
  secondary,
  testID,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[s.actionText, secondary && { color: colors.ink }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
export function Body({
  children,
  muted,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Text style={[s.body, muted && { color: colors.muted }]}>{children}</Text>
  );
}
export function ErrorNote({ text }: { text: string }) {
  return text ? (
    <Text accessibilityRole="alert" style={s.error}>
      {text}
    </Text>
  ) : null;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && {
            minHeight: Math.ceil(104 * fontScale),
            textAlignVertical: "top",
          },
          props.style,
        ]}
      />
    </View>
  );
}

export function Check({
  checked,
  onPress,
  label,
  testID,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={s.check}
    >
      <View style={[s.box, checked && { backgroundColor: colors.ink }]}>
        <Text style={{ color: colors.cream, fontSize: 17 }}>
          {checked ? "✓" : ""}
        </Text>
      </View>
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export function Portrait({
  name,
  uri,
  size = 68,
  onPress,
  fictional,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  onPress?: () => void;
  fictional?: boolean;
}) {
  const image = (
    <View
      style={[
        s.portrait,
        { width: size, height: size, borderRadius: size * 0.42 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityIgnoresInvertColors
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Text
          style={{
            fontSize: size * 0.37,
            color: colors.ink,
            fontWeight: "600",
          }}
        >
          {name.slice(0, 1).toUpperCase() || "Y"}
        </Text>
      )}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}'s profile${fictional ? ", fictional sample friend" : ""}`}
      onPress={onPress}
      style={{ minHeight: 44, minWidth: 44 }}
    >
      {image}
    </Pressable>
  ) : (
    image
  );
}

export function Paper({
  children,
  color = colors.paper,
  style,
  ticket,
}: {
  children: ReactNode;
  color?: string;
  style?: ViewStyle;
  ticket?: boolean;
}) {
  return (
    <View style={[s.paper, { backgroundColor: color }, style]}>
      {ticket ? (
        <>
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={[s.notch, { left: -10 }]}
          />
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={[s.notch, { right: -10 }]}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 32, gap: 24 },
  heading: {
    fontSize: 34,
    lineHeight: 41,
    color: colors.ink,
    fontWeight: "600",
    letterSpacing: -1.2,
  },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  label: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontWeight: "700",
    color: colors.muted,
  },
  action: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.ink,
  },
  actionText: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
    color: colors.cream,
    textAlign: "center",
  },
  paper: { padding: 22, borderRadius: 24, gap: 14 },
  notch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.cream,
    position: "absolute",
    top: "50%",
  },
  portrait: {
    backgroundColor: colors.apricot,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: colors.paper,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.paper,
    minHeight: 50,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
  },
  error: {
    fontSize: 15,
    lineHeight: 23,
    color: "#8B2941",
    backgroundColor: "#FFE5DD",
    padding: 14,
    borderRadius: 14,
  },
  check: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  box: {
    width: 25,
    height: 25,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 23,
    lineHeight: 30,
    color: colors.ink,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#FFFFFF70",
  },
});
