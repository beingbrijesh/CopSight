# UFDR System - Data Flow Diagram

## Level 0: Context Diagram (Mermaid)

```mermaid
graph TB
    Admin[Admin]
    IO[Investigating Officer]
    Supervisor[Supervisor]
    External[External Forensic Tools]
    
    subgraph UFDR[UFDR SYSTEM - Digital Forensic Investigation Platform]
        Core[Core System]
    end
    
    Admin -->|User Management, Case Creation, System Config| Core
    IO -->|Case Data, Queries, Evidence| Core
    Supervisor -->|Case Monitoring, Reports, Oversight| Core
    External -->|UFDR Files XML/JSON| Core
    
    Core -->|Dashboard, Reports| Admin
    Core -->|Results, Visualizations| IO
    Core -->|Analytics, Reports| Supervisor
    
    style Admin fill:#ff9999
    style IO fill:#99ccff
    style Supervisor fill:#99ff99
    style External fill:#ffcc99
    style Core fill:#e8f5e9
```

## Level 1: Main System Processes (Mermaid)

```mermaid
flowchart TD
    Users[Users - Admin/IO/Supervisor]
    
    P1[1.0 Authentication and Session Management]
    P2[2.0 User and Case Management]
    P3[3.0 File Upload and Processing]
    P4[4.0 Background Processing]
    P5[5.0 Query Processing RAG Pipeline]
    P6[6.0 AI Analysis and Answer Generation]
    P7[7.0 Evidence Management]
    P8[8.0 Report Generation]
    
    D1[(D1: Users Database)]
    D2[(D2: Cases Database)]
    D3[(D3: Raw File Storage)]
    D4[(D4: PostgreSQL Structured)]
    D5[(D5: Elasticsearch Full-text)]
    D6[(D6: Neo4j Graph)]
    D7[(D7: Milvus Vectors)]
    D8[(D8: Ollama LLM)]
    D9[(D9: Bookmarks Database)]
    D10[(D10: Reports Storage)]
    
    Users -->|1. Login Credentials| P1
    P1 -->|Session Token JWT| Users
    P1 -->|2. Authenticated Requests| P2
    P2 <-->|Read/Write| D1
    P2 -->|3. Case Assignment| P3
    P3 <-->|Store/Retrieve| D2
    P3 -->|4. UFDR File| P4
    P4 <-->|Store/Read| D3
    P4 -->|5. Extracted Data| D4
    P4 -->|5. Extracted Data| D5
    P4 -->|5. Extracted Data| D6
    D6 -->|6. Query Request| P5
    P5 <-->|Vector Search| D7
    P5 -->|7. Search Results| P6
    P6 <-->|LLM Inference| D8
    P6 -->|8. AI Response| P7
    P7 <-->|Store/Retrieve| D9
    P7 -->|9. Report Request| P8
    P8 -->|Store| D10
    P8 -->|10. PDF Report| Users
    
    style Users fill:#e1f5ff
    style P1 fill:#fff4e1
    style P2 fill:#fff4e1
    style P3 fill:#fff4e1
    style P4 fill:#e8f5e9
    style P5 fill:#fff3e0
    style P6 fill:#fff3e0
    style P7 fill:#fff4e1
    style P8 fill:#fff4e1
```

## Level 2: Detailed Process Flows

### 2.1 File Upload and Processing Flow (Mermaid)

```mermaid
flowchart TD
    IO[Investigating Officer]
    
    P31[3.1 Validate File Format]
    P32[3.2 Store File and Create Job]
    FS[(File Storage)]
    P33[3.3 Queue Job - Bull Queue]
    RQ[(Redis Queue Bull)]
    
    P41[4.1 Parse UFDR File XML/JSON]
    P42[4.2 Extract Entities NER]
    P43[4.3 Store in PostgreSQL]
    P44[4.4 Index to Elasticsearch]
    P45[4.5 Build Neo4j Graph]
    P46[4.6 Generate Embeddings Optional]
    P47[4.7 Update Job Status]
    
    IO -->|UFDR File XML/JSON| P31
    P31 -->|Valid File| P32
    P32 -->|Store| FS
    P32 -->|Job ID| P33
    P33 -->|Queue| RQ
    RQ -->|Job Picked| P41
    P41 -->|Raw Data| P42
    P42 -->|Entities| P43
    P43 --> P44
    P44 --> P45
    P45 --> P46
    P46 --> P47
    
    style IO fill:#99ccff
    style P31 fill:#fff4e1
    style P32 fill:#fff4e1
    style P33 fill:#fff4e1
    style P41 fill:#e8f5e9
    style P42 fill:#e8f5e9
    style P43 fill:#e8f5e9
    style P44 fill:#e8f5e9
    style P45 fill:#e8f5e9
    style P46 fill:#e8f5e9
    style P47 fill:#e8f5e9
    style FS fill:#f3e5f5
    style RQ fill:#f3e5f5
```

### 2.2 Query Processing Flow (RAG Pipeline) - Mermaid

```mermaid
flowchart TD
    IO[Investigating Officer]
    
    S1[5.1 Send Query to AI Service]
    S2[6.1 Query Decomposition]
    LLM1[(Ollama LLM llama3.2)]
    
    subgraph Parallel[6.2 Parallel Multi-Database Search]
        PG[6.2.1 PostgreSQL Search - Devices, Sources, Contacts]
        ES[6.2.2 Elasticsearch Search - Messages, Calls, Contacts]
        Neo[6.2.3 Neo4j Search - Relations, Patterns]
        Milvus[6.2.4 Milvus Search - Semantic Vectors]
    end
    
    S3[6.3 Rank and Deduplicate Results]
    S4[6.4 Generate Answer with Citations]
    LLM2[(Ollama LLM llama3.2)]
    S5[6.5 Calculate Confidence Score]
    S6[5.2 Store Query Result]
    QH[(Query History Database)]
    
    IO -->|Natural Language Query| S1
    S1 -->|Query Text| S2
    S2 <-->|Decompose| LLM1
    S2 -->|Sub-queries| Parallel
    
    Parallel -->|All Results| S3
    S3 -->|Ranked Evidence| S4
    S4 <-->|Generate| LLM2
    S4 -->|AI Answer| S5
    S5 -->|Complete Response| S6
    S6 -->|Store| QH
    S6 -->|Response| IO
    
    style IO fill:#99ccff
    style Parallel fill:#f0f0f0
    style LLM1 fill:#fce4ec
    style LLM2 fill:#fce4ec
    style S1 fill:#fff4e1
    style S2 fill:#fff3e0
    style S3 fill:#fff3e0
    style S4 fill:#fff3e0
    style S5 fill:#fff3e0
    style S6 fill:#fff4e1
```

### 2.3 Report Generation Flow (Mermaid)

```mermaid
flowchart TD
    IO[Investigating Officer]
    
    R1[8.1 Validate Report Config]
    
    subgraph R2[8.2 Gather Data from Multiple Sources]
        CaseInfo[Case Info PG]
        Devices[Devices PG]
        Queries[Queries PG]
        Bookmarks[Bookmarks PG]
        Evidence[Evidence ES]
        Network[Network Neo4j]
    end
    
    R3[8.3 Apply Template - Full/Exec/Evidence]
    R4[8.4 Generate PDF PDFKit<br/>Header/Footer, Case Info<br/>Evidence, Timeline<br/>Queries, Bookmarks, Graph]
    R5[8.5 Store Report]
    RFS[(Report Files Storage)]
    R6[8.6 Save Metadata]
    RMD[(Report Meta Database)]
    R7[8.7 Log Generation]
    ALD[(Audit Log Database)]
    
    IO -->|Report Request Template + Options| R1
    R1 -->|Valid Config| R2
    R2 -->|Aggregated Data| R3
    R3 -->|Formatted Data| R4
    R4 -->|PDF File| R5
    R5 -->|Store| RFS
    R5 --> R6
    R6 -->|Store| RMD
    R6 --> R7
    R7 -->|Log| ALD
    R7 -->|Download Link| IO
    
    style IO fill:#99ccff
    style R1 fill:#fff4e1
    style R2 fill:#f0f0f0
    style R3 fill:#fff4e1
    style R4 fill:#fff4e1
    style R5 fill:#fff4e1
    style R6 fill:#fff4e1
    style R7 fill:#fff4e1
    style RFS fill:#f3e5f5
    style RMD fill:#f3e5f5
    style ALD fill:#f3e5f5
```

## Data Stores

### D1: Users Database (PostgreSQL)
**Table**: `users`  
**Data**: user_id, username, password_hash, email, role, badge_number, unit, supervisor_id, is_active, created_at

### D2: Cases Database (PostgreSQL)
**Table**: `cases`  
**Data**: case_id, fir_number, title, description, status, priority, assigned_to, unit, created_by, created_at, updated_at

### D3: Raw File Storage (File System)
**Location**: `backend-node/uploads/`  
**Data**: Original UFDR XML/JSON files

### D4: PostgreSQL (Structured Data)
**Tables**: devices, data_sources, processing_jobs, case_queries, evidence_bookmarks, entity_tags, case_reports, audit_log  
**Data**: Structured forensic data, metadata, relationships

### D5: Elasticsearch (Full-text Search)
**Indices**: 
- `ufdr-messages`: SMS, WhatsApp, Telegram messages
- `ufdr-calls`: Call logs with duration, direction
- `ufdr-contacts`: Contact information  
**Data**: Searchable text content with entity highlighting

### D6: Neo4j (Graph Database)
**Nodes**: Case, Device, PhoneNumber, Contact, Entity  
**Relationships**: HAS_DEVICE, COMMUNICATED_WITH, HAS_NUMBER, LINKED_TO  
**Data**: Communication networks, relationship patterns

### D7: Milvus (Vector Database)
**Collection**: `ufdr_embeddings`  
**Data**: 384-dimensional vectors for semantic search

### D8: Ollama (LLM Models)
**Models**: 
- `nomic-embed-text`: Embedding generation
- `llama3.2`: Query processing and answer generation  
**Data**: Model weights and inference engine

### D9: Bookmarks Database (PostgreSQL)
**Table**: `evidence_bookmarks`  
**Data**: bookmark_id, case_id, user_id, evidence_type, evidence_id, notes, tags, created_at

### D10: Reports Storage (File System + Database)
**Files**: `backend-node/reports/`  
**Table**: `case_reports`  
**Data**: PDF files and metadata (report_id, case_id, template, generated_by, file_path, created_at)

## Data Flow Summary

### Input Data Flows
1. **User Credentials** → Authentication System
2. **UFDR Files (XML/JSON)** → File Upload System
3. **Natural Language Queries** → Query Processing System
4. **Report Configurations** → Report Generator

### Processing Data Flows
1. **Raw Files** → Parser → Structured Data → Multiple Databases
2. **Queries** → AI Service → Multi-DB Search → LLM → Answers
3. **Evidence** → Bookmark System → User Storage
4. **Case Data** → Report Generator → PDF Files

### Output Data Flows
1. **JWT Tokens** → User Sessions
2. **Processing Status** → User Dashboard
3. **Query Results** → User Interface (Answer + Evidence + Analysis)
4. **PDF Reports** → User Downloads
5. **Audit Logs** → Admin Dashboard

## Data Transformation Points

### T1: UFDR Parser
**Input**: XML/JSON file  
**Output**: Structured objects (messages, calls, contacts, devices)  
**Transformation**: Parse → Normalize → Validate → Structure

### T2: Entity Extractor (NER)
**Input**: Text content (messages, notes)  
**Output**: Entities (phone numbers, emails, IDs, URLs, crypto addresses)  
**Transformation**: Regex patterns → Classification → Validation

### T3: Elasticsearch Indexer
**Input**: Structured objects  
**Output**: Searchable documents with mappings  
**Transformation**: Map fields → Tokenize → Index

### T4: Neo4j Graph Builder
**Input**: Structured objects with relationships  
**Output**: Graph nodes and edges  
**Transformation**: Identify entities → Create nodes → Create relationships

### T5: Embedding Generator
**Input**: Text content  
**Output**: 384-dimensional vectors  
**Transformation**: Tokenize → Ollama embedding model → Vector

### T6: Query Decomposer
**Input**: Natural language query  
**Output**: Structured sub-queries  
**Transformation**: LLM analysis → Intent extraction → Query generation

### T7: Answer Synthesizer
**Input**: Ranked evidence + Query  
**Output**: Natural language answer with citations  
**Transformation**: Context assembly → LLM generation → Citation linking

### T8: Report Compiler
**Input**: Case data from multiple sources  
**Output**: PDF document  
**Transformation**: Data aggregation → Template application → PDF rendering

## Data Security & Privacy

### Encryption
- **In Transit**: HTTPS/TLS for all API communications
- **At Rest**: Database encryption for sensitive fields
- **Passwords**: Bcrypt hashing (12 rounds)
- **Tokens**: JWT with secure signing

### Access Control
- **RBAC**: Role-based access at API level
- **Row-Level Security**: Users see only assigned cases
- **Audit Trail**: All data access logged
- **Session Management**: Token expiration and refresh

### Data Isolation
- **Multi-tenancy**: Cases isolated by assignment
- **User Isolation**: IOs see only their cases
- **Supervisor Scope**: Limited to unit/team
- **Admin Override**: Full access with audit logging

## Performance Considerations

### Caching
- **Redis**: Session cache, job queue
- **Application**: Query result caching (short-term)

### Async Processing
- **Bull Queue**: File processing, indexing, embedding generation
- **Non-blocking**: User doesn't wait for processing

### Database Optimization
- **PostgreSQL**: Indexes on foreign keys, search fields
- **Elasticsearch**: Optimized mappings, sharding
- **Neo4j**: Graph indexes on node properties
- **Milvus**: HNSW index for vector search

### Parallel Processing
- **RAG Pipeline**: Parallel database searches
- **Background Workers**: Multiple concurrent jobs
- **Batch Operations**: Bulk indexing, embedding generation
