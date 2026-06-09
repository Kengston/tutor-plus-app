/**
 * Babel config. Phase 0 ran on Expo's implicit default (no babel.config.js) —
 * `babel-preset-expo` auto-wires the reanimated/worklets plugin and React Compiler
 * (app.json `experiments.reactCompiler`). We make it explicit to add WatermelonDB's
 * decorators (ADR-0007).
 *
 * `@field/@date/...` need the legacy (TS stage-2) decorators transform, which must run
 * BEFORE class-properties. Crucially, class fields must compile in LOOSE (assignment)
 * mode: WatermelonDB models declare definite-assignment fields (`@field('x') x!: T`)
 * with no initializer, and in spec/define mode babel emits a property that clobbers the
 * decorator's prototype accessor ("Definitely assigned fields cannot be initialized
 * here"). Loose mode preserves the accessor. The three class-features plugins must share
 * the same `loose` value, so all are pinned here (overriding the preset's defaults).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
  };
};
