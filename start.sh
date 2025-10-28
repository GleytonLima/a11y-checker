#!/bin/bash

# A11Y AI Checker - Script de Inicialização Completa
# Este script inicializa todo o sistema de verificação de acessibilidade

set -e

echo "🚀 A11Y AI Checker - Inicializando Sistema Completo"
echo "=================================================="

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker Desktop."
    exit 1
fi

echo "✅ Docker está rodando"

# Parar containers existentes (se houver)
echo "🔄 Parando containers existentes..."
docker-compose down 2>/dev/null || true

# Construir e iniciar todos os serviços
echo "🏗️  Construindo e iniciando todos os serviços..."
echo "   - MinIO (armazenamento)"
echo "   - UI (interface web)"
echo "   - HTML Checker (verificação HTML)"
echo "   - PDF Checker (verificação PDF)"
echo ""

docker-compose up --build -d

echo ""
echo "⏳ Aguardando serviços ficarem prontos..."

# Aguardar MinIO ficar saudável
echo "   - Aguardando MinIO..."
timeout 60 bash -c 'until docker-compose ps minio | grep -q "healthy"; do sleep 2; done' || {
    echo "❌ MinIO não ficou saudável a tempo"
    exit 1
}

# Aguardar UI ficar pronta
echo "   - Aguardando UI..."
timeout 60 bash -c 'until curl -f http://localhost:3000/api/health > /dev/null 2>&1; do sleep 2; done' || {
    echo "❌ UI não ficou pronta a tempo"
    exit 1
}

echo ""
echo "🎉 Sistema inicializado com sucesso!"
echo ""
echo "📋 Serviços disponíveis:"
echo "   🌐 UI:                    http://localhost:3000"
echo "   📦 MinIO Console:         http://localhost:9011"
echo "   🔧 MinIO API:             http://localhost:9010"
echo ""
echo "🔑 Credenciais MinIO:"
echo "   Usuário: minioadmin"
echo "   Senha:   minioadmin123"
echo ""
echo "📖 Para parar o sistema: docker-compose down"
echo "📖 Para ver logs:        docker-compose logs -f"
echo ""
echo "✨ Pronto para usar! Acesse http://localhost:3000 para começar."
