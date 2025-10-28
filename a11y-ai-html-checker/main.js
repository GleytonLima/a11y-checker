const path = require('path');
const fs = require('fs').promises;

// Importar módulos
const { loadConfig } = require('./src/utils/config');
const { createLogger } = require('./src/utils/logger');
const FileScanner = require('./src/utils/fileScanner');
const HttpServer = require('./src/utils/httpServer');
const Pa11yRunner = require('./src/analyzers/pa11yRunner');
const ConsolidatedReporter = require('./src/reporters/consolidatedReporter');

/**
 * Classe principal do Accessibility Checker
 */
class AccessibilityChecker {
  constructor() {
    this.config = null;
    this.logger = null;
    this.results = [];
    this.startTime = null;
  }

  /**
   * Inicializa o sistema
   */
  async initialize() {
    try {
      // Carregar configurações
      this.config = loadConfig();
      
      // Criar logger
      this.logger = createLogger(this.config.logLevel, this.config.logColor);
      
      // Exibir header
      this.displayHeader();
      
      // Validar diretórios
      await this.validateDirectories();
      
      this.logger.info('Initialization completed successfully');
    } catch (error) {
      this.logger?.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inicializa o sistema sem validar diretórios (modo arquivo específico)
   */
  async initializeWithoutValidation() {
    try {
      // Carregar configurações
      this.config = loadConfig();
      
      // Criar logger
      this.logger = createLogger(this.config.logLevel, this.config.logColor);
      
      // Exibir header
      this.displayHeader();
      
      this.logger.info('Initialization completed successfully (without directory validation)');
    } catch (error) {
      this.logger?.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Exibe header da aplicação
   */
  displayHeader() {
    this.logger.header('🚀 Accessibility Checker v1.0.0');
    this.logger.subheader('📋 Configuration');
    this.logger.info(`   Standard:  ${this.config.wcagStandard}`);
    this.logger.info(`   Runner:    ${this.config.runner}`);
    this.logger.info(`   Warnings:  ${this.config.includeWarnings ? '✓' : '✗'}`);
    this.logger.info(`   Notices:   ${this.config.includeNotices ? '✓' : '✗'}`);
  }

  /**
   * Valida diretórios necessários
   */
  async validateDirectories() {
    try {
      // Verificar se samples/ existe
      try {
        await fs.access(this.config.samplesDir);
      } catch (error) {
        throw new Error(`Samples directory not found: ${this.config.samplesDir}`);
      }

      // Criar reports/ se não existir
      try {
        await fs.access(this.config.reportsDir);
      } catch (error) {
        await fs.mkdir(this.config.reportsDir, { recursive: true });
        this.logger.info(`Created reports directory: ${this.config.reportsDir}`);
      }

      // Verificar se samples/ tem arquivos HTML
      const scanner = new FileScanner(this.config.samplesDir);
      const hasFiles = await scanner.hasHtmlFiles();
      
      if (!hasFiles) {
        throw new Error(`No HTML files found in ${this.config.samplesDir}`);
      }

      // Exibir arquivos encontrados
      const stats = await scanner.getStats();
      this.logger.info(`Found ${stats.totalFiles} HTML files`);
      
    } catch (error) {
      this.logger.error(`Directory validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inicia servidor HTTP
   */
  async startHttpServer() {
    try {
      this.logger.subheader('🌐 Starting HTTP server...');
      
      this.httpServer = new HttpServer(this.config.httpPort, this.config.samplesDir);
      this.httpServer.setLogger(this.logger);
      
      await this.httpServer.start();
      
      this.logger.success(`Server ready at http://localhost:${this.config.httpPort}`);
    } catch (error) {
      this.logger.error(`Failed to start HTTP server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analisa todos os arquivos HTML
   */
  async analyzeFiles() {
    try {
      this.logger.subheader('📄 Analyzing files...');
      
      // Escanear arquivos
      const scanner = new FileScanner(this.config.samplesDir);
      const files = await scanner.scan();
      
      if (files.length === 0) {
        throw new Error('No valid HTML files found to analyze');
      }

      // Preparar URLs
      const urls = files.map(file => this.httpServer.getUrl(file.filename));
      
      // Configurar Pa11y Runner
      const pa11yRunner = new Pa11yRunner(this.config);
      pa11yRunner.setLogger(this.logger);
      
      // Executar análise
      this.logger.info(`Starting analysis of ${files.length} files with concurrency ${this.config.concurrency}`);
      
      const results = await pa11yRunner.analyzeMultiple(urls, this.config.concurrency);
      
      // Processar resultados
      this.results = results.map((result, index) => ({
        ...result,
        metadata: {
          ...result.metadata,
          file: files[index].filename,
          path: files[index].path
        }
      }));

      // Exibir resumo da análise
      this.displayAnalysisSummary();
      
      return this.results;
    } catch (error) {
      this.logger.error(`File analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Exibe resumo da análise
   */
  displayAnalysisSummary() {
    this.logger.subheader('📊 Analysis Summary');
    
    this.results.forEach((result, index) => {
      const duration = result.metadata.duration || 0;
      const issues = result.summary.total;
      const errors = result.summary.byType.error;
      const warnings = result.summary.byType.warning;
      
      this.logger.info(`[${index + 1}/${this.results.length}] ${result.metadata.file}`);
      this.logger.info(`   URL: ${result.metadata.url}`);
      this.logger.info(`   ⏱  Duration: ${duration}ms`);
      this.logger.info(`   🐛 Issues: ${issues} (${errors} errors, ${warnings} warnings)`);
      this.logger.info(`   ✓ Reports generated`);
    });
  }

  /**
   * Gera relatórios consolidados
   */
  async generateConsolidatedReports() {
    try {
      this.logger.subheader('📊 Generating consolidated reports...');
      
      const reporter = new ConsolidatedReporter();
      reporter.setLogger(this.logger);
      
      // Gerar relatórios consolidados com upload para MinIO
      const summary = await reporter.generate(this.results, this.config.reportsDir);
      
      this.logger.success('Consolidated reports generated');
      
      // Exibir relatórios locais
      this.logger.info(`✓ ${summary.json}`);
      this.logger.info(`✓ ${summary.html}`);
      
      // Exibir uploads para MinIO
      this.logger.subheader('☁️ MinIO Upload Results');
      if (summary.minio && summary.minio.length > 0) {
        summary.minio.forEach(upload => {
          if (upload.error) {
            this.logger.error(`❌ ${upload.filename}.${upload.extension}: ${upload.error}`);
          } else {
            this.logger.info(`✅ ${upload.filename}.${upload.extension}: ${upload.bucketPath}`);
          }
        });
      } else {
        this.logger.warn('⚠️ No files uploaded to MinIO');
      }
      
      return summary;
      
      // Exibir relatórios locais
      this.logger.info(`✓ ${summary.local.consolidated.json}`);
      this.logger.info(`✓ ${summary.local.consolidated.html}`);
      
      // Exibir uploads para MinIO
      this.logger.subheader('☁️ MinIO Upload Results');
      if (summary.minio && summary.minio.length > 0) {
        summary.minio.forEach(upload => {
          if (upload.error) {
            this.logger.error(`❌ ${upload.filename}.${upload.extension}: ${upload.error}`);
          } else {
            this.logger.info(`✅ ${upload.filename}.${upload.extension}: ${upload.bucketPath}`);
          }
        });
      } else {
        this.logger.warn('⚠️ No files uploaded to MinIO');
      }
      
      return summary;
    } catch (error) {
      this.logger.error(`Failed to generate consolidated reports: ${error.message}`);
      throw error;
    }
  }

  /**
   * Para o servidor HTTP
   */
  async stopHttpServer() {
    try {
      if (this.httpServer) {
        await this.httpServer.stop();
        this.logger.info('HTTP server stopped');
      }
    } catch (error) {
      this.logger.error(`Failed to stop HTTP server: ${error.message}`);
    }
  }

  /**
   * Exibe resumo final
   */
  printFinalSummary() {
    const totalDuration = Date.now() - this.startTime;
    const totalIssues = this.results.reduce((sum, result) => sum + result.summary.total, 0);
    const totalErrors = this.results.reduce((sum, result) => sum + result.summary.byType.error, 0);
    const totalWarnings = this.results.reduce((sum, result) => sum + result.summary.byType.warning, 0);
    const totalNotices = this.results.reduce((sum, result) => sum + result.summary.byType.notice, 0);

    // Calcular top issues
    const issueCounts = {};
    this.results.forEach(result => {
      result.issues.forEach(issue => {
        issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
      });
    });

    const topIssues = Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    // Arquivos com mais erros
    const filesWithErrors = this.results
      .filter(result => result.summary.byType.error > 0)
      .sort((a, b) => b.summary.byType.error - a.summary.byType.error)
      .slice(0, 3);

    this.logger.header('SUMMARY');
    
    this.logger.info(`📁 Files analyzed:     ${this.results.length}`);
    this.logger.info(`🐛 Total issues:       ${totalIssues}`);
    this.logger.info(`❌ Errors:             ${totalErrors}`);
    this.logger.info(`⚠️  Warnings:           ${totalWarnings}`);
    this.logger.info(`ℹ️  Notices:            ${totalNotices}`);
    this.logger.info(`⏱  Total duration:     ${totalDuration}ms`);

    if (topIssues.length > 0) {
      this.logger.subheader('Top 5 Issues:');
      topIssues.forEach((issue, index) => {
        this.logger.info(`  ${index + 1}. ${issue.code} (${issue.count} occurrences)`);
      });
    }

    if (filesWithErrors.length > 0) {
      this.logger.subheader('Files with most errors:');
      filesWithErrors.forEach((file, index) => {
        this.logger.info(`  ${index + 1}. ${file.metadata.file} (${file.summary.byType.error} errors)`);
      });
    }

    this.logger.subheader('📂 Reports saved to:');
    this.logger.info(`   ${this.config.reportsDir}/`);
    this.logger.info(`   ├─ consolidated_report.html`);
    this.logger.info(`   ├─ consolidated_report.json`);
    
    this.results.forEach(result => {
      const filename = result.metadata.file.replace('.html', '');
      this.logger.info(`   ├─ ${filename}_report.html`);
      this.logger.info(`   └─ ${filename}_report.json`);
    });

    this.logger.success('Analysis completed successfully!');
  }

  /**
   * Executa o fluxo principal
   */
  async run() {
    this.startTime = Date.now();
    
    try {
      // 1. Inicializar
      await this.initialize();
      
      // 2. Iniciar servidor HTTP
      await this.startHttpServer();
      
      // 3. Analisar arquivos
      await this.analyzeFiles();
      
      // 4. Gerar relatórios consolidados
      await this.generateConsolidatedReports();
      
      // 5. Parar servidor HTTP
      await this.stopHttpServer();
      
      // 6. Exibir resumo final
      this.printFinalSummary();
      
    } catch (error) {
      this.logger.error(`Fatal error: ${error.message}`);
      
      // Tentar parar servidor em caso de erro
      await this.stopHttpServer();
      
      throw error;
    }
  }

  /**
   * Executa análise para um arquivo específico (modo Docker)
   */
  async runWithSpecificFile(filename) {
    this.startTime = Date.now();
    
    try {
      // 1. Inicializar sem validar diretórios (modo arquivo específico)
      await this.initializeWithoutValidation();
      
      // 2. Verificar se arquivo existe no MinIO
      const MinIOClient = require('./src/minioClient');
      const minioClient = new MinIOClient();
      
      const isAvailable = await minioClient.isAvailable();
      if (!isAvailable) {
        throw new Error('MinIO not available');
      }
      
      // 3. Baixar arquivo do MinIO
      const localPath = `/tmp/${filename}`;
      await minioClient.downloadFile(filename, localPath);
      
      // 4. Iniciar servidor HTTP
      await this.startHttpServer();
      
      // 5. Analisar arquivo específico
      const scanner = new FileScanner(path.dirname(localPath));
      const files = await scanner.scan();
      
      if (files.length === 0) {
        throw new Error(`No files found for analysis: ${filename}`);
      }

      // Preparar URLs
      const urls = files.map(file => this.httpServer.getUrl(file.filename));
      
      // Configurar Pa11y Runner
      const pa11yRunner = new Pa11yRunner(this.config);
      pa11yRunner.setLogger(this.logger);
      
      // Executar análise
      this.logger.info(`Starting analysis of ${files.length} files`);
      
      const results = await pa11yRunner.analyzeMultiple(urls, this.config.concurrency);
      
      // Processar resultados
      this.results = results.map((result, index) => ({
        ...result,
        metadata: {
          ...result.metadata,
          file: files[index].filename,
          url: urls[index]
        }
      }));
      
      // 6. Gerar relatórios consolidados
      await this.generateConsolidatedReports();
      
      // 7. Parar servidor HTTP
      await this.stopHttpServer();
      
      // 8. Exibir resumo final
      this.printFinalSummary();
      
    } catch (error) {
      this.logger.error(`Fatal error: ${error.message}`);
      
      // Tentar parar servidor em caso de erro
      await this.stopHttpServer();
      
      throw error;
    }
  }
}

// Entry point
(async () => {
  const checker = new AccessibilityChecker();
  
  try {
    // Verificar se foi passado um arquivo específico como parâmetro
    const specificFile = process.argv[2];
    if (specificFile) {
      console.log(`Processing specific file: ${specificFile}`);
      await checker.runWithSpecificFile(specificFile);
    } else {
      await checker.run();
    }
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
})();
