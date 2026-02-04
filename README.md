# nextkit

**Nextkit** is a modern, cross-platform application framework designed with the philosophy that "The Web is the Application." It allows you to build a single codebase using web technologies and deploy it as a high-performance Web App, a Progressive Web App (PWA), and a Native Desktop/Mobile application.

## Features

- **True Cross-Platform**: Write once, deploy everywhere—Web, PWA, and Native (Windows, macOS, Linux, iOS, and Android).
- **Web-First Philosophy**: Leverages the power of modern web standards to provide a seamless experience across all platforms.
- **Next.js Power**: Built on the latest Next.js 15+ for optimized routing, rendering, and developer experience.
- **Native Performance**: Uses **Tauri 2.0** to provide native system access and small binary sizes with a Rust-based backend.
- **PWA Ready**: Includes a built-in Service Worker architecture for offline capabilities and installation.

## Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) (React 19)
- **Native Bridge**: [Tauri](https://tauri.app/) (Rust)
- **Service Worker**: [esbuild](https://esbuild.github.io/) for SW bundling
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/), [Rust](https://www.rust-lang.org/)

## Getting Started

### Prerequisites
#### Web
- [Node.js](https://nodejs.org/) (v20 or later)
#### Native (Optional)
- [Rust](https://www.rust-lang.org/)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
- [Tauri CLI](https://crates.io/crates/tauri-cli)
```bash
cargo install tauri-cli
```
- [Other System Dependencies](https://tauri.app/start/prerequisites/)

### Installation

```bash
npm install
```

## Development Commands

Development scripts are managed via `package.json`.

| Command               | Description                                                                   |
|:----------------------|:------------------------------------------------------------------------------|
| `npm run dev`         | Starts the Next.js dev server (port 4000) and the Service Worker watcher.     |
| `npm run build`       | Builds the static export of the site and minifies the Service Worker.         |
| `npm run start`       | Serves the production build locally (from the `out` directory).               |
| `npm run tauri <cmd>` | Executes Tauri commands (e.g., `npm run tauri dev` or `npm run tauri build`). |

### Running Native App

To start the native application in development mode:
```bash
npm run tauri dev
```

To build the native application for production:
```bash
npm run tauri build
```

To start the native mobile application in development mode:
```bash
npm run tauri ios dev
npm run tauri android dev
```

To build the native mobile application for production:
```bash
npm run tauri ios build
npm run tauri android build
```

## Project Structure

- `src/app/`: Next.js App Router pages and layouts.
- `src/components/`: Reusable React components.
- `src/infra/`: Core TypeScript infrastructure, types, and utility libraries.
- `src/sw/`: Service Worker source code.
- `src-tauri/`: Rust backend and native configuration.
- `public/`: Static assets, including icons and the bundled `sw.js`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Learn Tauri](https://tauri.app/learn/) - a framework for building tiny, fast binaries for all major desktop and mobile platforms.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
