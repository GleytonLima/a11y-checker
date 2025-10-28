@echo off
REM A11Y AI Checker - Script de Inicialização Completa para Windows
REM Este script inicializa todo o sistema de verificação de acessibilidade

echo 🚀 A11Y AI Checker - Inicializando Sistema Completo
echo ==================================================

REM Verificar se Docker está rodando
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker não está rodando. Por favor, inicie o Docker Desktop.
    pause
    exit /b 1
)

echo ✅ Docker está rodando

REM Parar containers existentes (se houver)
echo 🔄 Parando containers existentes...
docker-compose down >nul 2>&1

REM Construir e iniciar todos os serviços
echo 🏗️  Construindo e iniciando todos os serviços...
echo    - MinIO (armazenamento)
echo    - UI (interface web)
echo    - HTML Checker (verificação HTML)
echo    - PDF Checker (verificação PDF)
echo.

docker-compose up --build -d

echo.
echo ⏳ Aguardando serviços ficarem prontos...

REM Aguardar um pouco para os serviços iniciarem
timeout /t 30 /nobreak >nul

echo.
echo 🎉 Sistema inicializado com sucesso!
echo.
echo 📋 Serviços disponíveis:
echo    🌐 UI:                    http://localhost:3000
echo    📦 MinIO Console:         http://localhost:9011
echo    🔧 MinIO API:             http://localhost:9010
echo.
echo 🔑 Credenciais MinIO:
echo    Usuário: minioadmin
echo    Senha:   minioadmin123
echo.
echo 📖 Para parar o sistema: docker-compose down
echo 📖 Para ver logs:        docker-compose logs -f
echo.
echo ✨ Pronto para usar! Acesse http://localhost:3000 para começar.
echo.
pause
