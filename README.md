# A11Y AI Checker

Sistema completo de verificação de acessibilidade para documentos PDF e páginas HTML usando inteligência artificial e ferramentas especializadas.

## 🚀 Início Rápido

Para usar o sistema completo com uma única linha de comando:

### Linux/macOS:
```bash
git clone <repository-url>
cd a11y-ai-checker
chmod +x start.sh
./start.sh
```

### Windows:
```cmd
git clone <repository-url>
cd a11y-ai-checker
start.bat
```

### Manual:
```bash
docker-compose up --build -d
```

Após a inicialização, acesse: **http://localhost:3000**

## 🌐 Serviços Disponíveis

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **UI Web** | http://localhost:3000 | Interface principal para upload e análise |
| **MinIO Console** | http://localhost:9011 | Interface de gerenciamento de arquivos |
| **MinIO API** | http://localhost:9010 | API para acesso programático |

### 🔑 Credenciais MinIO
- **Usuário**: `minioadmin`
- **Senha**: `minioadmin123`

## 🛠️ Comandos Úteis

```bash
# Iniciar sistema completo
docker-compose up --build -d

# Parar sistema
docker-compose down

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f a11y-ui
docker-compose logs -f html-checker
docker-compose logs -f pdf-checker

# Reconstruir apenas um serviço
docker-compose up --build -d a11y-ui

# Ver status dos containers
docker-compose ps
```

## Visão Geral

Este projeto consiste em um sistema completo para análise de acessibilidade:

1. **PDF Checker** - Análise de acessibilidade em documentos PDF usando VeraPDF
2. **HTML Checker** - Análise de acessibilidade em páginas HTML usando Pa11y
3. **UI Web** - Interface unificada para upload e análise
4. **MinIO** - Armazenamento de arquivos e relatórios

Todos os sistemas são containerizados com Docker e integrados via rede interna.

## Estrutura do Projeto

```
a11y-ai-checker/
├── a11y-ai-pdf-checker/     # Sistema de análise de PDFs
├── a11y-ai-html-checker/    # Sistema de análise de HTML
├── a11y-ai-checker-ui/      # Interface web unificada
├── a11y-minio/              # Configuração do MinIO
└── README.md               # Este arquivo
```

## Componentes

### PDF Checker (`a11y-ai-pdf-checker/`)

Sistema para análise de acessibilidade em documentos PDF:

- **Tecnologia**: Python + VeraPDF
- **Funcionalidades**: Verificação de estrutura, metadados e conformidade PDF/UA
- **Relatórios**: JSON detalhado com problemas encontrados
- **Integração**: MinIO para armazenamento automático

### HTML Checker (`a11y-ai-html-checker/`)

Sistema para análise de acessibilidade em páginas HTML:

- **Tecnologia**: Node.js + Pa11y + Puppeteer
- **Funcionalidades**: Análise WCAG 2.1/2.2, relatórios individuais e consolidados
- **Relatórios**: JSON e HTML com interface visual
- **Integração**: MinIO para armazenamento automático

### UI Web (`a11y-ai-checker-ui/`)

Interface web unificada para ambos os sistemas:

- **Tecnologia**: Node.js + Express + HTML/CSS/JS
- **Funcionalidades**: Upload de arquivos, análise assíncrona, download de relatórios
- **Integração**: Gerencia containers Docker automaticamente
- **Acesso**: Interface web em http://localhost:3000

### MinIO (`a11y-minio/`)

Servidor de armazenamento de objetos compatível com S3:

- **Função**: Armazenamento centralizado de relatórios
- **Buckets**: `pdf`, `html-reports`, `temp`
- **Acesso**: Console web em http://localhost:9011

## Pré-requisitos

- Docker e Docker Compose
- 4GB RAM mínimo
- 2GB espaço em disco

## Instalação Rápida

### Opção 1: Interface Web (Recomendado)

```bash
cd a11y-ai-checker-ui
./test-ui.sh
```

Este script automaticamente:
- Verifica e constrói as imagens necessárias
- Inicia MinIO e UI
- Configura buckets automaticamente
- Abre interface em http://localhost:3000

### Opção 2: Sistemas Individuais

#### 1. Iniciar MinIO

```bash
cd a11y-minio
docker-compose up -d
```

#### 2. Testar PDF Checker

```bash
cd a11y-ai-pdf-checker
./test-compose.sh
```

#### 3. Testar HTML Checker

```bash
cd a11y-ai-html-checker
docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit
```

## Uso

### Interface Web (Recomendado)

1. Acesse http://localhost:3000
2. Selecione o tipo de arquivo (PDF ou HTML)
3. Faça upload do arquivo (drag-and-drop ou seleção)
4. Aguarde a análise assíncrona
5. Baixe os relatórios gerados

### Sistemas Individuais

#### Análise de PDFs

1. Coloque os PDFs na pasta `a11y-ai-pdf-checker/samples/`
2. Execute: `./test-compose.sh`
3. Relatórios salvos em `reports/` e MinIO

#### Análise de HTML

1. Coloque os arquivos HTML na pasta `a11y-ai-html-checker/samples/`
2. Execute: `docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit`
3. Relatórios salvos em `reports/` e MinIO

## Configuração

### MinIO

- **URL**: http://localhost:9010
- **Console**: http://localhost:9011
- **Credenciais**: `minioadmin` / `minioadmin123`

### Variáveis de Ambiente

Cada sistema possui suas próprias variáveis de ambiente configuráveis via Docker Compose.

## Relatórios

### Formato dos Arquivos

- **PDF**: `{nome}_accessibility_report_before_remidiation.json`
- **HTML**: `{nome}_a11y_report_YYYY_MM_DD_HH_MM.{json|html}`

### Localização

- **Local**: Pasta `reports/` de cada sistema
- **MinIO**: Buckets `pdf` e `html-reports`

## 🔌 API Endpoints

A UI web consome uma API REST que pode ser utilizada diretamente por desenvolvedores para integração com outros sistemas.

### Base URL
```
http://localhost:3000
```

### Endpoints Disponíveis

#### 1. **Health Check**
```http
GET /api/health
```

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-28T11:48:43.594Z",
  "jobs": 0
}
```

#### 2. **Upload e Análise de Arquivo**
```http
POST /api/analyze
Content-Type: multipart/form-data
```

**Parâmetros:**
- `file` (file): Arquivo PDF ou HTML para análise
- `type` (string): Tipo do arquivo (`pdf` ou `html`)

**Resposta:**
```json
{
  "jobId": "job-1761624420235-939715416",
  "message": "Análise iniciada com sucesso"
}
```

#### 3. **Status da Análise**
```http
GET /api/status/{jobId}
```

**Resposta (em andamento):**
```json
{
  "status": "running",
  "steps": {
    "upload": "completed",
    "starting": "completed", 
    "analyzing": "running",
    "reporting": "pending",
    "completed": "pending"
  },
  "results": null
}
```

**Resposta (concluído):**
```json
{
  "status": "completed",
  "steps": {
    "upload": "completed",
    "starting": "completed",
    "analyzing": "completed", 
    "reporting": "completed",
    "completed": "completed"
  },
  "results": [
    {
      "filename": "documento.pdf",
      "type": "pdf",
      "issues": 5,
      "status": "completed",
      "downloadUrl": "/api/download/temp/pdf_accessibility_2025_10_28/documento_accessibility_report.json"
    }
  ]
}
```

#### 4. **Download de Relatório**
```http
GET /api/download/{bucketKey}
```

**Parâmetros:**
- `bucketKey` (string): Chave do arquivo no MinIO (ex: `temp/html_accessibility_2025_10_28/consolidated_a11y_report.html`)

**Resposta:** Arquivo binário do relatório

#### 5. **Listar Jobs**
```http
GET /api/jobs
```

**Resposta:**
```json
{
  "jobs": [
    {
      "id": "job-1761624420235-939715416",
      "status": "completed",
      "createdAt": "2025-10-28T11:48:43.594Z",
      "fileType": "pdf",
      "filename": "documento.pdf"
    }
  ]
}
```

### Status dos Steps

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando execução |
| `running` | Em execução |
| `completed` | Concluído com sucesso |
| `error` | Erro na execução |

### Exemplo de Uso com cURL

```bash
# 1. Verificar saúde da API
curl http://localhost:3000/api/health

# 2. Upload de arquivo PDF
curl -X POST \
  -F "file=@documento.pdf" \
  -F "type=pdf" \
  http://localhost:3000/api/analyze

# 3. Verificar status (substitua {jobId} pelo ID retornado)
curl http://localhost:3000/api/status/job-1761624420235-939715416

# 4. Baixar relatório
curl -O http://localhost:3000/api/download/temp/pdf_accessibility_2025_10_28/documento_accessibility_report.json
```

### Exemplo de Uso com JavaScript

```javascript
// Upload e análise
async function analyzeFile(file, type) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  
  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
}

// Polling do status
async function pollStatus(jobId) {
  const response = await fetch(`/api/status/${jobId}`);
  const status = await response.json();
  
  if (status.status === 'completed') {
    return status.results;
  } else if (status.status === 'error') {
    throw new Error('Análise falhou');
  } else {
    // Continuar polling
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await pollStatus(jobId);
  }
}

// Uso completo
const file = document.getElementById('fileInput').files[0];
const result = await analyzeFile(file, 'pdf');
const reports = await pollStatus(result.jobId);
console.log('Relatórios:', reports);
```

## Desenvolvimento

### Estrutura de Desenvolvimento

Cada sistema é independente e pode ser desenvolvido separadamente:

- **PDF Checker**: Python + Docker
- **HTML Checker**: Node.js + Docker
- **MinIO**: Configuração compartilhada

### Modificações

- Templates HTML são montados como volumes Docker
- Código fonte é copiado durante o build
- Use `--build` para reconstruir após mudanças

## Troubleshooting

### Problemas Comuns

1. **MinIO não conecta**: Verifique se está rodando em http://localhost:9010
2. **Timeout na análise**: Aumente `TIMEOUT` nas variáveis de ambiente
3. **Arquivos não encontrados**: Verifique se estão nas pastas `samples/`

### Logs

- **PDF Checker**: Logs via Docker Compose
- **HTML Checker**: Logs estruturados com níveis
- **MinIO**: Logs via `docker-compose logs`

## Licença

MIT

## Suporte

Para problemas específicos de cada sistema, consulte os READMEs individuais:

- [PDF Checker](a11y-ai-pdf-checker/README.md)
- [HTML Checker](a11y-ai-html-checker/README.md)
- [UI Web](a11y-ai-checker-ui/README.md)
