# File Architect

File Architect is a native macOS application that helps developers and designers quickly create file structures from text descriptions. Available on [filearchitect.com](https://filearchitect.com).

## Development

This repository contains the core functionality for File Architect. The app is built using:

- Tauri (Rust + TypeScript)
- React
- Vite
- shadcn/ui components

### Building from Source

1. Install dependencies:

```bash
pnpm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Run in development:

```bash
pnpm run tauri dev
```

to rebuild with filearchitect/core

```bash
pnpm run tauri:dev
```

### Windows Development Setup

On Windows (especially ARM64), additional setup is required due to native compilation dependencies:

#### Prerequisites

1. **Visual Studio Build Tools 2022** with:

   - "Desktop development with C++" workload
   - "C++ ARM64 build tools" component (for ARM64 Windows)

2. **LLVM** (includes clang) - Install via:

   ```bash
   winget install LLVM.LLVM
   ```

3. **Native bindings for Windows ARM64** - Required packages:
   ```bash
   pnpm add -D @tauri-apps/cli-win32-arm64-msvc@^2.9.6 @rollup/rollup-win32-arm64-msvc@^4.57.1
   ```

#### Running on Windows

Due to MSVC environment requirements, use the provided batch file:

```bash
npm run tauri:dev:msvc
```

Or directly:

```bash
.\tauri-dev.bat
```

This batch file will:

- Set up the MSVC environment for ARM64
- Add LLVM/clang to PATH (required for the `ring` crate)
- Configure compiler environment variables
- Build the monorepo and start the Tauri dev server

**Notes:**

- If you encounter "clang not found" errors, restart your terminal after installing LLVM to refresh the PATH, or the batch file will attempt to add it automatically.
- If you see "Cannot find native binding" errors, ensure `@tauri-apps/cli-win32-arm64-msvc` is installed (see Prerequisites above).

### Testing License Types (Development Only)

During development, you can override the license type to test different user experiences without needing actual licenses:

1. Create a `.env` file in the project root
2. Add the following variables:

```
VITE_OVERRIDE_LICENSE=trial
VITE_MAX_LINES_FREE_VERSION=10
```

Valid `VITE_OVERRIDE_LICENSE` values:

- `trial` - Creates a trial license that expires in 7 days (shows line limits)
- `once` - Creates a lifetime license (never expires, no limits)
- `yearly` - Creates a yearly license that expires in 1 year (no limits while active)

The `VITE_MAX_LINES_FREE_VERSION` variable controls how many lines trial users can create before hitting the limit.

**Note:** These overrides only work in development mode (`npm run tauri dev`) and will be ignored in production builds.

### Build and deploy

```bash
scripts/build.sh
```

### Building Windows on macOS (cross-compile)

You can build the Windows x64 executable from macOS using the provided script. This uses [xwin](https://github.com/Jake-Shadle/xwin) for the Windows CRT/SDK and LLVM (clang-cl, lld-link) for cross-compilation.

#### Prerequisites

1. **Rust Windows target**

   ```bash
   rustup target add x86_64-pc-windows-msvc
   ```

2. **LLVM and LLD** (Homebrew; keg-only, so not on PATH by default)

   ```bash
   brew install llvm lld
   ```

   - `llvm` provides `clang-cl` and `llvm-lib` (C/C++ compiler and archiver for the Windows target).
   - `lld` provides `lld-link` (linker). The main `llvm` formula does not include it.

3. **xwin** (downloads and unpacks the Windows CRT and SDK for use by clang)
   ```bash
   cargo install xwin
   ```

#### First run

The first time you run the build, `xwin splat` will download and extract the Windows CRT and SDK to `~/.xwin` (or `$XWIN_DIR` if set). This is one-time.

#### Build

From the project root:

```bash
./scripts/build_windows.sh
```

The script will:

- Ensure LLVM and LLD are on `PATH`.
- Run `xwin splat` if `~/.xwin` is not set up.
- Set cross-compilation env vars (`CC`, `AR`, `CFLAGS`, `RUSTFLAGS`, etc.) for `x86_64-pc-windows-msvc`.
- Clean `dist/` and `src-tauri/target/`, then run the production Tauri build with `--target x86_64-pc-windows-msvc --no-bundle`.
- Optionally deploy: upload the `.exe` to Backblaze B2 and notify the website API (same flow as the macOS build script).

**Output:** The Windows executable is produced at:

```
src-tauri/target/x86_64-pc-windows-msvc/release/filearchitect-app.exe
```

**Note:** The NSIS/MSI installer is not created when cross-compiling from macOS (`--no-bundle`). Only the `.exe` is built. To generate installers, build on Windows.

#### Deploy (optional)

When the script asks “Do you want to deploy this build?”, answering **Y** will:

1. Ask for the version (defaults to the one in `package.json`).
2. Upload the exe to B2 as `releases/File Architect_<version>_x64.exe`.
3. If a minisign signature file exists (`filearchitect-app.exe.sig`), upload it too (for the in-app updater).
4. POST the version and download URL to `https://filearchitect.com/api/updates-.../windows`.

**Deploy prerequisites:** `b2` CLI installed and authorized, and `UPDATE_API_PASSWORD` must be set in your environment. For in-app updater support, sign the exe with minisign and place the `.sig` file next to the exe before deploying.

### Additional notes

#### Machine ID

Licensing works by sending the the machine unique id to filearchitect.com/api/v1/machine. It is used to identify the machine to the server.

The settings can be overridden by creating a file at `~/Documents/fa.json` with the following content:

```json
{
  "machineId": "my-machine-name"
}
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

To build for debug version

```bash
pnpm run tauri build --debug
```
