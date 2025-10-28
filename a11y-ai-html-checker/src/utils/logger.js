const chalk = require('chalk');

/**
 * Sistema de logging com cores e níveis
 */
function createLogger(level = 'info', enableColor = true) {
  const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  const currentLevel = levels[level] || 1;

  function shouldLog(logLevel) {
    return levels[logLevel] >= currentLevel;
  }

  function formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    
    if (enableColor) {
      const colors = {
        debug: chalk.gray,
        info: chalk.blue,
        warn: chalk.yellow,
        error: chalk.red
      };
      return colors[level](`${prefix} ${message}`, ...args);
    }
    
    return `${prefix} ${message} ${args.join(' ')}`;
  }

  return {
    debug: (message, ...args) => {
      if (shouldLog('debug')) {
        console.log(formatMessage('debug', message, ...args));
      }
    },
    
    info: (message, ...args) => {
      if (shouldLog('info')) {
        console.log(formatMessage('info', message, ...args));
      }
    },
    
    warn: (message, ...args) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', message, ...args));
      }
    },
    
    error: (message, ...args) => {
      if (shouldLog('error')) {
        console.error(formatMessage('error', message, ...args));
      }
    },

    // Métodos especiais para output formatado
    success: (message) => {
      if (enableColor) {
        console.log(chalk.green(`✓ ${message}`));
      } else {
        console.log(`✓ ${message}`);
      }
    },

    failure: (message) => {
      if (enableColor) {
        console.log(chalk.red(`✗ ${message}`));
      } else {
        console.log(`✗ ${message}`);
      }
    },

    header: (message) => {
      if (enableColor) {
        console.log(chalk.bold.cyan(`\n${message}`));
        console.log(chalk.gray('━'.repeat(message.length)));
      } else {
        console.log(`\n${message}`);
        console.log('━'.repeat(message.length));
      }
    },

    subheader: (message) => {
      if (enableColor) {
        console.log(chalk.bold.white(`\n${message}`));
      } else {
        console.log(`\n${message}`);
      }
    }
  };
}

module.exports = { createLogger };
