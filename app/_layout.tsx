import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { convex } from "../lib/convex";

const storage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

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
  return <SafeAreaProvider><ConvexAuthProvider client={convex} storage={storage}><SessionGate /></ConvexAuthProvider></SafeAreaProvider>;
}
