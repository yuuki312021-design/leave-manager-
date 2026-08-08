@echo off
echo 有給休暇管理アプリを起動中...
cd /d "%~dp0"
start "leave-manager" cmd /c "npm run dev"
timeout /t 5 /nobreak >nul
start "ngrok" cmd /c "npx ngrok http 3000"
echo.
echo アプリ起動完了！
echo ローカル: http://localhost:3000
echo 外部URL: ngrokのウィンドウに表示されます
echo.
pause
