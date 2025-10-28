const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

class MinIOClient {
    constructor() {
        this.isLocal = process.env.ENVIRONMENT === 'local';
        this.endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9010';
        this.accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
        this.secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
        this.bucketName = process.env.MINIO_BUCKET || 'html-reports';
        
        this.s3 = new AWS.S3({
            endpoint: this.endpoint,
            accessKeyId: this.accessKey,
            secretAccessKey: this.secretKey,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
            region: 'us-east-1'
        });
    }

    /**
     * Testa a conectividade com MinIO
     */
    async testConnection() {
        try {
            await this.s3.listBuckets().promise();
            console.log('✅ MinIO connection successful');
            return true;
        } catch (error) {
            console.error('❌ MinIO connection failed:', error.message);
            return false;
        }
    }

    /**
     * Cria o bucket se não existir
     */
    async ensureBucket() {
        try {
            await this.s3.headBucket({ Bucket: this.bucketName }).promise();
            console.log(`✅ Bucket '${this.bucketName}' already exists`);
        } catch (error) {
            if (error.statusCode === 404) {
                try {
                    await this.s3.createBucket({ Bucket: this.bucketName }).promise();
                    console.log(`✅ Created bucket '${this.bucketName}'`);
                } catch (createError) {
                    console.error(`❌ Failed to create bucket '${this.bucketName}':`, createError.message);
                    throw createError;
                }
            } else {
                console.error(`❌ Error checking bucket '${this.bucketName}':`, error.message);
                throw error;
            }
        }
    }

    /**
     * Faz upload de um arquivo para MinIO
     */
    async uploadFile(localFilePath, bucketPath) {
        try {
            const fileContent = fs.readFileSync(localFilePath);
            
            const params = {
                Bucket: this.bucketName,
                Key: bucketPath,
                Body: fileContent,
                ContentType: this.getContentType(localFilePath)
            };

            const result = await this.s3.upload(params).promise();
            console.log(`✅ Uploaded ${path.basename(localFilePath)} to ${result.Location}`);
            return result.Location;
        } catch (error) {
            console.error(`❌ Failed to upload ${localFilePath}:`, error.message);
            throw error;
        }
    }

    /**
     * Faz upload de múltiplos arquivos de relatório
     */
    async uploadReports(reports, baseFilename) {
        const uploadResults = [];
        
        for (const report of reports) {
            try {
                const timestamp = this.getTimestamp();
                const bucketPath = `temp/${baseFilename}/accessibility-report/${report.filename}_a11y_report_${timestamp}.${report.extension}`;
                
                const result = await this.uploadFile(report.localPath, bucketPath);
                uploadResults.push({
                    filename: report.filename,
                    extension: report.extension,
                    bucketPath: bucketPath,
                    url: result
                });
            } catch (error) {
                console.error(`❌ Failed to upload report ${report.filename}:`, error.message);
                uploadResults.push({
                    filename: report.filename,
                    extension: report.extension,
                    error: error.message
                });
            }
        }
        
        return uploadResults;
    }

    /**
     * Lista arquivos no bucket
     */
    async listFiles(prefix = '') {
        try {
            const params = {
                Bucket: this.bucketName,
                Prefix: prefix
            };
            
            const result = await this.s3.listObjectsV2(params).promise();
            return result.Contents || [];
        } catch (error) {
            console.error('❌ Failed to list files:', error.message);
            return [];
        }
    }

    /**
     * Determina o Content-Type baseado na extensão do arquivo
     */
    getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.json': 'application/json',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        return contentTypes[ext] || 'application/octet-stream';
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
     * Verifica se MinIO está configurado e disponível
     */
    async isAvailable() {
        try {
            await this.testConnection();
            await this.ensureBucket();
            return true;
        } catch (error) {
            console.log('⚠️ MinIO not available, reports will be saved locally only');
            return false;
        }
    }
}

module.exports = MinIOClient;
