@echo off
setlocal enabledelayedexpansion
REM Batch file to set up MSVC environment and run tauri:dev
REM This is needed for Windows ARM64 builds that require native compilation (ring crate)

REM Find Visual Studio vcvarsall.bat (check BuildTools first, then full VS installations)
set "VCVARSALL="
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
) else if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvarsall.bat"
) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat"
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files (x86)\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files (x86)\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvarsall.bat"
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat" (
    set "VCVARSALL=C:\Program Files (x86)\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat"
)

if "%VCVARSALL%"=="" (
    echo Error: Visual Studio Build Tools not found.
    echo Please install Visual Studio 2022 with "Desktop development with C++" workload.
    exit /b 1
)

echo Setting up MSVC environment for ARM64...
call "%VCVARSALL%" arm64
if errorlevel 1 (
    echo Native ARM64 not available, trying x64_arm64 cross-compilation...
    call "%VCVARSALL%" x64_arm64
    if errorlevel 1 (
        echo Error: Failed to set up MSVC environment.
        echo Please ensure "C++ ARM64 build tools" are installed in Visual Studio.
        echo In Visual Studio Installer, go to Individual Components and install:
        echo   - MSVC v143 - VS 2022 C++ ARM64 build tools (Latest)
        exit /b 1
    )
)

REM Add LLVM/clang to PATH if not already there (needed for ring crate)
set "LLVM_BIN="
if exist "C:\Program Files\LLVM\bin\clang.exe" (
    set "LLVM_BIN=C:\Program Files\LLVM\bin"
) else if exist "C:\Program Files (x86)\LLVM\bin\clang.exe" (
    set "LLVM_BIN=C:\Program Files (x86)\LLVM\bin"
)
if defined LLVM_BIN (
    where clang.exe >nul 2>&1 || set "PATH=!LLVM_BIN!;!PATH!"
    where clang.exe >nul 2>&1 && echo Clang found in PATH || echo Warning: Clang still not found
) else (
    echo Warning: LLVM not found - ring crate may fail to build
)

REM Explicitly set CC and CXX to use cl.exe (MSVC) instead of clang
REM This is required for the ring crate on Windows ARM64
set "CL_FULL_PATH="
where cl.exe >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%i in ('where cl.exe 2^>nul') do (
        set "CL_FULL_PATH=%%i"
        goto :found_cl
    )
)
:found_cl
if defined CL_FULL_PATH (
    set "CC_aarch64_pc_windows_msvc=!CL_FULL_PATH!"
    set "CXX_aarch64_pc_windows_msvc=!CL_FULL_PATH!"
    set "CC=!CL_FULL_PATH!"
    set "CXX=!CL_FULL_PATH!"
    echo Configured CC and CXX to use MSVC: !CL_FULL_PATH!
) else (
    echo Error: cl.exe not found after vcvarsall setup
    exit /b 1
)

echo MSVC environment configured. Building monorepo and running tauri dev...
cd /d "%~dp0"
cd ..\filearchitect
call npm run build
if errorlevel 1 (
    echo Error: Failed to build monorepo.
    exit /b 1
)
cd ..\filearchitect-app
call pnpm prune
call pnpm update
call npm run tauri dev
