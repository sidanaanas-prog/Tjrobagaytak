const fs = require("fs");

console.log("Fixing package.json...");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
delete pkg.dependencies["@onesignal/react-native-onesignal"];
delete pkg.dependencies["expo-notifications"];
delete pkg.dependencies["expo-symbols"];
pkg.dependencies["react-native-onesignal"] = "5.4.3";
pkg.dependencies["onesignal-expo-plugin"] = "2.4.0";
pkg.dependencies["expo-build-properties"] = "~0.14.8";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
console.log("  Done");

console.log("Fixing hooks/useNotifications.ts...");
fs.writeFileSync("hooks/useNotifications.ts", `import { useEffect } from "react";
import { router } from "expo-router";
import OneSignal from "react-native-onesignal";

const ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? "";

export function setupAndroidChannels() {}

export function initOneSignal() {
  if (!ID) return;
  try {
    OneSignal.initialize(ID);
    OneSignal.Notifications.requestPermission(true);
    OneSignal.Notifications.addEventListener("click", (event) => {
      const data = event?.notification?.additionalData;
      if (!data) return;
      if (data.type === "message" && data.conversationId)
        router.push("/conversation/" + data.conversationId);
      else if (data.type === "product" && data.productId)
        router.push("/product/" + data.productId);
    });
  } catch (e) {
    console.warn("[OneSignal] init failed:", e);
  }
}

export function loginOneSignal(userId) {
  if (!ID) return;
  try { OneSignal.login(userId); } catch (e) {}
}

export function logoutOneSignal() {
  if (!ID) return;
  try { OneSignal.logout(); } catch (e) {}
}

export function useNotifications(userId) {
  useEffect(() => {
    if (!ID) return;
    if (userId) loginOneSignal(userId);
    else logoutOneSignal();
  }, [userId]);
}
`);
console.log("  Done");

console.log("Fixing app.config.js...");
fs.writeFileSync("app.config.js", `const baseConfig = require("./app.json");
const isReplit = !!process.env.REPL_ID;

const basePlugins = [
  ["expo-router", { origin: "https://gaytak.app/" }],
  "expo-font",
  "expo-web-browser",
  "expo-image-picker",
  ["expo-build-properties", {
    android: {
      compileSdkVersion: 35,
      targetSdkVersion: 35,
      minSdkVersion: 24,
      buildToolsVersion: "35.0.0",
      kotlinVersion: "1.9.25",
    },
  }],
];

const nativePlugins = [
  ["onesignal-expo-plugin", { mode: "production" }],
];

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    plugins: [...basePlugins, ...(isReplit ? [] : nativePlugins)],
  },
};
`);
console.log("  Done");

console.log("Fixing babel.config.js...");
const babel = fs.readFileSync("babel.config.js", "utf8")
  .split("\n")
  .filter(l => !l.includes("onesignal-stub"))
  .join("\n");
fs.writeFileSync("babel.config.js", babel);
console.log("  Done");

console.log("\nAll fixed! Now run:");
console.log("  npm install --legacy-peer-deps");
console.log("  eas build --platform android --profile preview");
