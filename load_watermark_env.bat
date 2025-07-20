@echo off
REM Load watermark environment variables from watermark.env file
REM Usage: load_watermark_env.bat

echo Loading watermark environment variables...

REM Set default values
set WM_PATH=themes/gallery/static/images/sig3.1.png
set SOURCE_DIR=assets/images
set TARGET_DIR=assets/images
set BACKUP_DIR=/tmp/original_images
set WM_OPACITY=40
set WM_GEOMETRY=+20+20

REM Load from watermark.env file if it exists
if exist watermark.env (
    echo Found watermark.env file, loading variables...
    for /f "usebackq delims== tokens=1,2" %%a in ("watermark.env") do (
        if not "%%a"=="" if not "%%b"=="" (
            REM Skip comments and empty lines
            echo %%a | findstr /r "^[^#]" >nul
            if not errorlevel 1 (
                set %%a=%%b
                echo Set %%a=%%b
            )
        )
    )
) else (
    echo No watermark.env file found, using defaults.
)

echo.
echo Watermark Configuration:
echo   WM_PATH=%WM_PATH%
echo   SOURCE_DIR=%SOURCE_DIR%
echo   TARGET_DIR=%TARGET_DIR%
echo   BACKUP_DIR=%BACKUP_DIR%
echo   WM_OPACITY=%WM_OPACITY%
echo   WM_GEOMETRY=%WM_GEOMETRY%
echo.
echo Environment variables are now set for this session.
echo You can now run your watermarking script.
