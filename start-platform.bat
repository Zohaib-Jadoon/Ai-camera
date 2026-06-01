@echo off
title Madad Vision AI - One-Click Platform Launcher
cls

echo ==============================================================
echo               MADAD VISION AI PLATFORM LAUNCHER
echo ==============================================================
echo.
echo [*] Checking system prerequisites...
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js 20+ first.
    pause
    exit /b 1
)
echo [OK] Node.js is installed.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed! Please install Python 3.11 first.
    pause
    exit /b 1
)
echo [OK] Python is installed.

echo.
echo ==============================================================
echo            STEP 1: INSTALLING NODE DEPENDENCIES
echo ==============================================================
echo [*] Installing monorepo node packages...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm dependencies!
    pause
    exit /b 1
)
echo [OK] Node packages installed successfully.
echo.

echo ==============================================================
echo            STEP 2: GENERATING DATABASE CLIENT
echo ==============================================================
echo [*] Running Prisma Client generation in apps/backend...
cd apps\backend
call npx prisma generate
cd ..\..
if %errorlevel% neq 0 (
    echo [ERROR] Failed to generate Prisma Client!
    pause
    exit /b 1
)
echo [OK] Prisma Client generated successfully.
echo.

echo ==============================================================
echo            STEP 3: PREPARING PYTHON AI ENGINE
echo ==============================================================
cd apps\ai-engine

:: Create virtual env if not exists
if not exist .venv (
    echo [*] Creating Python virtual environment (.venv)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment!
        cd ..\..
        pause
        exit /b 1
    )
) else (
    echo [OK] Python virtual environment (.venv) already exists.
)

echo [*] Activating .venv and installing requirements...
call .venv\Scripts\pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies!
    cd ..\..
    pause
    exit /b 1
)
echo [OK] Python dependencies installed successfully.
cd ..\..
echo.

echo ==============================================================
echo            STEP 4: LAUNCHING SERVICES (ONE-CLICK)
echo ==============================================================
echo [*] Spawning Node Dev Server (Backend + Frontend Next.js)...
start "Madad Vision AI - Web & Backend Services" cmd /k "npm run dev"

echo [*] Spawning Python AI Engine Server...
start "Madad Vision AI - Python AI Engine" cmd /k "cd apps\ai-engine && .venv\Scripts\activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo ==============================================================
echo            PLATFORM LAUNCHED SUCCESSFULLY!
echo ==============================================================
echo.
echo  [*] Next.js Dashboard: http://localhost:3000
echo  [*] NestJS REST API:   http://localhost:3001
echo  [*] Python AI Engine:  http://localhost:8000
echo.
echo  [Note] Keep the spawned terminal windows open to keep servers running.
echo.
pause
