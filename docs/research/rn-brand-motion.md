# Исследование: SVG-росчерк, шрифты и app icon/splash в Expo-пайплайне Tutor+

Дата: 2026-08-10
Ответ на issue #67 (wayfinder-тикет «SVG-росчерк и шрифты в RN/web: технические факты») в репо `Kengston/tutor-plus-app`.

Установленные версии (из `package.json` репо `tutor-plus-app`, проверены напрямую в `node_modules/*/package.json`): `expo` 56.0.9, `expo-router` ~56.2.9, `expo-font` 56.0.5, `expo-splash-screen` 56.0.10, `expo-constants` ~56.0.17, `react-native` 0.85.3, `react-native-web` 0.21.2, `react-native-svg` 15.15.4, `react-native-reanimated` 4.3.1, `react-native-worklets` 0.8.3, `react` 19.2.3.

---

## Вопрос 1. Анимация stroke-dashoffset в react-native-svg 15.15.4

**Вывод/рекомендация:** draw-in ~250мс делать через Reanimated — `useSharedValue` + `useAnimatedProps` на `Animated.createAnimatedComponent(Path)` из `react-native-reanimated`, с `strokeDasharray = pathLength` (константа, не мерить в рантайме) и `strokeDashoffset`, анимируемым от `pathLength` до `0`. Схема одинаково работает на native (iOS/Android/Fabric) и на web (react-native-svg рендерит настоящий `<svg>` в DOM) — но со следующими граблями:
- **На iOS**, если `pathLength` вычисляется в рантайме через `path.getTotalLength()` сразу при монтировании, есть открытый баг react-native-svg — на первом кадре длина ещё 0, анимация не срабатывает (issue #2200, см. ниже). Для статичного лого-росчерка лучше **захардкодить** длину пути как известную константу (посчитанную заранее по самому SVG), а не мерить `getTotalLength()` синхронно на маунте.
- `strokeDasharray` и `strokeDashoffset` должны идти в паре: native-извлечение обнуляет `strokeDashoffset`, если `strokeDasharray` не задан (см. `extractStroke.ts` ниже) — задавать оба прописью в одном `useAnimatedProps`.
- Фолбэк, если Reanimated почему-то не завёлся на конкретной платформе: `Animated` API из `react-native` (`Animated.Value` + `Animated.timing`, тот же `Animated.createAnimatedComponent(Path)`, но из `react-native`, а не `react-native-reanimated`) — работает по тому же контракту `setNativeProps`/props-driven update, который явно поддержан в `react-native-svg` (см. `WebShape.setNativeProps` ниже, комментарий в коде специально упоминает и Reanimated, и общий контракт). Отдельный web-only фолбэк — чистый CSS `@keyframes` на `stroke-dashoffset`, т.к. на web это реальный DOM-атрибут SVG-элемента.

### Факты

- **react-native-svg 15.15.4**, лицензия MIT, официальный репозиторий `software-mansion/react-native-svg` (не архивирован, подтверждено `gh api repos/software-mansion/react-native-svg` — `"archived": false`). Поле `homepage` в `node_modules/react-native-svg/package.json` указывает на устаревший `react-native-community/react-native-svg`, но фактический upstream — `software-mansion/react-native-svg`.
- **Web-реализация — реальный `<svg>` в DOM.** `node_modules/react-native-svg/src/web/WebShape.ts` — базовый класс всех web-элементов (`Path` и т.д. extend его). Ключевой метод:
  ```ts
  // node_modules/react-native-svg/src/web/WebShape.ts:29-84
  /**
   * disclaimer: I am not sure why the props are wrapped in a `style` attribute here, but that's how reanimated calls it
   */
  setNativeProps(props: { style: P }) {
    ...
    for (const cleanAttribute of Object.keys(clean)) {
      const cleanValue = clean[cleanAttribute];
      switch (cleanAttribute) {
        case 'fill': /* спец-обработка ColorValue */ break;
        case 'stroke': /* спец-обработка ColorValue */ break;
        default:
          // apply all other incoming prop updates as attributes on the node
          current.setAttribute(getAttributeName(cleanAttribute), cleanValue);
      }
    }
  }
  ```
  `strokeDashoffset` не входит в спец-кейсы (`fill`/`stroke`), значит идёт через `default` — прямой `setAttribute` на реальный DOM-узел `<path>`.
- **camelCase → kebab-case для DOM-атрибута.** `node_modules/react-native-svg/src/web/utils/index.ts:101-103`:
  ```ts
  export const getAttributeName = (attr: string) => {
    return KEEP_CAMEL_CASE.has(attr) ? attr : camelCaseToDashed(attr);
  };
  ```
  `strokeDashoffset` не в множестве `KEEP_CAMEL_CASE` (там только настоящие camelCase SVG-атрибуты вроде `markerUnits`, `viewBox`), поэтому конвертируется в `stroke-dashoffset` — валидный SVG presentation attribute, unit (px/%) не требуется, число ставится как есть.
- **Извлечение strokeDashoffset на native (Paper/общий JS-слой).** `node_modules/react-native-svg/src/lib/extract/extractStroke.ts:67-71`:
  ```ts
  if (strokeDashoffset != null) {
    inherited.push('strokeDashoffset');
    o.strokeDashoffset =
      strokeDasharray && strokeDashoffset ? +strokeDashoffset || 0 : null;
  }
  ```
  Важная деталь: `strokeDashoffset` применяется, **только если** `strokeDasharray` тоже truthy — иначе обнуляется в `null`. Отсюда правило «оба пропа в паре».
- **Fabric native component типизирует strokeDashoffset как обычный анимируемый Float.** `node_modules/react-native-svg/src/fabric/PathNativeComponent.ts:54`:
  ```ts
  strokeDashoffset?: Float;
  ```
  (без `WithDefault`, без спецобработки) — codegen’утый пропс `RNSVGPath`, полноценно управляется через стандартный native props update path, которым и пользуется Reanimated UI-runtime на native.
- **Reanimated 4.3.1, `createAnimatedComponent`.** `node_modules/react-native-reanimated/src/createAnimatedComponent/createAnimatedComponent.tsx:57-67` — док-комментарий прямо в коде:
  ```ts
  /**
   * Lets you create an Animated version of any React Native component.
   * ...
   * @see https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent
   */
  ```
  Официальная страница доки (https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent) описывает `createAnimatedComponent` универсально («wrapping a component... allows Reanimated to animate any prop or style»), **без специфики про react-native-svg или про unit-требования для числовых пропов** — страница не привязывает механизм к SVG отдельно, что подтверждает: это общий контракт, не особый SVG-кейс.
- **Web-путь обновления пропов в Reanimated специально учитывает react-native-svg.** `node_modules/react-native-reanimated/src/ReanimatedModule/js-reanimated/index.ts:58-62`:
  ```ts
  if (typeof component.setNativeProps === 'function') {
    // This is the legacy way to update props on React Native Web <= 0.18.
    // Also, some components (e.g. from react-native-svg) don't have styles
    // and always provide setNativeProps function instead (even on React Native Web 0.19+).
    setNativeProps(component, rawStyles, isAnimatedProps);
  } else if (...) { /* React Native Web 0.19+ DOM update path */ }
  ```
  То есть Reanimated **явно знает** про react-native-svg на web и намеренно идёт через его `setNativeProps`, а не через обычный RN-Web 0.19+ DOM-style-путь (который у SVG-компонентов недоступен, т.к. у них нет `style` prop в этом смысле).
- **`node_modules/react-native-reanimated/src/mock-svg.ts`** — в самом пакете reanimated есть jest-мок для `react-native-svg` (`Svg`, `Path`, `Circle`, ... с собственным `setNativeProps`), используемый в тестах пакетов, которые Reanimated-анимируют SVG. Наличие официального мока — косвенное подтверждение, что связка «Reanimated + react-native-svg» — поддерживаемый, а не случайный сценарий.
- **История бага, который и породил текущую поддержку (GitHub issue/PR, software-mansion/react-native-svg):**
  - Issue [#1674](https://github.com/software-mansion/react-native-svg/issues/1674) «setNativeProps is not implemented on web, animating svg properties via reanimated is not possible» (closed). В issue дан ровно тот код, который мы и рекомендуем:
    ```jsx
    const AnimatedPath = Animated.createAnimatedComponent(Path);
    const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset }));
    return <AnimatedPath animatedProps={animatedProps} />;
    ```
  - Закрыт PR [#1886](https://github.com/software-mansion/react-native-svg/pull/1886) «make reanimated work in web», **merged 2022-10-13** — это и есть коммит, добавивший `WebShape.setNativeProps` (см. выше). Т.е. поддержка стабильна и присутствует в кодовой базе уже ~4 года, задолго до 15.15.4.
  - Issue [#2200](https://github.com/software-mansion/react-native-svg/issues/2200) «animating strokeDashoffset of a path does not work on IOS» — **открыт**, лейблы `bug` + `Workaround exists`. Комментарий от `webdesign2be` (2024-06-30): проблема в том, что при инициализации SVG длина стороки = 0; `getTotalLength()`, вызванный сразу на маунте, возвращает 0, и обход — обернуть вызов в `setTimeout`/дождаться реального layout. Для лого с фиксированным путём практический вывод: не мерить `getTotalLength()` в рантайме вообще, использовать заранее посчитанную константу длины пути.
  - Release notes v15.15.4 (`gh api repos/software-mansion/react-native-svg/releases/tags/v15.15.4`): «Support react-native nightly build» / «Fix nightly builds» (PR #2872) — в этом конкретном патче ничего не менялось в логике strokeDashoffset/animated props, поведение выше — то, что реально стоит в `node_modules` сейчас.
  - Отдельного `CHANGELOG.md` в корне репозитория `software-mansion/react-native-svg` нет (`/blob/main/CHANGELOG.md` → 404) — история changes ведётся через GitHub Releases.

---

## Вопрос 2. Reduced motion кроссплатформенно

**Вывод/рекомендация:** отдельная web-ветка с `matchMedia` не нужна — `react-native-web` 0.21.2 **уже** реализует `AccessibilityInfo.isReduceMotionEnabled()`/`addEventListener('reduceMotionChanged', ...)` через `window.matchMedia('(prefers-reduced-motion: reduce)')` под капотом. Единый `useReducedMotion()` хук просто вызывает стандартный `AccessibilityInfo` из `react-native` (RN сам резолвит native/web реализацию через platform-specific модуль) — без `Platform.OS === 'web'` веток и без ручного `matchMedia`.

```ts
// пример реализации, не проверялся линтером репозитория — только фактическая база
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
```

### Факты

- **`node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.js:188-207`** (RN 0.85.3) — `isReduceMotionEnabled(): Promise<boolean>`, на Android идёт через `NativeAccessibilityInfoAndroid.isReduceMotionEnabled(resolve)`, на iOS — `NativeAccessibilityManagerIOS.getCurrentReduceMotionState(resolve, reject)`.
- **`addEventListener` (там же, строки 427-437):**
  ```js
  addEventListener<K>(eventName, handler): EventSubscription {
    const deviceEventName = EventNames.get(eventName);
    return deviceEventName == null
      ? {remove(): void {}}
      : RCTDeviceEventEmitter.addListener(deviceEventName, handler);
  },
  ```
  Возвращает объект с `.remove()` (тип `EventSubscription` из `../../vendor/emitter/EventEmitter`), не требует отдельного `removeEventListener`.
- **`node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.d.ts:129-136`** — типизирует возврат `addEventListener` как `EmitterSubscription` (немного отстаёт от Flow-исходника, где это уже `EventSubscription`), но контракт одинаковый — объект с методом `.remove()`. Актуальный **старый** паттерн `AccessibilityInfo.removeEventListener(name, handler)` в текущих тайпингах уже отсутствует — это подтверждает, что нужно использовать именно `subscription.remove()`, а не legacy `removeEventListener`.
- **Официальная документация React Native** (https://reactnative.dev/docs/accessibilityinfo, проверено WebFetch): `isReduceMotionEnabled(): Promise<boolean>` — кроссплатформенно (iOS и Android); `addEventListener(eventName, handler): EmitterSubscription`, «returns an EmitterSubscription object that can be used to unsubscribe from the event» — то же самое, что видно в исходниках.
- **`node_modules/react-native-web/src/exports/AccessibilityInfo/index.js`** (react-native-web 0.21.2, установленная версия) — реализация **напрямую через `matchMedia`**:
  ```js
  const prefersReducedMotionMedia =
    canUseDOM && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  function isReduceMotionEnabled(): Promise<*> {
    return new Promise((resolve, reject) => {
      resolve(prefersReducedMotionMedia ? prefersReducedMotionMedia.matches : true);
    });
  }

  addEventListener: function (eventName, handler) {
    if (eventName === 'reduceMotionChanged') {
      if (!prefersReducedMotionMedia) return;
      const listener = (event) => handler(event.matches);
      prefersReducedMotionMedia.addEventListener
        ? prefersReducedMotionMedia.addEventListener('change', listener)
        : prefersReducedMotionMedia.addListener(listener); // легаси-браузеры
      handlers[handler] = listener;
    }
    return { remove: () => AccessibilityInfo.removeEventListener(eventName, handler) };
  },
  ```
  Т.е. `isReduceMotionEnabled`/`addEventListener` на web уже используют `matchMedia('(prefers-reduced-motion: reduce)')`, с фолбэком на легаси `addListener`/`removeListener` для очень старых браузеров без `MediaQueryList.addEventListener`. **Важный нюанс**: если `matchMedia` недоступен вообще (не-DOM окружение / SSR без `window`), `isReduceMotionEnabled` резолвится в `true` (safe default — «считаем, что motion уменьшенный», не наоборот) — учитывать при статическом экспорте/SSR.
  Возврат `addEventListener` — объект `{ remove: () => ... }`, той же формы, что и нативный `EventSubscription`/`EmitterSubscription` — единый хук может звать `.remove()` не различая платформу.
- **MDN, `prefers-reduced-motion`** (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion, проверено WebFetch): синтаксис `window.matchMedia('(prefers-reduced-motion: reduce)')`; значения `no-preference` (false) и `reduce` (true); «Baseline Widely available... available across browsers since January 2020»; подписка на изменения — `mediaQueryList.addEventListener('change', handler)`.

---

## Вопрос 3. Шрифты Onest и Manrope через @expo-google-fonts

**Вывод/рекомендация:** ставить `@expo-google-fonts/onest` и `@expo-google-fonts/manrope` (пакеты существуют на npm, проверено через `npm registry`), грузить через `useFonts` из этих пакетов (не через `expo-font` config-plugin) — потому что на web именно `useFonts` даёт Expo Router возможность статически заинлайнить `@font-face`/`preload` в HTML при `expo export -p web`; config-plugin `"fonts"` в `app.json` — это чисто **нативная** (iOS/Android) линковка шрифтов при prebuild, на web она вообще не действует. Веса: Onest — `Onest_400Regular`, `Onest_500Medium`, `Onest_600SemiBold`, `Onest_700Bold` (плюс ещё 5 других начертаний в пакете); Manrope — `Manrope_600SemiBold`, `Manrope_700Bold`, `Manrope_800ExtraBold` (плюс ещё 4 начертания). Лицензия обоих шрифтов — SIL Open Font License 1.1.

### Факты

- **Пакеты реально существуют**, проверено напрямую через npm registry API (`curl https://registry.npmjs.org/@expo-google-fonts/onest` / `.../manrope`):
  - `@expo-google-fonts/onest` — latest `0.4.1`, описание «Use the Onest font family from Google Fonts in your Expo app».
  - `@expo-google-fonts/manrope` — latest `0.4.2`, описание «Use the Manrope font family from Google Fonts in your Expo app».
- **Точные имена экспортов весов** — проверено распаковкой реального npm-тарбола (`npm pack` + `tar -xzf`, не по памяти), `package/index.js`:
  - Onest (`node_modules`-эквивалент `onest/package/index.js` после распаковки): `Onest_100Thin`, `Onest_200ExtraLight`, `Onest_300Light`, `Onest_400Regular`, `Onest_500Medium`, `Onest_600SemiBold`, `Onest_700Bold`, `Onest_800ExtraBold`, `Onest_900Black` — 9 начертаний, все от 100 до 900 по 100.
  - Manrope (`manrope/package/index.js`): `Manrope_200ExtraLight`, `Manrope_300Light`, `Manrope_400Regular`, `Manrope_500Medium`, `Manrope_600SemiBold`, `Manrope_700Bold`, `Manrope_800ExtraBold` — 7 начертаний, от 200 до 800 (100 и 900 у Manrope не существуют — подтверждено также метаданными Google Fonts, см. ниже).
  - Формат экспорта (`index.js` пакета): `export const Onest_400Regular = require('./400Regular/Onest_400Regular.ttf');` — каждый вес это отдельный `.ttf`-файл со своим подпакетом-каталогом.
- **Официальные метаданные Google Fonts** (`https://fonts.google.com/metadata/fonts/Onest` и `.../Manrope` — официальный JSON-API самого Google Fonts, не блог; страница `fonts.google.com/specimen/...` рендерится через JS и через обычный WebFetch отдаётся пустой, поэтому источник истины — сам API):
  - Onest: `"category": "Sans Serif"`, `"license": "ofl"`, доступные веса `100, 200, 300, 400, 500, 600, 700, 800, 900`.
  - Manrope: `"category": "Sans Serif"`, `"license": "ofl"`, доступные веса `200, 300, 400, 500, 600, 700, 800`.
  - `"license": "ofl"` в API Google Fonts соответствует **SIL Open Font License, Version 1.1** — подтверждено прямым текстом файла лицензии, распакованного из тарбола пакета `@expo-google-fonts/onest` (`onest/package/LICENSE_FONT`, первая строка): «Copyright 2021 The Onest Project Authors (https://github.com/googlefonts/onest). This Font Software is licensed under the SIL Open Font License, Version 1.1.» — идентичный файл `OFL.txt` лежит и в апстрим-репозитории `google/fonts` (`ofl/onest/OFL.txt`, `ofl/manrope/OFL.txt`, оба — 4384 байта, проверено через GitHub API `contents`-endpoint).
- **Точный вес файлов — реальные размеры из распакованного npm-пакета** (не оценка, а прямое измерение `ls -la` после `npm pack` + `tar -xzf`):
  - Onest, статичные TTF по весам: **~62.9–63.0 КБ** на файл (100Thin 64364 байт, 400Regular 64272 байт, 500Medium 64444 байт, 600SemiBold 64444 байт, 700Bold 64416 байт, 800ExtraBold 64388 байт, 900Black 64188 байт, 200ExtraLight 64424 байт, 300Light 64376 байт) — разброс минимальный, все веса примерно одного размера.
  - Manrope, статичные TTF по весам: **~94.4–95.2 КБ** на файл (200ExtraLight 96700 байт, 300Light 96728 байт, 400Regular 96832 байт, 500Medium 96904 байт, 600SemiBold 96936 байт, 700Bold 96800 байт, 800ExtraBold 97524 байт).
  - Для сравнения: в апстрим-репозитории `google/fonts` (`github.com/google/fonts`, `ofl/onest/Onest[wght].ttf` — 193056 байт, `ofl/manrope/Manrope[wght].ttf` — 165420 байт) шрифты лежат как **один variable-font файл на все веса** — это НЕ то, что ставит `@expo-google-fonts`; пакет от Expo даёт отдельные статичные TTF на каждый вес (что и логично для `useFonts`, где на весь конкретный `fontFamily` нужен свой файл).
  - Итого для проекта: если брать 4 веса Onest (400/500/600/700) + 3 веса Manrope (600/700/800) — суммарно примерно `4×63 + 3×95 ≈ 537 КБ` статичных TTF в бандле (нативно) / для скачивания на web (без сжатия; на web сервер обычно отдаёт с gzip/brotli).
- **`node_modules/expo-font/README.md`, `src/FontHooks.ts`** — `useFonts` (строки 45-74 `FontHooks.ts`) грузит шрифты через `loadAsync`, возвращает `[loaded, error]`; на web (`typeof window === 'undefined' ? useStaticFonts : useRuntimeFonts`) при SSR/статическом рендере используется синхронный `useStaticFonts`, при обычном рантайме — асинхронный `useRuntimeFonts` с проверкой `isMapLoaded` для гидратации без лишнего ре-рендера.
- **Config-plugin `expo-font` (`app.plugin.js` → `./plugin/build/withFonts`)** — исходник `node_modules/expo-font/plugin/src/withFonts.ts:8-36`, форма конфига:
  ```ts
  type FontProps = {
    fonts?: string[];              // общий список путей к файлам шрифтов
    android?: { fonts?: Font[] };  // Android-специфичные (можно с доп. синтаксисом family/weight)
    ios?: { fonts?: string[] };    // iOS-специфичные пути
  };
  ```
  Плагин **линкует шрифты нативно** (`withFontsIos`/`withFontsAndroid`) — доступно только при `expo prebuild`/native build, к web не имеет отношения. По `CHANGELOG.md` пакета (`node_modules/expo-font/CHANGELOG.md`) фича «Added config plugin to allow fonts to be linked at build time» (#24772) появилась в версии `expo-font@11.8.0` (2023-10-17) — задолго до текущей `56.0.5`, то есть механизм давно стабилен; «static font extraction support with expo-router» (#24027) добавлена следом, `expo-font@11.9.0` (2023-11-14). Точную привязку к конкретному номеру Expo SDK («SDK 52+») в доступных источниках подтвердить не удалось — в официальной странице `docs.expo.dev/versions/latest/sdk/font/` (текущая, помечена как «SDK v57.0.0» — т.е. описывает актуальный на сегодня SDK, не обязательно 56) такой привязки нет; не выдаю это как факт, только версии/даты из CHANGELOG.
- **Официальная документация Expo, `docs.expo.dev/versions/latest/sdk/font/`** (проверено WebFetch; страница помечена версией SDK v57, актуальная «latest», не обязательно 1:1 совпадает с установленным SDK 56, но описывает актуальное поведение `expo-font`):
  - Про статический экспорт на web: «will automatically extract the font resource and embed it in the page's HTML, enabling preload, faster hydration, and reduced layout shift» — генерируется `<link rel="preload" href="/assets/inter.ttf" as="font" crossorigin />` и `@font-face` с `font-display: auto`.
  - Условие срабатывания оптимизации: «Static font optimization requires the font to be loaded synchronously. If the font isn't statically optimized, it could be because it was loaded inside a `useEffect`, deferred component, or async function» — то есть `useFonts(...)` нужно звать синхронно на верхнем уровне компонента (например, в корневом `_layout` route), а не внутри `useEffect`/условно, иначе Expo Router не сможет заинлайнить шрифт в HTML при `expo export -p web`.
  - Про `fontDisplay`: «Even though setting the `fontDisplay` does nothing on native platforms, the default behavior emulates `FontDisplay.SWAP` on flagship devices» — на web рекомендуемое поведение — `SWAP` («Fallback text is rendered immediately with a default font while the desired font is loaded»), что и есть штатная FOUT-стратегия (не FOIT) — избегать `FontDisplay.BLOCK`.
- **`docs.expo.dev/router/web/static-rendering/`** (проверено WebFetch; репозитория Tutor+ уже стоит `"web": {"output": "static"}` в `app.json`, т.е. этот режим и используется) — страница подтверждает механизм автоэкстракции шрифта в HTML при статическом рендере (см. выше), отдельного упоминания FOUT/FOIT-терминологии на странице нет, но описанный механизм (`preload` + `@font-face` inline + `font-display`) — и есть техническая реализация анти-FOUT/FOIT стратегии.

---

## Вопрос 4. App icon / favicon / splash в Expo-пайплайне

**Вывод/рекомендация:** Expo/EAS **не рендерит SVG** — на входе везде нужен растровый **PNG**, обычно 1024×1024. SVG-лого нужно заранее (программно, вне Expo-пайплайна — любым headless-рендерером SVG→PNG) превратить в набор PNG под каждое требуемое поле `app.json` (`icon`, `android.adaptiveIcon.foregroundImage`/`backgroundImage`/`monochromeImage`, `web.favicon`, `plugins[expo-splash-screen].image`). Expo/EAS при сборке сам генерирует **производные ресурсы под все плотности/размеры** из этих PNG (mipmap-иконки под все DPI на Android, `Assets.xcassets` на iOS, favicon для web-экспорта) — но safe zone для adaptive icon foreground и monochrome-версию для Android themed icons нужно подготовить **вручную заранее**, Expo их не считает и не генерирует.

Отдельно: конфигурация репозитория для сплэша сейчас **неполная** — заданы только `backgroundColor`/`dark.backgroundColor` и `android.image`/`android.imageWidth`, но нет top-level (или `ios.*`) `image` — по логике самого `expo-splash-screen` config-plugin (см. ниже) это означает, что на **iOS сплэш будет просто заливкой цветом `#FAF8F4` без картинки/логотипа**, потому что `image` для iOS не наследуется из `android.image`.

### Факты

- **Текущий `app.json` репо** (`/Users/danillysikov/tutor-plus-app/app.json`):
  - `icon`: `./assets/images/icon.png` (top-level, растровый PNG).
  - `ios.icon`: `./assets/expo.icon` — путь на **каталог** `.icon` (не PNG-файл), нестандартный/относительно новый формат.
  - `android.adaptiveIcon`: `backgroundColor #FAF8F4`, `foregroundImage`/`backgroundImage`/`monochromeImage` — все три поля заданы отдельными PNG.
  - `web.favicon`: `./assets/images/favicon.png`.
  - Плагин `expo-splash-screen`: `backgroundColor #FAF8F4`, `dark.backgroundColor #16140F`, `android.image ./assets/images/splash-icon.png`, `android.imageWidth 76`. **Нет** top-level `image`/`imageWidth`, нет `ios.*`.
- **Официальная документация Expo Config** (`docs.expo.dev/versions/latest/config/app/`, проверено WebFetch):
  - `icon` (top-level): «We recommend that you use a 1024x1024 png file.»
  - `ios.icon`: «Use a 1024x1024 icon which follows Apple's interface guidelines for icons, including color profile and transparency.» — и отдельно подтверждён `.icon`-путь как валидная альтернатива (см. ниже отдельным пунктом).
  - `android.adaptiveIcon.backgroundImage`: должно иметь те же размеры, что и `foregroundImage`.
  - `android.adaptiveIcon.monochromeImage`: «This icon will appear on the home screen when the user enables "Themed icons" in system settings on Android 13+.»
  - `web.favicon`: «Relative path of an image to use for your app's favicon.» — без требований к размеру/формату в тексте страницы.
- **Официальная страница про app icons** (URL из задания `docs.expo.dev/develop/user-interface/app-icons/` — при обращении отдаёт **HTTP 301**, редиректит на `/develop/user-interface/splash-screen-and-app-icon` — то есть страницы app-icons и splash-screen официально объединены в одну; проверено `curl -sIL`, а не по памяти):
  - Формат/размер: «Use a `.png` file.» и «1024x1024 is a good size.» Для iOS отдельно жёстче: «The icon must be exactly square.»
  - Android adaptive icon — слоистая модель: `android.adaptiveIcon.foregroundImage` (передний план) + фон (`backgroundColor` или `backgroundImage`); дефолтный фон белый, если не переопределён `backgroundColor`. Отдельно `monochromeImage` для themed icons (см. выше).
  - **iOS `.icon`-каталог (Icon Composer) — подтверждено официально**: «Providing an Icon Composer `.icon` directory via `ios.icon` is supported **in SDK 54** and later. Adding support for dark mode is handled in Icon Composer, so you do not need to provide variants when using this approach.» — то есть текущий `"icon": "./assets/expo.icon"` в `ios`-блоке репо (SDK 56 > 54) — это **не эксперимент и не самодеятельность**, а официально поддерживаемый с SDK 54 формат; факт подтверждён первоисточником, а не предположение.
- **Android adaptive icon safe zone — точные цифры** (страница Expo ссылается на официальный Android-гайд `developer.android.com/develop/ui/compose/system/icon_design_adaptive`, проверено WebFetch напрямую на этой странице, а не по памяти): полное «холст» иконки — **108×108dp**, безопасная зона (то, что гарантированно не будет обрезано маской) — **66×66dp** в центре, с рекомендацией держать сам логотип в диапазоне **48–66dp**, оставляя **18dp отступа** с каждой стороны для эффектов маскирования/параллакса.
- **Splash — только PNG, официальная цитата.** Страница `docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/` (проверено WebFetch): «Currently, only `.png` images are supported to use as a splash screen icon in an Expo project.» — прямой ответ на вопрос «PNG или SVG»: **SVG не поддерживается**, нужен PNG.
- **`docs.expo.dev/versions/latest/sdk/splash-screen/`** (config-plugin `expo-splash-screen`, проверено WebFetch) — свойства плагина: `backgroundColor` (по умолчанию `#ffffff`), `image`, `imageWidth` (по умолчанию `100`), `resizeMode` (`contain`/`cover`/`native`), `dark: { image, backgroundColor }`, платформенные оверрайды `android`/`ios`, устаревающий `enableFullScreenImage_legacy`. Отдельно отмечено: начиная с SDK 52 «Expo Go will show your app icon instead of the splash screen, and the splash screen on development builds will not reflect all properties set in the config plugin» — тестировать сплэш нужно на **release**-сборках, не в Expo Go / dev-клиенте.
- **Как top-level/`android`/`ios`-конфиг сплэша реально мёржится — проверено по исходнику плагина, а не по доке.** `node_modules/expo-splash-screen/plugin/src/getIosSplashConfig.ts:4-27`:
  ```ts
  export function getIosSplashConfig({ ios = {}, ...rest }: Props): IOSSplashConfig {
    // Respect the splash screen object, don't mix and match across different splash screen objects
    const { dark, ...root } = { ...rest, ...ios, dark: { ...rest.dark, ...ios.dark } };
    return {
      imageWidth: root.imageWidth ?? 100,
      resizeMode: (root.resizeMode !== 'native' ? root.resizeMode : undefined) ?? 'contain',
      backgroundColor: root.backgroundColor ?? '#ffffff',
      image: root.image,   // ← если ни top-level, ни ios.image не заданы — undefined
      ...
    };
  }
  ```
  и `node_modules/expo-splash-screen/plugin/src/getAndroidSplashConfig.ts:3-21` — аналогично, `image: root.image` где `root = {...rest, ...android}`, плюс под каждую плотность (`mdpi`/`hdpi`/`xhdpi`/`xxhdpi`/`xxxhdpi`) — фолбэк на общий `image`, если плотность не задана отдельно (5 android-плотностей генерятся автоматически из одного PNG).
  **Вывод из кода**: в текущем `app.json` репо `image` задан только внутри `android: {...}`, а top-level и `ios: {...}` — без `image`. Значит `getIosSplashConfig` вернёт `image: undefined` — на iOS сплэш будет **однотонной заливкой `backgroundColor` (`#FAF8F4`/`#16140F` в тёмной теме) без картинки**, а не тем же `splash-icon.png`, что на Android. Если цель — единый сплэш с лого на обеих платформах, нужно добавить `image`/`imageWidth` либо на top-level (унаследуется обеими платформами), либо явно продублировать в `ios.image`.
- **`node_modules/expo-splash-screen/README.md`** — фичи модуля: три `resizeMode` (`CONTAIN`, `COVER`, `NATIVE` — «Android only», центрирует картинку в исходном размере без растяжения) и «per-appearance (dark-mode) splash screen», поддержанный «on system appearance changes on iOS 13+ and dark-mode changes on Android 10+» — что и объясняет наличие `dark.backgroundColor` в текущем конфиге репо.
- **Что Expo/EAS генерирует автоматически vs что готовить руками:**
  - Автоматически (из подготовленных PNG, при `expo prebuild`/EAS Build): Android — mipmap-иконки под все стандартные плотности + adaptive icon XML (foreground+background слои), 5 плотностей сплэш-картинки (`mdpi`…`xxxhdpi`, см. `getAndroidSplashConfig.ts` выше); iOS — `Assets.xcassets` (App Icon set, Launch Screen storyboard/assets); web — favicon в статическом экспорте.
  - Руками заранее: safe zone для `android.adaptiveIcon.foregroundImage` (логотип должен помещаться в круг ~66×66dp на холсте 1024×1024, т.е. с существенными полями по краям — Expo не подрезает и не проверяет это); monochrome-версия (`monochromeImage`) для Android 13+ themed icons — это отдельный контрастный силуэт, который тоже не выводится автоматически из цветной иконки; при использовании `ios.icon` как `.icon`-каталога (Icon Composer) — сам `.icon`-файл собирается в приложении Icon Composer (входит в Xcode 26+), не программным SVG→PNG рендером.

---

### Источники (сводно)

- react-native-svg: `github.com/software-mansion/react-native-svg` (README/CHANGELOG через Releases), issues [#1674](https://github.com/software-mansion/react-native-svg/issues/1674), [#2200](https://github.com/software-mansion/react-native-svg/issues/2200), PR [#1886](https://github.com/software-mansion/react-native-svg/pull/1886); исходники в `node_modules/react-native-svg/src/**`.
- react-native-reanimated: `docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent`; исходники в `node_modules/react-native-reanimated/src/**`.
- React Native: `reactnative.dev/docs/accessibilityinfo`; исходники в `node_modules/react-native/Libraries/Components/AccessibilityInfo/**`.
- react-native-web: исходник `node_modules/react-native-web/src/exports/AccessibilityInfo/index.js`.
- MDN: `developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion`.
- Expo Google Fonts: `github.com/expo/google-fonts`, npm registry (`@expo-google-fonts/onest`, `@expo-google-fonts/manrope`), распакованные npm-тарболы.
- Google Fonts: `fonts.google.com/metadata/fonts/Onest`, `fonts.google.com/metadata/fonts/Manrope` (официальный JSON API); апстрим `github.com/google/fonts` (`ofl/onest`, `ofl/manrope`).
- expo-font: `docs.expo.dev/versions/latest/sdk/font/`, `docs.expo.dev/router/web/static-rendering/`; исходники/плагин в `node_modules/expo-font/**`.
- Expo Config / app icons / splash: `docs.expo.dev/versions/latest/config/app/`, `docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/`, `docs.expo.dev/versions/latest/sdk/splash-screen/`; Android adaptive icon safe zone — `developer.android.com/develop/ui/compose/system/icon_design_adaptive`; исходники/плагин в `node_modules/expo-splash-screen/**`.
