import { useMutation } from "convex/react";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../convex/_generated/api";
import { socialApi, Topic } from "../lib/socialApi";
import { WeeklyWindow } from "../lib/weeklyImport";
import { Action, Body, Check, ErrorNote, Field, Heading } from "./paper";

export function TopicEditor({
  topic,
  window,
  onSaved,
  onBusy,
  scope: initialScope,
}: {
  topic?: Topic;
  window: WeeklyWindow;
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
  scope: string | null;
}) {
  const add = useMutation(api.topics.add);
  const update = useMutation(socialApi.topics.update);
  const remove = useMutation(socialApi.topics.remove);
  const key = useRef(`manual:${Crypto.randomUUID()}`);
  const [title, setTitle] = useState(topic?.title ?? "");
  const [scope] = useState(initialScope);
  const [summary, setSummary] = useState(topic?.summary ?? "");
  const [tags, setTags] = useState(topic?.tags.join(", ") ?? "");
  const [shared, setShared] = useState(topic?.audience === "friends");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const tagList = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (
      !title.trim() ||
      !summary.trim() ||
      !tagList.length ||
      tagList.length > 3 ||
      tagList.some((tag) => tag.length > 40)
    ) {
      setError(
        "Add a title, one specific sentence, and one to three short tags.",
      );
      return;
    }
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const fields = {
        title: title.trim(),
        summary: summary.trim(),
        tags: tagList,
        audience: shared ? ("friends" as const) : ("private" as const),
      };
      if (topic) await update({ id: topic._id, ...fields });
      else
        await add({
          ...fields,
          scope,
          source: "manual",
          date: window.end,
          weekStart: window.start,
          weekEnd: window.end,
          importKey: key.current,
        });
      onSaved();
    } catch {
      setError("Couldn’t save. Your draft is still here; try again.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  function deleteTopic() {
    if (!topic) return;
    Alert.alert(
      "Delete this topic?",
      "It will disappear from your profile and friends’ connections.",
      [
        { text: "Keep topic", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            onBusy(true);
            void remove({ id: topic._id })
              .then(onSaved)
              .catch(() => setError("Couldn’t delete. Try again."))
              .finally(() => {
                setBusy(false);
                onBusy(false);
              });
          },
        },
      ],
    );
  }

  return (
    <View style={{ gap: 22 }}>
      <Heading>{topic ? "Edit topic." : "What are you into?"}</Heading>
      <Body>
        {topic
          ? "Changes update your friends’ view immediately."
          : `For ${window.label}. A curiosity, a plan, or something you did.`}
      </Body>
      <Field
        label="Topic title"
        testID="manual-topic-title"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        placeholder="A small thing on your mind"
      />
      <Field
        label="Your sentence"
        value={summary}
        onChangeText={setSummary}
        multiline
        maxLength={500}
        placeholder="I’m hoping to try…"
      />
      <Field
        label="Tags (one to three, comma separated)"
        value={tags}
        onChangeText={setTags}
        placeholder="ceramics, coffee"
      />
      <Check
        checked={shared}
        label="Share this topic with friends"
        onPress={() => setShared((value) => !value)}
        testID="manual-topic-share"
      />
      <Body>
        {shared
          ? "Accepted friends can see the title, sentence and tags above."
          : "Only you can see this topic. You can share it later."}
      </Body>
      <ErrorNote text={error} />
      <Action
        onPress={() => void save()}
        disabled={busy}
        testID="save-manual-topic"
      >
        {busy
          ? "Saving…"
          : topic
            ? "Save changes"
            : shared
              ? "Add & share with friends"
              : "Add topic privately"}
      </Action>
      {topic ? (
        <>
          <Action
            secondary
            disabled={busy || topic.audience === "private"}
            onPress={() => {
              setBusy(true);
              onBusy(true);
              void update({ id: topic._id, audience: "private" })
                .then(onSaved)
                .catch(() => setError("Couldn’t unshare. Try again."))
                .finally(() => {
                  setBusy(false);
                  onBusy(false);
                });
            }}
          >
            Unshare now
          </Action>
          <Action secondary disabled={busy} onPress={deleteTopic}>
            Delete topic
          </Action>
        </>
      ) : null}
    </View>
  );
}
