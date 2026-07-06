## Project Structure

- `src/app/`: Next.js App Router entry points.
  - `layout.tsx`: app shell and global metadata.
  - `page.tsx`: main page (client component).
  - `native_entry/page.tsx`: native/Tauri entry route.
  - `globals.css`: global styles and Tailwind setup.
- `src/blocks/`: business-facing React UI blocks composed from base components.
  - Put app-specific composite UI here, such as search, playlist, player, history, settings, and auth blocks.
- `src/components/`: base reusable UI components and UI infrastructure.
  - Put framework-level or reusable primitives here.
  - Commonly categorized into `base/` (atomic UI), `composite/` (generic composite components), and `animation/` (transitions/animations).
- `src/core/`: core domain logic, algorithms, and pure app logic.
- `src/infra/`: infrastructure, platform adapters, Web IPC client, and utilities.
  - `*.client.ts`: browser/webview-only client integrations.
  - `web_ipc.client.ts`: frontend-side Tauri IPC adapter.
- `src/inject/`: client-side scripts injected directly into external WebViews.
  - Organized into `infra/` (environment/IPC polyfills) and `core/` (business/product logic injections), each using `index.ts` as the entry point.
- `src/sw/`: service worker source (built/packaged to `public/sw.js`).
  - `core/`: core service worker logic (e.g., image/video cache, playlist handlers).
  - `infra/`: service worker infrastructure/adapters (e.g., static resource cache).
  - `main.worker.ts`: entry worker script.
- `public/`: static assets, icons, `manifest.json`, and built SW entry.
- `scripts/`: local scripts.
- `cli/`: local CLI helper utilities.
- `draft/`: temporary sandboxes and development draft files.
- `src-tauri/`: Tauri (Rust) backend and native app configuration.
  - `src/main.rs`: desktop/mobile app entry point.
  - `src/lib.rs`: shared Tauri command/runtime wiring.
  - `src/commands/`: backend IPC commands exposed to the web frontend.
  - `src/webview/` and `src/window/`: controllers for Tauri WebView and native window management.
  - `src/logging.rs`: application logger setup.
  - `Cargo.toml` and `Cargo.lock`: Rust package manifest and lockfile.
  - `build.rs`: Tauri/Rust build script.
  - `tauri.conf.json`, `tauri.ios.conf.json`, `tauri.macos.conf.json`: platform configs.
  - `capabilities/`: Tauri capability allowlists.
  - `icons/`: app icons for desktop/mobile targets.
  - `gen/`: generated native project artifacts.
  - `target/`: Rust build outputs (generated).

## Naming Conventions

- Types, interfaces, classes, enums, and type aliases: `PascalCase` (e.g. `PlayerState`).
- React components: `PascalCase` filenames and exports (e.g. `GlobalSettingButton`).
- React component props types: component name plus `Props` in `PascalCase` (e.g. `PlayerProps`).
- Blocks: `PascalCase` filenames and exports under `src/blocks/`.
- React hooks: `camelCase` names starting with `use` (e.g. `useWindowSize`).
- Functions and methods: `snake_case` (e.g. `get_playlist_id_from_url`).
- Variables, parameters, refs, and state values: `snake_case` (e.g. `current_video_id`).
- Constants: `SCREAMING_SNAKE_CASE` for module-level immutable values (e.g. `DESKTOP_USER_AGENT`); use `snake_case` for local values.
- Type imports: use `import type` when importing only types.
- Path aliases: prefer `@/` for imports under `src/`.
- WebView injection scripts: entry point is `src-tauri/src/inject.ts` (source) and `src-tauri/src/inject.js` (compiled output). Sub-modules under `src/inject/` may use `*.inject.ts` naming.
- Type Definitions: Follow the proximity principle (define types close to where they are used). Avoid creating separate type files (like `types.ts` or `*.types.ts`) unless the type declarations are highly complex or repeatedly reused across multiple files.

## UI & Dialog Rules

- **Emoji Prohibition**: Do not use emojis in any UI text or icons.
- **Icons & SVGs**: Write SVG components in the corresponding `icons.tsx` based on the UI position (e.g., `src/components/icons.tsx` for generic component-level icons, `src/blocks/icons.tsx` for block-level business icons). Do not use inline SVGs or external icon library imports.
- **Modals & Dialogs**:
  - Do not use native window dialogs (`window.alert`, `window.confirm`, `window.prompt`).
  - Use [ModalContainer.tsx](src/components/composite/ModalContainer.tsx) to build modals and dialog components.
  - If a modal requires animations, cooperate with [AnimationContainer.tsx](src/components/animation/AnimationContainer.tsx).

## Layering Rules

- `src/components/` must not depend on `src/blocks/`.
- `src/blocks/` may depend on `src/components/`, `src/core/`, and `src/infra/`.
- `src/app/` is responsible for route entry points and composing blocks.
- Keep business UI out of `src/components/`, place it in `src/blocks/`.
- Non-UI Environments (`src/inject/` and `src/sw/`):
  - They **CAN** import modules from `src/core/` and `src/infra/` (excluding any React/UI-related modules).
  - They must **NEVER** import modules from UI-related directories: `src/app/`, `src/blocks/`, or `src/components/`.
  - Other direct subdirectories under `src/` (such as `src/app/`, `src/blocks/`, `src/components/`, `src/core/`, `src/infra/`) must **NEVER** import modules from `src/inject/` or `src/sw/` (except their compiled outputs).
- Web IPC Communications:
  - All communication between frontend Next.js and backend Rust must utilize the Web IPC layer (e.g., [web_ipc.client.ts](src/infra/web_ipc.client.ts)).
  - Shared data types used across the IPC boundary should follow the general type rules and be defined close to their usage/IPC client implementation.

## Base Rules

- Match existing naming, formatting, and import style in every file.
- Keep edits minimal and targeted; avoid sweeping reformatting.
- Do not add new dependencies unless necessary; always try to reuse existing interfaces.
- Interface Reuse & Search Priority:
  - Prioritize referencing the module's `index.ts` (e.g., `src/infra/index.ts`) and use the interfaces exported there.
  - If no `index.ts` exists, search the corresponding module directory to check for suitable interfaces.
  - If no suitable interface exists, design one yourself if it is simple. If it is complex or requires external dependencies, evaluate the dependency for stability, maintainability, and code quality first.
  - If no suitable dependency exists and the interface is important, design it cautiously and explicitly inform the developer; only proceed to output code after developer approval.
- Prioritize human readability: keep logic simple, direct, and minimal.
- Do not add verbose or convoluted logic just to make code "work".
- Avoid unnecessary fallback mechanisms.
- Prefer minimal implementation over defensive coding.
- If any files have been edited, use related tools to check if the edits are valid and acceptable
(e.g. `tsc`, `tsx`, `eslint`, `cargo`, `pyright`, `pylint`, `python`, `node`)
