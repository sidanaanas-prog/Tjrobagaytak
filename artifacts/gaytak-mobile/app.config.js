const baseConfig = require("./app.json");

const isReplit = !!process.env.REPL_ID;

const basePlugins = [
  ["expo-router", { origin: "https://gaytak.app/" }],
  "expo-font",
  "expo-web-browser",
  "expo-image-picker",
  [
    "expo-notifications",
    {
      icon: "./assets/images/icon.png",
      color: "#09090F",
      androidMode: "default",
      androidCollapsedTitle: "Gaytak",
      sounds: ["./assets/sounds/alert.mp3"],
    },
  ],
  [
    "expo-build-properties",
    {
      android: {
        compileSdkVersion: 36,
        targetSdkVersion: 35,
        minSdkVersion: 24,
        buildToolsVersion: "35.0.0",
        kotlinVersion: "2.1.21",
        newArchEnabled: true,
      },
    },
  ],
];

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    plugins: basePlugins,
  },
};
