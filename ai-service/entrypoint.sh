#!/bin/bash

# Start Ollama in the background
echo "Starting Ollama server..."
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
for i in {1..10}; do
    if curl -s -f http://localhost:11434 > /dev/null; then
        echo "Ollama is ready!"
        break
    fi
    echo "Waiting..."
    sleep 1
done

# Start the ARQ background worker
echo "Starting ARQ worker..."
python -m arq app.worker.WorkerSettings &

# Start the FastAPI application
echo "Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 7860
