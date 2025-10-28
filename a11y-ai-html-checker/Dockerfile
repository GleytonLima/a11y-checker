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
RUN npm install --omit=dev

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
