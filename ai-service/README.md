# UFDR AI Service

Python-based AI service for natural language query processing, RAG pipeline, and forensic analysis.

## Features

- **Natural Language Query Processing**: Ask questions in plain English
- **RAG Pipeline**: Retrieval-Augmented Generation for accurate answers
- **Multi-Database Search**: Parallel search across Elasticsearch, Milvus, and Neo4j
- **Pattern Detection**: Identify suspicious activities and patterns
- **Network Analysis**: Visualize communication networks
- **Timeline Generation**: Create event timelines

## Tech Stack

- **FastAPI**: Modern Python web framework
- **Ollama**: Local LLM inference (llama3.2)
- **LangChain**: LLM orchestration
- **Sentence Transformers**: Embedding generation
- **AsyncIO**: Async database operations

## Installation

### 1. Create Virtual Environment

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Ollama Models

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull nomic-embed-text
ollama pull llama3.2
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

## Running the Service

### Development Mode

```bash
uvicorn app.main:app --reload --port 8005
```

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8005 --workers 4
```

## API Endpoints

### Query Endpoints

**POST /api/query/execute**
Execute a natural language query

```json
{
  "case_id": 1,
  "query": "Show me all chats with foreign numbers discussing payments",
  "user_id": 1
}
```

**GET /api/query/history/{case_id}**
Get query history for a case

**GET /api/query/{query_id}**
Get specific query result

### Embedding Endpoints

**POST /api/embeddings/generate**
Generate embeddings for texts

```json
{
  "texts": ["Hello world", "Another text"]
}
```

**GET /api/embeddings/test**
Test embedding service availability

### Analysis Endpoints

**POST /api/analysis/detect-patterns**
Detect patterns in case data

```json
{
  "case_id": 1,
  "analysis_type": "suspicious"
}
```

Analysis types:
- `suspicious`: Detect suspicious activities
- `network`: Analyze communication network
- `timeline`: Generate event timeline

**GET /api/analysis/summary/{case_id}**
Get comprehensive case summary

## Example Queries

```python
import httpx

# Execute query
response = httpx.post("http://localhost:8005/api/query/execute", json={
    "case_id": 1,
    "query": "Find all WhatsApp messages mentioning 'bitcoin' or crypto addresses",
    "user_id": 1
})

result = response.json()
print(result["answer"])
print(result["evidence"])
```

## Architecture

```
Query → Query Decomposition (LLM)
     ↓
Parallel Search:
  - Elasticsearch (keyword)
  - Milvus (semantic)
  - Neo4j (graph)
     ↓
Result Ranking & Filtering
     ↓
Answer Synthesis (RAG)
     ↓
Response with Citations
```

## RAG Pipeline

1. **Query Decomposition**: LLM breaks down query into components
2. **Parallel Search**: Search all databases simultaneously
3. **Result Ranking**: Deduplicate and rank by relevance
4. **Answer Synthesis**: LLM generates answer from evidence
5. **Citation**: All answers cite specific evidence

## Integration with Node.js Backend

The AI service integrates with the Node.js backend via HTTP:

```javascript
// In Node.js backend
const response = await axios.post('http://localhost:8005/api/query/execute', {
  case_id: caseId,
  query: userQuery,
  user_id: userId
});
```

## Database Requirements

- **PostgreSQL**: Case and query metadata
- **Elasticsearch**: Indexed forensic data
- **Neo4j**: Communication graph (optional)
- **Milvus**: Vector embeddings (optional)
- **Redis**: Caching (optional)

## Performance

- Query processing: 2-5 seconds
- Embedding generation: 100ms per text
- Parallel search: 1-2 seconds
- Answer synthesis: 1-3 seconds

## Security

- No external API calls (fully on-premise)
- Local LLM inference with Ollama
- All data stays within your infrastructure
- JWT authentication (via backend)

## Monitoring

Health check endpoint:

```bash
curl http://localhost:8005/health
```

Returns status of all database connections and models.

## Troubleshooting

### Ollama Not Available

```bash
# Check if Ollama is running
ollama list

# Start Ollama
ollama serve
```

### Database Connection Issues

Check `.env` file for correct credentials and ensure all databases are running.

### Slow Query Performance

- Reduce `TOP_K` in config
- Optimize Elasticsearch indices
- Use Milvus for faster semantic search

## Development

### Project Structure

```
ai-service/
├── app/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── routers/             # API routes
│   │   ├── query.py         # Query endpoints
│   │   ├── embeddings.py    # Embedding endpoints
│   │   └── analysis.py      # Analysis endpoints
│   └── services/            # Business logic
│       ├── database.py      # Database manager
│       ├── embeddings.py    # Embedding service
│       ├── llm.py           # LLM service
│       └── rag.py           # RAG pipeline
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

### Adding New Features

1. Create new router in `app/routers/`
2. Add service logic in `app/services/`
3. Register router in `app/main.py`

## License

MIT
