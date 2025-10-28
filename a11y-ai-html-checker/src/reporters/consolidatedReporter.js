const fs = require('fs').promises;
const path = require('path');
const JsonReporter = require('./jsonReporter');
const HtmlReporter = require('./htmlReporter');
const MinIOClient = require('../minioClient');

/**
 * Gerador de relatórios consolidados
 */
class ConsolidatedReporter {
  constructor() {
    this.jsonReporter = new JsonReporter();
    this.htmlReporter = new HtmlReporter();
    this.minioClient = new MinIOClient();
    this.logger = null;
  }

  /**
   * Configura o logger
   */
  setLogger(logger) {
    this.logger = logger;
    this.jsonReporter.setLogger(logger);
    this.htmlReporter.setLogger(logger);
  }

  /**
   * Gera relatórios consolidados (JSON + HTML)
   */
  async generate(results, outputDir) {
    try {
      if (this.logger) {
        this.logger.info(`Generating consolidated reports for ${results.length} files...`);
      }

      // Garantir que o diretório existe
      await fs.mkdir(outputDir, { recursive: true });

      // Gerar JSON consolidado
      await this.jsonReporter.generateConsolidated(results, outputDir);

      // Gerar HTML consolidado
      await this.htmlReporter.generateConsolidated(results, outputDir);

      // Fazer upload para MinIO
      const uploadResults = [];
      try {
        const timestamp = this.getTimestamp();
        const consolidatedJsonPath = path.join(outputDir, `consolidated_a11y_report_${timestamp}.json`);
        const consolidatedHtmlPath = path.join(outputDir, `consolidated_a11y_report_${timestamp}.html`);
        
        if (this.logger) {
          this.logger.info('Attempting MinIO upload...');
        }
        
        if (await this.fileExists(consolidatedJsonPath)) {
          const result = await this.minioClient.uploadFile(consolidatedJsonPath, `temp/html_accessibility_${timestamp}/consolidated_a11y_report_${timestamp}.json`);
          uploadResults.push({ filename: 'consolidated', extension: 'json', ...result });
        }
        
        if (await this.fileExists(consolidatedHtmlPath)) {
          const result = await this.minioClient.uploadFile(consolidatedHtmlPath, `temp/html_accessibility_${timestamp}/consolidated_a11y_report_${timestamp}.html`);
          uploadResults.push({ filename: 'consolidated', extension: 'html', ...result });
        }
        
        if (this.logger) {
          this.logger.info(`MinIO upload completed. Results: ${uploadResults.length} files`);
        }
      } catch (error) {
        if (this.logger) {
          this.logger.warn(`MinIO upload failed: ${error.message}`);
        }
      }

      if (this.logger) {
        this.logger.success('Consolidated reports generated');
      }

      return {
        json: 'consolidated_a11y_report_*.json',
        html: 'consolidated_a11y_report_*.html',
        minio: uploadResults
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to generate consolidated reports: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gera relatórios individuais para todos os resultados
   */
  async generateIndividual(results, outputDir) {
    try {
      if (this.logger) {
        this.logger.info(`Generating individual reports for ${results.length} files...`);
      }

      // Garantir que o diretório existe
      await fs.mkdir(outputDir, { recursive: true });

      const generatedReports = [];

      for (const result of results) {
        const filename = this.extractFilename(result.metadata.url);
        
        // Gerar JSON individual
        await this.jsonReporter.generate(result, outputDir);

        // Gerar HTML individual
        await this.htmlReporter.generate(result, outputDir);

        generatedReports.push({
          filename: filename,
          json: `${filename}_a11y_report_*.json`,
          html: `${filename}_a11y_report_*.html`
        });
      }

      if (this.logger) {
        this.logger.success(`Individual reports generated for ${results.length} files`);
      }

      return generatedReports;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to generate individual reports: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gera todos os relatórios (individuais + consolidados)
   */
  async generateAll(results, outputDir) {
    try {
      if (this.logger) {
        this.logger.info('Generating all reports...');
      }

      // Gerar relatórios individuais
      const individualReports = await this.generateIndividual(results, outputDir);

      // Gerar relatórios consolidados
      const consolidatedReports = await this.generate(results, outputDir);

      const summary = {
        totalFiles: results.length,
        individualReports: individualReports,
        consolidatedReports: consolidatedReports,
        outputDir: outputDir
      };

      if (this.logger) {
        this.logger.success('All reports generated successfully');
        this.printSummary(summary);
      }

      return summary;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to generate all reports: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extrai nome do arquivo da URL
   */
  extractFilename(url) {
    const filename = path.basename(url);
    return filename.replace('.html', '');
  }

  /**
   * Imprime resumo dos relatórios gerados
   */
  printSummary(summary) {
    if (!this.logger) return;

    this.logger.subheader('📊 Generated Reports Summary');
    
    this.logger.info(`Total files analyzed: ${summary.totalFiles}`);
    this.logger.info(`Individual reports: ${summary.individualReports.length}`);
    this.logger.info(`Consolidated reports: 2 (JSON + HTML)`);
    
    this.logger.subheader('📁 Report Files');
    
    // Listar relatórios individuais
    summary.individualReports.forEach(report => {
      this.logger.info(`  ${report.filename}:`);
      this.logger.info(`    - ${path.basename(report.json)}`);
      this.logger.info(`    - ${path.basename(report.html)}`);
    });
    
    // Listar relatórios consolidados
    this.logger.info('  Consolidated:');
    this.logger.info(`    - ${path.basename(summary.consolidatedReports.json)}`);
    this.logger.info(`    - ${path.basename(summary.consolidatedReports.html)}`);
    
    this.logger.subheader('💡 Next Steps');
    this.logger.info(`Open consolidated report: ${summary.consolidatedReports.html}`);
    this.logger.info(`View individual reports in: ${summary.outputDir}`);
  }

  /**
   * Calcula estatísticas dos resultados
   */
  calculateStats(results) {
    const stats = {
      totalFiles: results.length,
      totalIssues: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalNotices: 0,
      byImpact: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0
      },
      filesWithIssues: 0,
      filesWithoutIssues: 0,
      averageIssuesPerFile: 0
    };

    results.forEach(result => {
      stats.totalIssues += result.summary.total;
      stats.totalErrors += result.summary.byType.error;
      stats.totalWarnings += result.summary.byType.warning;
      stats.totalNotices += result.summary.byType.notice;
      
      stats.byImpact.critical += result.summary.byImpact.critical;
      stats.byImpact.serious += result.summary.byImpact.serious;
      stats.byImpact.moderate += result.summary.byImpact.moderate;
      stats.byImpact.minor += result.summary.byImpact.minor;
      
      if (result.summary.total > 0) {
        stats.filesWithIssues++;
      } else {
        stats.filesWithoutIssues++;
      }
    });

    stats.averageIssuesPerFile = stats.totalFiles > 0 ? 
      (stats.totalIssues / stats.totalFiles).toFixed(2) : 0;

    return stats;
  }

  /**
   * Faz upload dos relatórios para MinIO
   */
  async uploadToMinIO(reports, baseFilename) {
    try {
      console.log('Uploading reports to MinIO...');
      console.log('Base filename:', baseFilename);
      // Verificar se MinIO está disponível
      const isAvailable = await this.minioClient.isAvailable();
      if (!isAvailable) {
        if (this.logger) {
          this.logger.warn('MinIO not available, skipping upload');
        }
        return [];
      }

      if (this.logger) {
        this.logger.info('Uploading reports to MinIO...');
      }

      const uploadResults = await this.minioClient.uploadReports(reports, baseFilename);
      
      if (this.logger) {
        this.logger.success(`Uploaded ${uploadResults.length} reports to MinIO`);
      }

      return uploadResults;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to upload to MinIO: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Gera todos os relatórios e faz upload para MinIO
   */
  async generateAll(results, outputDir) {
    try {
      console.log('🚀 generateAll() called!'); // Debug log
      if (this.logger) {
        this.logger.info('Generating all reports...');
      }
      
      // Fazer upload simples para MinIO
      const uploadResults = [];
      
      if (this.logger) {
        this.logger.info('Attempting MinIO upload...');
      }
      
      try {
        // Upload dos relatórios consolidados
        const timestamp = this.getTimestamp();
        const consolidatedJsonPath = path.join(outputDir, `consolidated_a11y_report_${timestamp}.json`);
        const consolidatedHtmlPath = path.join(outputDir, `consolidated_a11y_report_${timestamp}.html`);
        
        if (await this.fileExists(consolidatedJsonPath)) {
          const result = await this.minioClient.uploadFile(consolidatedJsonPath, `temp/html_accessibility_${timestamp}/consolidated_a11y_report_${timestamp}.json`);
          uploadResults.push({ filename: 'consolidated', extension: 'json', ...result });
        }
        
        if (await this.fileExists(consolidatedHtmlPath)) {
          const result = await this.minioClient.uploadFile(consolidatedHtmlPath, `temp/html_accessibility_${timestamp}/consolidated_a11y_report_${timestamp}.html`);
          uploadResults.push({ filename: 'consolidated', extension: 'html', ...result });
        }
        
        if (this.logger) {
          this.logger.info(`MinIO upload completed. Results: ${uploadResults.length} files`);
        }
      } catch (error) {
        if (this.logger) {
          this.logger.warn(`MinIO upload failed: ${error.message}`);
        }
      }

      // Gerar timestamp único para todos os relatórios
      if (this.logger) {
        this.logger.info('Generating timestamp...');
      }
      const timestamp = this.getTimestamp();
      
      if (this.logger) {
        this.logger.info(`Timestamp generated: ${timestamp}`);
      }

      // Gerar relatórios individuais
      if (this.logger) {
        this.logger.info('Generating individual reports...');
      }
      const individualReports = await this.generateIndividual(results, outputDir);
      
      if (this.logger) {
        this.logger.info('Individual reports generated successfully');
      }

      // Gerar relatórios consolidados diretamente
      if (this.logger) {
        this.logger.info('Generating consolidated reports...');
      }
      
      const consolidatedJsonPath = await this.jsonReporter.generateConsolidated(results, outputDir, timestamp);
      const consolidatedHtmlPath = await this.htmlReporter.generateConsolidated(results, outputDir, timestamp);
      
      if (this.logger) {
        this.logger.info('Consolidated reports generated successfully');
      }
      
      const consolidatedReports = {
        json: `consolidated_a11y_report_${timestamp}.json`,
        html: `consolidated_a11y_report_${timestamp}.html`
      };

      // Upload dos relatórios consolidados para MinIO
      if (this.logger) {
        this.logger.info('Attempting MinIO upload...');
      }
      
      try {
        const consolidatedJsonPath = path.join(outputDir, consolidatedReports.json);
        const consolidatedHtmlPath = path.join(outputDir, consolidatedReports.html);
        
        if (await this.fileExists(consolidatedJsonPath)) {
          const result = await this.minioClient.uploadFile(consolidatedJsonPath, `temp/html_accessibility_${timestamp}/consolidated_a11y_report_${timestamp}.json`);
          uploadResults.push({ filename: 'consolidated', extension: 'json', ...result });
        }
        
        if (await this.fileExists(consolidatedHtmlPath)) {
          const result = await this.minioClient.uploadFile(consolidatedHtmlPath, `temp/html_accessibility_${timestamp}/consolidated_a11y_report_${timestamp}.html`);
          uploadResults.push({ filename: 'consolidated', extension: 'html', ...result });
        }
        
        if (this.logger) {
          this.logger.info(`MinIO upload completed. Results: ${uploadResults.length} files`);
        }
      } catch (error) {
        if (this.logger) {
          this.logger.warn(`MinIO upload failed: ${error.message}`);
        }
      }

      if (this.logger) {
        this.logger.success('All reports generated and uploaded successfully');
      }

      return {
        local: {
          individual: individualReports,
          consolidated: consolidatedReports
        },
        minio: uploadResults
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to generate all reports: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Verifica se um arquivo existe
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gera timestamp no formato YYYY_MM_DD_HH_MM
   */
  getTimestamp() {
    const now = new Date();
    return now.getFullYear() + '_' + 
           String(now.getMonth() + 1).padStart(2, '0') + '_' + 
           String(now.getDate()).padStart(2, '0') + '_' + 
           String(now.getHours()).padStart(2, '0') + '_' + 
           String(now.getMinutes()).padStart(2, '0');
  }
}

module.exports = ConsolidatedReporter;
