# UFDR System User Guide
## Unified Forensic Data Repository - Complete Setup & Usage Guide

### 🚀 Quick Start

1. **Start the System**
   ```bash
   # On Windows
   start-system.bat
   
   # On Linux/Mac
   chmod +x start-system.sh
   ./start-system.sh
   ```

2. **Access the Application**
   - Frontend: http://localhost:5173
   - Default Login: `admin` / `admin123`

### 📋 System Overview

The UFDR system consists of 6 integrated modules:

| Module | Port | Purpose |
|--------|------|---------|
| **React Frontend** | 5173 | User interface for file upload, search, and visualization |
| **API Gateway** | 8080 | Authentication and request routing |
| **Parser Service** | 8001 | Processes Cellebrite XML and UFDR JSON files |
| **Indexer Service** | 8002 | Stores data in Elasticsearch and PostgreSQL |
| **Search Service** | 8003 | AI-powered search using OpenAI and ChromaDB |
| **Graph Service** | 8004 | Network analysis using Neo4j |

### 🔧 Prerequisites

- **Docker & Docker Compose** (for backend services)
- **Node.js 18+** (for frontend)
- **OpenAI API Key** (for AI features)

### ⚙️ Configuration

#### 1. Environment Variables
Edit `.env` file in the root directory:

```env
# Replace with your actual OpenAI API key
OPENAI_API_KEY=sk-your-actual-openai-api-key-here

# Database passwords (change in production)
NEO4J_PASSWORD=your-secure-password
DATABASE_URL=postgresql://ufdr_user:your-db-password@localhost:5432/ufdr_db

# JWT Secret (change in production)
JWT_SECRET=your-super-secret-jwt-key
```

#### 2. Frontend Configuration
Edit `CopSight-react/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

### 📁 File Upload & Processing

#### Supported File Types
1. **Cellebrite UFDR XML** - Mobile device extractions
2. **Generic UFDR JSON** - Standardized forensic data
3. **CSV Files** - Tabular forensic data

#### Upload Process
1. Navigate to **Upload** tab
2. Drag & drop files or click to browse
3. Monitor parsing progress
4. View processing results

#### Sample Data
Use the provided sample files for testing:
- `sample-data/sample_cellebrite_report.xml`
- `sample-data/sample_ufdr_data.json`

### 🔍 AI-Powered Search

#### Natural Language Queries
- "Show me all messages between John and Jane"
- "Find suspicious communication patterns"
- "What calls were made on January 15th?"
- "Analyze sentiment of messages containing 'meeting'"

#### Search Features
- **Semantic Search** - Understanding context and meaning
- **Entity Extraction** - Automatic identification of people, places, dates
- **Sentiment Analysis** - Emotional tone analysis
- **Summarization** - Key insights from large datasets

### 📊 Network Visualization

#### Graph Analysis Features
- **Relationship Mapping** - Visual connections between contacts
- **Community Detection** - Groups of closely connected individuals
- **Centrality Analysis** - Most important nodes in the network
- **Timeline Analysis** - Communication patterns over time
- **Suspicious Pattern Detection** - Anomaly identification

#### Interactive Features
- Click nodes to see details
- Drag to rearrange layout
- Zoom and pan for exploration
- Filter by relationship type

### 🗄️ Database Access

#### PostgreSQL (Metadata)
```bash
# Connect to database
docker exec -it ufdr-postgres psql -U ufdr_user -d ufdr_db

# View tables
\dt

# Query users
SELECT * FROM users;
```

#### Elasticsearch (Full-text Search)
- Web Interface: http://localhost:9200
- View indices: `GET /_cat/indices`
- Search messages: `GET /messages/_search`

#### Neo4j (Graph Database)
- Browser: http://localhost:7474
- Username: `neo4j`
- Password: `ufdr_password`
- Query: `MATCH (n) RETURN n LIMIT 25`

### 🔐 Security Features

#### Authentication
- JWT-based authentication
- Role-based access control
- Session management
- Password hashing with bcrypt

#### Data Protection
- Encrypted communication
- Secure file storage
- Audit logging
- Access controls

### 🛠️ Troubleshooting

#### Common Issues

**1. Services Not Starting**
```bash
# Check Docker status
docker ps

# View service logs
docker-compose logs api-gateway
docker-compose logs parser-service
```

**2. Frontend Build Errors**
```bash
# Clear cache and reinstall
cd CopSight-react
rm -rf node_modules package-lock.json
npm install
```

**3. Database Connection Issues**
```bash
# Restart databases
docker-compose restart postgres elasticsearch neo4j
```

**4. OpenAI API Errors**
- Verify API key is valid
- Check API quota and billing
- Ensure network connectivity

#### Service Health Checks
- API Gateway: http://localhost:8080/health
- Parser Service: http://localhost:8001/health
- Indexer Service: http://localhost:8002/health
- Search Service: http://localhost:8003/health
- Graph Service: http://localhost:8004/health

### 📈 Performance Optimization

#### For Large Datasets
1. **Elasticsearch Tuning**
   - Increase heap size: `-Xms2g -Xmx2g`
   - Optimize index settings
   - Use bulk indexing

2. **Neo4j Optimization**
   - Increase memory allocation
   - Create appropriate indexes
   - Optimize Cypher queries

3. **PostgreSQL Tuning**
   - Adjust connection pool size
   - Optimize query performance
   - Regular maintenance

### 🔄 Data Workflow

```
File Upload → Parser Service → Indexer Service → {
    ├── Elasticsearch (Full-text search)
    ├── PostgreSQL (Metadata)
    └── Neo4j (Relationships)
}
```

### 📝 API Documentation

#### Authentication Endpoints
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/me` - Current user info

#### File Processing
- `POST /parser/upload` - Upload files
- `GET /parser/jobs/{job_id}` - Check processing status

#### Search & Analysis
- `POST /search/query` - Natural language search
- `POST /search/analyze` - AI analysis
- `GET /graph/network/{entity_id}` - Network visualization

### 🎯 Use Cases

#### Digital Forensics
- Mobile device analysis
- Communication pattern investigation
- Timeline reconstruction
- Evidence correlation

#### Law Enforcement
- Criminal investigation support
- Network analysis
- Pattern recognition
- Report generation

#### Corporate Security
- Internal investigation
- Compliance monitoring
- Risk assessment
- Incident response

### 🔮 Advanced Features

#### Custom Parsers
Extend the system by adding new parsers in `backend/parser-service/parsers/`:

```python
class CustomParser:
    def parse(self, file_path: str) -> ParsedData:
        # Your parsing logic here
        pass
```

#### AI Model Customization
- Replace OpenAI with local models
- Fine-tune embeddings
- Custom analysis pipelines
- Domain-specific training

### 📞 Support & Maintenance

#### Regular Maintenance
- Database backups
- Log rotation
- Security updates
- Performance monitoring

#### Monitoring
- Service health checks
- Resource usage monitoring
- Error tracking
- Performance metrics

---

## 🎉 You're Ready!

Your UFDR system is now fully configured and ready for forensic data analysis. Start by uploading sample data and exploring the AI-powered search capabilities.

For technical support or feature requests, refer to the system logs and API documentation.
