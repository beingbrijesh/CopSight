# CopSight AI - A Universal Forensic Data Analysis Platform

A comprehensive digital forensics platform for law enforcement agencies to analyze mobile device data extracted from UFDR (Universal Forensic Data Reader) files. The system provides natural language query capabilities, multi-database search, network visualization, and professional report generation.

## 🎯 Key Features

### Core Functionality
- **Multi-Role Authentication**: JWT-based auth with Admin, Investigating Officer, and Supervisor roles
- **Case Management**: Create, assign, and track investigation cases with status workflow
- **UFDR File Processing**: Parse XML/JSON UFDR files with background job processing
- **Entity Extraction**: Automatic extraction of phone numbers, emails, crypto addresses, IDs, URLs
- **Multi-Database Architecture**: PostgreSQL, Elasticsearch, Neo4j, Redis for comprehensive data analysis

### Advanced Features
- **AI-Powered Queries**: Natural language query processing using RAG (Retrieval-Augmented Generation)
- **Semantic Search**: Vector-based similarity search across evidence
- **Network Visualization**: Interactive communication network graphs with zoom/pan controls
- **Timeline Analysis**: Chronological event visualization with filtering
- **Evidence Bookmarking**: Save and annotate important evidence with tags and notes
- **Professional Reports**: Generate PDF reports with customizable templates

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (React + TypeScript)               │
│                     Port 5173 (Vite Dev)                     │
│  • 11 Pages  • 6 Components  • Zustand State Management     │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (Axios)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Node.js + Express)                 │
│                        Port 8080                             │
│  • 11 Routes  • 7 Controllers  • 14 Models  • 5 Middleware  │
│  • Background Workers (Bull Queue)  • File Upload (Multer)  │
└─┬──────────┬──────────┬──────────┬──────────┬──────────────┘
  │          │          │          │          │
  ↓          ↓          ↓          ↓          ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│Postgres│ │Elastic │ │ Neo4j  │ │ Redis  │ │ AI Service   │
│  5432  │ │  9200  │ │  7687  │ │  6379  │ │   (Python)   │
│11 Tables│ │3 Indices│ │ Graph  │ │ Queue  │ │   Port 8005  │
└────────┘ └────────┘ └────────┘ └────────┘ └──────┬───────┘
                                                     │
                                                     ↓
                                              ┌──────────────┐
                                              │    Ollama    │
                                              │  (Local LLM) │
                                              │   Port 11434 │
                                              └──────────────┘
```

## 📊 Project Statistics

- **Total Lines of Code**: ~10,600 lines
  - Backend (Node.js): ~6,000 lines
  - Frontend (React/TS): ~3,200 lines
  - AI Service (Python): ~1,400 lines
- **API Endpoints**: 61 REST endpoints
- **Database Models**: 14 Sequelize models
- **React Components**: 17 (11 pages + 6 shared components)
- **Background Services**: 3 (Parser, Entity Extractor, Indexer)

## 🚀 Quick Start

### Prerequisites

**Required:**
- Docker Desktop (for databases)
- Node.js 18+ and npm
- Git

**Optional (for AI features):**
- Python 3.10+
- Ollama (for local LLM)

### Installation Steps

#### 1. Clone and Setup
```bash
git clone <repository-url>
cd UFDR
```

#### 2. Start Database Services
```bash
# Start PostgreSQL, Elasticsearch, Neo4j, Redis
./START-ALL.sh

# Wait ~30 seconds for services to initialize
```

#### 3. Setup and Start Backend
```bash
cd backend-node

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env if needed (defaults work for local development)

# Start backend server
npm run dev

# Backend will be available at http://localhost:8080
```

#### 4. Setup and Start Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Frontend will be available at http://localhost:5173
```

#### 5. Setup AI Service (Optional)
```bash
cd ai-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Start AI service
uvicorn app.main:app --reload --port 8005

# AI service will be available at http://localhost:8005
```

#### 6. Install Ollama Models (Optional, for AI features)
```bash
# Install Ollama from https://ollama.com

# Pull required models
ollama pull nomic-embed-text  # For embeddings (384 dimensions)
ollama pull llama3.2          # For query processing
```

## 🌐 Access Points

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| **Frontend** | http://localhost:5173 | admin / admin123 |
| **Backend API** | http://localhost:8080 | - |
| **AI Service** | http://localhost:8005 | - |
| **Kibana** | http://localhost:5601 | - |
| **Neo4j Browser** | http://localhost:7474 | neo4j / ufdr_password |

## 📖 Usage Guide

### First Time Setup

1. **Login** to the system at http://localhost:5173
   - Username: `admin`
   - Password: `admin123`

2. **Create Users** (Admin → Users → Add User)
   - Create Investigating Officers
   - Create Supervisors
   - Assign badge numbers and units

3. **Create Cases** (Admin → Cases → Create Case)
   - Enter case details
   - Assign to Investigating Officer
   - Set priority level

### Investigating Officer Workflow

1. **View Assigned Cases** (IO Dashboard)
2. **Upload UFDR File** (Case Detail → Upload Data)
   - Supported formats: XML, JSON
   - File is processed in background
   - Monitor processing status

3. **Execute Queries** (Case Detail → Execute Query)
   - Use natural language: "Show me all foreign number communications"
   - View AI-generated answers
   - Browse evidence with relevance scores

4. **Bookmark Evidence** (Query Results → Bookmark icon)
   - Add personal notes
   - Tag with categories
   - Access from Bookmarks page

5. **Generate Reports** (Case Detail → Generate Report)
   - Choose template (Full Report, Executive Summary, etc.)
   - Select sections to include
   - Download PDF

## 🗂️ Project Structure

```
UFDR/
├── frontend/                    # React + TypeScript Frontend
│   ├── src/
│   │   ├── pages/              # 11 page components
│   │   │   ├── Login.tsx
│   │   │   ├── admin/          # Admin pages (Dashboard, Users, Cases)
│   │   │   └── io/             # IO pages (Dashboard, CaseDetail, Query, etc.)
│   │   ├── components/         # 6 shared components
│   │   │   ├── Navbar.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── QueryResults.tsx
│   │   │   ├── QueryHistory.tsx
│   │   │   ├── NetworkGraph.tsx
│   │   │   └── Timeline.tsx
│   │   ├── store/              # Zustand state management
│   │   └── lib/                # API client (Axios)
│   └── package.json
│
├── backend-node/               # Node.js + Express Backend
│   ├── src/
│   │   ├── config/            # Database connections, logger
│   │   ├── models/            # 11 Sequelize models
│   │   ├── controllers/       # 7 controllers (auth, user, case, etc.)
│   │   ├── routes/            # 11 route files (61 endpoints total)
│   │   ├── middleware/        # Auth, RBAC, case access, upload, rate limiting
│   │   ├── services/          # Business logic
│   │   │   ├── parser/        # UFDR file parser
│   │   │   ├── ner/           # Entity extraction
│   │   │   ├── search/        # Elasticsearch, Milvus
│   │   │   ├── graph/         # Neo4j operations
│   │   │   ├── ai/            # AI service client
│   │   │   └── reports/       # PDF generation
│   │   ├── queues/            # Bull queue configuration
│   │   ├── workers/           # Background job processors
│   │   └── server.js          # Express app entry point
│   ├── scripts/               # Utility scripts (reset-admin.js)
│   ├── uploads/               # Uploaded files directory
│   ├── logs/                  # Application logs
│   └── package.json
│
├── ai-service/                # Python + FastAPI AI Service
│   ├── app/
│   │   ├── routers/          # API endpoints (query, embeddings, analysis)
│   │   ├── services/         # Business logic
│   │   │   ├── database.py   # Multi-DB connection manager
│   │   │   ├── embeddings.py # Ollama embedding service
│   │   │   ├── llm.py        # LLM query processing
│   │   │   └── rag.py        # RAG pipeline
│   │   ├── config.py         # Configuration settings
│   │   └── main.py           # FastAPI app entry point
│   └── requirements.txt
│
├── docker-compose.yml         # Database services configuration
├── START-ALL.sh              # Database startup script
├── README.md                 # This file
├── PROJECT-COMPLETE.md       # Detailed documentation
├── QUICK-START.md           # Quick setup guide
└── DEPLOYMENT.md            # Production deployment guide
```

## 🔧 Technology Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ORM**: Sequelize
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer
- **Job Queue**: Bull (Redis-backed)
- **Logging**: Winston
- **Security**: Helmet, CORS
- **PDF Generation**: PDFKit

### Databases
- **PostgreSQL 14+**: Primary relational database (11 tables)
- **Elasticsearch 8.11**: Full-text search and indexing (3 indices)
- **Neo4j 5.13**: Graph database for relationship mapping
- **Redis 7**: Job queue and caching
- **Milvus 2.3**: Vector database for semantic search (optional)

### AI Service
- **Framework**: FastAPI
- **LLM**: Ollama (local inference)
- **Embeddings**: nomic-embed-text (384 dimensions)
- **Query Model**: llama3.2
- **Vector Operations**: NumPy
- **Async**: AsyncIO, AsyncPG

## 📡 API Endpoints (61 total)

### Authentication (4 endpoints)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/change-password` - Change password

### Users (7 endpoints)
- `POST /api/users` - Create user (Admin)
- `GET /api/users` - List users (Admin)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user (Admin)
- `POST /api/users/:id/reset-password` - Reset password (Admin)
- `GET /api/users/officers` - List investigating officers
- `GET /api/users/supervisors` - List supervisors

### Cases (7 endpoints)
- `POST /api/cases` - Create case (Admin)
- `GET /api/cases` - List cases
- `GET /api/cases/statistics` - Get case statistics
- `GET /api/cases/:id` - Get case details
- `PUT /api/cases/:id` - Update case
- `GET /api/cases/:id/chats` - Get case chats
- `GET /api/cases/:id/network` - Get communication network

### Upload (3 endpoints)
- `POST /api/upload/case/:id` - Upload UFDR file
- `GET /api/upload/job/:id` - Get job status
- `GET /api/upload/case/:id/processing-summary` - Get processing summary

### Query (3 endpoints)
- `POST /api/query/case/:id` - Execute natural language query
- `GET /api/query/case/:id/history` - Get query history
- `GET /api/query/:id` - Get specific query result

### Bookmarks (5 endpoints)
- `POST /api/bookmarks` - Create bookmark
- `GET /api/bookmarks/case/:id` - List bookmarks for case
- `PUT /api/bookmarks/:id` - Update bookmark
- `DELETE /api/bookmarks/:id` - Delete bookmark
- `POST /api/bookmarks/case/:id/reorder` - Reorder bookmarks

### Reports (3 endpoints)
- `POST /api/reports/case/:id/generate` - Generate PDF report
- `GET /api/reports/case/:id/history` - Get report history
- `GET /api/reports/templates` - Get available templates

### Cross-Case Intelligence (5 endpoints)
- `GET /api/cross-case/search` - Search across all cases
- `GET /api/cross-case/statistics` - Cross-case statistics
- `GET /api/cross-case/shared-entities` - Find shared entities
- `GET /api/cross-case/links` - Get case links
- `POST /api/cross-case/links` - Create case link

### Alerts (7 endpoints)
- `GET /api/alerts` - List alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert
- `GET /api/alerts/rules` - List alert rules
- `POST /api/alerts/rules` - Create alert rule
- `PUT /api/alerts/rules/:id` - Update alert rule

### Integration (12 endpoints)
- Webhook management, bulk operations, data transformation, and sync endpoints

### Performance (5 endpoints)
- System metrics, health checks, and monitoring endpoints

## 🗄️ Database Schema

### PostgreSQL Tables (14)
1. **users** - User accounts with roles and permissions
2. **sessions** - Active user sessions
3. **cases** - Investigation cases
4. **devices** - Extracted device information
5. **data_sources** - Data sources per device
6. **processing_jobs** - Background job tracking
7. **case_queries** - Query execution history
8. **evidence_bookmarks** - Bookmarked evidence
9. **entity_tags** - Tagged entities
10. **case_reports** - Generated report metadata
11. **audit_log** - System audit trail
12. **alerts** - System and case alerts
13. **alert_rules** - Alert triggering rules
14. **cross_case_links** - Links between related cases

### Elasticsearch Indices (3)
- **ufdr-messages** - SMS, WhatsApp, Telegram messages
- **ufdr-calls** - Call logs with duration and direction
- **ufdr-contacts** - Contact information

### Neo4j Graph Schema
- **Nodes**: Case, Device, PhoneNumber, Contact, Entity
- **Relationships**: HAS_DEVICE, COMMUNICATED_WITH, HAS_NUMBER, LINKED_TO

## 🔐 Security Features

- JWT-based authentication with secure token storage
- JWT_SECRET startup validation (server won't start without it)
- Password hashing using bcrypt (12 rounds)
- Role-based access control (RBAC) with 3 roles
- Case-level access control (`checkCaseAccess` middleware)
- Session management with database persistence
- CORS protection with configurable origins
- Helmet security headers
- API rate limiting (auth, search, upload, general)
- Input validation and sanitization
- SQL injection prevention (Sequelize ORM)
- XSS protection
- Audit logging for all actions
- On-premise AI (no external API calls)

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check if port 8080 is in use
lsof -ti:8080

# Kill process if needed
kill -9 $(lsof -ti:8080)

# Check logs
tail -f backend-node/logs/combined.log
```

### Database Connection Error
```bash
# Check if Docker is running
docker ps

# Restart databases
docker-compose restart

# Check specific service
docker logs ufdr-postgres
docker logs ufdr-elasticsearch
```

### Frontend Build Error
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Reset Admin Password
```bash
cd backend-node
node scripts/reset-admin.js
# Password will be reset to: admin123
```

### AI Service Not Working
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
ollama serve

# Re-pull models
ollama pull nomic-embed-text
ollama pull llama3.2
```

## 📈 Performance

- **Query Response Time**: 2-5 seconds (with AI)
- **File Upload**: Async processing, no blocking
- **Background Processing**: Parallel workers
- **Search Performance**: Sub-second (Elasticsearch)
- **Graph Queries**: Optimized with indexes
- **Report Generation**: 5-10 seconds
- **Concurrent Users**: 100+ supported

## 🚢 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment instructions.

### Quick Production Build

```bash
# Backend
cd backend-node
npm install --production
NODE_ENV=production node src/server.js

# Frontend
cd frontend
npm install
npm run build
# Serve dist/ folder with nginx or similar

# AI Service
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8005
```

## 📝 Environment Variables

### Backend (.env)
```env
# Server
PORT=8080
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ufdr_db
DB_USER=ufdr_user
DB_PASSWORD=ufdr_password

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Services
ELASTICSEARCH_URL=http://localhost:9200
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=ufdr_password
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Service
AI_SERVICE_URL=http://localhost:8005
```

### AI Service (.env)
```env
# Server
HOST=0.0.0.0
PORT=8005
ENVIRONMENT=development

# Databases
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ufdr_db
POSTGRES_USER=ufdr_user
POSTGRES_PASSWORD=ufdr_password

# Ollama
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.2
```

## 🤝 Contributing

This is a law enforcement tool. Contributions should maintain security and data privacy standards.

### Local Development Workflow (Git Hooks)
To ensure code quality and automatically build the project locally when collaborating, we use `pre-commit`.
After cloning the repository, install the development dependencies and setup the Git hooks:

```bash
# Install development dependencies (including pre-commit and pyinstaller)
pip install -e .[dev]

# Install pre-commit hook (Runs linters and tests on git commit)
pre-commit install

# Install pre-push hook (Runs the PyInstaller build on git push)
pre-commit install -t pre-push
```
This ensures that any developer working on Mac, Windows, or Linux automatically runs tests on commit and builds the executable on push.

## 📄 License

MIT License - See LICENSE file for details

## 📞 Support

For detailed documentation, see:
- [PROJECT-COMPLETE.md](PROJECT-COMPLETE.md) - Comprehensive project overview
- [QUICK-START.md](QUICK-START.md) - Quick setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment

---

**Status**: Production Ready ✅  
**Version**: 1.0.0  
**Last Updated**: February 2026
