import { useAction, useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { View } from "react-native";
import { Profile, socialApi } from "../lib/socialApi";
import {
  Action,
  Body,
  Check,
  ErrorNote,
  Field,
  Heading,
  Portrait,
} from "./paper";

export function ProfileEditor({
  profile,
  onSaved,
  onBusy,
}: {
  profile: Profile;
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const update = useMutation(socialApi.profiles.update);
  const setPhoto = useAction(socialApi.profiles.setPhoto);
  const [name, setName] = useState(profile.name);
  const [paused, setPaused] = useState(profile.sharingPaused);
  const [photo, setPickedPhoto] = useState<{
    uri: string;
    base64: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function choosePhoto() {
    setError("");
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          "Photo access wasn’t granted. Your initials work too; you can change access in iOS Settings.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;
      const picked = result.assets[0];
      if (!picked.base64 || picked.base64.length * 0.75 > 2 * 1024 * 1024) {
        setError(
          "Choose a smaller image, under 2 MB. Your profile hasn’t changed.",
        );
        return;
      }
      const mimeType = picked.mimeType ?? "image/jpeg";
      if (
        mimeType !== "image/jpeg" &&
        mimeType !== "image/png" &&
        mimeType !== "image/webp"
      ) {
        setError("Choose a JPEG, PNG or WebP image.");
        return;
      }
      setPickedPhoto({ uri: picked.uri, base64: picked.base64, mimeType });
      setRemovePhoto(false);
    } catch {
      setError("Couldn’t open your photos. Try again.");
    }
  }

  async function save() {
    if (!name.trim() || name.trim().length > 60) {
      setError("Use a name between 1 and 60 characters.");
      return;
    }
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await update({
        name: name.trim(),
        sharingPaused: paused,
        ...(removePhoto ? { photoId: null } : {}),
      });
      if (photo)
        await setPhoto({ base64: photo.base64, mimeType: photo.mimeType });
      setPickedPhoto(null);
      onSaved();
    } catch {
      setError(
        "Couldn’t finish saving your profile. Your changes are still here; retry when you’re connected.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <View style={{ gap: 22 }}>
      <Heading>A face, a name, you.</Heading>
      <View style={{ alignItems: "center" }}>
        <Portrait
          name={name}
          uri={photo?.uri ?? (removePhoto ? null : profile.photoUrl)}
          size={116}
        />
      </View>
      <Action
        secondary
        onPress={() => void choosePhoto()}
        disabled={busy}
        testID="choose-profile-photo"
      >
        Choose a photo
      </Action>
      {photo || profile.photoUrl ? (
        <Action
          secondary
          disabled={busy}
          onPress={() => {
            setPickedPhoto(null);
            setRemovePhoto(true);
          }}
        >
          Remove photo
        </Action>
      ) : null}
      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        maxLength={60}
        testID="profile-name"
      />
      <Check
        checked={paused}
        onPress={() => setPaused((value) => !value)}
        label="Pause sharing with friends"
        testID="pause-sharing"
      />
      <Body>
        {paused
          ? "Your shared topics and connections are hidden from friends until you resume. Nothing is deleted."
          : "Only accepted friends can see the topics you explicitly share."}
      </Body>
      <ErrorNote text={error} />
      <Action disabled={busy} onPress={() => void save()} testID="save-profile">
        {busy ? "Saving…" : "Save profile"}
      </Action>
    </View>
  );
}
