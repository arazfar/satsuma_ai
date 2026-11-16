import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import mayaPortrait from "../assets/portraits/maya.jpg";
import leoPortrait from "../assets/portraits/leo.jpg";
import { Portrait } from "./paper";

vi.mock("react-native", () => ({
  Image: "image",
  Pressable: "button",
  Text: "text",
  TextInput: "input",
  View: "view",
  StyleSheet: { create: (styles: unknown) => styles },
  useWindowDimensions: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => vi.unstubAllGlobals());

it.each([
  { name: "Maya", fictional: true, source: mayaPortrait },
  { name: "Leo", fictional: true, source: leoPortrait },
  { name: "Maya", fictional: false, source: undefined },
  { name: "Leo", fictional: undefined, source: undefined },
  { name: "Another friend", fictional: true, source: undefined },
  {
    name: "Maya",
    fictional: true,
    uri: "https://example.com/uploaded.jpg",
    source: { uri: "https://example.com/uploaded.jpg" },
  },
])("selects the correct portrait for $name (fictional=$fictional, uri=$uri)", async ({ name, fictional, source, ...props }) => {
  let screen: ReturnType<typeof create>;
  await act(async () => {
    screen = create(<Portrait name={name} fictional={fictional} {...props} />);
  });
  const images = screen!.root.findAllByType("image");
  if (source) {
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual(source);
    expect(images[0].props.resizeMode).toBe("cover");
    if (fictional)
      expect(images[0].props.accessibilityLabel).toContain("fictional sample friend");
  } else {
    expect(images).toHaveLength(0);
    expect(screen!.root.findByType("text").props.children).toBe(name[0]);
  }
  await act(async () => screen!.unmount());
});

it.each([44, 52, 68, 112])("keeps the fictional portrait identifiable and tappable at size %i", async (size) => {
  const onPress = vi.fn();
  let screen: ReturnType<typeof create>;
  await act(async () => {
    screen = create(<Portrait name="Maya" fictional size={size} onPress={onPress} />);
  });
  const button = screen!.root.findByType("button");
  expect(button.props.accessibilityLabel).toBe("Open Maya's profile, fictional sample friend");
  expect(screen!.root.findByType("view").props.style).toContainEqual({
    width: size,
    height: size,
    borderRadius: size * 0.42,
  });
  await act(async () => button.props.onPress());
  expect(onPress).toHaveBeenCalledOnce();
  await act(async () => screen!.unmount());
});
