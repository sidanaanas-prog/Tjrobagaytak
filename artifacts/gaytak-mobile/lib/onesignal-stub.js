/**
 * OneSignal no-op stub — used ONLY in Replit dev environment.
 *
 * Before running: eas build --platform android --profile preview
 * REMOVE the alias line from babel.config.js:
 *   "@onesignal/react-native-onesignal": "./lib/onesignal-stub",
 * Then run: npm install && eas build --platform android --profile preview
 */
const noop = () => {};
const noopReturn = { remove: noop };

const OneSignalStub = {
  initialize: noop,
  login: noop,
  logout: noop,
  Notifications: {
    requestPermission: noop,
    addEventListener: () => noopReturn,
    removeEventListener: noop,
    hasPermission: () => false,
    clearAll: noop,
  },
  User: {
    addTag: noop,
    removeTag: noop,
    addTags: noop,
    removeTags: noop,
    pushSubscription: {
      optIn: noop,
      optOut: noop,
      id: null,
      token: null,
    },
  },
  InAppMessages: {
    addTrigger: noop,
    removeTrigger: noop,
    paused: false,
  },
  Debug: {
    setLogLevel: noop,
    setAlertLevel: noop,
  },
  LiveActivities: {
    setupDefault: noop,
  },
};

module.exports = { OneSignal: OneSignalStub };
