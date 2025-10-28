#!/bin/bash

# A11Y AI Checker UI - Script de Teste
# Este script facilita o teste da UI completa

set -e

echo "🚀 A11Y AI Checker UI - Setup e Teste"
echo "======================================"

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

# Verificar se as imagens dos checkers existem
echo "📋 Verificando imagens dos checkers..."

if ! docker image inspect pdf-accessibility-checker:latest > /dev/null 2>&1; then
    echo "⚠️  Imagem pdf-accessibility-checker:latest não encontrada."
    echo "   Construindo imagem PDF checker..."
    cd ../a11y-ai-pdf-checker
    if [ -f "./build-image.sh" ]; then
        chmod +x ./build-image.sh
        ./build-image.sh
    else
        docker build -t pdf-accessibility-checker:latest .
    fi
    cd ../a11y-ai-checker-ui
fi

if ! docker image inspect accessibility-checker:latest > /dev/null 2>&1; then
    echo "⚠️  Imagem accessibility-checker:latest não encontrada."
    echo "   Construindo imagem HTML checker..."
    cd ../a11y-ai-html-checker
    docker build -t accessibility-checker:latest .
    cd ../a11y-ai-checker-ui
fi

echo "✅ Imagens dos checkers verificadas."

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker-compose down 2>/dev/null || true

# Limpar volumes antigos (opcional)
read -p "🧹 Deseja limpar dados antigos? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Limpando volumes..."
    docker-compose down -v 2>/dev/null || true
fi

# Iniciar serviços
echo "🚀 Iniciando serviços..."
docker-compose up -d

# Aguardar serviços ficarem prontos
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 10

# Verificar saúde dos serviços
echo "🔍 Verificando saúde dos serviços..."

# MinIO
if curl -s http://localhost:9010/minio/health/live > /dev/null; then
    echo "✅ MinIO: OK"
else
    echo "❌ MinIO: Falha"
fi

# UI Server
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ UI Server: OK"
else
    echo "❌ UI Server: Falha"
fi

echo ""
echo "🎉 Setup concluído!"
echo ""
echo "📱 Acesse a interface em: http://localhost:3000"
echo "🗄️  MinIO Console: http://localhost:9011"
echo "   Usuário: minioadmin"
echo "   Senha: minioadmin123"
echo ""
echo "📊 Para ver logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Para parar:"
echo "   docker-compose down"
echo ""

# Mostrar status dos containers
echo "📋 Status dos containers:"
docker-compose ps

echo ""
echo "💡 Dica: Coloque arquivos de teste nas pastas:"
echo "   - PDFs: ../a11y-ai-pdf-checker/samples/"
echo "   - HTMLs: ../a11y-ai-html-checker/samples/"
echo "   Ou use a interface web para upload direto!"
