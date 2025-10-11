# UFDR System - System Architecture Diagram

## High-Level System Architecture (Mermaid)

```mermaid
graph TB
    subgraph Client["CLIENT LAYER"]
        Browser["Web Browser<br/>Port 5173<br/>Vite Dev Server"]
    end
    
    subgraph Frontend["PRESENTATION LAYER<br/>React 19 + TypeScript"]
        Pages["11 Pages<br/>Login, Admin(3), IO(5), Supervisor(2)"]
        Components["6 Components<br/>Navbar, ProtectedRoute<br/>QueryResults, QueryHistory<br/>NetworkGraph, Timeline"]
        State["Zustand State Store<br/>TailwindCSS<br/>React Router v6"]
    end
    
    subgraph Backend["APPLICATION LAYER<br/>Node.js 18 + Express (Port 8080)"]
        Middleware["MIDDLEWARE<br/>Helmet, CORS, Auth, RBAC<br/>Multer, ErrorHandler"]
        Routes["7 ROUTES<br/>auth, users, cases<br/>upload, query, bookmarks, reports<br/>(27 endpoints)"]
        Controllers["7 CONTROLLERS<br/>auth, user, case, upload<br/>query, bookmark, report"]
        Services["6 SERVICES<br/>Parser, NER, Search<br/>Graph, AI, Report"]
        Workers["WORKERS<br/>processingWorker<br/>(Bull Queue + Redis)"]
        ORM["ORM: Sequelize<br/>(11 Models)"]
    end
    
    subgraph DataLayer["DATA LAYER"]
        PG["PostgreSQL:5432<br/>11 Tables<br/>Primary Database"]
        ES["Elasticsearch:9200<br/>3 Indices<br/>Full-text Search"]
        Neo["Neo4j:7687<br/>5 Node Types<br/>Graph Relations"]
        Redis["Redis:6379<br/>Bull Queue<br/>Session Cache"]
        Milvus["Milvus:19530<br/>Vector DB<br/>Semantic Search"]
        etcd["etcd:2379<br/>Metadata Store"]
        MinIO["MinIO:9000<br/>Object Storage"]
        Kibana["Kibana:5601<br/>ES Visualization"]
    end
    
    subgraph AIService["AI/ML SERVICE LAYER<br/>Python 3.10 + FastAPI (Port 8005)"]
        AIRouters["3 ROUTERS<br/>query, embeddings, analysis"]
        AIServices["5 SERVICES<br/>Database, Embeddings<br/>LLM, RAG, Analysis"]
        RAG["RAG PIPELINE<br/>1. Query Decomposition<br/>2. Multi-DB Search<br/>3. Ranking<br/>4. Answer Synthesis<br/>5. Confidence Scoring"]
    end
    
    subgraph LLM["LLM INFERENCE LAYER<br/>Ollama (Port 11434)"]
        Models["MODELS<br/>nomic-embed-text (384-dim)<br/>llama3.2 (Query & Answer)"]
    end
    
    Browser -->|HTTPS/REST<br/>Axios| Frontend
    Frontend -->|REST API<br/>JSON + JWT| Backend
    Backend -->|SQL| PG
    Backend -->|HTTP| ES
    Backend -->|Bolt| Neo
    Backend -->|TCP| Redis
    Backend -->|gRPC| Milvus
    Backend -->|HTTP API| AIService
    AIService -->|HTTP| LLM
    AIService -->|Query| PG
    AIService -->|Search| ES
    AIService -->|Cypher| Neo
    AIService -->|Vector Search| Milvus
    Milvus -.->|Metadata| etcd
    Milvus -.->|Storage| MinIO
    ES -.->|Visualize| Kibana
    
    style Client fill:#e1f5ff
    style Frontend fill:#fff4e1
    style Backend fill:#e8f5e9
    style DataLayer fill:#f3e5f5
    style AIService fill:#fff3e0
    style LLM fill:#fce4ec
```

## Component Breakdown

### Frontend (React + TypeScript)
- **11 Pages**: Login, Admin (Dashboard, UserList, CaseList, CreateUser, CreateCase), IO (Dashboard, CaseDetail, QueryInterface, Bookmarks, ReportGenerator), Supervisor (Dashboard, CaseOverview)
- **6 Components**: Navbar, ProtectedRoute, QueryResults, QueryHistory, NetworkGraph, Timeline
- **State Management**: Zustand (authStore)
- **Routing**: React Router v6
- **Styling**: TailwindCSS
- **HTTP Client**: Axios

### Backend (Node.js + Express)
- **7 Routes**: auth, users, cases, upload, query, bookmarks, reports
- **27 API Endpoints**: RESTful API
- **7 Controllers**: Business logic handlers
- **6 Services**: Parser, NER, Search, Graph, AI Client, Report Generator
- **11 Models**: Sequelize ORM (users, sessions, cases, devices, data_sources, processing_jobs, case_queries, evidence_bookmarks, entity_tags, case_reports, audit_log)
- **Background Workers**: Bull queue with Redis for async processing

### AI Service (Python + FastAPI)
- **3 Routers**: query, embeddings, analysis
- **5 Services**: Database connector, Embeddings, LLM, RAG pipeline, Analysis
- **RAG Pipeline**: Query decomposition → Multi-DB search → Ranking → Answer synthesis

### Databases
- **PostgreSQL**: Primary relational database (11 tables)
- **Elasticsearch**: Full-text search (3 indices: messages, calls, contacts)
- **Neo4j**: Graph database (5 node types, 4 relationship types)
- **Redis**: Job queue and session cache
- **Milvus**: Vector database for semantic search (optional)
- **etcd**: Metadata store for Milvus
- **MinIO**: Object storage for Milvus

### LLM Layer
- **Ollama**: Local LLM server
- **nomic-embed-text**: 384-dimensional embeddings
- **llama3.2**: Query processing and answer generation

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Zustand, Axios, React Router v6, Lucide Icons |
| **Backend** | Node.js 18, Express.js, Sequelize, JWT, Bcrypt, Multer, Bull, Winston, Helmet, CORS, PDFKit |
| **AI Service** | Python 3.10, FastAPI, Ollama, AsyncIO, AsyncPG, NumPy, Loguru |
| **Databases** | PostgreSQL 15, Elasticsearch 8.11, Neo4j 5.13, Redis 7, Milvus 2.3 |
| **DevOps** | Docker, Docker Compose, Git |

## Port Mapping

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | Vite dev server |
| Backend | 8080 | Express API |
| AI Service | 8005 | FastAPI |
| PostgreSQL | 5432 | Primary database |
| Elasticsearch | 9200 | Search engine |
| Neo4j HTTP | 7474 | Graph browser |
| Neo4j Bolt | 7687 | Graph database |
| Redis | 6379 | Queue & cache |
| Milvus | 19530 | Vector database |
| etcd | 2379 | Metadata store |
| MinIO | 9000 | Object storage |
| Kibana | 5601 | ES visualization |
| Ollama | 11434 | LLM inference |
