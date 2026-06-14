# CopSight AI — Quick Start Guide

Get CopSight AI up and running on your local machine in under 5 minutes for development or evaluation.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your machine:
- **Docker Desktop** (running)
- **Node.js** (v18 or higher)
- **Python** (v3.11 or higher)
- **Git**

*(Optional but Recommended)*
- **Ollama** (for local AI features without cloud API keys)

---

## 🚀 5-Minute Setup

### 1. Clone and Setup

```bash
git clone https://github.com/beingbrijesh/CopSight.git
cd CopSight
```

### 2. Start Database Services

We provide a script to spin up all required databases (PostgreSQL, Elasticsearch, Neo4j, Redis, ChromaDB).

```bash
# Make script executable and run it
chmod +x START-ALL.sh
./START-ALL.sh

# Wait ~30 seconds for all services to initialize
```

### 3. Setup and Start Backend

Open a new terminal window:

```bash
cd backend-node
npm install

# Copy environment variables (defaults work for local dev)
cp .env.example .env

# Start the API gateway
npm run dev
```

You should see: `🚀 CopSight AI API Gateway running on port 8080`

### 4. Setup and Start Frontend

Open a new terminal window:

```bash
cd frontend
npm install

# Start the Vite development server
npm run dev
```

The frontend is now running at: **http://localhost:5173**

### 5. Setup AI Service (Required for ML Features)

Open a new terminal window:

```bash
cd ai-service

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env

# Start FastAPI server
uvicorn app.main:app --reload --port 8005
```

---

## 🤖 Enable AI Features

To test Natural Language Queries, Anomaly Detection, and Predictive Analytics, you need LLM models.

**Option A: Local AI (Recommended for privacy)**
1. Install [Ollama](https://ollama.com/)
2. Run in terminal: `ollama pull nomic-embed-text`
3. Run in terminal: `ollama pull llama3.2`

**Option B: Cloud AI (Gemini)**
1. Edit `ai-service/.env`
2. Add: `GEMINI_API_KEY=your_api_key_here`
3. Restart the AI Service.

---

## 🧪 Testing the Platform

### 1. Login
Open **http://localhost:5173** in your browser.
- **Username:** `admin`
- **Password:** `admin123`

### 2. Create a Case
- Go to **Cases** → **New Case**
- Enter details (e.g., FIR: `123`, Title: `Test Investigation`)
- Assign it to yourself (Admin).

### 3. Upload Test Evidence
- Go to the newly created case details page.
- Click **Upload Evidence**.
- *(If you don't have a UFDR file, the system provides a mock parser for testing if you upload any XML file named `dummy.ufdr` or similar).*
- Wait for processing to complete.

### 4. Try Key Features
Once processing is complete, test the core platform capabilities:

- **Graph Explorer:** Click the "Network Graph" tab to see communication links.
- **AI Query:** Type *"Show me all communications with unknown numbers"* in the Query tab.
- **Anomaly Detection:** Go to Advanced AI Features and run the anomaly detector.

---

## 🔧 Using the forensixd CLI

To test the physical device extraction capabilities:

```bash
cd forensixd

# Install dependencies
pip install -e .

# Run the CLI
forensixd
```
This will open the interactive forensic shell where you can simulate or perform actual device extractions via USB.
