const baseConfig = require("./app.json");

const isReplit = !!process.env.REPL_ID;

const basePlugins = [
  ["expo-router", { origin: "https://gaytak.app/" }],
  "expo-font",
  "expo-web-browser",
  "expo-image-picker",
  [
    "expo-build-properties",
    {
      android: {
        compileSdkVersion: 35,
        targetSdkVersion: 35,
        minSdkVersion: 24,
        buildToolsVersion: "35.0.0",
        kotlinVersion: "1.9.25",
      },
    },
  ],
];

const nativePlugins = [
  ["onesignal-expo-plugin", { mode: "production" }],
];

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    plugins: [
      ...basePlugins,
      ...(isReplit ? [] : nativePlugins),
    ],
  },
};
