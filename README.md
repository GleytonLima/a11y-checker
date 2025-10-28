# A11Y AI Checker

Sistema de verificação de acessibilidade para documentos PDF e páginas HTML usando inteligência artificial e ferramentas especializadas.

## Visão Geral

Este projeto consiste em dois sistemas complementares para análise de acessibilidade:

1. **PDF Checker** - Análise de acessibilidade em documentos PDF usando VeraPDF
2. **HTML Checker** - Análise de acessibilidade em páginas HTML usando Pa11y

Ambos os sistemas são containerizados com Docker e incluem integração com MinIO para armazenamento de relatórios.

## Estrutura do Projeto

```
a11y-ai-checker/
├── a11y-ai-pdf-checker/     # Sistema de análise de PDFs
├── a11y-ai-html-checker/    # Sistema de análise de HTML
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

### 1. Iniciar MinIO

```bash
cd a11y-minio
docker-compose up -d
```

### 2. Testar PDF Checker

```bash
cd a11y-ai-pdf-checker
./test-compose.sh
```

### 3. Testar HTML Checker

```bash
cd a11y-ai-html-checker
docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit
```

## Uso

### Análise de PDFs

1. Coloque os PDFs na pasta `a11y-ai-pdf-checker/samples/`
2. Execute: `./test-compose.sh`
3. Relatórios salvos em `reports/` e MinIO

### Análise de HTML

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
