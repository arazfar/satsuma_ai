import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { convex } from "../lib/convex";
import { authStorage, subscribeAuthStorageErrors } from "../lib/authStorage";
import { authenticateInstallation } from "../lib/installation";

function SessionGate({ retryConnection }: { retryConnection: () => void }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const started = useRef(false);
  const [error, setError] = useState(false);
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (isAuthenticated) return;
    const timer = setTimeout(() => setStalled(true), 20000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);
  useEffect(() => {
    if (isAuthenticated) { started.current = false; return; }
    if (isLoading || started.current) return;
    started.current = true;
    void authenticateInstallation(signIn).catch(() => { started.current = false; setError(true); });
  }, [isLoading, isAuthenticated, signIn]);
  if (!isAuthenticated) return <View style={{ flex: 1, justifyContent: "center", padding: 32, backgroundColor: "#FFF7EC", gap: 16 }}>{error || stalled ? <><Text accessibilityRole="alert">Couldn’t connect to your circle yet. Check your connection and retry; your saved identity and topics stay safe.</Text><Button title="Retry connection" onPress={retryConnection} /></> : <><ActivityIndicator accessibilityLabel="Opening your private circle" /><Text>Opening your secure circle…</Text></>}</View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [storageError, setStorageError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => subscribeAuthStorageErrors(setStorageError), []);
  return <SafeAreaProvider>{storageError ? <View style={{ flex: 1, justifyContent: "center", padding: 32, backgroundColor: "#FFF7EC", gap: 16 }}><Text accessibilityRole="alert">Your secure session couldn’t be opened. Satsuma won’t replace your identity or discard your topics.</Text><Text>{storageError}</Text><Button title="Retry secure storage" onPress={() => { setStorageError(""); setAttempt(value => value + 1); }} /></View> : <ConvexAuthProvider key={attempt} client={convex} storage={authStorage} shouldHandleCode={false}><SessionGate retryConnection={() => setAttempt(value => value + 1)} /></ConvexAuthProvider>}</SafeAreaProvider>;
}
