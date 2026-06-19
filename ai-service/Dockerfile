FROM python:3.11-slim

# Install curl
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -L https://ollama.com/download/ollama-linux-amd64 -o /usr/bin/ollama && chmod +x /usr/bin/ollama

WORKDIR /app

# Set Ollama models directory
ENV OLLAMA_MODELS=/app/ollama_models

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-pull the Llama 3.2 3B model (4-bit quantization, ~2GB) during build
RUN ollama serve & \
    OLLAMA_PID=$! && \
    sleep 5 && \
    ollama pull llama3.2:3b && \
    kill $OLLAMA_PID

COPY . .

# Expose the port required by Hugging Face Spaces
EXPOSE 7860

# Disable TensorFlow CUDA/GPU to prevent warnings on Hugging Face CPU instances
ENV CUDA_VISIBLE_DEVICES="-1"
ENV TF_CPP_MIN_LOG_LEVEL="2"
ENV TF_ENABLE_ONEDNN_OPTS="0"

# Set entrypoint permissions and use it as default command
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
