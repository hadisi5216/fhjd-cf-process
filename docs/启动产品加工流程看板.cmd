@echo off
chcp 65001 >nul
setlocal

set "DASHBOARD_URL=http://192.168.1.180/screen"

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if not exist "%EDGE%" (
    set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)

if not exist "%EDGE%" (
    set "EDGE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
)

if not exist "%EDGE%" (
    echo 未找到 Microsoft Edge，请确认 Edge 已正确安装。
    pause
    exit /b 1
)

echo 正在等待看板服务启动...

:WAIT_SERVER
powershell.exe -NoLogo -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri '%DASHBOARD_URL%' -UseBasicParsing -TimeoutSec 5 | Out-Null; exit 0 } catch { exit 1 }"

if errorlevel 1 (
    echo 暂时无法访问看板，5 秒后重试...
    timeout /t 5 /nobreak >nul
    goto WAIT_SERVER
)

start "" "%EDGE%" ^
  --kiosk "%DASHBOARD_URL%" ^
  --edge-kiosk-type=fullscreen ^
  --kiosk-idle-timeout-minutes=0 ^
  --no-first-run ^
  --disable-session-crashed-bubble

exit /b 0
