# CopSight AI — Ollama Setup Guide

CopSight AI prioritizes privacy and security for forensic data. We strongly recommend running LLM inference entirely on-premise using [Ollama](https://ollama.com/), ensuring no sensitive case data or queries are ever transmitted to third-party cloud providers.

---

## 🚀 1. Install Ollama

### macOS
Download and install from the official site:
[https://ollama.com/download/mac](https://ollama.com/download/mac)

### Windows
Download and install from the official site:
[https://ollama.com/download/windows](https://ollama.com/download/windows)

### Linux (Ubuntu/Debian)
Run the automated installation script:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

---

## 🧠 2. Required Models

CopSight AI requires two specific models to function correctly in a local environment: an embedding model for vector search, and a conversational LLM for query synthesis.

Open your terminal and pull the models:

### A. The Embedding Model (Mandatory)
Generates vector embeddings for the ChromaDB/Qdrant vector database.
```bash
ollama pull nomic-embed-text
```
*(Size: ~274 MB. Extremely fast, optimized for text retrieval).*

### B. The Query Model (Mandatory)
Used by the RAG pipeline to decompose user queries and synthesize evidence into human-readable answers.
```bash
# Recommended for machines with 8GB+ RAM
ollama pull llama3.2

# Alternatively, for higher accuracy on 16GB+ RAM machines
ollama pull mistral
```
*(Size: Llama3.2 is ~2.0 GB. Mistral is ~4.1 GB).*

---

## ⚙️ 3. Configure CopSight AI Service

Once Ollama is running and models are downloaded, configure the CopSight AI Service to connect to it.

1. Open `ai-service/.env`
2. Configure the following variables:

```env
# Point to your local Ollama instance (default port is 11434)
OLLAMA_HOST=http://localhost:11434

# Specify the exact model names you pulled
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.2
```

3. Restart the Python AI Service.

---

## 🌐 4. Running Ollama on a Separate Node (Production)

If you deploy the AI Service and Ollama on separate servers (highly recommended for performance), you must configure Ollama to listen on all network interfaces, not just `localhost`.

### Linux Systemd Configuration

1. Edit the Ollama service configuration:
```bash
sudo systemctl edit ollama.service
```

2. Add the following under the `[Service]` section to expose the API to your local network:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```

3. Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

4. Update your `ai-service/.env` to point to the new IP:
```env
OLLAMA_HOST=http://192.168.1.100:11434
```

> [!CAUTION]
> **Security Warning:** Setting `OLLAMA_HOST=0.0.0.0` exposes the Ollama API to anyone who can reach that IP address. Ensure this node is protected by a firewall or deployed within an isolated Virtual Private Cloud (VPC) accessible only by the CopSight AI backend.

---

## ☁️ Fallback: Using Cloud LLMs

If local hardware is insufficient for LLM inference, CopSight AI supports falling back to cloud providers.

### Google Gemini (Supported)
1. Get an API key from [Google AI Studio](https://aistudio.google.com/).
2. Add it to `ai-service/.env`:
```env
GEMINI_API_KEY=your_api_key_here
```
*(If `GEMINI_API_KEY` is present, the system will use Gemini for query synthesis instead of Ollama, but will still require local embeddings via Ollama or a configured cloud vectorizer).*

---

## 🛠️ Troubleshooting

**Error: Connection Refused (Port 11434)**
- Ensure the Ollama application is actually running (check your system tray on Mac/Windows or `systemctl status ollama` on Linux).

**Error: Model not found**
- Ensure you ran `ollama pull <model-name>` and that the exact string matches your `.env` configuration.

**Slow Query Responses**
- Ensure your machine is not heavily utilizing Swap/Pagefile memory.
- If using CPU only, inference will be slow. A dedicated GPU is strongly recommended for production use.
