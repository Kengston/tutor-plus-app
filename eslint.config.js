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
  {
    // No inline UI strings (ADR-0003 §1: "конвенция/линт" — this is that lint). All product
    // Cyrillic text must live in src/i18n/strings.ts and reach components through t(); a literal
    // dropped straight into JSX is exactly the retrofit debt the ADR set out to avoid.
    //
    // Scoped to JSX only (JSXText / JSXAttribute / JSXExpressionContainer children) so it does
    // NOT flag the many legitimate Cyrillic string literals outside JSX — domain enum values
    // compared in plain code (`clientType === 'Ученик'`), object keys, etc. — which are not
    // user-facing UI text and are out of ADR-0003's scope.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "src/i18n/**", // the dictionary itself — the one legitimate home for these strings
      "src/db/seed.ts", // demo-data strings, not UI copy
      "src/app/gallery.tsx", // dev-only UI-kit showcase, explicitly out of i18n scope (see its header)
      "**/*.test.ts",
      // TODO(TP-REVIEW-0810): one remaining literal («…к ₽» bar label, src/app/(tabs)/analytics.tsx:93)
      // owned by a parallel change in this review pass — not touched here to avoid a scope collision.
      // Drop this exception once that literal moves into the i18n dictionary.
      "src/app/**/analytics.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/[а-яА-ЯёЁ]/]",
          message: "No inline Cyrillic text in JSX — add a key to src/i18n/strings.ts and render it via t() (ADR-0003).",
        },
        {
          selector: "JSXAttribute > Literal[value=/[а-яА-ЯёЁ]/]",
          message: "No inline Cyrillic string literal in a JSX attribute — add a key to src/i18n/strings.ts and use t() (ADR-0003).",
        },
        {
          selector: "JSXExpressionContainer > Literal[value=/[а-яА-ЯёЁ]/]",
          message: "No inline Cyrillic string literal in JSX — add a key to src/i18n/strings.ts and use t() (ADR-0003).",
        },
      ],
    },
  },
]);
