const fs = require('fs').promises;
const path = require('path');

/**
 * Scanner de arquivos HTML no diretório samples
 */
class FileScanner {
  constructor(directory) {
    this.directory = directory;
  }

  /**
   * Escaneia o diretório por arquivos .html
   */
  async scan() {
    try {
      const files = await fs.readdir(this.directory);
      const htmlFiles = files.filter(file => file.toLowerCase().endsWith('.html'));
      
      const results = [];
      
      for (const file of htmlFiles) {
        const filePath = path.join(this.directory, file);
        const isValid = await this.validate(filePath);
        
        if (isValid) {
          const stats = await fs.stat(filePath);
          results.push({
            filename: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
      
      return results.sort((a, b) => a.filename.localeCompare(b.filename));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${this.directory}`);
      }
      throw error;
    }
  }

  /**
   * Valida se o arquivo é HTML válido (verificação básica)
   */
  async validate(filepath) {
    try {
      const content = await fs.readFile(filepath, 'utf8');
      
      // Verificação básica: deve conter tags HTML
      const hasHtmlTag = /<html[^>]*>/i.test(content);
      const hasBodyTag = /<body[^>]*>/i.test(content);
      
      // Verificação adicional: não deve ser vazio
      const hasContent = content.trim().length > 0;
      
      return hasHtmlTag && hasBodyTag && hasContent;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica se o diretório existe e tem arquivos HTML
   */
  async hasHtmlFiles() {
    try {
      const files = await this.scan();
      return files.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retorna estatísticas do diretório
   */
  async getStats() {
    try {
      const files = await this.scan();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      return {
        totalFiles: files.length,
        totalSize,
        files: files.map(f => ({
          name: f.filename,
          size: f.size,
          modified: f.modified
        }))
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        files: []
      };
    }
  }
}

module.exports = FileScanner;
