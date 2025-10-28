const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AWS = require('aws-sdk');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Jobs storage (in production, use Redis or database)
const jobs = new Map();

// API URLs for checkers
const PDF_CHECKER_URL = process.env.PDF_CHECKER_URL || 'http://pdf-checker:5000';
const HTML_CHECKER_URL = process.env.HTML_CHECKER_URL || 'http://html-checker:5001';

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
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
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

// Job management functions
function createJob(fileType, filename) {
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
    const job = {
        id: jobId,
        status: 'pending',
        fileType,
        filename,
        createdAt: new Date().toISOString(),
        steps: {
            upload: 'pending',
            starting: 'pending',
            analyzing: 'pending',
            reporting: 'pending',
            completed: 'pending'
        },
        results: null,
        error: null
    };
    jobs.set(jobId, job);
    return job;
}

function updateJobStatus(jobId, status, steps = {}, error = null, results = null) {
    const job = jobs.get(jobId);
    if (job) {
        job.status = status;
        if (error) job.error = error;
        if (results) job.results = results;
        Object.assign(job.steps, steps);
        jobs.set(jobId, job);
    }
}

// Upload file to MinIO
async function uploadFileToMinIO(filePath, fileName, fileType) {
    try {
        const bucketName = fileType === 'pdf' ? 'pdf' : 'html-reports';
        const key = fileName;
        
        await minioClient.upload({
            Bucket: bucketName,
            Key: key,
            Body: await fs.readFile(filePath)
        }).promise();
        console.log(`File uploaded to MinIO: ${bucketName}/${key}`);
        return `${bucketName}/${key}`;
    } catch (error) {
        console.error('MinIO upload error:', error);
        throw error;
    }
}

// Run analysis via API
async function runAnalysis(jobId, filePath, fileType, fileName) {
    try {
        updateJobStatus(jobId, 'running', { upload: 'completed', starting: 'running' });

        console.log(`Starting analysis for job ${jobId}: ${fileType} - ${fileName}`);
        
        // Upload file to MinIO first
        console.log(`Uploading file to MinIO: ${fileName}`);
        const bucketKey = await uploadFileToMinIO(filePath, fileName, fileType);
        console.log(`File uploaded to MinIO: ${bucketKey}`);
        
        updateJobStatus(jobId, 'running', { starting: 'completed', analyzing: 'running' });

        // Call appropriate checker API
        let checkerUrl;
        if (fileType === 'pdf') {
            checkerUrl = `${PDF_CHECKER_URL}/api/analyze`;
        } else {
            checkerUrl = `${HTML_CHECKER_URL}/api/analyze`;
        }

        console.log(`Calling checker API: ${checkerUrl}`);
        
        const response = await axios.post(checkerUrl, {
            fileName: fileName
        }, {
            timeout: 300000 // 5 minutes timeout
        });

        console.log(`Checker API response for job ${jobId}:`, response.data);

        if (response.data.status === 'completed') {
            // Transform the results to match frontend expectations
            const transformedResults = response.data.results.map(result => ({
                filename: result.filename,
                type: result.extension,
                issues: response.data.issues,
                status: 'completed',
                downloadUrl: `/api/download/${result.bucketKey || result.bucketPath}`
            }));
            
            console.log(`Transformed results for job ${jobId}:`, JSON.stringify(transformedResults, null, 2));
            
            updateJobStatus(jobId, 'completed', { 
                analyzing: 'completed', 
                reporting: 'completed',
                completed: 'completed' 
            }, null, transformedResults);
            console.log(`Job ${jobId} updated to completed status with ${response.data.issues || 0} issues`);
        } else if (response.data.status === 'error') {
            updateJobStatus(jobId, 'error', { analyzing: 'error' }, response.data.error);
        } else {
            updateJobStatus(jobId, 'error', { analyzing: 'error' }, 'Status desconhecido retornado pela API');
        }

        // Cleanup uploaded file (aguardar mais tempo para debug)
        setTimeout(async () => {
            try {
                await fs.unlink(filePath);
                console.log(`Cleaned up file: ${filePath}`);
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }, 120000); // 2 minutes

    } catch (error) {
        console.error(`Analysis error for job ${jobId}:`, error.message);
        updateJobStatus(jobId, 'error', { analyzing: 'error' }, error.message);
    }
}

// API Routes

app.post('/api/analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        // Manual file type validation
        const fileType = req.body.type;
        const fileName = req.file.originalname;
        
        if (!fileType || (fileType !== 'pdf' && fileType !== 'html')) {
            return res.status(400).json({ error: 'Tipo de arquivo inválido' });
        }

        console.log(`Upload request - fileType: ${fileType}, filename: ${fileName}, mimetype: ${req.file.mimetype}`);

        // Create job
        const job = createJob(fileType, fileName);
        
        // Start analysis asynchronously
        runAnalysis(job.id, req.file.path, fileType, fileName).catch(error => {
            console.error(`Background analysis error for job ${job.id}:`, error);
        });

        res.json({
            jobId: job.id,
            message: 'Análise iniciada com sucesso'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job não encontrado' });
    }

    const response = {
        status: job.status,
        steps: job.steps,
        results: job.results,
        error: job.error
    };

    res.json(response);
});

app.get('/api/download/*', async (req, res) => {
    try {
        const bucketKey = req.params[0];
        console.log(`Download request for: ${bucketKey}`);
        
        // Determinar bucket baseado na chave
        let bucketName = 'html-reports';
        if (bucketKey.includes('temp/html_accessibility')) {
            bucketName = 'html-reports';
        } else if (bucketKey.includes('temp/pdf_accessibility')) {
            bucketName = 'pdf';
        }
        
        console.log(`Downloading from bucket: ${bucketName}, key: ${bucketKey}`);
        
        // Baixar arquivo do MinIO
        const response = await minioClient.getObject({
            Bucket: bucketName,
            Key: bucketKey
        }).promise();
        
        // Determinar content-type
        let contentType = 'application/octet-stream';
        if (bucketKey.endsWith('.json')) {
            contentType = 'application/json';
        } else if (bucketKey.endsWith('.html')) {
            contentType = 'text/html';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(bucketKey)}"`);
        res.send(response.Body);
        
    } catch (error) {
        console.error('Download error:', error);
        if (error.code === 'NoSuchKey') {
            res.status(404).json({ error: 'Arquivo não encontrado' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/jobs', (req, res) => {
    const jobsList = Array.from(jobs.values()).map(job => ({
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        fileType: job.fileType,
        filename: job.filename
    }));
    
    res.json({ jobs: jobsList });
});

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
    
    app.listen(PORT, () => {
        console.log(`A11Y AI Checker UI running on http://localhost:${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
        console.log(`PDF Checker URL: ${PDF_CHECKER_URL}`);
        console.log(`HTML Checker URL: ${HTML_CHECKER_URL}`);
    });
}

startServer().catch(console.error);