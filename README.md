# UFDR System - Unified Forensic Data Repository

A comprehensive digital forensics platform with AI-powered analysis capabilities, built using an API-first microservices architecture.

## 🏗️ Architecture Overview

The UFDR system consists of 6 specialized modules working together:

### Module 1: React Frontend (Port 3000/5173)
- **Technology**: React + TypeScript + Vite + shadcn/ui
- **Purpose**: Investigation dashboard with authentication, file upload, AI search, and network visualization
- **Features**: Secure login, drag-and-drop file upload, intelligent search interface, interactive network graphs

### Module 2: API Gateway (Port 8080)
- **Technology**: FastAPI + JWT Authentication
- **Purpose**: Single entry point with authentication and request routing
- **Features**: User management, JWT tokens, request proxying to internal services

### Module 3: Data Parser (Port 8001)
- **Technology**: Python + FastAPI
- **Purpose**: Parse Cellebrite reports, UFDR files, and CSV data
- **Features**: Multi-format support (XML, JSON, CSV), background processing, standardized data output

### Module 4: Data Indexer (Port 8002)
- **Technology**: Python + Elasticsearch + PostgreSQL
- **Purpose**: Index parsed data for efficient searching
- **Features**: Full-text search, metadata storage, relationship extraction

### Module 5: AI Search Core (Port 8003)
- **Technology**: Python + OpenAI + ChromaDB + LangChain
- **Purpose**: RAG-powered intelligent search and analysis
- **Features**: Natural language queries, sentiment analysis, entity extraction, conversation summarization

### Module 6: Link Analyst (Port 8004)
- **Technology**: Python + Neo4j + NetworkX
- **Purpose**: Graph-based relationship analysis
- **Features**: Network visualization, community detection, centrality analysis, suspicious pattern detection

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)
- OpenAI API Key (for AI features)

### 1. Environment Setup

Copy and configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```env
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Start Backend Services

Start all backend services with Docker Compose:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Elasticsearch (port 9200)
- Kibana (port 5601)
- Neo4j (port 7474, 7687)
- ChromaDB (port 8000)
- All 5 backend services (ports 8080-8004)

### 3. Start Frontend

```bash
cd CopSight-react
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. Access the System

1. Open `http://localhost:5173`
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`

## 📊 Service Health Checks

Check if all services are running:

```bash
# API Gateway
curl http://localhost:8080/health

# Parser Service
curl http://localhost:8001/health

# Indexer Service
curl http://localhost:8002/health

# Search Service
curl http://localhost:8003/health

# Graph Service
curl http://localhost:8004/health
```

## 🔧 Development Setup

### Backend Development

Each service can be run independently for development:

```bash
# API Gateway
cd backend/api-gateway
pip install -r requirements.txt
uvicorn main:app --reload --port 8080

# Parser Service
cd backend/parser-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# And so on for other services...
```

### Frontend Development

```bash
cd CopSight-react
npm install
npm run dev
```

## 📁 Project Structure

```
UFDR/
├── backend/
│   ├── api-gateway/          # Module 2: Authentication & Routing
│   ├── parser-service/       # Module 3: Data Parsing
│   ├── indexer-service/      # Module 4: Data Indexing
│   ├── search-service/       # Module 5: AI Search
│   ├── graph-service/        # Module 6: Graph Analysis
│   └── database/            # Database initialization
├── CopSight-react/         # Module 1: React Frontend
├── docker-compose.yml       # Service orchestration
├── .env                     # Environment variables
└── README.md               # This file
```

## 🎯 Key Features

### File Upload & Processing
- Drag-and-drop interface for UFDR files
- Support for Cellebrite XML, JSON, CSV formats
- Background processing with real-time status updates
- Automatic data standardization and indexing

### AI-Powered Search
- Natural language queries: "Show me all messages between John and Mary last week"
- Contextual answers with source evidence
- Sentiment analysis and entity extraction
- Conversation summarization

### Network Analysis
- Interactive communication network visualization
- Community detection and centrality analysis
- Suspicious pattern identification
- Timeline analysis and frequent contact identification

### Security & Authentication
- JWT-based authentication
- Role-based access control
- Secure API endpoints
- Audit logging

## 🔍 Usage Examples

### 1. Upload Data
1. Navigate to "Upload Data" tab
2. Drag and drop Cellebrite XML files or UFDR JSON files
3. Monitor processing status in real-time

### 2. AI Search
1. Go to "AI Search" tab
2. Ask questions like:
   - "Find all WhatsApp messages containing 'meeting'"
   - "Show communication patterns for +1234567890"
   - "What are the most frequent contacts for John Doe?"

### 3. Network Analysis
1. Switch to "Network Analysis" tab
2. Enter a phone number or contact ID
3. Explore the interactive network graph
4. Analyze relationships and communication patterns

## 🛠️ API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user info

### Parser Endpoints
- `POST /api/parser/upload` - Upload file for parsing
- `GET /api/parser/jobs/{job_id}` - Get parsing job status
- `GET /api/parser/jobs` - List all jobs

### Search Endpoints
- `POST /api/search/search` - Intelligent AI search
- `GET /api/search/messages` - Search messages
- `GET /api/search/calls` - Search call logs
- `GET /api/search/contacts` - Search contacts

### Graph Endpoints
- `GET /api/graph/network/{node_id}` - Get network around node
- `GET /api/graph/path/{start}/{end}` - Find shortest path
- `GET /api/graph/communities` - Detect communities
- `GET /api/graph/centrality/{node_id}` - Calculate centrality

## 🔧 Configuration

### Database Configuration
- PostgreSQL: User metadata, case information, processing jobs
- Elasticsearch: Full-text search of messages, calls, contacts
- Neo4j: Relationship graphs and network analysis
- ChromaDB: Vector embeddings for AI search

### AI Configuration
- OpenAI GPT-4 for natural language processing
- Sentence Transformers for text embeddings
- LangChain for RAG implementation
- ChromaDB for vector similarity search

## 🚨 Troubleshooting

### Common Issues

1. **Services won't start**: Check Docker Desktop is running and ports are available
2. **AI search not working**: Verify OpenAI API key is set correctly
3. **File upload fails**: Check file format is supported (XML, JSON, CSV)
4. **Network visualization empty**: Ensure data has been uploaded and processed

### Logs
```bash
# View service logs
docker-compose logs api-gateway
docker-compose logs parser-service
docker-compose logs search-service
# etc.
```

### Reset Data
```bash
# Clear all data (use with caution)
docker-compose down -v
docker-compose up -d
```

## 🔐 Security Considerations

- Change default passwords in production
- Use strong JWT secrets
- Enable HTTPS in production
- Implement proper network security
- Regular security audits
- Data encryption at rest and in transit

## 📈 Performance Optimization

- Elasticsearch index optimization
- Neo4j query optimization
- Vector database tuning
- Caching strategies
- Load balancing for production

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes following coding standards
4. Add tests for new features
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review service logs for error details

---

**UFDR System** - Empowering digital forensics investigations with AI-powered analysis and visualization.
