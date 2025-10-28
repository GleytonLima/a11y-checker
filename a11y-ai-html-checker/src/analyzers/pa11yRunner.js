const pa11y = require('pa11y');
const pLimit = require('p-limit');

/**
 * Executor do Pa11y para análise de acessibilidade
 */
class Pa11yRunner {
  constructor(config) {
    this.config = config;
    this.logger = null;
  }

  /**
   * Configura o logger
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Analisa uma URL específica
   */
  async analyze(url) {
    const startTime = Date.now();
    
    try {
      if (this.logger) {
        this.logger.debug(`Analyzing URL: ${url}`);
      }

      // Configuração do Pa11y
      const pa11yConfig = {
        standard: this.config.wcagStandard,
        runner: this.config.runner,
        timeout: this.config.timeout,
        wait: this.config.waitAfterLoad,
        viewport: {
          width: this.config.viewportWidth,
          height: this.config.viewportHeight
        },
        includeNotices: this.config.includeNotices,
        includeWarnings: this.config.includeWarnings,
        chromeLaunchConfig: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      };

      // Executar análise
      const result = await pa11y(url, pa11yConfig);
      
      const duration = Date.now() - startTime;
      
      // Processar resultado
      const processedResult = this.processResult(result, url, duration);
      
      if (this.logger) {
        this.logger.debug(`Analysis completed in ${duration}ms - ${processedResult.summary.total} issues found`);
      }

      return processedResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.logger) {
        this.logger.error(`Analysis failed for ${url}: ${error.message}`);
      }

      // Retornar resultado com erro
      return {
        metadata: {
          analyzedAt: new Date().toISOString(),
          url: url,
          config: {
            standard: this.config.wcagStandard,
            runner: this.config.runner,
            includeWarnings: this.config.includeWarnings,
            includeNotices: this.config.includeNotices
          },
          duration: duration,
          error: error.message
        },
        summary: {
          total: 0,
          byType: { error: 0, warning: 0, notice: 0 },
          byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 }
        },
        issues: []
      };
    }
  }

  /**
   * Analisa múltiplos URLs com controle de concorrência
   */
  async analyzeMultiple(urls, concurrency = null) {
    const limit = pLimit(concurrency || this.config.concurrency);
    const startTime = Date.now();

    if (this.logger) {
      this.logger.info(`Starting analysis of ${urls.length} URLs with concurrency ${concurrency || this.config.concurrency}`);
    }

    const promises = urls.map(url => 
      limit(() => this.analyze(url))
    );

    try {
      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      if (this.logger) {
        this.logger.info(`Completed analysis of ${urls.length} URLs in ${totalDuration}ms`);
      }

      return results;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Batch analysis failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Processa resultado bruto do Pa11y
   */
  processResult(rawResult, url, duration) {
    const issues = rawResult.issues.map(issue => this.processIssue(issue));
    
    // Calcular estatísticas
    const summary = this.calculateSummary(issues);
    
    return {
      metadata: {
        analyzedAt: new Date().toISOString(),
        url: url,
        documentTitle: rawResult.documentTitle || 'Untitled',
        config: {
          standard: this.config.wcagStandard,
          runner: this.config.runner,
          includeWarnings: this.config.includeWarnings,
          includeNotices: this.config.includeNotices
        },
        duration: duration
      },
      summary: summary,
      issues: issues
    };
  }

  /**
   * Processa uma issue individual
   */
  processIssue(issue) {
    const processed = {
      code: issue.code,
      type: issue.type,
      message: issue.message,
      context: issue.context,
      selector: issue.selector,
      helpUrl: this.getHelpUrl(issue.code),
      suggestions: this.getSuggestions(issue.code, issue.type)
    };

    // Adicionar impacto se disponível (axe runner)
    if (issue.runnerExtras && issue.runnerExtras.impact) {
      processed.impact = issue.runnerExtras.impact;
    } else {
      // Mapear tipo para impacto padrão
      processed.impact = this.mapTypeToImpact(issue.type);
    }

    // Extrair informações WCAG
    const wcagInfo = this.extractWcagInfo(issue.code);
    processed.wcagLevel = wcagInfo.level;
    processed.wcagCriterion = wcagInfo.criterion;

    return processed;
  }

  /**
   * Calcula estatísticas dos issues
   */
  calculateSummary(issues) {
    const summary = {
      total: issues.length,
      byType: { error: 0, warning: 0, notice: 0 },
      byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 }
    };

    issues.forEach(issue => {
      // Contar por tipo
      if (summary.byType[issue.type] !== undefined) {
        summary.byType[issue.type]++;
      }

      // Contar por impacto
      if (summary.byImpact[issue.impact] !== undefined) {
        summary.byImpact[issue.impact]++;
      }
    });

    return summary;
  }

  /**
   * Mapeia tipo para impacto padrão
   */
  mapTypeToImpact(type) {
    const mapping = {
      error: 'serious',
      warning: 'moderate',
      notice: 'minor'
    };
    return mapping[type] || 'minor';
  }

  /**
   * Extrai informações WCAG do código da issue
   */
  extractWcagInfo(code) {
    // Padrões comuns para extrair nível e critério WCAG
    const wcagPattern = /WCAG2([A-Z]+)\.Principle(\d+)\.Guideline(\d+)_(\d+)\.(\d+)_(\d+)_(\d+)/;
    const match = code.match(wcagPattern);
    
    if (match) {
      return {
        level: match[1],
        criterion: `${match[3]}.${match[4]}.${match[5]}`
      };
    }

    // Fallback para códigos axe-core
    const axePattern = /^([a-z-]+)$/;
    if (axePattern.test(code)) {
      return {
        level: 'AA', // Padrão para axe-core
        criterion: 'Unknown'
      };
    }

    return {
      level: 'Unknown',
      criterion: 'Unknown'
    };
  }

  /**
   * Retorna URL de ajuda para o código da issue
   */
  getHelpUrl(code) {
    // URLs de documentação baseadas no runner
    if (this.config.runner === 'axe') {
      return `https://dequeuniversity.com/rules/axe/4.8/${code}`;
    } else if (this.config.runner === 'htmlcs') {
      return `https://squizlabs.github.io/HTML_CodeSniffer/Standards/${this.config.wcagStandard}.html#${code}`;
    }
    
    return 'https://www.w3.org/WAI/WCAG21/quickref/';
  }

  /**
   * Retorna sugestões de correção baseadas no código
   */
  getSuggestions(code, type) {
    const suggestions = {
      'color-contrast': [
        'Increase the contrast ratio to at least 4.5:1 for normal text',
        'Use a darker text color or lighter background color',
        'Consider using WCAG contrast checker tools'
      ],
      'label': [
        'Add a visible label element',
        'Use aria-label or aria-labelledby attributes',
        'Ensure the label is associated with the form control'
      ],
      'image-alt': [
        'Add alt attribute to img elements',
        'Use empty alt="" for decorative images',
        'Provide descriptive alt text for informative images'
      ],
      'link-name': [
        'Add descriptive text content to links',
        'Use aria-label for icon-only links',
        'Ensure link purpose is clear from context'
      ],
      'button-name': [
        'Add text content to button elements',
        'Use aria-label for icon-only buttons',
        'Ensure button purpose is clear'
      ]
    };

    return suggestions[code] || [
      'Review the WCAG guidelines for this issue',
      'Test with screen readers',
      'Consider user testing with people with disabilities'
    ];
  }
}

module.exports = Pa11yRunner;
