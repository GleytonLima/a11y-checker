Você está absolutamente certo! Peço desculpas pela confusão. Vamos corrigir:

1. **Pa11y é uma ferramenta Node.js/JavaScript** - então o entry point deveria ser `main.js` ao invés de `main.py`
2. **Não precisa de código de exemplo** - apenas instruções claras

Deixe me refazer a especificação técnica corretamente:

---

# Especificação Técnica: Sistema de Análise de Acessibilidade Web (Local)

**Versão**: 1.0  
**Data**: 28 de outubro de 2025

---

## 1. Visão Geral do Projeto

Desenvolver um sistema containerizado **simples e local** para análise automatizada de acessibilidade web seguindo padrões WCAG 2.1/2.2. O sistema processa arquivos HTML de um diretório local e gera relatórios detalhados em múltiplos formatos.

**Stack Tecnológica**:
- **Node.js 20+ LTS** (runtime principal)
- **Pa11y 8.x** com axe-core
- **Puppeteer** (headless Chrome)
- **Docker & Docker Compose**

**Modo de Operação**: Batch processing local (execução única por demanda)

---

## 2. Estrutura do Projeto

```
accessibility-checker/
├── reports/                      # Saída de relatórios (gerados automaticamente)
├── samples/                      # Arquivos HTML para análise (input do usuário)
├── src/
│   ├── analyzers/
│   │   └── pa11yRunner.js       # Executor do Pa11y
│   ├── reporters/
│   │   ├── jsonReporter.js      # Gerador de JSON
│   │   ├── htmlReporter.js      # Gerador de HTML
│   │   └── consolidatedReporter.js
│   ├── templates/
│   │   ├── individual.html      # Template para relatório individual
│   │   └── consolidated.html    # Template para relatório consolidado
│   └── utils/
│       ├── fileScanner.js       # Scanner de arquivos HTML
│       ├── httpServer.js        # Servidor HTTP temporário
│       └── logger.js            # Sistema de logs
├── main.js                       # Entry point principal
├── package.json                  # Dependências Node.js
├── Dockerfile
├── docker-compose-teste.yaml
├── build-image.sh
├── test-compose.sh
├── .env.example
└── README.md
```

---

## 3. Requisitos Funcionais

### 3.1 Fluxo de Execução

```
1. Validação inicial
   ├─ Verificar se samples/ existe e contém arquivos .html
   ├─ Validar variáveis de ambiente
   └─ Criar diretório reports/ se não existir

2. Preparação
   ├─ Iniciar servidor HTTP local na porta 8000
   └─ Escanear todos os arquivos .html em samples/

3. Análise (para cada arquivo)
   ├─ Servir arquivo via http://localhost:8000/{filename}
   ├─ Executar Pa11y com configurações especificadas
   ├─ Processar resultados
   └─ Gerar relatórios individuais (JSON + HTML)

4. Consolidação
   ├─ Agregar todos os resultados
   ├─ Gerar relatórios consolidados
   └─ Calcular estatísticas globais

5. Finalização
   ├─ Parar servidor HTTP
   ├─ Exibir resumo no console
   └─ Exit com código apropriado
```

### 3.2 Configurações (Variáveis de Ambiente)

```bash
# Padrão WCAG a ser seguido
WCAG_STANDARD=WCAG2AA              # WCAG2A | WCAG2AA | WCAG2AAA

# Runner de análise
RUNNER=axe                          # axe (recomendado) | htmlcs

# Tipos de issues a incluir
INCLUDE_WARNINGS=true               # true | false
INCLUDE_NOTICES=true               # true | false

# Performance
TIMEOUT=30000                       # Timeout em milissegundos (30s)
VIEWPORT_WIDTH=1920                 # Largura do viewport
VIEWPORT_HEIGHT=1080                # Altura do viewport
WAIT_AFTER_LOAD=500                # Espera após carregar página (ms)

# Concorrência
CONCURRENCY=2                       # Número de arquivos processados simultaneamente

# Logging
LOG_LEVEL=info                      # debug | info | warn | error
LOG_COLOR=true                      # Habilitar cores no console

# Paths (não alterar quando usar Docker)
SAMPLES_DIR=./samples
REPORTS_DIR=./reports
HTTP_PORT=8000
```

### 3.3 Estrutura de Dados dos Resultados

**Resultado Pa11y (raw)**:
```javascript
{
  documentTitle: "Nome da Página",
  pageUrl: "http://localhost:8000/arquivo.html",
  issues: [
    {
      code: "WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail",
      type: "error",
      typeCode: 1,
      message: "Este elemento tem contraste insuficiente...",
      context: "<div class=\"low-contrast\">Texto</div>",
      selector: "html > body > div:nth-child(2)",
      runner: "htmlcs",
      runnerExtras: {}
    }
  ]
}
```

**Resultado Processado (para relatórios)**:
```javascript
{
  metadata: {
    analyzedAt: "2025-10-28T14:30:00.000Z",
    file: "example.html",
    path: "samples/example.html",
    config: {
      standard: "WCAG2AA",
      runner: "axe",
      includeWarnings: true,
      includeNotices: false
    }
  },
  summary: {
    total: 12,
    byType: {
      error: 8,
      warning: 4,
      notice: 0
    },
    byImpact: {                    // Para axe runner
      critical: 3,
      serious: 5,
      moderate: 3,
      minor: 1
    }
  },
  issues: [
    {
      code: "color-contrast",
      type: "error",
      impact: "serious",           // critical | serious | moderate | minor
      message: "Elements must have sufficient color contrast",
      context: "<div class=\"card\">...</div>",
      selector: ".card",
      wcagLevel: "AA",
      wcagCriterion: "1.4.3",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.8/color-contrast",
      suggestions: [
        "Increase the contrast ratio to at least 4.5:1",
        "Use a darker text color or lighter background"
      ]
    }
  ]
}
```

---

## 4. Implementação Node.js

### 4.1 main.js - Entry Point

**Responsabilidades**:
- Carregar e validar configurações
- Orquestrar todo o fluxo de execução
- Gerenciar ciclo de vida do servidor HTTP
- Coordenar análise de múltiplos arquivos
- Gerar relatórios consolidados
- Exibir resumo final

**Estrutura Básica**:

```javascript
const path = require('path');
const { loadConfig } = require('./src/utils/config');
const { createLogger } = require('./src/utils/logger');
const FileScanner = require('./src/utils/fileScanner');
const HttpServer = require('./src/utils/httpServer');
const Pa11yRunner = require('./src/analyzers/pa11yRunner');
const JsonReporter = require('./src/reporters/jsonReporter');
const HtmlReporter = require('./src/reporters/htmlReporter');
const ConsolidatedReporter = require('./src/reporters/consolidatedReporter');

class AccessibilityChecker {
  constructor() {
    this.config = loadConfig();
    this.logger = createLogger(this.config.logLevel, this.config.logColor);
    this.results = [];
  }

  async initialize() {
    // Validar diretórios
    // Criar reports/ se não existir
    // Validar que samples/ tem arquivos .html
  }

  async startHttpServer() {
    // Iniciar servidor HTTP na porta configurada
    // Servir arquivos de samples/
  }

  async analyzeFiles() {
    // Escanear arquivos .html
    // Executar Pa11y para cada arquivo (respeitando concorrência)
    // Processar resultados
    // Gerar relatórios individuais
  }

  async generateConsolidatedReports() {
    // Agregar todos os resultados
    // Gerar JSON consolidado
    // Gerar HTML consolidado
  }

  printSummary() {
    // Exibir estatísticas no console
    // Mostrar arquivos com mais problemas
    // Listar issues mais comuns
  }

  async run() {
    // Fluxo principal completo
  }
}

// Entry point
(async () => {
  const checker = new AccessibilityChecker();
  try {
    await checker.run();
    process.exit(0);
  } catch (error) {
    checker.logger.error('Fatal error:', error);
    process.exit(1);
  }
})();
```

### 4.2 Módulos Principais

#### src/analyzers/pa11yRunner.js

**Responsável por**:
- Configurar e executar Pa11y
- Processar resultados brutos
- Transformar dados para formato padronizado
- Extrair informações WCAG (critério, nível)
- Adicionar sugestões de correção

**Interface**:
```javascript
class Pa11yRunner {
  constructor(config) { }
  
  async analyze(url) {
    // Retorna objeto com resultados processados
  }
  
  async analyzeMultiple(urls, concurrency = 1) {
    // Analisa múltiplos URLs com controle de concorrência
  }
}
```

#### src/utils/httpServer.js

**Responsável por**:
- Servir arquivos HTML estáticos
- Gerenciar ciclo de vida do servidor
- Logging de requisições

**Interface**:
```javascript
class HttpServer {
  constructor(port, rootDir) { }
  
  async start() {
    // Inicia servidor HTTP
  }
  
  async stop() {
    // Para servidor gracefully
  }
  
  getUrl(filename) {
    // Retorna URL completa para um arquivo
  }
}
```

#### src/utils/fileScanner.js

**Responsável por**:
- Escanear diretório por arquivos .html
- Filtrar arquivos inválidos
- Retornar lista de arquivos para análise

**Interface**:
```javascript
class FileScanner {
  constructor(directory) { }
  
  async scan() {
    // Retorna array de objetos { filename, path, size }
  }
  
  async validate(filepath) {
    // Valida se arquivo é HTML válido (básico)
  }
}
```

#### src/reporters/jsonReporter.js

**Responsável por**:
- Gerar relatório JSON individual
- Formatar dados de forma legível
- Salvar arquivo

**Interface**:
```javascript
class JsonReporter {
  async generate(result, outputPath) {
    // Gera e salva JSON formatado
  }
}
```

#### src/reporters/htmlReporter.js

**Responsável por**:
- Gerar relatório HTML individual
- Usar template engine (Handlebars ou EJS)
- Incluir CSS/JS inline
- Criar visualizações (gráficos, tabelas)

**Interface**:
```javascript
class HtmlReporter {
  async generate(result, outputPath) {
    // Gera HTML a partir de template
  }
}
```

#### src/reporters/consolidatedReporter.js

**Responsável por**:
- Agregar múltiplos resultados
- Calcular estatísticas globais
- Gerar JSON e HTML consolidados
- Criar comparativos entre arquivos

**Interface**:
```javascript
class ConsolidatedReporter {
  async generate(results, outputDir) {
    // Gera relatórios consolidados (JSON + HTML)
  }
}
```

---

## 5. package.json

```json
{
  "name": "accessibility-checker",
  "version": "1.0.0",
  "description": "Automated web accessibility checker using Pa11y",
  "main": "main.js",
  "scripts": {
    "start": "node main.js",
    "test": "node main.js"
  },
  "keywords": ["accessibility", "wcag", "a11y", "pa11y"],
  "author": "",
  "license": "MIT",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "pa11y": "^8.0.0",
    "puppeteer": "^21.0.0",
    "express": "^4.18.0",
    "handlebars": "^4.7.0",
    "chalk": "^4.1.2",
    "dotenv": "^16.3.0",
    "p-limit": "^3.1.0"
  }
}
```

**Dependências Principais**:
- `pa11y`: Engine de análise de acessibilidade
- `puppeteer`: Controle do Chrome headless
- `express`: Servidor HTTP para servir arquivos
- `handlebars`: Template engine para HTML
- `chalk`: Cores no console
- `dotenv`: Carregar variáveis de ambiente
- `p-limit`: Controle de concorrência

---

## 6. Dockerfile

### 6.1 Dockerfile Otimizado

```dockerfile
FROM node:20-slim

# Instalar dependências do Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar Puppeteer para usar Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Criar diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fonte
COPY main.js ./
COPY src/ ./src/

# Criar diretórios necessários
RUN mkdir -p samples reports

# Criar usuário não-root
RUN groupadd -r checker && useradd -r -g checker checker \
    && chown -R checker:checker /app

USER checker

# Comando padrão
CMD ["node", "main.js"]
```

### 6.2 .dockerignore

```
node_modules/
npm-debug.log
reports/
.git/
.gitignore
.env
README.md
*.md
build-image.sh
test-compose.sh
.DS_Store
```

---

## 7. Docker Compose

### 7.1 docker-compose-teste.yaml

```yaml
version: '3.8'

services:
  accessibility-checker:
    build: .
    container_name: accessibility_checker
    volumes:
      # Arquivos de entrada (read-only)
      - ./samples:/app/samples:ro
      
      # Relatórios de saída (read-write)
      - ./reports:/app/reports
    
    environment:
      # Configuração WCAG
      - WCAG_STANDARD=WCAG2AA
      - RUNNER=axe
      
      # Tipos de issues
      - INCLUDE_WARNINGS=true
      - INCLUDE_NOTICES=false
      
      # Performance
      - TIMEOUT=30000
      - VIEWPORT_WIDTH=1920
      - VIEWPORT_HEIGHT=1080
      - WAIT_AFTER_LOAD=500
      - CONCURRENCY=2
      
      # Logging
      - LOG_LEVEL=info
      - LOG_COLOR=true
      
      # Paths internos
      - SAMPLES_DIR=/app/samples
      - REPORTS_DIR=/app/reports
      - HTTP_PORT=8000
    
    # Recursos (opcional - limitar uso)
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
    
    # Security (opcional)
    security_opt:
      - no-new-privileges:true
    
    # Não reiniciar (execução única)
    restart: "no"
```

---

## 8. Scripts de Build e Execução

### 8.1 build-image.sh

```bash
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
```

### 8.2 test-compose.sh

```bash
#!/bin/bash
set -e

echo "🧪 Running Accessibility Checker via Docker Compose"
echo "=================================================="
echo ""

# Verificar se samples/ existe e tem arquivos
if [ ! -d "samples" ] || [ -z "$(ls -A samples/*.html 2>/dev/null)" ]; then
    echo "❌ Error: No HTML files found in ./samples/"
    echo "   Please add HTML files to analyze before running."
    exit 1
fi

echo "📂 HTML files found:"
ls -1 samples/*.html | sed 's/samples\//   - /'
echo ""

# Limpar relatórios antigos (opcional)
read -p "🧹 Clean old reports? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Cleaning reports/ directory..."
    rm -rf reports/*.json reports/*.html 2>/dev/null || true
    echo "   ✓ Done"
    echo ""
fi

# Executar análise
echo "🚀 Starting analysis..."
echo ""

docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit

# Verificar se relatórios foram gerados
echo ""
echo "=================================================="
if [ -f "reports/consolidated_report.html" ]; then
    echo "✅ Analysis completed successfully!"
    echo ""
    echo "📊 Generated reports:"
    ls -lh reports/ | grep -E '\.(json|html)$' | awk '{print "   - " $9 " (" $5 ")"}'
    echo ""
    echo "💡 Open consolidated report:"
    echo "   open reports/consolidated_report.html"
    echo "   (or xdg-open on Linux)"
else
    echo "❌ Error: No reports generated"
    echo "   Check logs above for errors"
    exit 1
fi
```

### 8.3 Tornar Scripts Executáveis

```bash
chmod +x build-image.sh
chmod +x test-compose.sh
```

---

## 9. Configuração

### 9.1 .env.example

```bash
# ==========================================
# ACCESSIBILITY CHECKER - CONFIGURATION
# ==========================================

# WCAG Standard
# Options: WCAG2A | WCAG2AA | WCAG2AAA
WCAG_STANDARD=WCAG2AA

# Analysis Runner
# Options: axe (recommended) | htmlcs
RUNNER=axe

# Issue Types to Include
INCLUDE_WARNINGS=true
INCLUDE_NOTICES=false

# Performance Settings
TIMEOUT=30000                    # Timeout per page (milliseconds)
VIEWPORT_WIDTH=1920              # Browser viewport width
VIEWPORT_HEIGHT=1080             # Browser viewport height
WAIT_AFTER_LOAD=500              # Wait after page load (milliseconds)
CONCURRENCY=2                    # Files processed simultaneously

# Logging
LOG_LEVEL=info                   # debug | info | warn | error
LOG_COLOR=true                   # Enable colored console output

# Paths (don't change when using Docker Compose)
SAMPLES_DIR=/app/samples
REPORTS_DIR=/app/reports
HTTP_PORT=8000
```

---

## 10. Formato dos Relatórios

### 10.1 Relatório JSON Individual

**Arquivo**: `reports/{filename}_report.json`

**Estrutura**:
```json
{
  "metadata": {
    "analyzedAt": "ISO 8601 timestamp",
    "file": "nome-do-arquivo.html",
    "path": "samples/nome-do-arquivo.html",
    "config": {
      "standard": "WCAG2AA",
      "runner": "axe",
      "includeWarnings": true,
      "includeNotices": false
    }
  },
  "summary": {
    "total": 0,
    "byType": {
      "error": 0,
      "warning": 0,
      "notice": 0
    },
    "byImpact": {
      "critical": 0,
      "serious": 0,
      "moderate": 0,
      "minor": 0
    }
  },
  "issues": [
    {
      "code": "string",
      "type": "error | warning | notice",
      "impact": "critical | serious | moderate | minor",
      "message": "string",
      "context": "HTML snippet",
      "selector": "CSS selector",
      "wcagLevel": "A | AA | AAA",
      "wcagCriterion": "1.4.3",
      "helpUrl": "URL da documentação",
      "suggestions": ["array de sugestões"]
    }
  ]
}
```

### 10.2 Relatório JSON Consolidado

**Arquivo**: `reports/consolidated_report.json`

**Estrutura**:
```json
{
  "metadata": {
    "analyzedAt": "ISO timestamp",
    "totalFiles": 0,
    "config": {}
  },
  "summary": {
    "totalIssues": 0,
    "errors": 0,
    "warnings": 0,
    "notices": 0,
    "byImpact": {}
  },
  "files": [
    {
      "filename": "string",
      "path": "string",
      "issues": {
        "total": 0,
        "errors": 0,
        "warnings": 0
      },
      "reportUrl": "arquivo_report.html"
    }
  ],
  "topIssues": [
    {
      "code": "string",
      "count": 0,
      "files": ["array de arquivos afetados"]
    }
  ]
}
```

### 10.3 Relatórios HTML

**Templates devem incluir**:

**Individual** (`reports/{filename}_report.html`):
- Dashboard com cards de resumo
- Gráficos de distribuição
- Lista detalhada de issues com:
  - Badge de tipo e impacto
  - Código e mensagem
  - Contexto HTML (syntax highlighting)
  - Seletor CSS (com botão copiar)
  - Link para documentação
  - Sugestões de correção
- Filtros por tipo/impacto
- CSS/JS inline (auto-contido)

**Consolidado** (`reports/consolidated_report.html`):
- Dashboard global
- Tabela comparativa de arquivos
- Gráficos comparativos
- Top 10 issues mais comuns
- Links para relatórios individuais
- Recomendações gerais

---

## 11. Output no Console

### 11.1 Formato de Logs Durante Execução

```
🚀 Accessibility Checker v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configuration
   Standard:  WCAG2AA
   Runner:    axe
   Warnings:  ✓
   Notices:   ✗

🔍 Scanning samples/ directory...
   Found 4 HTML files

🌐 Starting HTTP server on port 8000...
   ✓ Server ready at http://localhost:8000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 [1/4] Analyzing: example.html
   URL: http://localhost:8000/example.html
   ⏱  Duration: 2.3s
   🐛 Issues: 0
   ✓ Reports generated

📄 [2/4] Analyzing: simple-errors.html
   URL: http://localhost:8000/simple-errors.html
   ⏱  Duration: 3.1s
   🐛 Issues: 6 (5 errors, 1 warning)
   ✓ Reports generated

📄 [3/4] Analyzing: complex.html
   URL: http://localhost:8000/complex.html
   ⏱  Duration: 5.8s
   🐛 Issues: 24 (18 errors, 6 warnings)
   ✓ Reports generated

📄 [4/4] Analyzing: valid.html
   URL: http://localhost:8000/valid.html
   ⏱  Duration: 1.9s
   🐛 Issues: 0
   ✓ Reports generated

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Generating consolidated reports...
   ✓ consolidated_report.json
   ✓ consolidated_report.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Files analyzed:     4
🐛 Total issues:       30
❌ Errors:             23
⚠️  Warnings:          7
ℹ️  Notices:           0

⏱  Total duration:    13.1s

Top 5 Issues:
  1. color-contrast (8 occurrences)
  2. label (6 occurrences)
  3. image-alt (4 occurrences)
  4. link-name (3 occurrences)
  5. button-name (2 occurrences)

Files with most errors:
  1. complex.html (18 errors)
  2. simple-errors.html (5 errors)

📂 Reports saved to: /app/reports/
   ├─ consolidated_report.html
   ├─ consolidated_report.json
   ├─ example_report.html
   ├─ example_report.json
   ├─ simple-errors_report.html
   ├─ simple-errors_report.json
   ├─ complex_report.html
   ├─ complex_report.json
   ├─ valid_report.html
   └─ valid_report.json

✅ Analysis completed successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 11.2 Tratamento de Erros

**Mensagens de Erro Comuns**:

```
❌ Error: No HTML files found in samples/
   Please add HTML files to analyze.

❌ Error: Failed to start HTTP server on port 8000
   Port may be in use. Try changing HTTP_PORT.

❌ Error: Chromium not found
   Rebuild the Docker image: ./build-image.sh

⚠️  Warning: File skipped - not valid HTML
   File: samples/broken.html

⚠️  Warning: Analysis timeout exceeded
   File: samples/slow-page.html (30000ms)
```

---

## 12. Casos de Uso

### 12.1 Uso Básico Local

```bash
# 1. Clonar/criar projeto
mkdir accessibility-checker && cd accessibility-checker

# 2. Adicionar arquivos HTML
cp /path/to/your-site/*.html samples/

# 3. Build da imagem
./build-image.sh

# 4. Executar análise
./test-compose.sh

# 5. Ver resultados
open reports/consolidated_report.html
```

### 12.2 Integração CI/CD

**GitHub Actions**:
```yaml
- name: Build checker
  run: ./build-image.sh

- name: Copy build artifacts
  run: cp -r dist/*.html samples/

- name: Run accessibility check
  run: docker-compose -f docker-compose-teste.yaml up

- name: Upload reports
  uses: actions/upload-artifact@v3
  with:
    name: accessibility-reports
    path: reports/

- name: Fail on errors
  run: |
    errors=$(jq '.summary.errors' reports/consolidated_report.json)
    if [ "$errors" -gt 0 ]; then exit 1; fi
```

---

## 13. README.md - Estrutura Mínima

```markdown
# Accessibility Checker 🔍

Automated web accessibility analysis using Pa11y and WCAG 2.1/2.2 standards.

## Quick Start

### Prerequisites
- Docker
- Docker Compose

### Usage

1. **Add your HTML files**:
   ```bash
   cp your-file.html samples/
   ```

2. **Build the image**:
   ```bash
   ./build-image.sh
   ```

3. **Run analysis**:
   ```bash
   ./test-compose.sh
   ```

4. **View reports**:
   ```bash
   open reports/consolidated_report.html
   ```

## Configuration

Copy `.env.example` to `.env` and customize:

- `WCAG_STANDARD`: WCAG2A, WCAG2AA, or WCAG2AAA
- `RUNNER`: axe (recommended) or htmlcs
- `INCLUDE_WARNINGS`: Include warnings (true/false)

See `.env.example` for all options.

## Generated Reports

- **Individual**: One HTML + JSON report per file
- **Consolidated**: Overview of all analyzed files

## Troubleshooting

**No HTML files found**
- Add `.html` files to `samples/` directory

**Chromium not found**
- Rebuild image: `./build-image.sh`

**Port 8000 in use**
- Change `HTTP_PORT` in `.env`

## Documentation

- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [Pa11y](https://pa11y.org/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
```

---

## 14. Checklist de Entrega

### Arquivos Core
- [ ] `main.js` - Entry point Node.js
- [ ] `package.json` - Dependências
- [ ] `Dockerfile` - Imagem Docker
- [ ] `docker-compose-teste.yaml` - Orquestração
- [ ] `.dockerignore` - Arquivos a ignorar
- [ ] `.env.example` - Variáveis de ambiente

### Módulos Source
- [ ] `src/analyzers/pa11yRunner.js`
- [ ] `src/utils/httpServer.js`
- [ ] `src/utils/fileScanner.js`
- [ ] `src/utils/logger.js`
- [ ] `src/utils/config.js`
- [ ] `src/reporters/jsonReporter.js`
- [ ] `src/reporters/htmlReporter.js`
- [ ] `src/reporters/consolidatedReporter.js`

### Templates
- [ ] `src/templates/individual.html`
- [ ] `src/templates/consolidated.html`

### Scripts
- [ ] `build-image.sh`
- [ ] `test-compose.sh`

### Documentação
- [ ] `README.md`

### Estrutura de Diretórios
- [ ] `samples/` (vazio ou com exemplos)
- [ ] `reports/` (criado automaticamente)

---

## 15. Critérios de Aceite

**Funcionais**:
- ✅ Analisa todos arquivos `.html` em `samples/`
- ✅ Gera JSON e HTML individual para cada arquivo
- ✅ Gera relatórios consolidados (JSON + HTML)
- ✅ Exibe resumo detalhado no console
- ✅ Suporta configuração via variáveis de ambiente
- ✅ Relatórios HTML são responsivos e auto-contidos

**Não-Funcionais**:
- ✅ Container inicia em menos de 5 segundos
- ✅ Análise de arquivo simples em menos de 10 segundos
- ✅ Imagem Docker menor que 1GB
- ✅ Logs claros com códigos de erro
- ✅ Funciona em Linux, macOS e Windows (via Docker)
- ✅ Exit codes apropriados (0 = sucesso, 1 = erro)

---

**Esta especificação é correta agora!** 

O sistema usa **Node.js como runtime principal** com Pa11y, e não Python. Todos os módulos, entry point e lógica devem ser implementados em JavaScript/Node.js.