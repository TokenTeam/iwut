---
name: migrate-to-strict-api
description: >
  Use when migrating a React Native project to the Strict TypeScript API —
  the default JavaScript API from React Native 0.87, available as an opt-in
  preview since 0.80. Handles tsconfig.json setup, dependency updates,
  rewriting deep imports to root imports, and resolving breaking type
  changes. Invoke with `/migrate-to-strict-api`.
license: MIT
metadata:
  author: react-native-community
  version: 0.1.0
---

# Migrate to Strict TypeScript API

Migrate a React Native project to the [Strict TypeScript API](https://reactnative.dev/docs/strict-typescript-api) — auto-generated TypeScript types, scoped to `react-native`'s root exports. The Strict API is the **default from React Native 0.87**, and an opt-in preview on 0.80–0.86.

This migration affects TypeScript analysis only. Nothing changes in the bundle or at runtime, so it is safe to apply incrementally and there is no shipping risk.

## Invocation

```
/migrate-to-strict-api
```

## Step-by-step procedure

Follow every step below **in order**. Do not skip steps.

### 1. Verify prerequisites

- Read `package.json` and confirm the `react-native` version is **>= 0.80**. If not, stop and tell the user to upgrade first. Record whether the version is **>= 0.87** — this decides steps 3 and 5.
- Confirm `tsconfig.json` exists.
- Confirm `node_modules/react-native/types_generated/index.d.ts` exists. If not, tell the user to run their package manager install first.

### 2. Update dependencies

Some libraries ship raw TypeScript source that is type-checked as part of the user's project — most commonly Jest mock entry points imported from a setup file. Under the Strict API these produce errors located under `node_modules`, typically `TS2307: Cannot find module 'react-native/Libraries/...'`, which the user cannot fix in their own code.

- Confirm `skipLibCheck` is enabled (`@react-native/typescript-config` sets it). Do not disable it.
- Whenever type errors are located under `node_modules/<package>` — at any point in this migration — update that package first, checking its releases for a Strict API compatibility fix. Known fixed versions are listed in [references/library-compatibility.md](references/library-compatibility.md).
- If no fixed release exists, apply a local fix by redirecting the imported subpath to an untyped stub, and tell the user to report the incompatibility to the library:

```json
{
  "compilerOptions": {
    "paths": {
      "some-library/jest/mock": ["./untyped-module.d.ts"]
    }
  }
}
```

```ts
// untyped-module.d.ts
declare const anyExport: unknown;
export default anyExport;
```

An inline `@ts-ignore` does not work for this case — the errors are reported inside the library's files, not at the import site.

### 3. Enable the Strict API in `tsconfig.json`

**React Native >= 0.87** — the Strict API is the default:

- If `compilerOptions.customConditions` contains `"react-native-legacy-deep-imports"`, remove that entry (it is the temporary opt-out, due for removal in a future release), keeping `"react-native"` in place.
- Otherwise, no config change is needed.

**React Native 0.80–0.86** — opt in:

- Add `"customConditions": ["react-native", "react-native-strict-api"]` to `compilerOptions`. **Both entries are required**: `customConditions` replaces (not merges with) the value from an extended config, so omitting `"react-native"` drops the standard condition set by `@react-native/typescript-config` and breaks module resolution for packages that key on it. The project must use `"moduleResolution": "bundler"` (or `"node16"` / `"nodenext"`) for custom conditions to take effect.

### 4. Fix deep imports

#### 4a. Run the ESLint autofix first

`@react-native/eslint-plugin` ships a `no-deep-imports` rule with a code autofixer that rewrites known deep imports (default and type imports) to root imports. If the plugin is installed — it is bundled with `@react-native/eslint-config` — enable the rule in the project's ESLint config:

```json
{"@react-native/no-deep-imports": "error"}
```

Then run ESLint with `--fix` across the project source. Recommend keeping the rule enabled afterwards to prevent regressions.

#### 4b. Manual pass for the remainder

Read `node_modules/react-native/types_generated/index.d.ts`. This file is the source of truth for every export available under the Strict API. Each line maps an internal source path to an exported name:

```ts
export { default as Alert } from "./Libraries/Alert/Alert";
export type { AlertButton } from "./Libraries/Alert/Alert";
```

Parse this file to build two mappings:

- **Value exports**: internal path + original name → exported name (e.g. `./Libraries/Alert/Alert` default → `Alert`)
- **Type exports**: internal path → list of exported type names (e.g. `./Libraries/Alert/Alert` → `AlertType`, `AlertButton`, ...)

Search all source files (`.ts`, `.tsx`, `.js`, `.jsx`) for remaining imports from `react-native/Libraries/...` or `react-native/src/...` subpaths, and rewrite each using the mapping:

| Deep import pattern | Replacement |
| --- | --- |
| `import Foo from 'react-native/Libraries/.../Foo'` | `import {Foo} from 'react-native'` |
| `import type {FooProps} from 'react-native/Libraries/.../Foo'` | `import type {FooProps} from 'react-native'` |
| `import {named} from 'react-native/Libraries/.../Foo'` | `import {named} from 'react-native'` |

When a file already has a `react-native` root import, merge into it rather than adding a duplicate.

**Codegen imports** move to the `CodegenTypes` namespace:

```ts
// Before
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';
import type {Int32, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';

// After
import {codegenNativeComponent, codegenNativeCommands} from 'react-native';
import type {CodegenTypes} from 'react-native';

// Usage changes: Int32 → CodegenTypes.Int32, WithDefault<...> → CodegenTypes.WithDefault<...>
```

**`InitializeCore`** is a side-effect entry point with no root export — replace it with the dedicated subpath (usually found in Jest setup files and custom entry points):

```diff
- import 'react-native/Libraries/Core/InitializeCore';
+ import 'react-native/setup-env';
```

If a deep import path does not appear in the mapping, it is intentionally private. Look for a root-API alternative; if none covers the use case, flag it to the user and point them to the [feedback thread](https://github.com/react-native-community/discussions-and-proposals/discussions/1015). Note that `react-native/src/private/*` imports are also removed at runtime in 0.87 — those usages must be removed, not just retyped.

#### 4c. Leave Jest string mocks alone

Do not rewrite `jest.mock('react-native/Libraries/...')` or `jest.requireActual(...)` path strings. Module resolution in Jest and Metro is unchanged — these keep working, and TypeScript does not check them. Only when a test file imports a deep path as a module does TypeScript error; where no root export covers the use case, keep the import and suppress the error explicitly:

```ts
// @ts-expect-error - React Native internal, untyped under the Strict API
import NativeAppState from 'react-native/Libraries/AppState/NativeAppState';
```

### 5. Run typecheck and fix remaining type errors

Run `npx tsc --noEmit`. Fix errors iteratively using these known patterns:

#### Component ref and instance types

Core components are now typed as function components, so a component name no longer works as an instance type (`useRef<TextInput>` refers to the component function, and methods like `.focus()` appear missing). This is the most common blocker.

- **On 0.87+**, use the dedicated `*Instance` types — every ref-supporting core component exports one (`ViewInstance`, `TextInputInstance`, `ScrollViewInstance`, `FlatListInstance`, ...). Components without ref support have no instance type: `InputAccessoryView`, `TouchableWithoutFeedback`, `experimental_LayoutConformance`.
- **On 0.80–0.86**, use `React.ComponentRef<typeof Component>` — it resolves the same instance type and works under both the Strict API and the legacy types.

```ts
// Before
const inputRef = useRef<TextInput>(null);

// After (0.87+) — preferred
const inputRef = useRef<TextInputInstance>(null);

// After (any version) — equivalent
const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
```

Apply this everywhere a component name is used as an instance type: `useRef` / `createRef` type arguments, `ref` props on wrapper components (`ref?: React.Ref<ViewInstance>`), `React.forwardRef<View, Props>` type arguments, and variables holding instances.

Related replacements:

- `Animated.LegacyRef<View>` is removed — use the plain `*Instance` type; `*Instance` types work transparently with `Animated.*` component variants.
- `NativeMethods` / `NativeMethodsMixin` are removed — use `HostInstance`, or the specific `*Instance` type.

#### `*Static` types removed

The API name itself is now exported as both the value and its type:

```ts
// Before
import {Linking, LinkingStatic} from 'react-native';
function foo(linking: LinkingStatic) {}

// After
import {Linking} from 'react-native';
function foo(linking: Linking) {}
```

Where no same-name type existed previously (`InteractionManagerStatic`, `PixelRatioStatic`, `DevMenuStatic`, `KeyboardStatic`, `DevSettingsStatic`, `NativeModulesStatic`), use `typeof` the value instead (e.g. `typeof PixelRatio`).

Full list: `AlertStatic`, `ActionSheetIOSStatic`, `ToastAndroidStatic`, `InteractionManagerStatic`, `UIManagerStatic`, `PlatformStatic`, `SectionListStatic`, `PixelRatioStatic`, `AppStateStatic`, `AccessibilityInfoStatic`, `ImageResizeModeStatic`, `BackHandlerStatic`, `DevMenuStatic`, `ClipboardStatic`, `PermissionsAndroidStatic`, `ShareStatic`, `DeviceEventEmitterStatic`, `LayoutAnimationStatic`, `KeyboardStatic`, `DevSettingsStatic`, `I18nManagerStatic`, `EasingStatic`, `PanResponderStatic`, `NativeModulesStatic`, `LogBoxStatic`, `PushNotificationIOSStatic`, `SettingsStatic`, `VibrationStatic`

#### Animated type changes

Animated nodes are no longer generic — they are non-generic types with a generic `interpolate` method. Remove type parameters from `Animated.Value`, `Animated.ValueXY`, etc.

#### Deprecated `*Properties` aliases

The legacy `*Properties` aliases are removed. Rename to the matching `*Props` type: `ViewProperties` → `ViewProps`, `TextProperties` → `TextProps`, `ImageProperties` → `ImageProps`, etc. — plus `ImagePropertiesSourceOptions`, which becomes `ImageSourcePropType`.

#### `StyleSheet.absoluteFillObject`

Not part of the Strict API. Replace with `StyleSheet.absoluteFill`, which is equivalent and works under both API modes:

```tsx
// Before
style={{...StyleSheet.absoluteFillObject, borderRadius: 12}}

// After
style={{...StyleSheet.absoluteFill, borderRadius: 12}}
```

#### `useColorScheme()` and `'unspecified'`

The return type no longer includes `'unspecified'` — this value was inaccurately typed in the old manual types and never occurred at runtime. Check for `'dark'` and default to `'light'`:

```ts
// Before — handles a case that cannot occur
const theme = scheme === 'unspecified' ? 'light' : scheme;

// After
const theme = scheme === 'dark' ? 'dark' : 'light';
```

#### Optional props are `type | undefined`

Every optional prop is now typed as `type | undefined`. Wrapper types that re-declare React Native props may need widening to match.

#### Internal helper types

`RecursiveArray`, `RegisteredStyle`, `Falsy`, `WithAnimatedArray`, `WithAnimatedObject`, and other internal-only helpers are no longer accessible from `react-native`. Inline the type definition or find an alternative.

#### Leftover component props removed

Props that existed only in the old type definitions were removed — for example `lineBreakMode` on `Text`, `scrollWithoutAnimationTo` on `ScrollView`, and transform styles declared outside the `transform` array. Remove or replace these usages.

### 6. Verify

- Run `npx tsc --noEmit` again. Confirm zero type errors remain.
- If the project has a Jest suite, run it. Mocks are unaffected by this migration; investigate any new failure before proceeding.

Present a summary of all changes:

- Files modified (count)
- Deep imports rewritten (count)
- Type errors fixed (by category)
- Anything flagged for the user (private APIs with no root equivalent, library incompatibilities)

## Bailing out

If the migration cannot be completed — an unresolvable library incompatibility, a larger error count than the user wants to absorb now, or the user asks to defer — the project can temporarily revert to the legacy types:

- **React Native >= 0.87**: set `"customConditions": ["react-native", "react-native-legacy-deep-imports"]` in `compilerOptions` (both entries required, as in step 3). This opt-out is temporary and due for removal in a future release.
- **React Native 0.80–0.86**: remove `"react-native-strict-api"` from `customConditions`, restoring its previous value.

Do not revert completed work that is valid under both API modes — it remains forward progress for a later attempt:

- Deep imports rewritten to root imports
- `CodegenTypes` namespace usage (also exported when the Strict API is not enabled)
- `react-native/setup-env`
- Ref types written as `React.ComponentRef<typeof Component>`

The exception is `*Instance` ref types, which only exist under the Strict API — when bailing out after step 5, convert these to the equivalent `React.ComponentRef<typeof Component>` form. If a bail-out seems likely from the start, prefer that form throughout.

When bailing out on 0.87+, encourage the user to share what blocked them in the [opt-out discussion thread](https://github.com/react-native-community/discussions-and-proposals/discussions/1015).
