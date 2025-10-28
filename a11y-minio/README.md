# MinIO Local Setup

Este diretório contém a configuração para executar a solução PDF Accessibility localmente usando MinIO em vez do AWS S3.

## 🚀 Início Rápido

### Pré-requisitos
- Docker e Docker Compose instalados
- Portas 9010 e 9011 disponíveis

### 1. Iniciar o MinIO

```bash
# Navegue até a pasta minio
cd minio

# Inicie os serviços
docker-compose up -d
```

### 2. Verificar se está funcionando

```bash
# Verificar status dos containers
docker-compose ps

# Ver logs
docker-compose logs -f
```

### 3. Acessar o Console Web

Abra seu navegador e acesse: http://localhost:9011

**Credenciais:**
- Usuário: `minioadmin`
- Senha: `minioadmin123`

## 📁 Estrutura de Buckets

O MinIO será configurado automaticamente com os seguintes buckets:

- **`pdf`**: Para armazenar PDFs de entrada
- **`temp`**: Para arquivos temporários e relatórios de acessibilidade

## 🔧 Configuração para Desenvolvimento Local

### Variáveis de Ambiente

Para usar MinIO em vez do S3, configure as seguintes variáveis de ambiente:

```bash
# MinIO Configuration
MINIO_ENDPOINT=http://localhost:9010
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=pdf-accessibility
MINIO_USE_SSL=false
```

### Modificações no Código

Para usar MinIO localmente, você pode:

1. **Opção 1**: Modificar temporariamente o código para usar MinIO
2. **Opção 2**: Criar um cliente MinIO compatível com S3
3. **Opção 3**: Usar variáveis de ambiente para alternar entre S3 e MinIO

## 📋 Comandos Úteis

```bash
# Parar os serviços
docker-compose down

# Parar e remover volumes (dados serão perdidos)
docker-compose down -v

# Reiniciar serviços
docker-compose restart

# Ver logs em tempo real
docker-compose logs -f minio

# Executar comandos no container MinIO
docker exec -it pdf-accessibility-minio sh
```

## 🔍 Testando a Configuração

### Upload de arquivo via curl

```bash
# Upload de um PDF de teste
curl -X PUT \
  http://localhost:9010/pdf/teste.pdf \
  -H 'Content-Type: application/pdf' \
  --data-binary @seu-arquivo.pdf
```

### Download de arquivo via curl

```bash
# Download de um arquivo
curl -o arquivo-baixado.pdf \
  http://localhost:9010/pdf/teste.pdf
```

## 🐛 Troubleshooting

### Porta já em uso
```bash
# Verificar o que está usando a porta
netstat -ano | findstr :9010
netstat -ano | findstr :9011

# Parar processo se necessário
taskkill /PID <PID> /F
```

### Container não inicia
```bash
# Verificar logs detalhados
docker-compose logs minio

# Verificar se Docker está rodando
docker version
```

### Buckets não são criados
```bash
# Executar configuração manualmente
docker exec -it pdf-accessibility-minio-client sh
mc alias set myminio http://minio:9000 minioadmin minioadmin123
mc mb myminio/pdf
mc mb myminio/temp
```

## 📚 Recursos Adicionais

- [Documentação MinIO](https://docs.min.io/)
- [MinIO Docker Hub](https://hub.docker.com/r/minio/minio)
- [MinIO Client (mc)](https://docs.min.io/docs/minio-client-quickstart-guide.html)
