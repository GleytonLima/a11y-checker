const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const MinIOClient = require('../minioClient');

/**
 * Gerador de relatórios HTML
 */
class HtmlReporter {
  constructor() {
    this.logger = null;
    this.templates = {};
    this.minioClient = new MinIOClient();
  }

  /**
   * Configura o logger
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Carrega templates Handlebars
   */
  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates');
      
      // Carregar template individual
      const individualTemplatePath = path.join(templatesDir, 'individual.html');
      const individualTemplateContent = await fs.readFile(individualTemplatePath, 'utf8');
      this.templates.individual = handlebars.compile(individualTemplateContent);
      
      // Carregar template consolidado
      const consolidatedTemplatePath = path.join(templatesDir, 'consolidated.html');
      const consolidatedTemplateContent = await fs.readFile(consolidatedTemplatePath, 'utf8');
      this.templates.consolidated = handlebars.compile(consolidatedTemplateContent);
      
      if (this.logger) {
        this.logger.debug('HTML templates loaded successfully');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to load HTML templates: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gera relatório HTML individual
   */
  async generate(result, outputDir, timestamp = null) {
    try {
      // Carregar templates se não foram carregados
      if (!this.templates.individual) {
        await this.loadTemplates();
      }

      // Extrair nome do arquivo sem extensão
      const fileName = this.extractFilename(result.metadata.url);
      
      // Usar timestamp fornecido ou gerar novo
      const reportTimestamp = timestamp || this.getTimestamp();
      
      // Gerar nome do arquivo com o novo formato
      const outputFileName = `${fileName}_a11y_report_${reportTimestamp}.html`;
      const outputPath = path.join(outputDir, outputFileName);

      // Preparar dados para o template
      const templateData = this.prepareIndividualData(result);
      
      // Renderizar HTML
      const htmlContent = this.templates.individual(templateData);
      
      // Salvar arquivo
      await fs.writeFile(outputPath, htmlContent, 'utf8');
      
      if (this.logger) {
        this.logger.info(`✓ HTML report saved: ${outputFileName}`);
      }
      
      return outputPath;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to generate HTML report: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gera relatório HTML consolidado
   */
  async generateConsolidated(results, outputDir, timestamp = null) {
    try {
      // Carregar templates se não foram carregados
      if (!this.templates.consolidated) {
        await this.loadTemplates();
      }

      // Usar timestamp fornecido ou gerar novo
      const reportTimestamp = timestamp || this.getTimestamp();
      
      // Gerar nome do arquivo consolidado
      const outputFileName = `consolidated_a11y_report_${reportTimestamp}.html`;
      const outputPath = path.join(outputDir, outputFileName);

      // Preparar dados consolidados
      const templateData = this.prepareConsolidatedData(results, reportTimestamp);
      
      // Renderizar HTML
      const htmlContent = this.templates.consolidated(templateData);
      
      // Salvar arquivo
      await fs.writeFile(outputPath, htmlContent, 'utf8');
      
      if (this.logger) {
        this.logger.info(`✓ Consolidated HTML report saved: ${outputFileName}`);
      }
      
      return outputPath;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to generate consolidated HTML report: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Prepara dados para template individual
   */
  prepareIndividualData(result) {
    return {
      metadata: {
        documentTitle: result.metadata.documentTitle || 'Untitled',
        analyzedAt: this.formatDate(result.metadata.analyzedAt),
        config: result.metadata.config,
        duration: result.metadata.duration
      },
      summary: result.summary,
      issues: result.issues.map(issue => ({
        ...issue,
        message: this.escapeHtml(issue.message),
        context: issue.context, // Não escapar o contexto HTML
        selector: issue.selector, // Não escapar o seletor CSS
        suggestions: issue.suggestions || []
      }))
    };
  }

  /**
   * Prepara dados para template consolidado
   */
  prepareConsolidatedData(results, timestamp = null) {
    // Usar timestamp fornecido ou gerar novo
    const reportTimestamp = timestamp || this.getTimestamp();

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

    // Preparar dados dos arquivos
    const files = results.map(result => {
      const filename = this.extractFilename(result.metadata.url);
      return {
        filename: filename,
        reportUrl: `${filename}_a11y_report_${reportTimestamp}.html`,
        issues: {
          total: result.summary.total,
          errors: result.summary.byType.error,
          warnings: result.summary.byType.warning,
          notices: result.summary.byType.notice
        }
      };
    });

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
        analyzedAt: this.formatDate(new Date().toISOString()),
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
   * Formata data para exibição
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Escapa HTML para evitar XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  /**
   * Faz upload de um relatório HTML para MinIO
   */
  async uploadToMinIO(localFilePath, bucketPath) {
    try {
      // Verificar se MinIO está disponível
      const isAvailable = await this.minioClient.isAvailable();
      if (!isAvailable) {
        if (this.logger) {
          this.logger.warn('MinIO not available, skipping HTML upload');
        }
        return null;
      }

      const result = await this.minioClient.uploadFile(localFilePath, bucketPath);
      
      if (this.logger) {
        this.logger.info(`✓ HTML report uploaded to MinIO: ${bucketPath}`);
      }

      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to upload HTML to MinIO: ${error.message}`);
      }
      return null;
    }
  }
}

module.exports = HtmlReporter;
