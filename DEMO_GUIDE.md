# 🎬 UFDR Demo Guide
## Interactive Demonstration of Key Features

---

## 🎯 Overview

This demo guide walks you through the complete UFDR system using realistic sample data. You'll experience all major features including AI-powered search, network analysis, and forensic data processing.

## 📁 Sample Data Files Created

I've created three comprehensive sample datasets:

1. **`sample_investigation_data.json`** - Corporate fraud investigation
2. **`sample_cellebrite_advanced.xml`** - Cybercrime data breach case  
3. **`sample_network_analysis.json`** - Drug trafficking network analysis

---

## 🚀 Demo Walkthrough

### Step 1: System Setup & Login

1. **Start the UFDR system**:
   ```powershell
   cd "C:\Users\Bhavna Goliyan\OneDrive\Desktop\UFDR"
   .\start-system.bat
   ```

2. **Access the frontend**: http://localhost:5173

3. **Login with default credentials**:
   - Username: `admin`
   - Password: `admin123`

### Step 2: Upload Sample Data

#### Upload Corporate Fraud Data
1. Navigate to **"Upload Data"** tab
2. Drag and drop `sample_investigation_data.json`
3. Watch the processing status - should complete in 30-60 seconds
4. Verify completion in "Processing Jobs" section

#### Upload Cellebrite XML Data  
1. Upload `sample_cellebrite_advanced.xml`
2. This demonstrates XML parsing capabilities
3. Contains cybercrime investigation data

#### Upload Network Analysis Data
1. Upload `sample_network_analysis.json` 
2. This provides rich network relationship data
3. Perfect for graph visualization testing

---

## 🔍 AI Search Demonstrations

### Corporate Fraud Investigation Queries

Try these natural language searches after uploading the corporate fraud data:

#### **Financial Crime Queries**
```
"Show me all messages about financial reports"
"Find communication between Michael Chen and Lisa Rodriguez"
"What did they discuss about quarterly reports?"
"Find messages containing 'adjustments' or 'numbers'"
```

#### **Suspicious Activity Queries**
```
"Show me all WhatsApp messages from January 12th"
"Find messages about file transfers or data"
"What communication happened after 10 PM?"
"Show me messages with David Kim from the competitor"
```

#### **Timeline Analysis**
```
"What happened between January 10th and January 15th?"
"Show me the sequence of events leading to the investigation"
"Find all communication on January 14th"
```

### Cybercrime Investigation Queries

After uploading the Cellebrite XML data:

#### **Data Breach Analysis**
```
"Find messages about database backups"
"Show communication with dark web contacts"
"What did Alex Turner say about encryption?"
"Find all Telegram messages"
```

#### **Criminal Network Queries**
```
"Show me communication between Alex Turner and Jake Morrison"
"Find messages about Bitcoin payments"
"What happened after the FBI contact?"
"Show me all deleted files"
```

#### **Evidence Discovery**
```
"Find files related to customer data"
"Show me all cryptocurrency transactions"
"What applications were used for secure communication?"
"Find location data during suspicious activities"
```

---

## 🕸️ Network Analysis Demonstrations

### Corporate Fraud Network

1. **Navigate to "Network Analysis" tab**
2. **Enter starting point**: `+1-555-0101` (Michael Chen)
3. **Set parameters**:
   - Depth: 2 levels
   - Time range: January 2024
   - Include: Messages + Calls

**Expected Results**:
- Central node: Michael Chen (CFO)
- Connected to: Lisa Rodriguez (internal), David Kim (external), Jennifer Walsh (whistleblower)
- Edge thickness shows communication frequency
- Colors indicate relationship types

### Drug Trafficking Network

1. **Enter starting point**: `+1-555-7001` (Carlos Rodriguez)
2. **Analyze the hierarchical structure**:
   - Leader → Lieutenants → Street dealers
   - Financial handlers (money laundering)
   - Physical locations (warehouse, car wash)

**Key Insights to Observe**:
- **Community Detection**: Miami operations vs. cross-country distribution
- **Centrality Analysis**: Carlos Rodriguez as the central hub
- **Suspicious Patterns**: Burst communications before operations
- **Geographic Spread**: Miami → Los Angeles → New York

### Cybercrime Network

1. **Enter starting point**: `+1-555-1001` (Alex Turner)
2. **Explore the data theft network**:
   - Internal accomplices (Maria Santos)
   - External buyers (Jake Morrison)
   - Law enforcement (Dr. Emily Chen)

---

## 📊 Advanced Analysis Features

### Sentiment Analysis Demo

Upload the sample data and try these queries to see sentiment analysis:

```
"Analyze the emotional tone of messages between suspects"
"Find worried or concerned messages"
"Show me aggressive or threatening communication"
"What was the sentiment after the FBI contact?"
```

### Entity Recognition Demo

```
"Find all mentions of companies or organizations"
"Extract all phone numbers and email addresses"
"Show me all financial amounts mentioned"
"Find all location references in messages"
```

### Pattern Detection Demo

```
"Find unusual communication patterns"
"Show me communication spikes or bursts"
"Identify after-hours communication"
"Find deleted or encrypted messages"
```

---

## 🎯 Specific Demo Scenarios

### Scenario 1: Corporate Insider Threat

**Objective**: Investigate suspected data theft by CFO

**Steps**:
1. Upload `sample_investigation_data.json`
2. Search: `"Find all communication with external contacts"`
3. Analyze network around Michael Chen (`+1-555-0101`)
4. Look for suspicious patterns in timeline
5. Examine financial transactions

**Key Evidence to Find**:
- Messages about "packages" and "deliveries" 
- Communication with competitor (David Kim)
- Whistleblower concerns (Jennifer Walsh)
- Offshore financial transactions

### Scenario 2: Cybercrime Data Breach

**Objective**: Trace the path of stolen customer data

**Steps**:
1. Upload `sample_cellebrite_advanced.xml`
2. Search: `"Show me all communication about database backups"`
3. Analyze Alex Turner's network (`+1-555-1001`)
4. Trace Bitcoin transactions
5. Identify dark web connections

**Key Evidence to Find**:
- Database backup discussions
- Dark web marketplace activity
- Cryptocurrency payments (50 BTC)
- Evidence destruction attempts
- FBI investigation trigger

### Scenario 3: Drug Trafficking Organization

**Objective**: Map the complete criminal network structure

**Steps**:
1. Upload `sample_network_analysis.json`
2. Start network analysis from Carlos Rodriguez (`+1-555-7001`)
3. Examine community structures
4. Analyze communication patterns
5. Identify money laundering operations

**Key Insights to Discover**:
- Hierarchical command structure
- Geographic distribution network
- Money laundering through car wash business
- Coordinated operations at warehouse location
- Cross-country distribution channels

---

## 🔬 Technical Features Demo

### API Testing

Test the backend APIs directly:

```bash
# Health check
curl http://localhost:8080/health

# Authentication
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Search API (after getting token)
curl -X POST http://localhost:8080/api/search/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Find messages about financial reports"}'
```

### Database Exploration

**PostgreSQL** (Metadata):
```sql
-- Connect to: localhost:5432, user: ufdr_user, password: ufdr_password
SELECT * FROM processing_jobs ORDER BY created_at DESC;
SELECT * FROM users;
```

**Elasticsearch** (Search Data):
```bash
# View indices
curl -X GET "localhost:9200/_cat/indices"

# Search messages
curl -X GET "localhost:9200/messages/_search" \
  -H "Content-Type: application/json" \
  -d '{"query":{"match_all":{}}}'
```

**Neo4j** (Graph Data):
```cypher
// Connect to: http://localhost:7474, user: neo4j, password: ufdr_password
MATCH (n) RETURN count(n);
MATCH (n:Contact)-[r]-(m:Contact) RETURN n, r, m LIMIT 25;
```

---

## 🎪 Demo Script for Presentations

### 5-Minute Quick Demo

1. **Login & Overview** (30 seconds)
   - Show dashboard interface
   - Explain the 4 main sections

2. **Data Upload** (1 minute)
   - Upload sample_investigation_data.json
   - Show processing status and completion

3. **AI Search** (2 minutes)
   - Query: "Find messages about financial reports"
   - Show natural language results
   - Demonstrate follow-up questions

4. **Network Analysis** (1.5 minutes)
   - Enter Michael Chen's number: +1-555-0101
   - Show interactive network graph
   - Explain relationships and patterns

### 15-Minute Comprehensive Demo

1. **System Architecture** (2 minutes)
   - Explain microservices approach
   - Show Docker containers running
   - Highlight AI and graph databases

2. **Multi-Format Data Processing** (3 minutes)
   - Upload JSON, XML, and network data
   - Show different parsing capabilities
   - Explain data standardization

3. **Advanced AI Search** (5 minutes)
   - Multiple query types and examples
   - Sentiment analysis demonstration
   - Entity recognition features

4. **Network Visualization** (3 minutes)
   - Multiple network examples
   - Community detection
   - Centrality analysis

5. **Investigation Workflow** (2 minutes)
   - Complete case walkthrough
   - Evidence discovery process
   - Report generation

---

## 🎯 Expected Outcomes

After completing this demo, users should understand:

### **Core Capabilities**
- ✅ Multi-format data ingestion (JSON, XML, CSV)
- ✅ Natural language search with AI
- ✅ Interactive network visualization
- ✅ Real-time data processing
- ✅ Cross-reference analysis

### **Investigation Benefits**
- ✅ Faster evidence discovery
- ✅ Pattern recognition automation
- ✅ Relationship mapping
- ✅ Timeline reconstruction
- ✅ Multi-source correlation

### **Technical Features**
- ✅ Scalable microservices architecture
- ✅ Modern web interface
- ✅ RESTful API access
- ✅ Database flexibility
- ✅ Docker containerization

---

## 🚨 Troubleshooting Demo Issues

### Data Upload Problems
- Ensure backend services are running: `docker compose ps`
- Check file format and size
- Verify processing logs: `docker compose logs parser-service`

### Search Not Working
- Confirm OpenAI API key is set in `.env`
- Check search service: `curl http://localhost:8003/health`
- Verify data was indexed: `curl http://localhost:9200/_cat/indices`

### Network Visualization Empty
- Ensure graph service is running: `curl http://localhost:8004/health`
- Check if data contains relationship information
- Try different starting nodes

---

## 📝 Demo Checklist

### Pre-Demo Setup
- [ ] Docker Desktop running
- [ ] UFDR system started (`.\start-system.bat`)
- [ ] Frontend accessible (http://localhost:5173)
- [ ] Sample data files ready
- [ ] OpenAI API key configured

### During Demo
- [ ] Login successful
- [ ] Upload all three sample files
- [ ] Verify processing completion
- [ ] Test multiple search queries
- [ ] Show network visualizations
- [ ] Demonstrate different investigation scenarios

### Post-Demo
- [ ] Answer questions about capabilities
- [ ] Provide access to documentation
- [ ] Discuss customization options
- [ ] Share installation guide

---

**🎉 You're now ready to deliver a comprehensive UFDR demonstration!**

This demo showcases the full power of AI-driven forensic analysis and will give users a complete understanding of the system's capabilities.
