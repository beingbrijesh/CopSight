FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port required by Hugging Face Spaces
EXPOSE 7860

# Disable TensorFlow CUDA/GPU to prevent warnings on Hugging Face CPU instances
ENV CUDA_VISIBLE_DEVICES="-1"
ENV TF_CPP_MIN_LOG_LEVEL="2"
ENV TF_ENABLE_ONEDNN_OPTS="0"

# Start the ARQ background worker and the FastAPI server
CMD python -m arq app.worker.WorkerSettings & uvicorn app.main:app --host 0.0.0.0 --port 7860
