@echo off
chcp 65001 >nul
title SaaSVala Bulk Uploader
color 0A

echo ╔══════════════════════════════════════════════════════════════╗
echo ║          SaaSVala GitHub Bulk Uploader                       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set /p TOKEN=Apna GitHub Token paste karo (ghp_...): 

if "%TOKEN%"=="" (
    echo Token nahi diya! Exit ho raha hai...
    pause
    exit /b 1
)

echo.
echo Token mila! Ab upload shuru...
echo.

set SUCCESS=0
set FAIL=0

for /D %%F in (*) do (
    if not "%%F"==".git" (
        echo ─────────────────────────────────────────
        echo Uploading: %%F
        
        cd "%%F"
        
        REM Create repo via GitHub API
        curl -s -X POST -H "Authorization: token %TOKEN%" -H "Accept: application/vnd.github.v3+json" "https://api.github.com/user/repos" -d "{\"name\":\"%%F\",\"private\":false}" >nul 2>&1
        
        REM Initialize git if needed
        if not exist ".git" git init -q 2>nul
        
        REM Setup remote
        git remote remove origin 2>nul
        git remote add origin "https://%TOKEN%@github.com/SaaSVala/%%F.git"
        
        REM Add and commit
        git add -A 2>nul
        git commit -q -m "Initial commit via SaaSVala Uploader" 2>nul
        
        REM Push
        git branch -M main 2>nul
        git push -u origin main --force -q 2>nul
        
        if %ERRORLEVEL%==0 (
            echo ✓ Done: %%F
            set /a SUCCESS+=1
        ) else (
            echo ✗ Failed: %%F
            set /a FAIL+=1
        )
        
        cd ..
        
        REM Small delay
        timeout /t 1 /nobreak >nul
    )
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    UPLOAD COMPLETE!                          ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo ✓ Success: %SUCCESS%
echo ✗ Failed: %FAIL%
echo.
echo All repos: https://github.com/SaaSVala?tab=repositories
echo.
pause
