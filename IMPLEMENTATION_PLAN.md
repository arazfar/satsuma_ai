# Satsuma AI implementation plan

1. Integration owns the root Expo Router/TypeScript scaffold, manifests, dependencies, SecureStore-backed guest authentication, and initial authenticated topic add/list slice.
2. Backend crew extends Convex profiles, friendships, approved topics, visibility, sample circle, normalized matches, and focused authorization tests. Authentication wiring remains with integration.
3. UI/import crew owns app screens, components, local import parser, review flow, and import tests. Root provider wiring remains with integration.
4. Integration combines the branches, checks types/tests, syncs cloud DEV, and proves the exact import and persistence flow on one standalone Release iPhone build in Revyl.

The source prompt's bare `"date"` key receives only a narrow on-device repair to `"date": null`; the viewer must confirm its week. General validation remains strict. No raw import source reaches Convex.
