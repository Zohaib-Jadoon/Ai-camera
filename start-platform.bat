@echo off
title Madad Vision AI - B2B Multi-Service Controller
cls

:: Clear screen and show premium ASCII header
:MENU
cls
echo ==============================================================
echo               MADAD VISION AI - MULTI-SERVICE SYSTEM
echo ==============================================================
echo.
echo  [1] QUICK START  - Launch Dev Servers Instantly (Skip Installs)
echo  [2] FULL SETUP   - Install Dependencies, Generate Client, ^& Launch
echo  [3] BUILD        - Compile Production Code (Next.js ^& NestJS)
echo  [4] EXIT         - Close Launcher
echo.
echo ==============================================================
set /p choice="Enter choice [1-4]: "

if "%choice%"=="1" goto QUICK_START
if "%choice%"=="2" goto FULL_SETUP
if "%choice%"=="3" goto BUILD_PROD
if "%choice%"=="4" goto EXIT
goto MENU

:QUICK_START
cls
echo ==============================================================
echo            LAUNCHING SERVICES INSTANTLY (QUICK START)
echo ==============================================================
echo [*] Spawning Node Dev Server (Backend + Frontend Next.js)...
start "Madad Vision AI - Web & Backend Services" cmd /k "npm run dev"

echo [*] Spawning Python AI Engine Server...
start "Madad Vision AI - Python AI Engine" cmd /k "cd apps\ai-engine && .venv\Scripts\activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo ==============================================================
echo            PLATFORM SERVERS LAUNCHED SUCCESSFULLY!
echo ==============================================================
echo.
echo  [*] Next.js Dashboard: http://localhost:3000
echo  [*] NestJS REST API:   http://localhost:3001
echo  [*] Python AI Engine:  http://localhost:8000
echo.
echo  [Note] Keep the spawned terminal windows open to keep servers running.
echo.
pause
goto EXIT

:FULL_SETUP
cls
echo ==============================================================
echo            RUNNING FULL ENVIRONMENT SETUP & INSTALL
echo ==============================================================
echo.
echo [*] Checking system prerequisites...
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js 20+ first.
    pause
    goto MENU
)
echo [OK] Node.js is installed.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed! Please install Python 3.11 first.
    pause
    goto MENU
)
echo [OK] Python is installed.
echo.

echo ==============================================================
echo            STEP 1: INSTALLING NODE MONOREPO DEPENDENCIES
echo ==============================================================
echo [*] Running npm install at root...
call npm install
set NODE_ERR=%errorlevel%
if %NODE_ERR% neq 0 (
    echo.
    echo [ERROR] Failed to install npm dependencies! Code: %NODE_ERR%
    pause
    goto MENU
)
echo [OK] Node packages installed successfully.
echo.

echo ==============================================================
echo            STEP 2: GENERATING DATABASE CLIENT (PRISMA)
echo ==============================================================
echo [*] Running Prisma Client generation in apps/backend...
cd apps\backend
call npx prisma generate
set PRISMA_ERR=%errorlevel%
cd ..\..
if %PRISMA_ERR% neq 0 (
    echo.
    echo [ERROR] Failed to generate Prisma Client! Code: %PRISMA_ERR%
    pause
    goto MENU
)
echo [OK] Prisma Client generated successfully.
echo.

echo ==============================================================
echo            STEP 3: PREPARING PYTHON AI VIRTUAL ENVIRONMENT
echo ==============================================================
cd apps\ai-engine

:: Create virtual env if not exists
if not exist .venv (
    echo [*] Creating Python virtual environment (.venv)...
    python -m venv .venv
    set VENV_ERR=%errorlevel%
    if %VENV_ERR% neq 0 (
        echo [ERROR] Failed to create virtual environment! Code: %VENV_ERR%
        cd ..\..
        pause
        goto MENU
    )
) else (
    echo [OK] Python virtual environment (.venv) already exists.
)

echo [*] Activating virtual environment and installing pip requirements...
call .venv\Scripts\pip install -r requirements.txt
set PIP_ERR=%errorlevel%
cd ..\..
if %PIP_ERR% neq 0 (
    echo.
    echo [ERROR] Failed to install Python dependencies! Code: %PIP_ERR%
    pause
    goto MENU
)
echo [OK] Python virtual environment ready.
echo.

echo ==============================================================
echo            SETUP COMPLETE! LAUNCHING DEV SERVICES...
echo ==============================================================
echo.
goto QUICK_START

:BUILD_PROD
cls
echo ==============================================================
echo            COMPILING PRODUCTION BUNDLES
echo ==============================================================
echo [*] Building NestJS & Next.js workspaces...
call npm run build
set BUILD_ERR=%errorlevel%
if %BUILD_ERR% neq 0 (
    echo.
    echo [ERROR] Production build failed! Code: %BUILD_ERR%
    pause
    goto MENU
)
echo.
echo [OK] Production build compiled successfully!
pause
goto MENU

:EXIT
echo.
echo Closing Madad Vision AI controller. Have a great meeting!
timeout /t 3 >nul
exit /b 0
