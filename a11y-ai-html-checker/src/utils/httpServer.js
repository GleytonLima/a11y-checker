const express = require('express');
const path = require('path');

/**
 * Servidor HTTP para servir arquivos HTML estáticos
 */
class HttpServer {
  constructor(port, rootDir) {
    this.port = port;
    this.rootDir = rootDir;
    this.app = express();
    this.server = null;
    this.logger = null;
  }

  /**
   * Configura o logger
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Inicia o servidor HTTP
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Servir arquivos estáticos
        this.app.use(express.static(this.rootDir));
        
        // Middleware de logging
        this.app.use((req, res, next) => {
          if (this.logger) {
            this.logger.debug(`HTTP ${req.method} ${req.path}`);
          }
          next();
        });

        // Rota para listar arquivos (debug)
        this.app.get('/list', (req, res) => {
          const fs = require('fs');
          try {
            const files = fs.readdirSync(this.rootDir)
              .filter(file => file.endsWith('.html'))
              .map(file => ({
                name: file,
                url: `http://localhost:${this.port}/${file}`
              }));
            res.json({ files });
          } catch (error) {
            res.status(500).json({ error: error.message });
          }
        });

        // Rota de health check
        this.app.get('/health', (req, res) => {
          res.json({ status: 'ok', port: this.port });
        });

        // Iniciar servidor
        this.server = this.app.listen(this.port, (error) => {
          if (error) {
            reject(error);
          } else {
            if (this.logger) {
              this.logger.info(`HTTP server started on port ${this.port}`);
            }
            resolve();
          }
        });

        // Tratamento de erros
        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.port} is already in use`));
          } else {
            reject(error);
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Para o servidor gracefully
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (this.logger) {
            this.logger.info('HTTP server stopped');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Retorna URL completa para um arquivo
   */
  getUrl(filename) {
    return `http://localhost:${this.port}/${filename}`;
  }

  /**
   * Verifica se o servidor está rodando
   */
  isRunning() {
    return this.server && this.server.listening;
  }

  /**
   * Retorna informações do servidor
   */
  getInfo() {
    return {
      port: this.port,
      rootDir: this.rootDir,
      running: this.isRunning(),
      baseUrl: `http://localhost:${this.port}`
    };
  }
}

module.exports = HttpServer;
