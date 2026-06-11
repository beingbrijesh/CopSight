FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port required by Hugging Face Spaces
EXPOSE 7860

# Start the ARQ background worker and the FastAPI server
CMD python -m arq app.worker.WorkerSettings & uvicorn app.main:app --host 0.0.0.0 --port 7860
