FROM openjdk:11-jdk-slim

# Instala Python e ferramentas necessárias
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv wget unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Cria link simbólico para python
RUN ln -s /usr/bin/python3 /usr/bin/python

# Define diretório de trabalho
WORKDIR /app

# Baixa e instala VeraPDF
RUN cd /tmp && \
    wget https://software.verapdf.org/releases/verapdf-installer.zip && \
    unzip verapdf-installer.zip && \
    cd verapdf-greenfield-* && \
    chmod +x verapdf-install && \
    printf "1\n/usr/local/verapdf\nO\n1\nN\nN\nN\n1\n" | ./verapdf-install && \
    ln -s /usr/local/verapdf/bin/verapdf /usr/local/bin/verapdf && \
    rm -rf /tmp/verapdf-*

# Verifica se VeraPDF foi instalado corretamente
RUN /usr/local/verapdf/verapdf --version

# Copia arquivos da aplicação
COPY main.py /app/
COPY requirements.txt /app/
COPY test_runner.py /app/

# Instala dependências Python
RUN pip3 install -r requirements.txt

# Define variáveis de ambiente para Lambda
ENV AWS_LAMBDA_RUNTIME_API=localhost:9001
ENV AWS_LAMBDA_FUNCTION_NAME=pdf-accessibility-checker
ENV AWS_LAMBDA_FUNCTION_VERSION=1
ENV AWS_LAMBDA_FUNCTION_MEMORY_SIZE=512
ENV AWS_LAMBDA_LOG_GROUP_NAME=/aws/lambda/pdf-accessibility-checker
ENV AWS_LAMBDA_LOG_STREAM_NAME=2024/01/01/[$LATEST]test

# Expõe porta para Lambda Runtime Interface
EXPOSE 8080

# Comando para executar a aplicação
CMD ["python3", "main.py"]
