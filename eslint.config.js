// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // `react-hooks/immutability` is a React Compiler rule (eslint-plugin-react-hooks v6). This app
    // does NOT run the React Compiler and uses Reanimated, whose shared values are mutated via
    // `sharedValue.value = …` BY DESIGN — the rule flags every such mutation as a false positive
    // (e.g. ui/Sheet gesture handlers). Disable just this rule; every other react-hooks rule
    // (rules-of-hooks, exhaustive-deps, set-state-in-effect, preserve-manual-memoization) stays on.
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);
