#!/bin/bash
set -e

echo "🔨 Building accessibility-checker Docker image..."
echo ""

# Build com tag
docker build -t accessibility-checker:latest .

# Mostrar informações da imagem
echo ""
echo "✅ Image built successfully!"
echo ""
echo "📦 Image details:"
docker images accessibility-checker:latest

echo ""
echo "💡 Usage:"
echo "   docker-compose -f docker-compose-teste.yaml up"
