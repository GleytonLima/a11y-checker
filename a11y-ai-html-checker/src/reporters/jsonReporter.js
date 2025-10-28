const fs = require('fs').promises;
const path = require('path');
const MinIOClient = require('../minioClient');

/**
 * Gerador de relatórios JSON
 */
class JsonReporter {
  constructor() {
    this.logger = null;
    this.minioClient = new MinIOClient();
  }

  /**
   * Configura o logger
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Gera e salva relatório JSON individual
   */
  async generate(result, outputDir) {
    try {
      // Extrair nome do arquivo sem extensão
      const fileName = this.extractFilename(result.metadata.url);
      
      // Gerar timestamp no formato YYYY_MM_DD_HH_MM
      const now = new Date();
      const timestamp = now.getFullYear() + '_' + 
        String(now.getMonth() + 1).padStart(2, '0') + '_' + 
        String(now.getDate()).padStart(2, '0') + '_' + 
        String(now.getHours()).padStart(2, '0') + '_' + 
        String(now.getMinutes()).padStart(2, '0');
      
      // Gerar nome do arquivo com o novo formato
      const outputFileName = `${fileName}_a11y_report_${timestamp}.json`;
      const outputPath = path.join(outputDir, outputFileName);

      const jsonContent = JSON.stringify(result, null, 2);
      await fs.writeFile(outputPath, jsonContent, 'utf8');
      
      if (this.logger) {
        this.logger.info(`✓ JSON report saved: ${outputFileName}`);
      }
      
      return outputPath;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to save JSON report: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gera relatório JSON consolidado
   */
  async generateConsolidated(results, outputDir) {
    try {
      // Gerar timestamp no formato YYYY_MM_DD_HH_MM
      const now = new Date();
      const timestamp = now.getFullYear() + '_' + 
        String(now.getMonth() + 1).padStart(2, '0') + '_' + 
        String(now.getDate()).padStart(2, '0') + '_' + 
        String(now.getHours()).padStart(2, '0') + '_' + 
        String(now.getMinutes()).padStart(2, '0');
      
      // Gerar nome do arquivo consolidado
      const outputFileName = `consolidated_a11y_report_${timestamp}.json`;
      const outputPath = path.join(outputDir, outputFileName);

      const consolidated = this.buildConsolidatedData(results);
      const jsonContent = JSON.stringify(consolidated, null, 2);
      await fs.writeFile(outputPath, jsonContent, 'utf8');
      
      if (this.logger) {
        this.logger.info(`✓ Consolidated JSON report saved: ${outputFileName}`);
      }
      
      return outputPath;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to save consolidated JSON report: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Constrói dados consolidados
   */
  buildConsolidatedData(results) {
    // Gerar timestamp no formato YYYY_MM_DD_HH_MM
    const now = new Date();
    const timestamp = now.getFullYear() + '_' + 
      String(now.getMonth() + 1).padStart(2, '0') + '_' + 
      String(now.getDate()).padStart(2, '0') + '_' + 
      String(now.getHours()).padStart(2, '0') + '_' + 
      String(now.getMinutes()).padStart(2, '0');

    const files = results.map(result => {
      const filename = this.extractFilename(result.metadata.url);
      return {
        filename: filename,
        path: result.metadata.url,
        issues: {
          total: result.summary.total,
          errors: result.summary.byType.error,
          warnings: result.summary.byType.warning,
          notices: result.summary.byType.notice
        },
        reportUrl: `${filename}_a11y_report_${timestamp}.html`
      };
    });

    // Calcular estatísticas globais
    const totalIssues = results.reduce((sum, result) => sum + result.summary.total, 0);
    const totalErrors = results.reduce((sum, result) => sum + result.summary.byType.error, 0);
    const totalWarnings = results.reduce((sum, result) => sum + result.summary.byType.warning, 0);
    const totalNotices = results.reduce((sum, result) => sum + result.summary.byType.notice, 0);

    // Calcular por impacto
    const byImpact = {
      critical: results.reduce((sum, result) => sum + result.summary.byImpact.critical, 0),
      serious: results.reduce((sum, result) => sum + result.summary.byImpact.serious, 0),
      moderate: results.reduce((sum, result) => sum + result.summary.byImpact.moderate, 0),
      minor: results.reduce((sum, result) => sum + result.summary.byImpact.minor, 0)
    };

    // Top issues mais comuns
    const issueCounts = {};
    results.forEach(result => {
      result.issues.forEach(issue => {
        if (!issueCounts[issue.code]) {
          issueCounts[issue.code] = { count: 0, files: new Set() };
        }
        issueCounts[issue.code].count++;
        issueCounts[issue.code].files.add(this.extractFilename(result.metadata.url));
      });
    });

    const topIssues = Object.entries(issueCounts)
      .map(([code, data]) => ({
        code: code,
        count: data.count,
        files: Array.from(data.files)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      metadata: {
        analyzedAt: new Date().toISOString(),
        totalFiles: results.length,
        config: results[0]?.metadata.config || {}
      },
      summary: {
        totalIssues: totalIssues,
        errors: totalErrors,
        warnings: totalWarnings,
        notices: totalNotices,
        byImpact: byImpact
      },
      files: files,
      topIssues: topIssues
    };
  }

  /**
   * Extrai nome do arquivo da URL
   */
  extractFilename(url) {
    const filename = path.basename(url);
    return filename.replace('.html', '');
  }

  /**
   * Faz upload de um relatório JSON para MinIO
   */
  async uploadToMinIO(localFilePath, bucketPath) {
    try {
      // Verificar se MinIO está disponível
      const isAvailable = await this.minioClient.isAvailable();
      if (!isAvailable) {
        if (this.logger) {
          this.logger.warn('MinIO not available, skipping JSON upload');
        }
        return null;
      }

      const result = await this.minioClient.uploadFile(localFilePath, bucketPath);
      
      if (this.logger) {
        this.logger.info(`✓ JSON report uploaded to MinIO: ${bucketPath}`);
      }

      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to upload JSON to MinIO: ${error.message}`);
      }
      return null;
    }
  }
}

module.exports = JsonReporter;
