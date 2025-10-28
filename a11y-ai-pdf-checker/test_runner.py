#!/usr/bin/env python3
"""
Script para testar o Lambda de verificação de acessibilidade PDF
Executa os testes diretamente usando os PDFs de exemplo
"""

import sys
import os
import json
import urllib.request
import boto3
from botocore.config import Config
from main import lambda_handler, get_s3_client

# Simular contexto Lambda
class MockContext:
    def __init__(self):
        self.function_name = "test-function"
        self.function_version = "1"
        self.invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:test-function"
        self.memory_limit_in_mb = 128
        self.remaining_time_in_millis = 30000

def test_minio_connectivity():
    """Testa conectividade com MinIO"""
    try:
        response = urllib.request.urlopen('http://host.docker.internal:9010/minio/health/live')
        print(f"✅ MinIO conectividade: OK (status {response.status})")
        return True
    except Exception as e:
        print(f"❌ MinIO conectividade: FALHOU - {e}")
        return False

def list_pdfs_in_minio():
    """Lista todos os PDFs disponíveis no bucket MinIO"""
    try:
        s3_client = get_s3_client()
        response = s3_client.list_objects_v2(Bucket='pdf')
        
        pdfs = []
        if 'Contents' in response:
            for obj in response['Contents']:
                key = obj['Key']
                if key.lower().endswith('.pdf'):
                    pdfs.append(key)
        
        print(f"📁 PDFs encontrados no MinIO: {len(pdfs)}")
        for pdf in pdfs:
            print(f"  - {pdf}")
        
        return pdfs
    except Exception as e:
        print(f"❌ Erro ao listar PDFs no MinIO: {e}")
        return []

def test_pdf(event_name, event_data):
    """
    Testa um PDF específico usando o lambda_handler
    """
    print(f"\n{'='*50}")
    print(f"TESTE: {event_name}")
    print(f"{'='*50}")
    
    context = MockContext()
    
    try:
        result = lambda_handler(event_data, context)
        print(f"✅ Resultado: {result}")
        return True
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def main():
    """
    Função principal que executa todos os testes
    """
    print("==========================================")
    print("  PDF Accessibility - Teste Local")
    print("==========================================")
    print("Iniciando testes...")
    
    # Teste de conectividade primeiro
    print("\n" + "="*50)
    print("TESTE DE CONECTIVIDADE")
    print("="*50)
    connectivity_ok = test_minio_connectivity()
    
    if not connectivity_ok:
        print("\n❌ Falha na conectividade com MinIO. Abortando testes.")
        return 1
    
    # Listar PDFs disponíveis no MinIO
    print("\n" + "="*50)
    print("LISTANDO PDFs DISPONÍVEIS")
    print("="*50)
    pdfs = list_pdfs_in_minio()
    
    if not pdfs:
        print("\n❌ Nenhum PDF encontrado no MinIO. Abortando testes.")
        return 1
    
    # Processar cada PDF encontrado
    print(f"\n{'='*50}")
    print("EXECUTANDO TESTES DE ACESSIBILIDADE")
    print(f"{'='*50}")
    
    results = []
    for i, pdf_key in enumerate(pdfs, 1):
        print(f"\n--- Teste {i}/{len(pdfs)} ---")
        
        # Criar evento para este PDF
        event = {
            "s3_bucket": "pdf",
            "chunks": [
                {
                    "s3_key": pdf_key
                }
            ]
        }
        
        # Executar teste
        success = test_pdf(f"PDF {i}: {pdf_key}", event)
        results.append((pdf_key, success))
    
    # Resumo dos testes
    print(f"\n{'='*50}")
    print("RESUMO DOS TESTES")
    print(f"{'='*50}")
    print(f"Conectividade MinIO: {'✅ PASSOU' if connectivity_ok else '❌ FALHOU'}")
    print(f"PDFs processados: {len(pdfs)}")
    
    passed = 0
    failed = 0
    for pdf_key, success in results:
        status = "✅ PASSOU" if success else "❌ FALHOU"
        print(f"  {pdf_key}: {status}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print(f"\nResultado: {passed} passaram, {failed} falharam")
    
    if connectivity_ok and failed == 0:
        print("\n🎉 Todos os testes passaram!")
        return 0
    else:
        print(f"\n⚠️  {failed} teste(s) falharam!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
