# 📋 UFDR Complete User Guide
## Unified Forensic Data Repository - Step-by-Step Usage Guide

---

## 🎯 Table of Contents
1. [System Overview](#system-overview)
2. [Installation & Setup](#installation--setup)
3. [First-Time Usage](#first-time-usage)
4. [Core Features Guide](#core-features-guide)
5. [Advanced Usage](#advanced-usage)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## 🏗️ System Overview

**UFDR (Unified Forensic Data Repository)** is a comprehensive digital forensics platform that combines:
- **AI-powered search capabilities** for natural language queries
- **Network analysis** for relationship mapping
- **Multi-format data parsing** (Cellebrite, UFDR, CSV)
- **Interactive visualizations** for investigation insights

### Architecture Components
- **Frontend**: CopSight React application (Port 5173/5174)
- **Backend**: 5 microservices + 4 databases (Docker-based)
- **AI Engine**: OpenAI GPT-4 + ChromaDB for intelligent search
- **Graph Database**: Neo4j for relationship analysis

---

## 🚀 Installation & Setup

### Prerequisites Checklist
- [ ] **Docker Desktop** installed and running
- [ ] **Node.js 18+** for frontend development
- [ ] **OpenAI API Key** (for AI features)
- [ ] **8GB+ RAM** recommended
- [ ] **Ports 5173, 8000-8004, 5432, 9200, 7474** available

### Step 1: Install Docker Desktop
1. Download from: https://www.docker.com/products/docker-desktop/
2. Install and restart your computer
3. Verify installation:
   ```powershell
   docker --version
   docker compose version
   ```

### Step 2: Configure Environment
1. Navigate to project directory:
   ```powershell
   cd "C:\Users\[YourUsername]\OneDrive\Desktop\UFDR"
   ```

2. Set up environment variables in `.env` file:
   ```env
   # OpenAI Configuration (Required for AI features)
   OPENAI_API_KEY=your-openai-api-key-here
   
   # Database Credentials
   POSTGRES_DB=ufdr_db
   POSTGRES_USER=ufdr_user
   POSTGRES_PASSWORD=ufdr_password
   
   # Neo4j Configuration
   NEO4J_AUTH=neo4j/ufdr_password
   
   # JWT Secret (Change in production)
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   ```

### Step 3: Start the System

#### Option A: Automated Startup (Recommended)
```powershell
# Run the automated startup script
.\start-system.bat
```

#### Option B: Manual Startup
```powershell
# 1. Start backend services
docker compose up -d

# 2. Wait for services to initialize (30 seconds)
timeout /t 30

# 3. Start frontend
cd CopSight-react
npm install
npm run dev
```

### Step 4: Verify Installation
1. **Frontend**: http://localhost:5173 (or 5174)
2. **API Gateway**: http://localhost:8080/health
3. **Elasticsearch**: http://localhost:9200
4. **Neo4j Browser**: http://localhost:7474

---

## 🎬 First-Time Usage

### Initial Login
1. Open browser to `http://localhost:5173`
2. Use default credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
3. **Important**: Change default password after first login

### Dashboard Overview
After login, you'll see the main dashboard with 4 key sections:
- **📁 Upload Data**: File upload and processing
- **🔍 AI Search**: Intelligent search interface  
- **🕸️ Network Analysis**: Relationship visualization
- **📊 Analytics**: Data insights and statistics

---

## 🛠️ Core Features Guide

### 1. Data Upload & Processing

#### Supported File Formats
- **Cellebrite XML Reports** (.xml)
- **UFDR JSON Files** (.json)
- **CSV Data Files** (.csv)
- **Mobile Forensics Exports**

#### Upload Process
1. **Navigate to Upload Tab**
   - Click "Upload Data" in the main navigation

2. **Select Files**
   - Drag and drop files into the upload area
   - Or click "Browse Files" to select manually
   - Multiple files supported

3. **Monitor Processing**
   - Real-time progress indicators
   - Processing status updates
   - Error notifications if issues occur

4. **Verify Upload Success**
   - Check "Processing Jobs" section
   - Status should show "Completed"
   - Data becomes searchable immediately

#### Example Upload Workflow
```
1. Drag Cellebrite XML file → Upload Area
2. System shows "Processing..." status
3. Parser extracts: Messages, Calls, Contacts, Media
4. Indexer stores data in: Elasticsearch + PostgreSQL
5. Graph service creates: Relationship networks
6. Status changes to: "Completed - Ready for Analysis"
```

### 2. AI-Powered Search

#### Natural Language Queries
The AI search understands conversational queries:

**Message Search Examples:**
- "Show me all WhatsApp messages from John last week"
- "Find messages containing 'meeting' or 'appointment'"
- "What did Sarah say about the project?"

**Contact Analysis:**
- "Who are the most frequent contacts for +1234567890?"
- "Find all communication with contacts in New York"
- "Show me contacts added in the last month"

**Call Log Analysis:**
- "Find all calls longer than 10 minutes"
- "Show missed calls from unknown numbers"
- "What time did John call yesterday?"

**Timeline Queries:**
- "What happened between 2PM and 4PM on March 15th?"
- "Show all activity during business hours"
- "Find communication patterns on weekends"

#### Search Interface
1. **Enter Query**: Type natural language question
2. **Select Context**: Choose data sources (Messages/Calls/Contacts)
3. **Review Results**: AI provides contextual answers
4. **Explore Evidence**: Click results to see source data
5. **Export Findings**: Save results for reports

#### Advanced Search Features
- **Sentiment Analysis**: Emotional tone of messages
- **Entity Recognition**: People, places, organizations
- **Conversation Summarization**: Key points from chat threads
- **Pattern Detection**: Unusual communication behaviors

### 3. Network Analysis & Visualization

#### Creating Network Maps
1. **Enter Starting Point**
   - Phone number: `+1234567890`
   - Contact name: `John Doe`
   - Email address: `john@example.com`

2. **Configure Analysis**
   - **Depth**: How many connection levels (1-3)
   - **Time Range**: Specific date ranges
   - **Communication Type**: Calls, messages, or both

3. **Explore Interactive Graph**
   - **Nodes**: Represent contacts/phone numbers
   - **Edges**: Show communication frequency
   - **Colors**: Indicate relationship strength
   - **Size**: Reflects communication volume

#### Network Analysis Features
- **Community Detection**: Identify social groups
- **Centrality Analysis**: Find key influencers
- **Path Analysis**: Trace communication routes
- **Timeline Visualization**: See relationship evolution

#### Practical Investigation Scenarios
**Scenario 1: Suspect Communication Network**
```
1. Enter suspect's phone number
2. Set depth to 2 levels
3. Analyze for unusual patterns:
   - High-frequency short calls (burner phones?)
   - Communication spikes before incidents
   - Connections to known associates
```

**Scenario 2: Corporate Investigation**
```
1. Map employee communication networks
2. Identify information flow patterns
3. Detect potential data leaks:
   - Unusual external communications
   - After-hours contact patterns
   - Connections to competitors
```

### 4. Analytics & Reporting

#### Data Insights Dashboard
- **Communication Volume**: Messages/calls over time
- **Peak Activity Hours**: When most communication occurs
- **Contact Frequency**: Most/least contacted individuals
- **Geographic Distribution**: Location-based analysis

#### Export Capabilities
- **PDF Reports**: Professional investigation summaries
- **CSV Data**: Raw data for external analysis
- **Network Graphs**: Visual relationship maps
- **Timeline Charts**: Chronological activity views

---

## 🔬 Advanced Usage

### Custom Search Queries
Use advanced operators for precise searches:

```
# Boolean operators
"John AND meeting" - Both terms must appear
"call OR message" - Either term can appear
"project NOT cancelled" - Exclude specific terms

# Date ranges
date:2024-01-01..2024-01-31 - January 2024
time:14:00..16:00 - Between 2-4 PM

# Contact filters
from:+1234567890 - Messages from specific number
to:john@example.com - Messages to specific email

# Content types
type:whatsapp - WhatsApp messages only
type:sms - SMS messages only
type:call - Call logs only
```

### API Integration
For programmatic access, use the REST API:

```bash
# Authentication
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Search API
curl -X POST http://localhost:8080/api/search/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Find all messages from John"}'

# Network Analysis API
curl -X GET http://localhost:8080/api/graph/network/+1234567890 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Direct Access
For advanced users, direct database access is available:

**PostgreSQL** (Metadata & Jobs):
```sql
-- Connect: localhost:5432, user: ufdr_user, password: ufdr_password
SELECT * FROM processing_jobs WHERE status = 'completed';
SELECT * FROM users WHERE created_at > '2024-01-01';
```

**Elasticsearch** (Search Data):
```bash
# Search messages
curl -X GET "localhost:9200/messages/_search" \
  -H "Content-Type: application/json" \
  -d '{"query":{"match":{"content":"meeting"}}}'
```

**Neo4j** (Graph Data):
```cypher
// Neo4j Browser: http://localhost:7474
// Username: neo4j, Password: ufdr_password
MATCH (n:Contact)-[r:COMMUNICATES_WITH]-(m:Contact)
RETURN n, r, m LIMIT 50;
```

---

## 🚨 Troubleshooting

### Common Issues & Solutions

#### 1. Docker Services Won't Start
**Problem**: `docker compose up -d` fails
**Solutions**:
- Ensure Docker Desktop is running
- Check port availability: `netstat -an | findstr "8080 5432 9200"`
- Restart Docker Desktop
- Clear Docker cache: `docker system prune -a`

#### 2. Frontend Connection Issues
**Problem**: Frontend can't connect to backend
**Solutions**:
- Verify backend is running: `curl http://localhost:8080/health`
- Check `.env` file configuration
- Ensure no firewall blocking ports
- Try different port: modify `vite.config.ts`

#### 3. AI Search Not Working
**Problem**: Search returns "AI service unavailable"
**Solutions**:
- Verify OpenAI API key in `.env` file
- Check API key validity: https://platform.openai.com/api-keys
- Ensure sufficient OpenAI credits
- Check search service logs: `docker compose logs search-service`

#### 4. File Upload Failures
**Problem**: Files fail to upload or process
**Solutions**:
- Check file format (XML, JSON, CSV only)
- Verify file size < 100MB
- Ensure proper file structure
- Check parser service logs: `docker compose logs parser-service`

#### 5. Network Visualization Empty
**Problem**: Network graphs show no connections
**Solutions**:
- Ensure data has been uploaded and processed
- Check if contacts have communication records
- Verify graph service: `curl http://localhost:8004/health`
- Try different starting node (phone number/contact)

### Log Analysis
```bash
# View all service logs
docker compose logs

# View specific service logs
docker compose logs api-gateway
docker compose logs parser-service
docker compose logs search-service
docker compose logs graph-service
docker compose logs indexer-service

# Follow live logs
docker compose logs -f search-service
```

### Performance Issues
**Slow Search Performance**:
- Restart Elasticsearch: `docker compose restart elasticsearch`
- Check available memory: Task Manager → Performance
- Reduce search scope (date ranges, specific types)

**High Memory Usage**:
- Limit Docker memory: Docker Desktop → Settings → Resources
- Close unused applications
- Consider upgrading RAM to 16GB+

---

## 💡 Best Practices

### Data Management
1. **Regular Backups**
   ```bash
   # Backup databases
   docker compose exec postgresql pg_dump -U ufdr_user ufdr_db > backup.sql
   
   # Backup Elasticsearch indices
   curl -X PUT "localhost:9200/_snapshot/backup_repo" -H "Content-Type: application/json" -d '{"type":"fs","settings":{"location":"/backup"}}'
   ```

2. **Data Retention Policies**
   - Set retention periods for different data types
   - Archive old investigations
   - Regular cleanup of temporary files

3. **Security Practices**
   - Change default passwords immediately
   - Use strong JWT secrets in production
   - Enable HTTPS for production deployments
   - Regular security updates

### Investigation Workflow
1. **Data Collection Phase**
   - Upload all relevant data files
   - Verify processing completion
   - Review data quality and completeness

2. **Initial Analysis**
   - Start with broad AI searches
   - Identify key contacts and timeframes
   - Create initial network maps

3. **Deep Investigation**
   - Focus on specific suspects/contacts
   - Analyze communication patterns
   - Look for anomalies and suspicious behavior

4. **Evidence Documentation**
   - Export relevant findings
   - Create comprehensive reports
   - Maintain chain of custody

### Performance Optimization
1. **Search Efficiency**
   - Use specific date ranges
   - Filter by communication type
   - Combine multiple search terms effectively

2. **Network Analysis**
   - Start with depth 1, expand gradually
   - Focus on high-activity nodes
   - Use time-based filtering

3. **System Maintenance**
   - Regular Docker cleanup: `docker system prune`
   - Monitor disk space usage
   - Update services periodically

---

## 📞 Support & Resources

### Getting Help
1. **Check Logs First**: Most issues show up in service logs
2. **Review This Guide**: Common solutions are documented here
3. **GitHub Issues**: Report bugs and feature requests
4. **Community Forums**: Connect with other users

### Additional Resources
- **API Documentation**: http://localhost:8080/docs (when running)
- **Elasticsearch Guide**: https://www.elastic.co/guide/
- **Neo4j Documentation**: https://neo4j.com/docs/
- **OpenAI API Docs**: https://platform.openai.com/docs

### System Requirements
**Minimum**:
- 8GB RAM
- 20GB free disk space
- Docker Desktop
- Modern web browser

**Recommended**:
- 16GB+ RAM
- 50GB+ free disk space
- SSD storage
- Multiple CPU cores

---

## 🎓 Quick Reference

### Essential Commands
```bash
# Start system
.\start-system.bat

# Check service health
curl http://localhost:8080/health

# View logs
docker compose logs -f

# Stop system
docker compose down

# Reset all data
docker compose down -v && docker compose up -d
```

### Default Credentials
- **Web Interface**: admin / admin123
- **PostgreSQL**: ufdr_user / ufdr_password  
- **Neo4j**: neo4j / ufdr_password

### Key URLs
- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:8080
- **Neo4j Browser**: http://localhost:7474
- **Kibana**: http://localhost:5601

---

**🎯 You're now ready to use UFDR for comprehensive digital forensics investigations!**

For the latest updates and community support, visit the project repository and join our user community.
