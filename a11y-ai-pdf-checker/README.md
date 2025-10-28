# Accessibility Checker Before Remediation

Este Lambda executa verificação de acessibilidade em PDFs usando VeraPDF antes da remediação.

## 🚀 Desenvolvimento Local

### Pré-requisitos
- Docker e Docker Compose instalados
- MinIO rodando localmente (veja pasta `minio/`)

### 1. Construir a Imagem Docker

O projeto usa uma abordagem otimizada com imagem base Java:

#### Dockerfile (otimizado)
- **Imagem base**: `openjdk:11-jdk-slim` (Java já configurado)
- **Python**: Instalado via `apt-get` (mais confiável)
- **VeraPDF**: Instalado usando o instalador oficial
- **Resultado**: Build rápido e confiável ✅

#### Linux/Mac (Bash):
```bash
chmod +x build-image.sh
./build-image.sh
```

#### Build Manual:
```bash
docker build -t pdf-accessibility-checker:latest .
```

### 2. Testar Localmente

#### Opção 1: Teste via Docker (Recomendado)
```bash
# Construir imagem
./build-image.sh

# Executar testes (script faz tudo automaticamente)
./test-local.sh
```

O script `test-local.sh` automaticamente:
- Faz upload dos PDFs de exemplo para MinIO
- Executa os testes dentro do container

**Nota**: O MinIO já está configurado via `docker-compose.yml` com buckets `pdf` e `temp` criados automaticamente.

#### Opção 2: Teste Direto (Python Local)
```bash
# Instalar dependências
pip install -r requirements.txt

# Instalar VeraPDF no sistema
# Download: https://software.verapdf.org/

# Executar testes diretamente
python3 test_runner.py
```

## 🔧 Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```bash
# Ambiente (local ou production)
ENVIRONMENT=local

# Configurações MinIO
MINIO_ENDPOINT=http://localhost:9010
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false
```

### Execução Manual

```bash
# Executar com MinIO local
docker run --rm \
  -e ENVIRONMENT=local \
  -e MINIO_ENDPOINT=http://host.docker.internal:9010 \
  -e MINIO_ACCESS_KEY=minioadmin \
  -e MINIO_SECRET_KEY=minioadmin123 \
  -p 9000:8080 \
  pdf-accessibility-checker:latest
```

## 📋 Evento de Entrada

```json
{
  "s3_bucket": "pdf",
  "chunks": [
    {
      "s3_key": "documento.pdf"
    }
  ]
}
```

## 📤 Saída

O Lambda gera um relatório JSON de acessibilidade e o salva no bucket `temp`:

```
temp/{nome_arquivo}/accessability-report/{nome_arquivo}_accessibility_report_before_remidiation.json
```

## 🐛 Troubleshooting

### VeraPDF não encontrado
```bash
# Verificar se VeraPDF está instalado
docker run --rm pdf-accessibility-checker:latest verapdf --version
```

### Erro de conexão com MinIO
```bash
# Verificar se MinIO está rodando
curl http://localhost:9010/minio/health/live
```

### Logs do Container
```bash
# Ver logs em tempo real
docker logs -f <container_id>
```

## 📚 Recursos

- [VeraPDF Documentation](https://docs.verapdf.org/)
- [MinIO Documentation](https://docs.min.io/)
- [AWS Lambda Local Testing](https://docs.aws.amazon.com/lambda/latest/dg/images-test.html)
