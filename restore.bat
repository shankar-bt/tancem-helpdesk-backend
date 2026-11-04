@echo off
echo Starting TANCEM Helpdesk Database Restore...
cd /d "%~dp0"
node scripts/db-restore.js %1
pause
