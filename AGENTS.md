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
  - [debug/](cli/debug): frontend debug bridge utility (SSE & HTTP server) for host-to-browser agent communication.
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

## Naming Conventions (Statically enforced by ESLint)

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

- **Emoji Prohibition (Statically enforced by ESLint)**: Do not use emojis in any UI text or icons.
- **Color Restrictions (AI Only)**: Do not use a large number of colors when designing the UI. Only black, white, gray, and colors controlled by transparency/opacity are allowed. (Humans are exempt, but AI must strictly follow this to avoid flashy layout designs).
- **Icons & SVGs (Statically enforced by ESLint)**: Write SVG components in the corresponding `icons.tsx` based on the UI position (e.g., `src/components/icons.tsx` for generic component-level icons, `src/blocks/icons.tsx` for block-level business icons). Do not use inline SVGs or external icon library imports.
- **Modals & Dialogs**:
  - Do not use native window dialogs (`window.alert`, `window.confirm`, `window.prompt`). (Statically enforced by ESLint).
  - Use [ModalContainer.tsx](src/components/composite/ModalContainer.tsx) to build modals and dialog components.
  - If a modal requires animations, cooperate with [AnimationContainer.tsx](src/components/animation/AnimationContainer.tsx).

## Layering Rules (Statically enforced by ESLint)

- **UI vs Non-UI Directories**: Only `src/app/`, `src/blocks/`, and `src/components/` are allowed to contain UI code. All other directories under `src/` (such as `src/core/`, `src/infra/`, `src/inject/`, `src/sw/`) are Non-UI environments.
- **UI Isolation**: Non-UI environments must NEVER import modules from UI-related directories (`src/app/`, `src/blocks/`, or `src/components/`).
- **Unidirectional UI Dependency**: `src/components/` (atomic reusable components) must NEVER depend on `src/blocks/` (composite UI blocks) or `src/app/` (route entry points). Keep business UI out of `src/components/`, place it in `src/blocks/`.
- **Web IPC Communications**:
  - All communication between frontend Next.js and backend Rust must utilize the Web IPC layer (e.g., [web_ipc.client.ts](src/infra/web_ipc.client.ts)).
  - Shared data types used across the IPC boundary should follow the general type rules and be defined close to their usage/IPC client implementation.

## Base Rules

- **Minimalist & Clean Code**: Keep edits minimal, direct, and targeted. Avoid sweeping reformatting, unnecessary fallback mechanisms, and defensive over-engineering. Prioritize human readability and simplicity.
- **Refactor Before Feature**: If a new feature depends on existing mechanisms, first review if they can support the new design. Do not force new mechanisms into a design that cannot accommodate them. Propose a local refactoring plan for the existing code first, then **stop and seek developer approval** before making any changes.
- **Style Consistency**: Match existing naming, formatting, and import styles in every file.
- **Interface Reuse & Dependencies**: Prioritize importing from the module's `index.ts` (or the module directory) first. Only design new interfaces if none exist. Do not add new dependencies or design complex public interfaces without developer approval.
- **Local Verification**: After editing any files, run verification tools (e.g. `tsc`, `eslint`, `cargo`) to ensure changes are valid and compile correctly.

## AI Debugging & Communication (Frontend Debug Bridge)

When running the Next.js dev server via `npm run dev`, a debug bridge is automatically launched via [launch.ts](cli/debug/launch.ts) that allows direct, silent bidirectional communication with the browser/Tauri webview context. Before starting the dev server, check if the dev server is already running to avoid duplicate/repeated runs.
- **Frontend Logs**: Read [logs.jsonl](.debug/logs.jsonl) (in JSON Lines format) to inspect console output and errors in real-time.
- **Execute Commands**: Synchronously execute JavaScript code in the browser/Tauri webview context using [eval.js](cli/debug/eval.js):
  ```bash
  node cli/debug/eval.js "document.title"
  ```
  This will print the response directly to stdout, for example:
  ```json
  {
    "success": true,
    "result": "Hello!"
  }
  ```
- **Execution History**: The history of executed commands and their results is stored in [history.jsonl](.debug/history.jsonl).
- **Sub-Agent Delegation**: When implementing new features or fixing bugs, prefer delegating validation and log monitoring to a sub-agent. The sub-agent should actively use the Frontend Debug Bridge to execute tests, verify UI correctness, and tail [logs.jsonl](.debug/logs.jsonl) to ensure no regressions or runtime console errors are introduced.
