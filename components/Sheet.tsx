import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Action, colors } from "./paper";

export function Sheet({
  children,
  onClose,
  title = "Back",
  busy = false,
}: {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  busy?: boolean;
}) {
  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingBottom: 44, gap: 24 }}
          >
            <View style={{ alignSelf: "flex-start" }}>
              <Action
                secondary
                onPress={onClose}
                disabled={busy}
                label="Close this screen"
              >
                ← {title}
              </Action>
            </View>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
