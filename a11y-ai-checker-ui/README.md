# A11Y AI Checker UI

Interface web simples para upload e análise de arquivos PDF e HTML usando os sistemas de verificação de acessibilidade.

## Visão Geral

Esta UI permite:
- Upload de arquivos PDF ou HTML
- Análise assíncrona usando os containers Docker existentes
- Visualização do status da análise em tempo real
- Download dos relatórios gerados
- Integração com MinIO para armazenamento

## Características

- Interface web responsiva e intuitiva
- Upload por drag-and-drop ou seleção de arquivo
- Análise assíncrona com polling de status
- Integração com MinIO para download de relatórios
- Suporte a PDF e HTML
- Gerenciamento automático de containers Docker

## Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Upload**: Multer
- **Storage**: MinIO (S3-compatible)
- **Container Management**: Docker API
- **Styling**: CSS customizado

## Pré-requisitos

- Docker e Docker Compose
- Imagens Docker dos checkers já construídas:
  - `pdf-accessibility-checker:latest`
  - `accessibility-checker:latest`

## Instalação e Uso

### 1. Construir as Imagens dos Checkers

Primeiro, construa as imagens dos sistemas de análise:

```bash
# PDF Checker
cd ../a11y-ai-pdf-checker
./build-image.sh

# HTML Checker  
cd ../a11y-ai-html-checker
docker build -t accessibility-checker:latest .
```

### 2. Iniciar a UI

```bash
cd a11y-ai-checker-ui
docker-compose up -d
```

### 3. Acessar a Interface

Abra http://localhost:3000 no navegador.

## Configuração

### Variáveis de Ambiente

- `PORT`: Porta do servidor (padrão: 3000)
- `MINIO_ENDPOINT`: Endpoint do MinIO
- `MINIO_ACCESS_KEY`: Chave de acesso
- `MINIO_SECRET_KEY`: Chave secreta

### Volumes Docker

- `uploads/`: Arquivos temporários enviados
- `reports/`: Relatórios gerados localmente
- `/var/run/docker.sock`: Socket do Docker para gerenciar containers

## Funcionamento

### Fluxo de Análise

1. **Upload**: Usuário seleciona arquivo PDF ou HTML
2. **Validação**: Verificação do tipo e tamanho do arquivo
3. **Job Creation**: Criação de job assíncrono com ID único
4. **Container Execution**: Execução do container apropriado
5. **Status Polling**: Verificação periódica do progresso
6. **Result Processing**: Processamento e upload dos relatórios
7. **Download**: Disponibilização dos relatórios para download

### Status da Análise

- **pending**: Aguardando início
- **running**: Em execução (com sub-status)
- **completed**: Concluído com sucesso
- **error**: Erro na análise

### Sub-status

- **upload**: Upload do arquivo
- **starting**: Iniciando análise
- **analyzing**: Executando verificação
- **reporting**: Gerando relatórios
- **completed**: Finalizado

## API Endpoints

### POST /api/analyze
Inicia análise de arquivo
- **Body**: FormData com `file` e `type`
- **Response**: `{ jobId, message }`

### GET /api/status/:jobId
Verifica status da análise
- **Response**: `{ jobId, status, steps, error, results }`

### GET /api/download/:bucketKey
Download de relatório
- **Response**: Arquivo binário

### GET /api/jobs
Lista todos os jobs
- **Response**: Array de jobs

### GET /api/health
Health check
- **Response**: `{ status, timestamp, jobs }`

## Estrutura de Arquivos

```
a11y-ai-checker-ui/
├── index.html          # Interface web
├── server.js           # Servidor Node.js
├── package.json        # Dependências
├── Dockerfile          # Imagem Docker
├── docker-compose.yml  # Orquestração
├── uploads/            # Arquivos temporários
└── reports/            # Relatórios locais
```

## Troubleshooting

### Problemas Comuns

1. **Containers não iniciam**: Verifique se as imagens dos checkers existem
2. **MinIO não conecta**: Aguarde o setup dos buckets completar
3. **Upload falha**: Verifique permissões dos volumes
4. **Análise trava**: Verifique logs do container específico

### Logs

```bash
# UI Server
docker logs a11y-ui

# MinIO
docker logs a11y-minio

# MinIO Client
docker logs a11y-minio-client
```

### Limpeza

```bash
# Parar todos os serviços
docker-compose down

# Remover volumes (cuidado: apaga dados)
docker-compose down -v

# Reconstruir UI
docker-compose up --build
```

## Desenvolvimento

### Modo Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar com nodemon
npm run dev
```

### Modificações

- **Frontend**: Edite `index.html` diretamente
- **Backend**: Edite `server.js` e reconstrua
- **Configuração**: Modifique `docker-compose.yml`

## Limitações

- Jobs são armazenados em memória (perdidos ao reiniciar)
- Upload limitado a 50MB por arquivo
- Timeout de 5 minutos por análise
- Suporte apenas a PDF e HTML

## Melhorias Futuras

- Persistência de jobs em banco de dados
- Suporte a mais tipos de arquivo
- Interface para gerenciar jobs antigos
- Notificações em tempo real (WebSocket)
- Autenticação e autorização
- Métricas e monitoramento

## Licença

MIT
