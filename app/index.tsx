import { useMutation, useQuery } from "convex/react";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Button, ScrollView, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../convex/_generated/api";

export default function YouScreen() {
  const topics = useQuery(api.topics.listMine);
  const add = useMutation(api.topics.add);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    setError("");
    const day = new Date().toLocaleDateString("en-CA");
    try {
      await add({ title, summary: `I’m getting into ${title}.`, tags: [title], source: "manual", date: day, weekStart: day, weekEnd: day, audience: "private", importKey: Crypto.randomUUID() });
      setTitle("");
    } catch { setError("Couldn’t save. Your draft is still here; try again."); }
    finally { setSaving(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: "#FFF7EC" }}><ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}><Text style={{ fontSize: 38, color: "#302637" }}>You</Text><Text>What are you getting into this week?</Text><TextInput accessibilityLabel="Topic title" placeholder="A small thing on your mind" value={title} onChangeText={setTitle} style={{ padding: 16, minHeight: 48, backgroundColor: "#CDBCF2", borderRadius: 16 }} /><Button title={saving ? "Saving…" : "Add topic privately"} disabled={saving || !title.trim()} onPress={() => void save()} />{error ? <Text accessibilityRole="alert">{error}</Text> : null}{topics?.map(topic => <Text key={topic._id} style={{ padding: 20, backgroundColor: "#B9DDC6", borderRadius: 18, fontSize: 22 }}>{topic.title}</Text>)}</ScrollView></SafeAreaView>;
}
