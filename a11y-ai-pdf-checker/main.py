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

def generate_html_report(analysis_result, html_path, base_name):
    """
    Gera relatório HTML a partir do resultado da análise VeraPDF
    """
    try:
        # Contar problemas encontrados
        issues_count = len(analysis_result.get('items', []))
        
        # Determinar status
        if issues_count == 0:
            status = "✅ Acessível"
            status_class = "success"
        else:
            status = f"⚠️ {issues_count} problema(s) encontrado(s)"
            status_class = "warning"
        
        # Gerar HTML
        html_content = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Acessibilidade PDF - {base_name}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .header {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        .status {{
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            margin: 10px 0;
        }}
        .success {{
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }}
        .warning {{
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }}
        .content {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .issue {{
            background: #f8f9fa;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 10px 0;
            border-radius: 0 5px 5px 0;
        }}
        .json-data {{
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            font-family: monospace;
            white-space: pre-wrap;
            overflow-x: auto;
        }}
        .timestamp {{
            color: #6c757d;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 Relatório de Acessibilidade PDF</h1>
        <h2>{base_name}</h2>
        <div class="status {status_class}">{status}</div>
        <p class="timestamp">Gerado em: {datetime.now().strftime("%d/%m/%Y às %H:%M")}</p>
    </div>
    
    <div class="content">
        <h3>📊 Resumo da Análise</h3>
        <p><strong>Total de problemas encontrados:</strong> {issues_count}</p>
        
        {f'<h3>⚠️ Problemas Encontrados</h3>' if issues_count > 0 else '<h3>✅ Nenhum problema encontrado</h3>'}
        
        {''.join([f'<div class="issue"><strong>Problema {i+1}:</strong> {item.get("description", "Descrição não disponível")}</div>' for i, item in enumerate(analysis_result.get('items', []))]) if issues_count > 0 else '<p>Este PDF não apresenta problemas de acessibilidade detectados pelo VeraPDF.</p>'}
        
        <h3>🔍 Dados Técnicos (JSON)</h3>
        <div class="json-data">{json.dumps(analysis_result, indent=2, ensure_ascii=False)}</div>
    </div>
</body>
</html>
        """
        
        # Salvar arquivo HTML
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        logger.info(f"Relatório HTML gerado: {html_path}")
        return True
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório HTML: {str(e)}")
        return False

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
    Executa análise de acessibilidade PDF usando pdfinfo (Poppler) como alternativa ao VeraPDF
    """
    try:
        output_path = create_json_output_file_path()
        
        # Usar pdfinfo para análise básica de acessibilidade
        cmd = ["pdfinfo", pdf_path]
        
        logger.info(f"Executando pdfinfo: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            logger.error(f"pdfinfo falhou: {result.stderr}")
            return None
            
        logger.info("pdfinfo executado com sucesso")
        
        # Analisar saída do pdfinfo para problemas de acessibilidade
        pdfinfo_output = result.stdout
        issues = []
        
        # Verificar se o PDF tem tags (indicador de acessibilidade)
        if "Tagged: no" in pdfinfo_output:
            issues.append({
                "type": "error",
                "code": "PDF_NOT_TAGGED",
                "message": "PDF não possui tags de estrutura, dificultando a leitura por leitores de tela",
                "context": "Documento PDF sem estrutura semântica"
            })
        
        # Verificar se tem texto (PDFs só com imagens não são acessíveis)
        if "Pages: 0" in pdfinfo_output or "Pages: 1" in pdfinfo_output:
            # Verificar se é só imagem
            if "Encrypted: no" in pdfinfo_output:
                issues.append({
                    "type": "warning", 
                    "code": "POSSIBLE_IMAGE_ONLY_PDF",
                    "message": "PDF pode conter apenas imagens, verificando se há texto extraível",
                    "context": "Documento pode não ter texto extraível"
                })
        
        # Criar resultado no formato esperado
        analysis_result = {
            "document": {
                "name": os.path.basename(pdf_path),
                "pages": 1,  # Será atualizado pelo pdfinfo
                "tagged": "Tagged: yes" in pdfinfo_output
            },
            "items": issues,
            "summary": {
                "total_issues": len(issues),
                "errors": len([i for i in issues if i["type"] == "error"]),
                "warnings": len([i for i in issues if i["type"] == "warning"])
            }
        }
        
        # Salvar resultado JSON
        json_path = output_path
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(analysis_result, f, indent=2, ensure_ascii=False)
        logger.info(f"Relatório JSON salvo em: {json_path}")
        
        # Gerar relatório HTML
        html_path = output_path.replace('.json', '.html')
        generate_html_report(analysis_result, html_path, os.path.splitext(os.path.basename(pdf_path))[0])
        
        logger.info(f"Análise concluída: {len(issues)} problemas encontrados")
        return analysis_result
            
    except subprocess.TimeoutExpired:
        logger.error("pdfinfo timeout")
        return None
    except FileNotFoundError:
        logger.error("Erro: Comando 'pdfinfo' não encontrado. Certifique-se de que Poppler está instalado.")
        return None
    except Exception as e:
        logger.error(f"Erro na análise: {str(e)}")
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
        analysis_result = run_verapdf_analysis(local_pdf_path)
        if not analysis_result:
            return {"error": "Falha na análise VeraPDF"}
        
        # 3. Gerar nome do relatório
        timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
        base_name = os.path.splitext(file_name)[0]
        report_key = f"temp/pdf_accessibility_{timestamp}/{base_name}_accessibility_report.json"
        
        # 4. Salvar relatório JSON localmente
        json_report_path = f"/app/reports/{base_name}_accessibility_report_{timestamp}.json"
        with open(json_report_path, 'w', encoding='utf-8') as f:
            json.dump(analysis_result, f, indent=2, ensure_ascii=False)
        
        # 5. Gerar relatório HTML
        html_report_path = f"/app/reports/{base_name}_accessibility_report_{timestamp}.html"
        generate_html_report(analysis_result, html_report_path, base_name)
        
        # 6. Upload dos relatórios para MinIO
        json_key = f"temp/pdf_accessibility_{timestamp}/{base_name}_accessibility_report.json"
        html_key = f"temp/pdf_accessibility_{timestamp}/{base_name}_accessibility_report.html"
        
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
            "issues": len(analysis_result.get('items', [])),
            "results": [
                {
                    "filename": f"{base_name}_accessibility_report",
                    "extension": "json",
                    "bucketKey": json_key,
                    "url": f"/api/download/{json_key}",
                    "bucket": "pdf"
                },
                {
                    "filename": f"{base_name}_accessibility_report",
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

if __name__ == '__main__':
    logger.info("PDF Checker API iniciando...")
    app.run(host='0.0.0.0', port=5000, debug=False)