import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeeklyImport } from "./WeeklyImport";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  clipboard: vi.fn(),
  pick: vi.fn(),
  bytes: vi.fn(),
  text: vi.fn(),
  remove: vi.fn(),
  native: vi.fn(),
}));
vi.mock("convex/react", () => ({ useMutation: () => mocks.save }));
vi.mock("expo-clipboard", () => ({
  getStringAsync: mocks.clipboard,
  setStringAsync: vi.fn(),
}));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system", () => ({
  File: class {
    size = 100;
    constructor(uri: string) {
      mocks.native(uri);
    }
    bytes = mocks.bytes;
    text = mocks.text;
    delete = mocks.remove;
  },
}));
vi.mock("react-native", () => ({
  View: "view",
  Text: "text",
  Linking: { openURL: vi.fn() },
}));
vi.mock("./paper", () => {
  const host = (type: string) => (props: Record<string, unknown>) =>
    React.createElement(type, props);
  return {
    Action: host("button"),
    Field: host("input"),
    Check: host("checkbox"),
    Body: host("body"),
    Heading: host("heading"),
    Label: host("label"),
    Paper: host("paper"),
    ErrorNote: host("error"),
    colors: {},
    s: {},
  };
});

const fixture =
  '{"topics":[{"title":"Wheel-thrown mugs","summary":"I want to make my own coffee mug on the wheel.","tags":["wheel throwing"],"date"}]}';
const window = { start: "2026-11-09", end: "2026-11-15", label: "Nov 9 – 15" };
let screen: ReactTestRenderer;
let saved = vi.fn<() => void>();
let step = vi.fn<() => void>();
const node = (type: string, id: string) =>
  screen.root.findAll((n) => n.type === type && n.props.testID === id)[0];
const press = async (id: string, type = "button") => {
  await act(async () => {
    await node(type, id).props.onPress();
  });
};
async function review() {
  await act(async () =>
    node("input", "import-recap-input").props.onChangeText(fixture),
  );
  await press("review-recap");
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  mocks.save.mockResolvedValue({ created: 1, unchanged: 0, deleted: 0 });
  mocks.bytes.mockResolvedValue(new TextEncoder().encode(fixture));
  mocks.text.mockResolvedValue(fixture);
  saved = vi.fn();
  step = vi.fn();
  await act(async () => {
    screen = create(
      <WeeklyImport
        window={window}
        scope="sample-run"
        onSaved={saved}
        onCancel={vi.fn()}
        onBusy={vi.fn()}
        onStep={step}
      />,
    );
  });
});

afterEach(async () => {
  await act(async () => screen.unmount());
  vi.unstubAllGlobals();
});

describe("private import interaction", () => {
  it("starts with a usable input and collapsed prompt, without reading clipboard", async () => {
    expect(node("input", "import-recap-input")).toBeDefined();
    expect(node("input", "weekly-prompt")).toBeUndefined();
    expect(mocks.clipboard).not.toHaveBeenCalled();
    await press("toggle-recap-prompt");
    expect(node("input", "weekly-prompt").props.value).toContain(
      "saved memories",
    );
    expect(mocks.clipboard).not.toHaveBeenCalled();
  });

  it("requires week consent and explicit sharing, then saves one bounded atomic payload in the original scope", async () => {
    await review();
    expect(step).toHaveBeenCalled();
    expect(node("checkbox", "confirm-week-0").props.checked).toBe(false);
    expect(node("checkbox", "share-topic-0").props.checked).toBe(false);
    await press("share-topic-0", "checkbox");
    await press("share-reviewed-topics");
    expect(mocks.save).not.toHaveBeenCalled();
    await press("confirm-week-0", "checkbox");
    await press("share-reviewed-topics");
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
      scope: "sample-run",
      topics: [
        {
          title: "Wheel-thrown mugs",
          summary: "I want to make my own coffee mug on the wheel.",
          tags: ["wheel throwing"],
          date: null,
          weekStart: window.start,
          weekEnd: window.end,
          audience: "friends",
          source: "chatgpt",
          importKey: expect.any(String),
        },
      ],
    });
    expect(saved).toHaveBeenCalledOnce();
  });

  it("retains reviewed edits after a failed save and retries with the same key", async () => {
    await review();
    await press("confirm-week-0", "checkbox");
    mocks.save.mockRejectedValueOnce(new Error("offline"));
    await press("save-import-privately");
    const first = mocks.save.mock.calls[0][0];
    expect(saved).not.toHaveBeenCalled();
    expect(node("input", "review-title-0").props.value).toBe(
      "Wheel-thrown mugs",
    );
    await press("save-import-privately");
    expect(mocks.save.mock.calls[1][0]).toEqual(first);
    expect(saved).toHaveBeenCalledOnce();
  });

  it("does not claim an existing shared topic became private on reimport", async () => {
    await review();
    await press("confirm-week-0", "checkbox");
    mocks.save.mockResolvedValueOnce({ created: 0, unchanged: 1, deleted: 0 });
    await press("save-import-privately");
    expect(saved).not.toHaveBeenCalled();
    expect(JSON.stringify(screen.toJSON())).toContain(
      "existing text and sharing were not changed",
    );
  });

  it("decodes a native selected file, deletes the cached source and leaves sharing unchecked", async () => {
    mocks.pick.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cache/recap.json", name: "recap.json" }],
    });
    await press("choose-import-file");
    expect(mocks.bytes).toHaveBeenCalledOnce();
    expect(mocks.text).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(node("checkbox", "share-topic-0").props.checked).toBe(false);
  });

  it("reads browser File without constructing the native File class", async () => {
    const file = new File([fixture.replace("mugs", "mugs �")], "recap.json");
    mocks.pick.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "blob:recap", name: "recap.json", file }],
    });
    await press("choose-import-file");
    expect(mocks.native).not.toHaveBeenCalled();
    expect(node("input", "review-title-0").props.value).toContain("�");
  });

  it("deletes a malformed cached file without saving or exposing its raw bytes", async () => {
    mocks.pick.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cache/binary", name: "recap.json" }],
    });
    mocks.bytes.mockResolvedValueOnce(new Uint8Array([0xff]));
    await press("choose-import-file");
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.text).not.toHaveBeenCalled();
  });

  it("cancels the picker without touching a source or changing the draft", async () => {
    await act(async () =>
      node("input", "import-recap-input").props.onChangeText("my draft"),
    );
    mocks.pick.mockResolvedValueOnce({ canceled: true, assets: null });
    await press("choose-import-file");
    expect(mocks.native).not.toHaveBeenCalled();
    expect(node("input", "import-recap-input").props.value).toBe("my draft");
  });
});
