@echo off
rem 토스 가격비교 매칭·역매칭만 실행 (블로그 발행·텔레그램 발송 없음)
rem 하루 중 추가 회차용 ? 쿠팡 검색 API 시간당 제한 때문에 회차 간격은 최소 3시간 이상
chcp 65001 >nul
cd /d "%~dp0.."
rem 이전 회차의 좀비 node·고아 크로미움 정리 ? 로그 파일 핸들을 물고 있으면 이번 회차가 시작조차 못 한다
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*toss-playwright.mjs*' -or $_.CommandLine -like '*.toss-profile*') -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
node scripts\toss-playwright.mjs --match-only >> "scripts\toss-auto.log" 2>&1
