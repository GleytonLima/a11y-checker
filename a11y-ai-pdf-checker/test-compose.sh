#!/bin/bash

# Script para testar usando docker-compose
# Execute este script para rodar todos os testes de forma integrada

set -e

echo "=========================================="
echo "  PDF Accessibility - Teste com Docker Compose"
echo "=========================================="
echo
echo "Este script executa todos os testes usando docker-compose:"
echo "  - Usa MinIO existente (deve estar rodando)"
echo "  - Faz upload de TODOS os PDFs da pasta samples/"
echo "  - Executa testes de acessibilidade para cada PDF"
echo "  - Exporta relatórios para ./reports/"
echo
echo "Pré-requisitos:"
echo "  1. MinIO rodando (cd ../a11y-minio && docker-compose up -d)"
echo "  2. PDFs na pasta samples/ (quantos quiser!)"
echo
echo "💡 Dica: Coloque quantos PDFs quiser na pasta samples/ e todos serão testados!"
echo

# Verificar se existem PDFs na pasta samples
echo "Verificando PDFs na pasta samples..."
pdf_count=$(find ./samples -name "*.pdf" 2>/dev/null | wc -l)
if [ "$pdf_count" -eq 0 ]; then
    echo "ERRO: Nenhum arquivo PDF encontrado na pasta samples/"
    echo "Certifique-se de que há pelo menos um arquivo .pdf na pasta samples/"
    exit 1
fi
echo "Encontrados $pdf_count arquivo(s) PDF na pasta samples ✓"
echo "Arquivos encontrados:"
find ./samples -name "*.pdf" 2>/dev/null | sed 's|../../samples/||' | sed 's/^/  - /'
echo

# Verificar se MinIO está rodando
echo "Verificando se MinIO está rodando..."
if ! curl -s http://localhost:9010/minio/health/live > /dev/null 2>&1; then
    echo "ERRO: MinIO não está rodando!"
    echo "Execute primeiro: cd ../a11y-minio && docker-compose up -d"
    echo "Depois execute este script novamente."
    exit 1
fi
echo "MinIO está rodando ✓"
echo

# Criar diretório para relatórios
echo "Criando diretório para relatórios..."
mkdir -p ./reports
echo "Diretório ./reports criado ✓"
echo

# Parar containers existentes se houver
echo "Parando containers existentes..."
docker-compose -f docker-compose-teste.yaml down --remove-orphans 2>/dev/null || true
echo

# Executar o teste completo
echo "Executando teste completo com docker-compose..."
echo "Isso pode levar alguns minutos na primeira execução..."
echo

docker-compose -f docker-compose-teste.yaml up --build

echo
echo "Teste concluído!"
echo
echo "=========================================="
echo "  RELATÓRIOS EXPORTADOS"
echo "=========================================="
echo "Os relatórios JSON e HTML foram salvos em:"
echo "  📁 ./reports/"
echo
echo "Arquivos disponíveis:"
if [ -d "./reports" ]; then
    ls -la ./reports/
else
    echo "  (nenhum arquivo encontrado)"
fi
echo
echo "Você pode abrir os arquivos HTML diretamente no navegador!"
echo "Exemplo: file://$(pwd)/reports/accessible_accessibility_report.html"
echo
echo "=========================================="
echo "  COMANDOS ÚTEIS"
echo "=========================================="
echo "Para parar todos os serviços:"
echo "  docker-compose -f docker-compose-teste.yaml down"
echo
echo "Para ver logs dos serviços:"
echo "  docker-compose -f docker-compose-teste.yaml logs"
echo
echo "Para acessar o MinIO Console:"
echo "  http://localhost:9011 (minioadmin/minioadmin123)"
echo
