import os
import boto3
import json
import subprocess
import tempfile
from datetime import datetime
from botocore.exceptions import ClientError
from botocore.config import Config

# Configurações MinIO para desenvolvimento local
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'http://localhost:9010')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin123')
MINIO_USE_SSL = os.getenv('MINIO_USE_SSL', 'false').lower() == 'true'

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
        print("Usando MinIO local")
        print(f"MINIO_ENDPOINT: {MINIO_ENDPOINT}")
        print(f"MINIO_ACCESS_KEY: {MINIO_ACCESS_KEY}")
        print(f"MINIO_SECRET_KEY: {MINIO_SECRET_KEY[:4]}***")
        print(f"MINIO_USE_SSL: {MINIO_USE_SSL}")
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
        print("Usando AWS S3")
        return boto3.client('s3')

def create_json_output_file_path():
        os.makedirs("/tmp/PDFAccessibilityChecker", exist_ok=True)
        # Também criar diretório para exportar relatórios para o host
        os.makedirs("/app/reports", exist_ok=True)
        return f"/tmp/PDFAccessibilityChecker/result_before_remidiation.json"

def download_file_from_s3(bucket_name, file_key, local_path):
    s3 = get_s3_client()
    print(f"Filename : {file_key} | File key in the function: {file_key}")
    print(f"Tentando baixar: bucket={bucket_name}, key={file_key}")

    s3.download_file(bucket_name, file_key, local_path)

    print(f"Filename : {file_key} | Downloaded {file_key} from {bucket_name} to {local_path}")

def save_to_s3(bucket_name, file_key):
    s3 = get_s3_client()
    file_key_without_extension = os.path.splitext(file_key)[0]
    timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
    
    # Upload do arquivo JSON
    json_local_path = "/tmp/PDFAccessibilityChecker/result_before_remidiation.json"
    json_bucket_path = f"temp/{file_key_without_extension}/accessability-report/{file_key_without_extension}_a11y_report_{timestamp}.json"
    
    with open(json_local_path, "rb") as data:
        s3.upload_fileobj(data, bucket_name, json_bucket_path)
    print(f"Filename {file_key} | Uploaded JSON report to {bucket_name} at path {json_bucket_path}")
    
    # Upload do arquivo HTML
    html_local_path = "/tmp/PDFAccessibilityChecker/result_before_remidiation.html"
    html_bucket_path = f"temp/{file_key_without_extension}/accessability-report/{file_key_without_extension}_a11y_report_{timestamp}.html"
    
    if os.path.exists(html_local_path):
        with open(html_local_path, "rb") as data:
            s3.upload_fileobj(data, bucket_name, html_bucket_path)
        print(f"Filename {file_key} | Uploaded HTML report to {bucket_name} at path {html_bucket_path}")
    else:
        print(f"Filename {file_key} | HTML report not found: {html_local_path}")

    return json_bucket_path

        
def run_verapdf_validation(pdf_path, output_path):
    """
    Executa o VeraPDF para validar acessibilidade do PDF
    Gera relatórios em JSON e HTML
    """
    try:
        # Garantir que o diretório de saída existe
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Preparar caminhos para JSON e HTML
        json_path = output_path
        html_path = output_path.replace('.json', '.html')
        
        # Preparar caminhos únicos para exportação no host baseados no nome do PDF
        pdf_basename = os.path.splitext(os.path.basename(pdf_path))[0]
        timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
        host_json_path = f"/app/reports/{pdf_basename}_a11y_report_{timestamp}.json"
        host_html_path = f"/app/reports/{pdf_basename}_a11y_report_{timestamp}.html"
        
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
        
        print(f"Executando comando VeraPDF JSON: {' '.join(cmd_json)}")
        
        # Executa o comando JSON
        result_json = subprocess.run(
            cmd_json,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos de timeout
        )
        
        print(f"Executando comando VeraPDF HTML: {' '.join(cmd_html)}")
        
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
            with open(json_path, 'w', encoding='utf-8') as f:
                f.write(result_json.stdout)
            print(f"Relatório JSON salvo em: {json_path}")
            
            # Salva o resultado HTML no arquivo de saída
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(result_html.stdout)
            print(f"Relatório HTML salvo em: {html_path}")
            
            # Também salva no diretório de exportação para o host
            with open(host_json_path, 'w', encoding='utf-8') as f:
                f.write(result_json.stdout)
            print(f"Relatório JSON exportado para host: {host_json_path}")
            
            with open(host_html_path, 'w', encoding='utf-8') as f:
                f.write(result_html.stdout)
            print(f"Relatório HTML exportado para host: {host_html_path}")
            
            print(f"VeraPDF executado com sucesso para {pdf_path}")
            return True
        else:
            print(f"Erro ao executar VeraPDF JSON: {result_json.stderr}")
            print(f"Erro ao executar VeraPDF HTML: {result_html.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"Timeout ao executar VeraPDF para {pdf_path}")
        return False
    except Exception as e:
        print(f"Erro inesperado ao executar VeraPDF: {e}")
        return False
     

def lambda_handler(event, context):
    print("Received event:", event)
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
            
    print("File basename:", file_basename)
    print("s3_bucket:", s3_bucket)
    local_path = f"/tmp/{file_basename}"
    download_file_from_s3(s3_bucket, file_basename, local_path)

    try:
        # Cria o caminho de saída para o relatório JSON
        output_file_path_json = create_json_output_file_path()
        
        # Executa a validação VeraPDF
        success = run_verapdf_validation(local_path, output_file_path_json)
        
        if success:
            # Salva o relatório no S3
            bucket_save_path = save_to_s3(s3_bucket, file_basename)
            print(f"Filename : {file_basename} | Saved accessibility report to {bucket_save_path}")
            return f"Filename : {file_basename} | Saved accessibility report to {bucket_save_path}"
        else:
            error_msg = f"Filename : {file_basename} | Failed to generate accessibility report with VeraPDF"
            print(error_msg)
            return error_msg

    except Exception as e:
        error_msg = f'Filename : {file_basename} | Exception encountered while executing VeraPDF operation: {e}'
        print(error_msg)
        return error_msg
    
