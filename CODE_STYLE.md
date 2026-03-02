# Code Structure & Style Guide

This guide documents the current project structure and code style. It is for developers and AI agents. Follow it strictly to keep new code consistent with this repo.

## Project Structure

- `src/app/`: Next.js App Router entry points.
    - `layout.tsx`: app shell and global metadata.
    - `page.tsx`: main page (client component).
    - `native_entry/page.tsx`: native/Tauri entry route.
    - `globals.css`: global styles and Tailwind setup.
- `src/components/`: UI components (mostly client components).
- `src/infra/`: data, device, player, and YouTube helpers.
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

- Components: `PascalCase` filenames and exports (e.g. `Player.tsx`, `GlobalSettingButton`).
- Hooks: `useSomething` functions in `src/components/hooks.tsx`.
- Utilities: snake_case function names are common (e.g. `get_playlist_id_from_url`).
- Variables: snake_case is widely used (`current_video_id`, `history_playlist_resources_ref`).
- Type imports: use `import type` when importing only types.
- Path aliases: prefer `@/` for imports under `src/`.

## Formatting and Style

- Indentation: 4 spaces.
- Quotes: double quotes for strings.
- Semicolons: generally omitted in `src/` files; follow local file style if different.
- Trailing commas: mixed; keep existing style in the file you edit.
- Spacing: keep current patterns, including compact object/array spacing (e.g. `{width,height}`).
- Comments: use sparingly, only for non-obvious logic or warnings.

## React and TypeScript

- Default to function components and hooks.
- Client components must start with `"use client"` at the top of the file.
- Keep state and refs in snake_case.
- Prefer `useCallback` for callbacks passed to children.
- Keep TypeScript `strict` compatibility; do not disable type checks.
- Avoid reformatting; preserve local patterns when touching a file.

## Styling

- Tailwind CSS is used via `@import "tailwindcss";` in `src/app/globals.css`.
- Components mix Tailwind utility classes with inline styles when needed.
- Global theme variables live in `:root` and `@theme inline`.
- Keep className strings intact; avoid re-ordering classes unless necessary.

## Service Worker

- Source lives under `src/sw/`.
- Built/served SW entry is `public/sw.js`.
- Avoid direct edits to generated assets unless explicitly required.

## AI-Specific Rules (Must Follow)

- Match existing naming, formatting, and import style in every file.
- Do not introduce new conventions (e.g. camelCase variables in a snake_case file).
- Preserve file-local style even if it differs from other files.
- Keep edits minimal and targeted; avoid sweeping reformatting.
- Use `@/` imports for `src/` modules unless the file already uses relative paths.
- Do not add new dependencies unless necessary; always try to reuse existing interfaces, especially under `src/infra/`.
- If no suitable interface exists, inform the developer and request adding one.
- If the interface is simple, you may design it yourself.
- If the interface is complex and would require external dependencies, evaluate the dependency for stability, maintainability, and code quality first.
- If no suitable dependency exists and the interface is important, design it cautiously and explicitly inform the developer; only proceed to output code after developer approval.
- Prioritize human readability: keep logic simple, direct, and minimal.
- Do not add verbose or convoluted logic just to make code "work".
- Avoid unnecessary fallback mechanisms; this is a maintainable application, not a script.
- Prefer minimal implementation over defensive coding by default.
- For non-critical risks, add a concise comment about the caveat instead of implementing extra defensive branches unless explicitly requested.
