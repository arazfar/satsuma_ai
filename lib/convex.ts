import { ConvexReactClient } from "convex/react";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url || !url.startsWith("https://") || /localhost|127\.0\.0\.1/.test(url)) {
  throw new Error("Set EXPO_PUBLIC_CONVEX_URL to the cloud HTTPS deployment before building.");
}
export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });
