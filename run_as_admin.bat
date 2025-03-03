@echo off
powershell Start-Process "npm.cmd" -ArgumentList "start --prefix frontend" -Verb RunAs
