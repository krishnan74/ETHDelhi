@echo off
echo Compiling contracts...
call npx hardhat compile
if %errorlevel% neq 0 (
    echo Compilation failed!
    exit /b %errorlevel%
)

echo Deleting old deployments folder...
if exist ignition\deployments (
    rmdir /s /q ignition\deployments
    echo Old deployments folder deleted.
) else (
    echo No previous deployments folder found.
)

