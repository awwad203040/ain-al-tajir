const { withMainActivity } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to guarantee the native splash screen is never stuck.
 * Dispatches an Android main-thread timeout (1500ms) to dismiss the splash screen
 * regardless of JS initialization or lifecycle state.
 */
module.exports = function withSplashTimeout(config) {
  return withMainActivity(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const target = "SplashScreenManager.registerOnActivity(this)";
    const replacement = `SplashScreenManager.registerOnActivity(this)
    window?.decorView?.postDelayed({
      expo.modules.splashscreen.SplashScreenManager.hide()
    }, 1500)`;

    if (contents.includes(target) && !contents.includes("postDelayed")) {
      contents = contents.replace(target, replacement);
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
};
