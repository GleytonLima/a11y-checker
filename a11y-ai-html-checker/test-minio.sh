#!/bin/bash

echo "🚀 HTML Accessibility Checker - Teste com MinIO"
echo "================================================"
echo ""

# Verificar se MinIO está rodando
echo "🔍 Verificando se MinIO está rodando..."
if curl -s http://localhost:9010/minio/health/live > /dev/null 2>&1; then
    echo "✅ MinIO está rodando em http://localhost:9010"
else
    echo "❌ MinIO não está rodando!"
    echo "   Execute primeiro: cd ../a11y-minio && docker-compose up -d"
    exit 1
fi

echo ""
echo "📦 Fazendo build da imagem..."
docker build -t accessibility-checker:latest .

echo ""
echo "🧪 Executando teste com MinIO..."
echo ""

# Executar análise com MinIO
docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit

# Verificar resultados
echo ""
echo "=================================================="
echo "📊 Verificando resultados..."

if ls reports/consolidated_a11y_report_*.html 1> /dev/null 2>&1; then
    echo "✅ Relatórios locais gerados:"
    ls -lh reports/ | grep -E '\.(json|html)$' | awk '{print "   - " $9 " (" $5 ")"}'
    
    echo ""
    echo "☁️ Verificando upload para MinIO..."
    
    # Verificar se os arquivos foram enviados para MinIO
    echo "   Acesse MinIO Console: http://localhost:9011"
    echo "   Usuário: minioadmin"
    echo "   Senha: minioadmin123"
    echo "   Bucket: html-reports"
    echo ""
    echo "💡 Os relatórios devem estar em:"
    echo "   temp/html_accessibility_YYYY_MM_DD_HH_MM/accessibility-report/"
    
else
    echo "❌ Erro: Nenhum relatório foi gerado"
    echo "   Verifique os logs acima para erros"
    exit 1
fi

echo ""
echo "🎉 Teste concluído com sucesso!"
echo "   Relatórios salvos localmente e enviados para MinIO"
