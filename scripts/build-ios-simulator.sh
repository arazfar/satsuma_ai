#!/usr/bin/env bash
set -euo pipefail

node -e 'const url=process.env.EXPO_PUBLIC_CONVEX_URL; if (!url || !url.startsWith("https://") || /localhost|127\.0\.0\.1/.test(url)) throw new Error("Provide the cloud HTTPS EXPO_PUBLIC_CONVEX_URL on this remote runner before bundling")'
unset CONVEX_DEPLOY_KEY
export CI=1
export EXPO_NO_DOTENV=1
npm ci
npx expo prebuild --platform ios --clean
xcodebuild -workspace ios/SatsumaAI.xcworkspace -scheme SatsumaAI -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
test -s ios/build/Build/Products/Release-iphonesimulator/SatsumaAI.app/main.jsbundle
echo 'Standalone Release arm64 simulator app contains its JavaScript bundle.'
