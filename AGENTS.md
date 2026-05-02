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
- `src/core/`: core domain logic and pure app logic.
- `src/infra/`: infrastructure, platform adapters, and shared types.
  - `*.client.ts`: browser-only utilities.
  - `types.ts`: shared types.
- `src/sw/`: service worker source (build/packaged to `public/sw.js`).
  - `fetch/`: fetch/cache worker modules.
- `public/`: static assets, icons, `manifest.json`, and built SW entry.
- `scripts/`: local scripts.
- `src-tauri/`: Tauri (Rust) backend and native app configuration.
  - `src/main.rs`: desktop/mobile app entry point.
  - `src/lib.rs`: shared Tauri command/runtime wiring.
  - `src/fetch.rs`: Rust-side fetch/network helpers.
  - `src/inject.ts` and `src/inject.js`: WebView injection script source/output.
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

## Layering Rules

- `src/components/` must not depend on `src/blocks/`.
- `src/blocks/` may depend on `src/components/`, `src/core/`, and `src/infra/`.
- `src/app/` is responsible for route entry points and composing blocks.
- Keep business UI out of `src/components/`, place it in `src/blocks/`.

## Base Rules

- Match existing naming, formatting, and import style in every file.
- Keep edits minimal and targeted; avoid sweeping reformatting.
- Do not add new dependencies unless necessary; always try to reuse existing interfaces.
- If no suitable interface exists, inform the developer and request adding one.
- If the interface is simple, you may design it yourself.
- If the interface is complex and would require external dependencies, evaluate the dependency for stability, maintainability, and code quality first.
- If no suitable dependency exists and the interface is important, design it cautiously and explicitly inform the developer; only proceed to output code after developer approval.
- Prioritize human readability: keep logic simple, direct, and minimal.
- Do not add verbose or convoluted logic just to make code "work".
- Avoid unnecessary fallback mechanisms.
- Prefer minimal implementation over defensive coding.
- If any files have been edited, use related tools to check if the edits are valid and acceptable
(e.g. `tsc`, `tsx`, `eslint`, `cargo`, `pyright`, `pylint`, `python`, `node`)
