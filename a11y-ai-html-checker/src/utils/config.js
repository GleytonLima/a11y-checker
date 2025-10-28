const path = require('path');
require('dotenv').config();

/**
 * Carrega e valida configurações do sistema
 */
function loadConfig() {
  const config = {
    // WCAG Standard
    wcagStandard: process.env.WCAG_STANDARD || 'WCAG2AA',
    
    // Runner de análise
    runner: process.env.RUNNER || 'axe',
    
    // Tipos de issues a incluir
    includeWarnings: process.env.INCLUDE_WARNINGS === 'true',
    includeNotices: process.env.INCLUDE_NOTICES === 'true',
    
    // Performance
    timeout: parseInt(process.env.TIMEOUT) || 30000,
    viewportWidth: parseInt(process.env.VIEWPORT_WIDTH) || 1920,
    viewportHeight: parseInt(process.env.VIEWPORT_HEIGHT) || 1080,
    waitAfterLoad: parseInt(process.env.WAIT_AFTER_LOAD) || 500,
    
    // Concorrência
    concurrency: parseInt(process.env.CONCURRENCY) || 2,
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    logColor: process.env.LOG_COLOR === 'true',
    
    // Paths
    samplesDir: process.env.SAMPLES_DIR || './samples',
    reportsDir: process.env.REPORTS_DIR || './reports',
    httpPort: parseInt(process.env.HTTP_PORT) || 8000
  };

  // Validações
  if (!['WCAG2A', 'WCAG2AA', 'WCAG2AAA'].includes(config.wcagStandard)) {
    throw new Error(`Invalid WCAG_STANDARD: ${config.wcagStandard}. Must be WCAG2A, WCAG2AA, or WCAG2AAA`);
  }

  if (!['axe', 'htmlcs'].includes(config.runner)) {
    throw new Error(`Invalid RUNNER: ${config.runner}. Must be axe or htmlcs`);
  }

  if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${config.logLevel}. Must be debug, info, warn, or error`);
  }

  if (config.timeout < 1000 || config.timeout > 300000) {
    throw new Error(`Invalid TIMEOUT: ${config.timeout}. Must be between 1000 and 300000 ms`);
  }

  if (config.concurrency < 1 || config.concurrency > 10) {
    throw new Error(`Invalid CONCURRENCY: ${config.concurrency}. Must be between 1 and 10`);
  }

  return config;
}

module.exports = { loadConfig };
