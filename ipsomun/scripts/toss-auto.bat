@echo off
rem 토스쇼핑 가격비교 자동 매칭 (작업 스케줄러용)
chcp 65001 >nul
cd /d "%~dp0.."
rem 이전 회차의 좀비 node·고아 크로미움 정리 ? 로그 파일 핸들을 물고 있으면 이번 회차가 시작조차 못 한다
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*toss-playwright.mjs*' -or $_.CommandLine -like '*.toss-profile*') -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
rem 날짜가 바뀌었으면 지난 로그를 toss-auto-YYYYMMDD.log로 떼어낸다 ? 한 파일에 계속 쌓이면 이상을 눈으로 못 찾는다
powershell -NoProfile -Command "$p='scripts\toss-auto.log'; if (Test-Path $p) { $d=(Get-Item $p).LastWriteTime.Date; if ($d -ne (Get-Date).Date) { Move-Item $p ('scripts\toss-auto-' + $d.ToString('yyyyMMdd') + '.log') -Force } }" >nul 2>&1
node scripts\toss-playwright.mjs --auto >> "scripts\toss-auto.log" 2>&1
node scripts\blog-draft.mjs >> "scripts\toss-auto.log" 2>&1
node scripts\social-card.mjs >> "scripts\toss-auto.log" 2>&1
node scripts\indexnow.mjs >> "scripts\toss-auto.log" 2>&1
