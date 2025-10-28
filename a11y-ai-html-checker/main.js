const express = require('express');
const path = require('path');
const fs = require('fs').promises;

// Importar módulos
const { loadConfig } = require('./src/utils/config');
const { createLogger } = require('./src/utils/logger');
const FileScanner = require('./src/utils/fileScanner');
const Pa11yRunner = require('./src/analyzers/pa11yRunner');
const ConsolidatedReporter = require('./src/reporters/consolidatedReporter');
const MinIOClient = require('./src/minioClient');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(express.json());

// Configurações globais
let config = null;
let logger = null;

/**
 * Inicializa o sistema
 */
async function initialize() {
    try {
        // Carregar configurações
        config = loadConfig();
        
        // Criar logger
        logger = createLogger(config.logLevel, config.logColor);
        
        logger.info('HTML Checker API inicializando...');
        logger.info(`Standard: ${config.wcagStandard}`);
        logger.info(`Runner: ${config.runner}`);
        logger.info(`Warnings: ${config.includeWarnings ? '✓' : '✗'}`);
        logger.info(`Notices: ${config.includeNotices ? '✓' : '✗'}`);
        
        // Garantir que diretórios existem
        await fs.mkdir(config.samplesDir, { recursive: true });
        await fs.mkdir(config.reportsDir, { recursive: true });
        
        logger.info('HTML Checker API inicializado com sucesso');
    } catch (error) {
        console.error(`Erro na inicialização: ${error.message}`);
        throw error;
    }
}

/**
 * Processa um arquivo HTML específico
 */
async function processHtmlFile(fileName) {
    let localFilePath = null;
    try {
        logger.info(`Processando arquivo: ${fileName}`);
        
        // Criar scanner e runner
        const scanner = new FileScanner(config);
        const pa11yRunner = new Pa11yRunner(config);
        const reporter = new ConsolidatedReporter();
        const minioClient = new MinIOClient();
        
        // Configurar logger nos componentes que suportam
        pa11yRunner.setLogger(logger);
        reporter.setLogger(logger);
        
        // Download file from MinIO
        localFilePath = path.join(config.samplesDir, fileName);
        await minioClient.downloadFile(fileName, localFilePath);
        logger.info(`File downloaded from MinIO to: ${localFilePath}`);

        // Executar análise real do arquivo
        logger.info('Executando análise Pa11y...');
        const analysisResult = await pa11yRunner.analyze(localFilePath);
        
        // Gerar apenas relatórios individuais (sem consolidado para UI)
        logger.info('Gerando relatórios individuais...');
        const summary = await reporter.generateAll([analysisResult], config.reportsDir);
        
        logger.info(`Análise concluída para: ${fileName}`);
        
        // Processar resultados do MinIO
        const minioResults = summary.minio || [];
        const reportUrl = minioResults.length > 0 && minioResults[0].bucketKey ? 
            `/api/download/${minioResults[0].bucketKey}` : null;
        
        logger.info(`MinIO results: ${JSON.stringify(minioResults)}`);
        logger.info(`Report URL: ${reportUrl}`);
        
        return {
            status: 'completed',
            filename: fileName,
            issues: analysisResult.summary.total,
            results: minioResults,
            reportUrl: reportUrl
        };
        
    } catch (error) {
        logger.error(`Erro no processamento: ${error.message}`);
        return {
            status: 'error',
            filename: fileName,
            error: error.message
        };
    } finally {
        // Clean up local file
        try {
            if (localFilePath) {
                await fs.unlink(localFilePath);
                logger.info(`Cleaned up local file: ${localFilePath}`);
            }
        } catch (cleanupError) {
            logger.warn(`Failed to clean up local file ${localFilePath}: ${cleanupError.message}`);
        }
    }
}

// API Endpoints

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'html-checker',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/analyze', async (req, res) => {
    try {
        const { fileName } = req.body;
        
        if (!fileName) {
            return res.status(400).json({ error: 'fileName é obrigatório' });
        }
        
        logger.info(`Iniciando análise para: ${fileName}`);
        
        // Processar arquivo
        const result = await processHtmlFile(fileName);
        
        if (result.status === 'error') {
            return res.status(500).json(result);
        }
        
        res.json(result);
        
    } catch (error) {
        logger.error(`Erro no endpoint analyze: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/download/*', async (req, res) => {
    try {
        const bucketKey = req.params[0];
        logger.info(`Download solicitado: ${bucketKey}`);
        
        // Usar o MinIO client do reporter
        const reporter = new ConsolidatedReporter();
        const minioClient = reporter.minioClient;
        
        // Determinar bucket baseado na chave
        let bucketName = 'html-reports';
        if (bucketKey.includes('temp/html_accessibility')) {
            bucketName = 'html-reports';
        } else if (bucketKey.includes('temp/pdf_accessibility')) {
            bucketName = 'pdf';
        }
        
        logger.info(`Baixando de bucket: ${bucketName}, chave: ${bucketKey}`);
        
        // Baixar arquivo do MinIO
        const localPath = `/tmp/${path.basename(bucketKey)}`;
        await minioClient.downloadFile(bucketKey, localPath);
        
        // Determinar content-type
        let contentType = 'application/octet-stream';
        if (bucketKey.endsWith('.json')) {
            contentType = 'application/json';
        } else if (bucketKey.endsWith('.html')) {
            contentType = 'text/html';
        }
        
        // Enviar arquivo
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(bucketKey)}"`);
        
        const fileContent = await fs.readFile(localPath);
        res.send(fileContent);
        
        // Limpar arquivo temporário
        try {
            await fs.unlink(localPath);
        } catch (cleanupError) {
            logger.warn(`Erro ao limpar arquivo temporário: ${cleanupError.message}`);
        }
        
    } catch (error) {
        logger.error(`Erro no download: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Inicializar e iniciar servidor
async function startServer() {
    try {
        await initialize();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`HTML Checker API rodando na porta ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('Erro ao iniciar servidor:', error.message);
        process.exit(1);
    }
}

// Iniciar servidor
startServer();