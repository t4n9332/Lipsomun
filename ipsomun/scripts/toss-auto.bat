@echo off
rem 토스쇼핑 가격비교 자동 매칭 (작업 스케줄러용)
chcp 65001 >nul
cd /d "%~dp0.."
node scripts\toss-playwright.mjs --auto >> "scripts\toss-auto.log" 2>&1
node scripts\blog-draft.mjs >> "scripts\toss-auto.log" 2>&1
