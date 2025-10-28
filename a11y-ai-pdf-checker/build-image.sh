#!/bin/bash

# Script para construir imagem Docker local do Lambda de verificação de acessibilidade
# Execute este script na pasta lambda/accessibility_checker_before_remidiation/

set -e  # Parar em caso de erro

echo "=========================================="
echo "  PDF Accessibility - Build Docker Image"
echo "=========================================="
echo

# Verificar se estamos na pasta correta
if [ ! -f "Dockerfile" ]; then
    echo "ERRO: Dockerfile não encontrado!"
    echo "Execute este script na pasta lambda/accessibility_checker_before_remidiation/"
    exit 1
fi

if [ ! -f "main.py" ]; then
    echo "ERRO: main.py não encontrado!"
    echo "Execute este script na pasta lambda/accessibility_checker_before_remidiation/"
    exit 1
fi

# Nome da imagem
IMAGE_NAME="pdf-accessibility-checker"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
DOCKERFILE="Dockerfile"

echo "Construindo imagem Docker..."
echo "Dockerfile: $DOCKERFILE"
echo "Nome da imagem: ${FULL_IMAGE_NAME}"
echo

# Construir a imagem
docker build -f "$DOCKERFILE" -t "${FULL_IMAGE_NAME}" .

if [ $? -eq 0 ]; then
    echo
    echo "=========================================="
    echo "  Imagem construída com sucesso!"
    echo "=========================================="
    echo
    echo "Imagem: ${FULL_IMAGE_NAME}"
    echo "Dockerfile usado: $DOCKERFILE"
    echo
    echo "Para executar localmente:"
    echo "  docker run --rm -p 9000:8080 ${FULL_IMAGE_NAME}"
    echo
    echo "Para testar com MinIO:"
    echo "  docker run --rm \\"
    echo "    -e ENVIRONMENT=local \\"
    echo "    -e MINIO_ENDPOINT=http://host.docker.internal:9010 \\"
    echo "    -e MINIO_ACCESS_KEY=minioadmin \\"
    echo "    -e MINIO_SECRET_KEY=minioadmin123 \\"
    echo "    -p 9000:8080 \\"
    echo "    ${FULL_IMAGE_NAME}"
    echo
    echo "Para executar testes locais:"
    echo "  ./test-local.sh"
    echo
    echo "Para executar testes dentro do container:"
    echo "  docker run --rm \\"
    echo "    -e ENVIRONMENT=local \\"
    echo "    -e MINIO_ENDPOINT=http://host.docker.internal:9010 \\"
    echo "    -e MINIO_ACCESS_KEY=minioadmin \\"
    echo "    -e MINIO_SECRET_KEY=minioadmin123 \\"
    echo "    ${FULL_IMAGE_NAME} python3 test_runner.py"
    echo
    echo "Para ver logs:"
    echo "  docker logs <container_id>"
    echo
    echo "Para testar VeraPDF:"
    echo "  docker run --rm ${FULL_IMAGE_NAME} verapdf --version"
    echo
else
    echo
    echo "ERRO: Falha ao construir a imagem Docker!"
    echo "Verifique os logs acima para mais detalhes."
    exit 1
fi
