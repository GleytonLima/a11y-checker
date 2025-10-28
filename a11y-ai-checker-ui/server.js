const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const AWS = require('aws-sdk');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Jobs storage (in production, use Redis or database)
const jobs = new Map();

// MinIO client
const minioClient = new AWS.S3({
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9010',
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
    s3ForcePathStyle: true,
    signatureVersion: 'v4'
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Detectar tipo baseado no arquivo se não estiver disponível
        let fileType = req.body.type;
        if (!fileType || fileType === 'undefined') {
            if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
                fileType = 'pdf';
            } else if (file.mimetype === 'text/html' || file.originalname.toLowerCase().endsWith('.html') || file.originalname.toLowerCase().endsWith('.htm')) {
                fileType = 'html';
            } else {
                fileType = 'unknown';
            }
        }
        cb(null, `${fileType}-${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Aceitar todos os arquivos por enquanto, validar depois
        cb(null, true);
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Ensure uploads directory exists
async function ensureUploadsDir() {
    const uploadsDir = path.join(__dirname, 'uploads');
    try {
        await fs.access(uploadsDir);
    } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
    }
}

// Generate unique job ID
function generateJobId() {
    return 'job-' + Date.now() + '-' + Math.round(Math.random() * 1E9);
}

// Update job status
function updateJobStatus(jobId, status, steps = {}, error = null, results = null) {
    if (jobs.has(jobId)) {
        const job = jobs.get(jobId);
        job.status = status;
        job.steps = { ...job.steps, ...steps };
        job.error = error;
        job.results = results;
        job.updatedAt = new Date();
        jobs.set(jobId, job);
    }
}

// Run Docker container for analysis
async function runAnalysis(jobId, filePath, fileType, fileName) {
    try {
        updateJobStatus(jobId, 'running', { upload: 'completed', starting: 'running' });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        let dockerCommand;
        let containerName = `a11y-${fileType}-${jobId}`;

        if (fileType === 'pdf') {
            // Run PDF checker (sem volume, arquivo já está no MinIO)
            dockerCommand = `docker run --rm --name ${containerName} \
                -e ENVIRONMENT=local \
                -e MINIO_ENDPOINT=http://host.docker.internal:9010 \
                -e MINIO_ACCESS_KEY=minioadmin \
                -e MINIO_SECRET_KEY=minioadmin123 \
                pdf-accessibility-checker:latest \
                python3 main.py ${fileName}`;
        } else {
            // Run HTML checker (sem volume, arquivo já está no MinIO)
            dockerCommand = `docker run --rm --name ${containerName} \
                -e WCAG_STANDARD=WCAG2AA \
                -e RUNNER=axe \
                -e INCLUDE_WARNINGS=true \
                -e INCLUDE_NOTICES=false \
                -e MINIO_ENDPOINT=http://host.docker.internal:9010 \
                -e MINIO_ACCESS_KEY=minioadmin \
                -e MINIO_SECRET_KEY=minioadmin123 \
                -e MINIO_BUCKET=html-reports \
                html-accessibility-checker:latest \
                node main.js ${fileName}`;
        }

        updateJobStatus(jobId, 'running', { starting: 'completed', analyzing: 'running' });

        console.log(`Starting analysis for job ${jobId}: ${dockerCommand}`);
        
        try {
            console.log(`Executing Docker command for job ${jobId}...`);
            const { stdout, stderr } = await execAsync(dockerCommand, { 
                timeout: 300000, // 5 minutes timeout
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
            
            console.log(`Docker stdout for job ${jobId}:`, stdout);
            if (stderr) {
                console.log(`Docker stderr for job ${jobId}:`, stderr);
            }
            console.log(`Docker command completed successfully for job ${jobId}`);
        } catch (execError) {
            console.error(`Docker execution error for job ${jobId}:`, execError);
            console.error(`Error details:`, execError.message);
            console.error(`Error code:`, execError.code);
            throw execError;
        }

        updateJobStatus(jobId, 'running', { analyzing: 'completed', reporting: 'running' });

        // Process results - buscar no MinIO
        console.log(`Looking for reports in MinIO for file: ${fileName}`);
        
        const results = [];
        
        try {
            // Listar objetos no bucket apropriado
            const bucketName = fileType === 'pdf' ? 'pdf' : 'html-reports';
            console.log(`Listing objects in bucket: ${bucketName}`);
            
            const listParams = {
                Bucket: bucketName,
                Prefix: 'temp/' // Relatórios são salvos em temp/
            };
            
            const listResult = await minioClient.listObjectsV2(listParams).promise();
            console.log(`Found ${listResult.Contents.length} objects in MinIO`);
            
            // Filtrar objetos relacionados ao arquivo atual
            const baseFileName = fileName.replace(/\.[^/.]+$/, '');
            const relevantObjects = listResult.Contents.filter(obj => 
                (obj.Key.includes(baseFileName) || obj.Key.includes('consolidated')) && 
                (obj.Key.endsWith('.json') || obj.Key.endsWith('.html'))
            );
            
            console.log(`Found ${relevantObjects.length} relevant report files:`, relevantObjects.map(obj => obj.Key));
            
            for (const obj of relevantObjects) {
                const fileName = path.basename(obj.Key);
                const bucketKey = obj.Key;
                
                results.push({
                    filename: fileName,
                    type: fileType,
                    size: obj.Size,
                    downloadUrl: `/api/download/${bucketKey}`,
                    status: 'completed',
                    minioPath: bucketKey
                });
            }
            
        } catch (minioError) {
            console.error('MinIO list error:', minioError);
            
            // Fallback: procurar no sistema de arquivos local
            const reportsDir = path.join(__dirname, 'reports');
            console.log(`Fallback: Looking for reports in: ${reportsDir}`);
            
            try {
                const reportFiles = await fs.readdir(reportsDir);
                console.log(`Found local report files:`, reportFiles);
                
                for (const file of reportFiles) {
                    if (file.includes(fileName.replace(/\.[^/.]+$/, ''))) {
                        const filePath = path.join(reportsDir, file);
                        const stats = await fs.stat(filePath);
                        
                        results.push({
                            filename: file,
                            type: fileType,
                            size: stats.size,
                            downloadUrl: null,
                            status: 'completed (local only)'
                        });
                    }
                }
            } catch (readError) {
                console.error(`Error reading local reports directory:`, readError);
            }
        }

        updateJobStatus(jobId, 'completed', { reporting: 'completed', completed: 'completed' }, null, results);
        console.log(`Job ${jobId} updated to completed status with ${results.length} results`);

            // Cleanup uploaded file (aguardar mais tempo para debug)
            setTimeout(async () => {
                try {
                    await fs.unlink(filePath);
                    console.log(`Cleaned up file: ${filePath}`);
                } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError);
                }
            }, 120000); // 2 minutos de delay para debug

    } catch (error) {
        console.error(`Analysis error for job ${jobId}:`, error);
        updateJobStatus(jobId, 'error', {}, error.message);
        
        // Cleanup uploaded file
        try {
            await fs.unlink(filePath);
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }
    }
}

// Routes
app.post('/api/analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const jobId = generateJobId();
        const fileType = req.body.type;

        console.log(`Upload request - fileType: ${fileType}, filename: ${req.file.originalname}, mimetype: ${req.file.mimetype}`);

        // Se fileType não foi enviado, tentar detectar pelo arquivo
        let detectedType = fileType;
        if (!fileType || fileType === 'undefined') {
            if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
                detectedType = 'pdf';
            } else if (req.file.mimetype === 'text/html' || req.file.originalname.toLowerCase().endsWith('.html') || req.file.originalname.toLowerCase().endsWith('.htm')) {
                detectedType = 'html';
            } else {
                detectedType = 'unknown';
            }
            console.log(`Detected file type: ${detectedType}`);
        }

        // Validar tipo de arquivo
        const isValidType = detectedType === 'pdf' 
            ? req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')
            : detectedType === 'html' && (req.file.mimetype === 'text/html' || req.file.originalname.toLowerCase().endsWith('.html') || req.file.originalname.toLowerCase().endsWith('.htm'));

        if (!isValidType) {
            // Limpar arquivo inválido
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
            return res.status(400).json({ error: `Tipo de arquivo inválido. Esperado: ${detectedType.toUpperCase()}` });
        }

        // Initialize job
        jobs.set(jobId, {
            id: jobId,
            filename: req.file.originalname,
            type: detectedType,
            status: 'pending',
            steps: { upload: 'running' },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Upload file to MinIO first (usar o nome que será passado para o checker)
        try {
            console.log(`Uploading file to MinIO: ${req.file.originalname}`);
            const bucketName = detectedType === 'pdf' ? 'pdf' : 'html-reports';
            const minioKey = `${req.file.originalname}`;
            
            const fileContent = await fs.readFile(req.file.path);
            await minioClient.putObject({
                Bucket: bucketName,
                Key: minioKey,
                Body: fileContent
            }).promise();
            
            console.log(`File uploaded to MinIO: ${bucketName}/${minioKey}`);
        } catch (uploadError) {
            console.error(`MinIO upload error: ${uploadError.message}`);
            updateJobStatus(jobId, 'error', {}, uploadError.message);
            return res.status(500).json({ error: 'Erro no upload para MinIO', details: uploadError.message });
        }

        // Start analysis in background
        runAnalysis(jobId, req.file.path, detectedType, req.file.originalname).catch(error => {
            console.error(`Background analysis error for job ${jobId}:`, error);
        });

        res.json({ jobId, message: 'Análise iniciada' });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job não encontrado' });
    }

    res.json({
        jobId: job.id,
        status: job.status,
        steps: job.steps,
        error: job.error,
        results: job.results,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
    });
});

app.get('/api/download/*', async (req, res) => {
    try {
        const bucketKey = decodeURIComponent(req.params[0]);
        console.log(`Download request for: ${bucketKey}`);
        
        // Determinar bucket baseado no tipo de arquivo
        let bucketName;
        if (bucketKey.includes('temp/html_accessibility') || bucketKey.includes('html-reports')) {
            bucketName = 'html-reports';
        } else if (bucketKey.includes('accessibility_report') || bucketKey.includes('pdf') || bucketKey.includes('temp/')) {
            bucketName = 'pdf';
        } else {
            bucketName = 'html-reports';
        }
        
        console.log(`Downloading from bucket: ${bucketName}, key: ${bucketKey}`);
        
        const object = await minioClient.getObject({
            Bucket: bucketName,
            Key: bucketKey
        }).promise();

        const contentType = bucketKey.endsWith('.json') ? 'application/json' : 
                           bucketKey.endsWith('.html') ? 'text/html' : 
                           'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(bucketKey)}"`);
        res.send(object.Body);

    } catch (error) {
        console.error('Download error:', error);
        res.status(404).json({ error: 'Arquivo não encontrado' });
    }
});

app.get('/api/jobs', (req, res) => {
    const jobList = Array.from(jobs.values()).map(job => ({
        id: job.id,
        filename: job.filename,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
    }));

    res.json(jobList);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        jobs: jobs.size
    });
});

// Start server
async function startServer() {
    await ensureUploadsDir();
    
    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, 'reports');
    try {
        await fs.access(reportsDir);
    } catch {
        await fs.mkdir(reportsDir, { recursive: true });
    }

    app.listen(PORT, () => {
        console.log(`A11Y AI Checker UI running on http://localhost:${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
}

startServer().catch(console.error);
