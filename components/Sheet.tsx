import { ComponentRef, ReactNode, Ref } from "react";
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
  scrollRef,
}: {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  busy?: boolean;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
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
          <View
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: 12,
            }}
          >
            <Action
              secondary
              onPress={onClose}
              disabled={busy}
              label="Close this screen"
            >
              ← {title}
            </Action>
          </View>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{
              padding: 24,
              paddingTop: 8,
              paddingBottom: 44,
              gap: 24,
            }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
