import os
import sys
import boto3
import json
import subprocess
import tempfile
from datetime import datetime
from botocore.exceptions import ClientError
from botocore.config import Config
from flask import Flask, request, jsonify
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configurações MinIO para desenvolvimento local
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'http://localhost:9010')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin123')
MINIO_USE_SSL = os.getenv('MINIO_USE_SSL', 'false').lower() == 'true'

app = Flask(__name__)

def is_local_environment():
    """
    Detecta se estamos rodando em ambiente local (MinIO) ou produção (AWS S3)
    """
    return os.getenv('ENVIRONMENT', 'local').lower() == 'local'

def get_s3_client():
    """
    Retorna cliente S3 configurado para MinIO local ou AWS S3
    """
    if is_local_environment():
        logger.info("Usando MinIO local")
        logger.info(f"MINIO_ENDPOINT: {MINIO_ENDPOINT}")
        logger.info(f"MINIO_ACCESS_KEY: {MINIO_ACCESS_KEY}")
        logger.info(f"MINIO_SECRET_KEY: {MINIO_SECRET_KEY[:4]}***")
        logger.info(f"MINIO_USE_SSL: {MINIO_USE_SSL}")
        return boto3.client(
            's3',
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            region_name='us-east-1',  # MinIO requer uma região
            use_ssl=MINIO_USE_SSL,
            config=Config(signature_version='s3v4')
        )
    else:
        logger.info("Usando AWS S3")
        return boto3.client('s3')

def create_json_output_file_path():
    os.makedirs("/tmp/PDFAccessibilityChecker", exist_ok=True)
    # Também criar diretório para exportar relatórios para o host
    os.makedirs("/app/reports", exist_ok=True)
    return f"/tmp/PDFAccessibilityChecker/result_before_remidiation.json"

def download_file_from_minio(file_name):
    """
    Baixa arquivo do MinIO para análise local
    """
    try:
        s3_client = get_s3_client()
        bucket_name = 'pdf'
        
        # Verificar se arquivo existe no MinIO
        try:
            s3_client.head_object(Bucket=bucket_name, Key=file_name)
            logger.info(f"Arquivo encontrado no MinIO: {file_name}")
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                logger.error(f"Arquivo não encontrado no MinIO: {file_name}")
                return None
            else:
                raise
        
        # Baixar arquivo
        local_path = f"/tmp/{file_name}"
        s3_client.download_file(bucket_name, file_name, local_path)
        logger.info(f"Arquivo baixado para: {local_path}")
        return local_path
        
    except Exception as e:
        logger.error(f"Erro ao baixar arquivo do MinIO: {str(e)}")
        return None


def upload_report_to_minio(local_file_path, minio_key):
    """
    Faz upload do relatório para o MinIO
    """
    try:
        s3_client = get_s3_client()
        bucket_name = 'pdf'
        
        s3_client.upload_file(local_file_path, bucket_name, minio_key)
        logger.info(f"Relatório enviado para MinIO: {minio_key}")
        return True
        
    except Exception as e:
        logger.error(f"Erro ao enviar relatório para MinIO: {str(e)}")
        return False

def run_verapdf_analysis(pdf_path):
    """
    Executa análise de acessibilidade PDF usando VeraPDF real
    """
    try:
        # Criar diretórios de saída
        os.makedirs("/tmp/PDFAccessibilityChecker", exist_ok=True)
        os.makedirs("/app/reports", exist_ok=True)
        
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
        
        # Preparar caminhos para JSON e HTML
        json_output = f"/tmp/PDFAccessibilityChecker/{base_name}_vera_report_{timestamp}.json"
        html_output = f"/tmp/PDFAccessibilityChecker/{base_name}_vera_report_{timestamp}.html"
        
        # Comando VeraPDF para validação de acessibilidade (PDF/UA) - JSON
        cmd_json = [
            '/usr/local/verapdf/verapdf',
            '--format', 'json',
            '--flavour', 'ua1',
            pdf_path
        ]
        
        # Comando VeraPDF para validação de acessibilidade (PDF/UA) - HTML
        cmd_html = [
            '/usr/local/verapdf/verapdf',
            '--format', 'html',
            '--flavour', 'ua1',
            pdf_path
        ]
        
        logger.info(f"Executando VeraPDF JSON: {' '.join(cmd_json)}")
        
        # Executa o comando JSON
        result_json = subprocess.run(
            cmd_json,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos de timeout
        )
        
        logger.info(f"Executando VeraPDF HTML: {' '.join(cmd_html)}")
        
        # Executa o comando HTML
        result_html = subprocess.run(
            cmd_html,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos de timeout
        )
        
        if (result_json.returncode == 0 or result_json.returncode == 1) and \
           (result_html.returncode == 0 or result_html.returncode == 1):
            # Exit code 0 = PDF conforme, Exit code 1 = PDF não conforme (mas válido)
            # Salva o resultado JSON no arquivo de saída
            with open(json_output, 'w', encoding='utf-8') as f:
                f.write(result_json.stdout)
            logger.info(f"Relatório JSON VeraPDF salvo em: {json_output}")
            
            # Salva o resultado HTML no arquivo de saída
            with open(html_output, 'w', encoding='utf-8') as f:
                f.write(result_html.stdout)
            logger.info(f"Relatório HTML VeraPDF salvo em: {html_output}")
            
            # Parsear JSON do VeraPDF para extrair informações
            try:
                vera_json = json.loads(result_json.stdout)
                
                # Contar problemas reais do VeraPDF
                issues_count = 0
                if 'report' in vera_json and 'jobs' in vera_json['report']:
                    for job in vera_json['report']['jobs']:
                        if 'validationResult' in job:
                            for result in job['validationResult']:
                                if 'details' in result:
                                    issues_count += result['details'].get('failedRules', 0)
                
                logger.info(f"Análise VeraPDF concluída: {issues_count} problemas encontrados")
                
                return {
                    "vera_json_path": json_output,
                    "vera_html_path": html_output,
                    "issues_count": issues_count,
                    "vera_data": vera_json
                }
            except json.JSONDecodeError as e:
                logger.error(f"Erro ao fazer parse do JSON do VeraPDF: {str(e)}")
                return None
        else:
            logger.error(f"Erro ao executar VeraPDF JSON: {result_json.stderr}")
            logger.error(f"Erro ao executar VeraPDF HTML: {result_html.stderr}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error("VeraPDF timeout")
        return None
    except FileNotFoundError:
        logger.error("Erro: Comando '/usr/local/verapdf/verapdf' não encontrado.")
        return None
    except Exception as e:
        logger.error(f"Erro na análise VeraPDF: {str(e)}")
        return None


def process_pdf_file(file_name):
    """
    Processa arquivo PDF completo: download, análise, upload do relatório
    """
    try:
        logger.info(f"Processando arquivo: {file_name}")
        
        # 1. Baixar arquivo do MinIO
        local_pdf_path = download_file_from_minio(file_name)
        if not local_pdf_path:
            return {"error": "Falha ao baixar arquivo do MinIO"}
        
        # 2. Executar análise VeraPDF
        vera_result = run_verapdf_analysis(local_pdf_path)
        if not vera_result:
            return {"error": "Falha na análise VeraPDF"}
        
        # 3. Usar os relatórios gerados pelo VeraPDF diretamente
        timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
        base_name = os.path.splitext(file_name)[0]
        
        # Copiar relatórios VeraPDF para diretório de reports
        json_report_path = f"/app/reports/{base_name}_vera_report_{timestamp}.json"
        html_report_path = f"/app/reports/{base_name}_vera_report_{timestamp}.html"
        
        # Copiar arquivos VeraPDF para o diretório de reports
        import shutil
        shutil.copy2(vera_result["vera_json_path"], json_report_path)
        shutil.copy2(vera_result["vera_html_path"], html_report_path)
        
        # 4. Upload dos relatórios VeraPDF para MinIO
        json_key = f"temp/pdf_accessibility_{timestamp}/{base_name}_vera_report.json"
        html_key = f"temp/pdf_accessibility_{timestamp}/{base_name}_vera_report.html"
        
        upload_success_json = upload_report_to_minio(json_report_path, json_key)
        upload_success_html = upload_report_to_minio(html_report_path, html_key)
        
        # 6. Limpar arquivo temporário
        try:
            os.remove(local_pdf_path)
        except:
            pass
        
        return {
            "status": "completed",
            "filename": file_name,
            "issues": vera_result["issues_count"],
            "results": [
                {
                    "filename": f"{base_name}_vera_report",
                    "extension": "json",
                    "bucketKey": json_key,
                    "url": f"/api/download/{json_key}",
                    "bucket": "pdf"
                },
                {
                    "filename": f"{base_name}_vera_report",
                    "extension": "html",
                    "bucketKey": html_key,
                    "url": f"/api/download/{html_key}",
                    "bucket": "pdf"
                }
            ],
            "reportUrl": f"/api/download/{json_key}"
        }
        
    except Exception as e:
        logger.error(f"Erro no processamento: {str(e)}")
        return {"error": str(e)}

# API Endpoints

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'pdf-checker',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Endpoint para análise de PDF"""
    try:
        data = request.get_json()
        if not data or 'fileName' not in data:
            return jsonify({'error': 'fileName é obrigatório'}), 400
        
        fileName = data['fileName']
        logger.info(f"Iniciando análise para: {fileName}")
        
        # Processar arquivo
        result = process_pdf_file(fileName)
        
        if 'error' in result:
            return jsonify(result), 500
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Erro no endpoint analyze: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<path:minio_key>', methods=['GET'])
def download_report(minio_key):
    """Endpoint para download de relatórios"""
    try:
        s3_client = get_s3_client()
        bucket_name = 'pdf'
        
        # Baixar arquivo do MinIO
        response = s3_client.get_object(Bucket=bucket_name, Key=minio_key)
        content = response['Body'].read()
        
        # Determinar content-type
        if minio_key.endswith('.json'):
            content_type = 'application/json'
        elif minio_key.endswith('.html'):
            content_type = 'text/html'
        else:
            content_type = 'application/octet-stream'
        
        return content, 200, {
            'Content-Type': content_type,
            'Content-Disposition': f'attachment; filename="{os.path.basename(minio_key)}"'
        }
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            return jsonify({'error': 'Arquivo não encontrado'}), 404
        else:
            return jsonify({'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Erro no download: {str(e)}")
        return jsonify({'error': str(e)}), 500

def lambda_handler(event, context):
    """
    Função lambda_handler para compatibilidade com test_runner.py
    """
    logger.info(f"Received event: {event}")
    s3_bucket = event.get('s3_bucket', None)
    chunks = event.get('chunks', [])
    
    if chunks:
        first_chunk = chunks[0]
        s3_key = first_chunk.get('s3_key', None)
        if s3_key:
            import os
            file_basename = os.path.basename(s3_key)
            # Remove chunk suffix if present
            if "_chunk_" in file_basename:
                file_basename = file_basename.split("_chunk_")[0] + os.path.splitext(file_basename)[1]
    else:
        return {"error": "No chunks found in event"}
    
    logger.info(f"File basename: {file_basename}")
    logger.info(f"s3_bucket: {s3_bucket}")
    
    try:
        # Processar arquivo usando a função existente
        result = process_pdf_file(file_basename)
        
        if 'error' in result:
            error_msg = f"Filename : {file_basename} | {result['error']}"
            logger.error(error_msg)
            return error_msg
        else:
            success_msg = f"Filename : {file_basename} | Saved accessibility report with {result['issues']} issues found"
            logger.info(success_msg)
            return success_msg
            
    except Exception as e:
        error_msg = f'Filename : {file_basename} | Exception encountered while executing VeraPDF operation: {e}'
        logger.error(error_msg)
        return error_msg

if __name__ == '__main__':
    logger.info("PDF Checker API iniciando...")
    app.run(host='0.0.0.0', port=5000, debug=False)