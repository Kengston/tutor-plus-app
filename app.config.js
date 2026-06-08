// Dynamic Expo config. Adds a web `baseUrl` for sub-path hosting (e.g. the
// GitHub Pages project site at /tutor-plus-app/) ONLY when EXPO_BASE_URL is set,
// so local dev (`npm run web`) and native builds stay rooted at "/".
const appJson = require('./app.json');

module.exports = () => {
  const expo = { ...appJson.expo };
  const baseUrl = process.env.EXPO_BASE_URL;
  if (baseUrl) {
    expo.experiments = { ...(expo.experiments || {}), baseUrl };
  }
  return { expo };
};
