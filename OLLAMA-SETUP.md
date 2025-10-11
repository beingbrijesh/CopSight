# Ollama Installation and Setup Guide for UFDR System

This guide provides step-by-step instructions for installing and configuring Ollama to enable AI-powered features in the UFDR system.

## 📋 Table of Contents
1. [What is Ollama?](#what-is-ollama)
2. [Installation](#installation)
3. [Model Setup](#model-setup)
4. [Configuration](#configuration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## 🤖 What is Ollama?

Ollama is a local LLM (Large Language Model) runtime that allows you to run AI models on your own machine without sending data to external APIs. In UFDR, it powers:
- Natural language query processing
- Evidence-based answer generation
- Query decomposition and understanding
- Text embeddings for semantic search

**Privacy Benefit**: All AI processing happens locally - no data leaves your system.

---

## 💻 Installation

### macOS

#### Method 1: Download Installer (Recommended)
1. Visit https://ollama.com/download
2. Click "Download for macOS"
3. Open the downloaded `.dmg` file
4. Drag Ollama to Applications folder
5. Launch Ollama from Applications

#### Method 2: Using Homebrew
```bash
brew install ollama
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows

1. Visit https://ollama.com/download
2. Download the Windows installer
3. Run the installer and follow prompts
4. Ollama will start automatically

### Verify Installation

```bash
# Check if Ollama is installed
ollama --version

# Expected output: ollama version is 0.x.x
```

---

## 📦 Model Setup

### Required Models for UFDR

UFDR requires two models:

1. **nomic-embed-text** - For generating text embeddings (384 dimensions)
2. **llama3.2** - For natural language understanding and answer generation

### Pull Models

```bash
# Start Ollama service (if not already running)
ollama serve &

# Pull embedding model (~274 MB)
ollama pull nomic-embed-text

# Pull LLM model (~2 GB)
ollama pull llama3.2
```

### Verify Models

```bash
# List installed models
ollama list

# Expected output:
# NAME                    ID              SIZE      MODIFIED
# llama3.2:latest         a80c4f17acd5    2.0 GB    X minutes ago
# nomic-embed-text:latest 0a109f422b47    274 MB    X minutes ago
```

### Test Models

```bash
# Test embedding model
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "test"
}'

# Test LLM model
ollama run llama3.2 "Hello, how are you?"
```

---

## ⚙️ Configuration

### 1. Backend Configuration

**File**: `backend-node/.env`

**What to Change**:
```env
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.2
```

**Location**: Lines 55-58 in `.env` file

**How to Edit**:
```bash
cd backend-node

# If .env doesn't exist, copy from example
cp .env.example .env

# Edit the file
nano .env  # or use your preferred editor

# Find the Ollama section and ensure these values:
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.2
```

**Note**: If Ollama is running on a different machine, change `localhost` to the machine's IP address.

---

### 2. AI Service Configuration

**File**: `ai-service/.env`

**What to Change**:
```env
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIM=384
LLM_MODEL=llama3.2
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000
```

**Location**: Lines 20-26 in `.env` file

**How to Edit**:
```bash
cd ai-service

# If .env doesn't exist, copy from example
cp .env.example .env

# Edit the file
nano .env  # or use your preferred editor

# Find the Ollama section and configure:
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIM=384
LLM_MODEL=llama3.2
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000
```

**Configuration Explained**:
- `OLLAMA_HOST`: URL where Ollama is running
- `EMBEDDING_MODEL`: Model for text embeddings
- `EMBEDDING_DIM`: Dimension of embeddings (384 for nomic-embed-text)
- `LLM_MODEL`: Model for query processing
- `LLM_TEMPERATURE`: Creativity level (0.0-1.0, lower = more focused)
- `LLM_MAX_TOKENS`: Maximum response length

---

### 3. Code Configuration (Optional)

If you want to use different models, update these files:

#### Backend: `backend-node/src/services/ai/embeddingService.js`

**File Location**: `backend-node/src/services/ai/embeddingService.js`

**What to Change** (Line 8-10):
```javascript
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const EMBEDDING_DIM = 384; // nomic-embed-text dimension
```

**How to Change**:
```bash
cd backend-node/src/services/ai
nano embeddingService.js

# Find the constants at the top and modify if needed
# Only change if using a different embedding model
```

#### AI Service: `ai-service/app/config.py`

**File Location**: `ai-service/app/config.py`

**What to Change** (Lines 20-26):
```python
# Ollama Configuration
ollama_host: str = Field(default="http://localhost:11434", env="OLLAMA_HOST")
embedding_model: str = Field(default="nomic-embed-text", env="EMBEDDING_MODEL")
embedding_dim: int = Field(default=384, env="EMBEDDING_DIM")
llm_model: str = Field(default="llama3.2", env="LLM_MODEL")
llm_temperature: float = Field(default=0.7, env="LLM_TEMPERATURE")
llm_max_tokens: int = Field(default=2000, env="LLM_MAX_TOKENS")
```

**How to Change**:
```bash
cd ai-service/app
nano config.py

# Find the Settings class and modify default values if needed
# Changes in .env file will override these defaults
```

---

## ✅ Verification

### Step 1: Check Ollama Service

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Expected: JSON response with list of models
```

### Step 2: Test Backend Integration

```bash
# Start backend
cd backend-node
npm run dev

# In another terminal, test embedding generation
curl -X POST http://localhost:8080/api/test/embedding \
  -H "Content-Type: application/json" \
  -d '{"text": "test message"}'

# Expected: Array of 384 numbers (embedding vector)
```

### Step 3: Test AI Service

```bash
# Start AI service
cd ai-service
source venv/bin/activate
uvicorn app.main:app --reload --port 8005

# In another terminal, test health check
curl http://localhost:8005/health

# Expected: JSON with ollama status
{
  "status": "healthy",
  "ollama": "http://localhost:11434",
  "models": {
    "embedding": "nomic-embed-text",
    "llm": "llama3.2"
  }
}
```

### Step 4: Test Query Execution

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')

# Execute a test query
curl -X POST http://localhost:8080/api/query/case/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"queryText":"Show me all communications","queryType":"natural_language"}'

# Expected: JSON response with AI-generated answer
```

---

## 🐛 Troubleshooting

### Issue 1: Ollama Service Not Running

**Symptoms**:
- `curl: (7) Failed to connect to localhost port 11434`
- AI service shows "Ollama not available"

**Solution**:
```bash
# Start Ollama manually
ollama serve

# Or on macOS, ensure Ollama app is running
# Check menu bar for Ollama icon

# Verify it's running
curl http://localhost:11434/api/tags
```

---

### Issue 2: Models Not Found

**Symptoms**:
- Error: "model 'nomic-embed-text' not found"
- Error: "model 'llama3.2' not found"

**Solution**:
```bash
# List installed models
ollama list

# If models are missing, pull them
ollama pull nomic-embed-text
ollama pull llama3.2

# Verify installation
ollama list
```

---

### Issue 3: Port 11434 Already in Use

**Symptoms**:
- Error: "address already in use"

**Solution**:
```bash
# Find process using port 11434
lsof -ti:11434

# Kill the process
kill -9 $(lsof -ti:11434)

# Restart Ollama
ollama serve
```

---

### Issue 4: Slow Response Times

**Symptoms**:
- Queries take > 30 seconds
- Timeout errors

**Solutions**:

**Option 1: Use Smaller Model**
```bash
# Pull smaller model
ollama pull llama3.2:1b  # 1 billion parameters (faster)

# Update .env files
LLM_MODEL=llama3.2:1b
```

**Option 2: Increase Timeout**

Edit `ai-service/app/services/llm.py` (Line 15):
```python
# Change timeout from 30 to 60 seconds
timeout = aiohttp.ClientTimeout(total=60)
```

**Option 3: Allocate More Resources**

Edit Ollama configuration:
```bash
# macOS/Linux
export OLLAMA_NUM_THREADS=8
export OLLAMA_NUM_GPU=1

# Restart Ollama
ollama serve
```

---

### Issue 5: Out of Memory Errors

**Symptoms**:
- Ollama crashes
- System becomes unresponsive

**Solutions**:

**Option 1: Use Quantized Model**
```bash
# Pull 4-bit quantized version (uses less RAM)
ollama pull llama3.2:4bit

# Update .env
LLM_MODEL=llama3.2:4bit
```

**Option 2: Limit Context Window**

Edit `ai-service/.env`:
```env
LLM_MAX_TOKENS=1000  # Reduce from 2000
```

---

### Issue 6: AI Service Can't Connect to Ollama

**Symptoms**:
- AI service logs show connection errors
- Health check fails

**Solution**:

**Check Configuration**:
```bash
# Verify Ollama host in AI service
cd ai-service
cat .env | grep OLLAMA_HOST

# Should show: OLLAMA_HOST=http://localhost:11434
```

**Test Connection**:
```bash
# From AI service directory
curl http://localhost:11434/api/tags

# If this fails, Ollama isn't accessible
# Check firewall settings or network configuration
```

**Fix Network Issues**:
```bash
# If running in Docker, use host network
docker run --network host ...

# Or use host.docker.internal instead of localhost
OLLAMA_HOST=http://host.docker.internal:11434
```

---

## 🚀 Advanced Configuration

### Running Ollama on Different Machine

If Ollama runs on a separate server:

**1. Update Backend `.env`**:
```env
OLLAMA_HOST=http://192.168.1.100:11434
```

**2. Update AI Service `.env`**:
```env
OLLAMA_HOST=http://192.168.1.100:11434
```

**3. Configure Ollama to Accept Remote Connections**:
```bash
# On Ollama server
export OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

---

### Using GPU Acceleration

Ollama automatically uses GPU if available. To verify:

```bash
# Check GPU usage while running query
nvidia-smi  # For NVIDIA GPUs

# Or check Ollama logs
ollama serve 2>&1 | grep -i gpu
```

---

### Custom Model Configuration

To use different models:

**1. Find Available Models**:
```bash
# Browse models at https://ollama.com/library
```

**2. Pull Custom Model**:
```bash
ollama pull mistral  # Example: Mistral model
```

**3. Update Configuration**:
```env
# In both backend-node/.env and ai-service/.env
LLM_MODEL=mistral
```

**4. Restart Services**:
```bash
# Restart backend and AI service to load new model
```

---

## 📊 Resource Requirements

### Minimum Requirements
- **RAM**: 8 GB (for llama3.2)
- **Disk**: 5 GB free space
- **CPU**: 4 cores recommended

### Recommended Requirements
- **RAM**: 16 GB
- **Disk**: 10 GB free space
- **CPU**: 8 cores
- **GPU**: NVIDIA GPU with 4GB+ VRAM (optional, for faster inference)

### Model Sizes
- `nomic-embed-text`: 274 MB
- `llama3.2`: 2.0 GB
- `llama3.2:1b`: 1.3 GB (smaller, faster)
- `llama3.2:4bit`: 1.5 GB (quantized)

---

## 🔄 Updating Ollama

### Update Ollama Application

**macOS**:
```bash
brew upgrade ollama
```

**Linux**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Update Models

```bash
# Pull latest version of models
ollama pull nomic-embed-text
ollama pull llama3.2

# Remove old versions (optional)
ollama rm nomic-embed-text:old-version
```

---

## 📝 Quick Reference

### Essential Commands

```bash
# Start Ollama
ollama serve

# List models
ollama list

# Pull model
ollama pull <model-name>

# Remove model
ollama rm <model-name>

# Test model
ollama run <model-name> "test prompt"

# Check version
ollama --version

# View logs (macOS)
tail -f ~/.ollama/logs/server.log
```

### Configuration Files

| File | Purpose | Key Settings |
|------|---------|--------------|
| `backend-node/.env` | Backend config | OLLAMA_HOST, EMBEDDING_MODEL, LLM_MODEL |
| `ai-service/.env` | AI service config | OLLAMA_HOST, models, temperature, tokens |
| `backend-node/src/services/ai/embeddingService.js` | Embedding logic | Model defaults |
| `ai-service/app/config.py` | AI service settings | Model defaults, dimensions |

### Ports

| Service | Port | Purpose |
|---------|------|---------|
| Ollama | 11434 | LLM API |
| Backend | 8080 | REST API |
| AI Service | 8005 | AI endpoints |

---

## ✅ Setup Checklist

- [ ] Ollama installed and running
- [ ] `nomic-embed-text` model pulled
- [ ] `llama3.2` model pulled
- [ ] Backend `.env` configured
- [ ] AI Service `.env` configured
- [ ] Ollama service verified (curl test)
- [ ] Models verified (ollama list)
- [ ] Backend integration tested
- [ ] AI service integration tested
- [ ] Query execution tested

---

## 🎯 Summary

**Minimum Setup** (5 minutes):
1. Install Ollama
2. Pull models: `ollama pull nomic-embed-text && ollama pull llama3.2`
3. Verify: `ollama list`
4. Done! Backend and AI service will auto-detect

**Full Setup** (10 minutes):
1. Install Ollama
2. Pull models
3. Configure `.env` files
4. Test connections
5. Execute test query

**No Configuration Needed**: If you use default settings, just install Ollama and pull models. The system will work automatically!

---

**Status**: Ready for AI-Powered Features 🚀  
**Last Updated**: October 2025
