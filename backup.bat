@echo off
echo Starting TANCEM Helpdesk Database Backup...
cd /d "%~dp0"
node scripts/db-backup.js
pause
