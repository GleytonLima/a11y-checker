# HTML Accessibility Checker

Sistema automatizado de análise de acessibilidade web para arquivos HTML usando Pa11y, Puppeteer e Docker.

## Visão Geral

Este projeto analisa arquivos HTML locais em busca de problemas de acessibilidade seguindo os padrões WCAG 2.1/2.2. Os relatórios são gerados em formato JSON e HTML, com opção de armazenamento no MinIO.

## Características

- Análise automatizada de arquivos HTML
- Relatórios detalhados em JSON e HTML
- Suporte aos padrões WCAG 2.1/2.2
- Integração com MinIO para armazenamento de relatórios
- Processamento em lote com controle de concorrência
- Interface web temporária para servir arquivos HTML

## Tecnologias

- Node.js 20+ LTS
- Pa11y 8.x com axe-core
- Puppeteer para renderização
- Docker e Docker Compose
- MinIO para armazenamento de objetos
- Handlebars para templates HTML

## Pré-requisitos

- Docker e Docker Compose
- MinIO (opcional, para armazenamento de relatórios)

## Instalação

1. Clone o repositório
2. Navegue para o diretório do projeto
3. Configure as variáveis de ambiente no `docker-compose-teste.yaml`

## Uso

### Execução Básica

```bash
docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit
```

### Com MinIO

1. Inicie o MinIO:
```bash
cd ../a11y-minio
docker-compose up -d
```

2. Execute o checker:
```bash
cd ../a11y-ai-html-checker
docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit
```

## Configuração

### Variáveis de Ambiente

- `WCAG_STANDARD`: Padrão WCAG (WCAG2AA, WCAG2AAA)
- `RUNNER`: Motor de análise (axe, htmlcs)
- `INCLUDE_WARNINGS`: Incluir avisos (true/false)
- `INCLUDE_NOTICES`: Incluir notificações (true/false)
- `TIMEOUT`: Timeout em milissegundos
- `CONCURRENCY`: Número de arquivos processados simultaneamente
- `MINIO_ENDPOINT`: Endpoint do MinIO
- `MINIO_ACCESS_KEY`: Chave de acesso do MinIO
- `MINIO_SECRET_KEY`: Chave secreta do MinIO
- `MINIO_BUCKET`: Bucket do MinIO

### Estrutura de Diretórios

```
a11y-ai-html-checker/
├── samples/          # Arquivos HTML para análise
├── reports/          # Relatórios gerados
├── src/
│   ├── templates/    # Templates HTML dos relatórios
│   ├── reporters/    # Geradores de relatórios
│   └── minioClient.js # Cliente MinIO
├── main.js           # Ponto de entrada
├── Dockerfile        # Imagem Docker
└── docker-compose-teste.yaml # Configuração Docker Compose
```

## Relatórios

### Tipos de Relatórios

1. **Relatórios Individuais**: Um relatório por arquivo HTML analisado
2. **Relatório Consolidado**: Resumo de todos os arquivos analisados

### Formato dos Arquivos

- **Individuais**: `{nome_arquivo}_a11y_report_YYYY_MM_DD_HH_MM.{json|html}`
- **Consolidado**: `consolidated_a11y_report_YYYY_MM_DD_HH_MM.{json|html}`

### Conteúdo dos Relatórios

- Estatísticas de problemas por tipo e impacto
- Lista detalhada de issues encontrados
- Contexto HTML e seletores CSS
- Links para documentação WCAG
- Configurações utilizadas na análise

## MinIO

### Configuração

O sistema suporta armazenamento automático de relatórios no MinIO:

- Bucket padrão: `html-reports`
- Estrutura: `temp/html_accessibility_{timestamp}/`
- Acesso via console: http://localhost:9011

### Credenciais Padrão

- Usuário: `minioadmin`
- Senha: `minioadmin123`

## Desenvolvimento

### Modificação de Templates

Os templates HTML são montados como volumes Docker, permitindo modificações em tempo real sem reconstrução da imagem.

### Logs

O sistema utiliza logging estruturado com diferentes níveis:
- `info`: Informações gerais
- `warn`: Avisos
- `error`: Erros
- `success`: Sucessos

## Troubleshooting

### Problemas Comuns

1. **Timeout na análise**: Aumente o valor de `TIMEOUT`
2. **Erro de conexão MinIO**: Verifique se o MinIO está rodando
3. **Arquivos não encontrados**: Verifique se os arquivos estão em `samples/`

### Logs de Debug

Para logs mais detalhados, ajuste `LOG_LEVEL` para `debug`.

## Licença

MIT