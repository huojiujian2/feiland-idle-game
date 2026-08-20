@echo off
REM 费兰德世界 - 一键启动脚本
REM 双击此文件即可启动游戏开发服务器

set PATH=C:\Program Files\nodejs;C:\Users\Administrator\AppData\Roaming\npm;C:\Windows\System32;C:\Windows;%PATH%

cd /d "%~dp0"

echo.
echo  ========================================
echo    费兰德世界 - 启动中...
echo    前端地址: http://localhost:3000
echo    后端地址: http://localhost:3001
echo  ========================================
echo.

npm run dev

pause
