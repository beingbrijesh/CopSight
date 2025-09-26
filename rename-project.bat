@echo off
echo Renaming floatchat-react to CopSight-react...

:: Create new directory
mkdir CopSight-react

:: Copy all files and folders
xcopy floatchat-react\* CopSight-react\ /E /H /C /I

:: Remove old directory after successful copy
if exist CopSight-react\package.json (
    echo Copy successful, removing old directory...
    rmdir /s /q floatchat-react
    echo Project renamed successfully!
) else (
    echo Copy failed, keeping original directory
)

pause
