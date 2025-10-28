#!/bin/bash

# Script para configurar buckets e políticas do MinIO
# Este script é executado automaticamente pelo docker-compose

echo "Configurando MinIO para PDF Accessibility..."

# Aguarda o MinIO estar pronto
until mc alias set myminio http://minio:9000 minioadmin minioadmin123; do
  echo "Aguardando MinIO estar pronto..."
  sleep 2
done

echo "MinIO conectado com sucesso!"

# Cria buckets necessários
echo "Criando buckets..."

# Bucket para PDFs de entrada
mc mb myminio/pdf --ignore-existing
echo "Bucket 'pdf' criado/verificado"

# Bucket para arquivos temporários e relatórios
mc mb myminio/temp --ignore-existing
echo "Bucket 'temp' criado/verificado"

# Configura políticas de acesso
echo "Configurando políticas de acesso..."

# Política pública para leitura dos PDFs
mc policy set public myminio/pdf
echo "Política pública configurada para bucket 'pdf'"

# Política pública para leitura dos arquivos temporários
mc policy set public myminio/temp
echo "Política pública configurada para bucket 'temp'"

# Cria estrutura de pastas dentro dos buckets
echo "Criando estrutura de pastas..."

# Estrutura para relatórios de acessibilidade
mc cp /dev/null myminio/temp/.gitkeep
echo "Estrutura de pastas criada"

echo "Configuração do MinIO concluída com sucesso!"
echo ""
echo "Buckets disponíveis:"
mc ls myminio
echo ""
echo "MinIO está pronto para uso!"
echo "Console: http://localhost:9011"
echo "API: http://localhost:9010"
