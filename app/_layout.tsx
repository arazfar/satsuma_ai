import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { convex } from "../lib/convex";
import { authStorage, subscribeAuthStorageErrors } from "../lib/authStorage";

function SessionGate() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const started = useRef(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (isLoading || isAuthenticated || started.current) return;
    started.current = true;
    void signIn("anonymous").catch(() => { started.current = false; setError(true); });
  }, [isLoading, isAuthenticated, signIn, retry]);
  if (!isAuthenticated) return <View style={{ flex: 1, justifyContent: "center", padding: 32, backgroundColor: "#FFF7EC" }}>{error ? <><Text>Couldn’t connect to your circle. Your drafts are safe.</Text><Button title="Try again" onPress={() => { setError(false); setRetry(value => value + 1); }} /></> : <ActivityIndicator accessibilityLabel="Opening your private circle" />}</View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [storageError, setStorageError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => subscribeAuthStorageErrors(setStorageError), []);
  return <SafeAreaProvider>{storageError ? <View style={{ flex: 1, justifyContent: "center", padding: 32, backgroundColor: "#FFF7EC", gap: 16 }}><Text accessibilityRole="alert">Your secure session couldn’t be opened. Satsuma won’t replace your identity or discard your topics.</Text><Text>{storageError}</Text><Button title="Retry secure storage" onPress={() => { setStorageError(""); setAttempt(value => value + 1); }} /></View> : <ConvexAuthProvider key={attempt} client={convex} storage={authStorage} shouldHandleCode={false}><SessionGate /></ConvexAuthProvider>}</SafeAreaProvider>;
}
