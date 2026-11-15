import React from "react";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { Field } from "./paper";

vi.mock("react-native", () => ({
  Image: "image",
  Pressable: "button",
  Text: "text",
  TextInput: "input",
  View: "view",
  StyleSheet: { create: (styles: unknown) => styles },
  useWindowDimensions: () => ({
    width: 393,
    height: 852,
    scale: 3,
    fontScale: 3.1,
  }),
}));

it("gives multiline fields room for the selected accessibility font size without capping text scaling", async () => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let screen: ReturnType<typeof create>;
  await act(async () => {
    screen = create(<Field label="Your recap" multiline value="My draft" />);
  });
  const input = screen!.root.findByType("input");
  expect(
    input.props.style
      .flat()
      .find((style: { minHeight?: number }) => style?.minHeight === 323),
  ).toBeDefined();
  expect(input.props.allowFontScaling).not.toBe(false);
  await act(async () => screen!.unmount());
  vi.unstubAllGlobals();
});
