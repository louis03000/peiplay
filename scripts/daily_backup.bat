@echo off
echo Starting daily backup...
cd /d D:\Peiplay2
npm run db:backup
echo Backup completed at %date% %time%
pause
