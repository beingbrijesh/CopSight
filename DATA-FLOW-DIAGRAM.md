# CopSight AI — Data Flow Diagrams

This document traces how data moves through the CopSight AI platform — from initial device extraction through processing, analysis, and final report generation.

---

## Level 0 — Context Diagram

The system boundary and all external actors interacting with the platform:

```mermaid
graph TB
    Admin(("👨‍💼 Admin"))
    IO(("🔍 Investigating<br/>Officer"))
    Supervisor(("👁️ Supervisor"))
    ForensixdTool(("🔧 forensixd<br/>CLI Tool"))

    subgraph System["CopSight AI Platform"]
        Core["Core System<br/>Forensic Investigation & Analysis"]
    end

    Admin -->|"User Management<br/>Case Creation<br/>System Configuration"| Core
    IO -->|"Evidence Upload<br/>NL Queries<br/>Bookmarks"| Core
    Supervisor -->|"Case Monitoring<br/>Report Review<br/>Oversight"| Core
    ForensixdTool -->|"Device Data Stream<br/>(Encrypted)"| Core

    Core -->|"Dashboards · Reports"| Admin
    Core -->|"AI Answers · Visualizations"| IO
    Core -->|"Analytics · Reports"| Supervisor

    style System fill:#1a1a2e,stroke:#e94560,color:#fff
    style Admin fill:#e94560,color:#fff
    style IO fill:#0f3460,color:#fff
    style Supervisor fill:#2d6a4f,color:#fff
    style ForensixdTool fill:#533483,color:#fff
```

---

## Level 1 — Main System Processes

How the major subsystems interact with data stores:

```mermaid
flowchart TD
    Users["Users<br/>Admin · IO · Supervisor"]
    Forensixd["forensixd CLI<br/>Device Extraction Tool"]

    P1["1.0<br/>Authentication &<br/>Session Management"]
    P2["2.0<br/>User & Case<br/>Management"]
    P3["3.0<br/>File Upload &<br/>Validation"]
    P4["4.0<br/>Background<br/>Processing"]
    P5["5.0<br/>Query Processing<br/>(RAG Pipeline)"]
    P6["6.0<br/>AI Analysis &<br/>Answer Generation"]
    P7["7.0<br/>Evidence<br/>Management"]
    P8["8.0<br/>Report<br/>Generation"]
    P9["9.0<br/>ML Analysis<br/>Pipeline"]
    P10["10.0<br/>Cross-Case<br/>Intelligence"]

    D1[("Users &<br/>Sessions")]
    D2[("Cases &<br/>Devices")]
    D3[("File<br/>Storage")]
    D4[("PostgreSQL<br/>(Structured)")]
    D5[("Elasticsearch<br/>(Full-text)")]
    D6[("Neo4j<br/>(Graph)")]
    D7[("Vector DB<br/>(Embeddings)")]
    D8[("LLM<br/>(Ollama/Gemini)")]
    D9[("Bookmarks &<br/>Tags")]
    D10[("Reports<br/>Storage")]

    Users -->|"Credentials"| P1
    P1 -->|"JWT Token"| Users
    P1 --> P2
    Users --> P3
    Forensixd -->|"Encrypted Stream"| P4

    P2 <-->|"Read/Write"| D1 & D2
    P3 -->|"Store File"| D3
    P3 -->|"Queue Job"| P4

    P4 -->|"Parse & Index"| D4 & D5 & D6 & D7
    Users -->|"NL Query"| P5
    P5 <-->|"Multi-DB Search"| D4 & D5 & D6 & D7
    P5 --> P6
    P6 <-->|"LLM Inference"| D8
    P6 -->|"Results"| P7 & Users

    P7 <-->|"Store/Retrieve"| D9
    Users -->|"Report Config"| P8
    P8 -->|"Aggregate Data"| D4 & D5 & D6
    P8 -->|"Store"| D10
    P8 -->|"PDF"| Users

    P4 --> P9
    P9 <-->|"Feature Data"| D4 & D6
    P9 <-->|"Inference"| D8
    P9 -->|"Anomaly Flags"| P7

    P10 <-->|"Cross-Search"| D4 & D5 & D6
    P10 -->|"Shared Entities"| Users

    style Users fill:#e94560,color:#fff
    style Forensixd fill:#533483,color:#fff
    style P1 fill:#0f3460,color:#fff
    style P2 fill:#0f3460,color:#fff
    style P3 fill:#0f3460,color:#fff
    style P4 fill:#2d6a4f,color:#fff
    style P5 fill:#533483,color:#fff
    style P6 fill:#533483,color:#fff
    style P7 fill:#0f3460,color:#fff
    style P8 fill:#0f3460,color:#fff
    style P9 fill:#c9184a,color:#fff
    style P10 fill:#c9184a,color:#fff
```

---

## Level 2 — Detailed Process Flows

### 2.1 Forensixd Device Extraction Flow

How `forensixd` acquires data from a physical device:

```mermaid
flowchart TD
    Start["forensixd acquire<br/>Command Invocation"]

    subgraph Auth["Authentication Phase"]
        BrowserAuth["Open Browser Login<br/>CopSight AI web UI"]
        GetToken["Receive JWT Token<br/>+ Encryption Key"]
        FetchCases["Fetch Assigned Cases<br/>from Backend API"]
        SelectCase["Officer Selects Case"]
    end

    subgraph Detection["Device Detection Phase"]
        USBScan["USB Device Scan<br/>pyusb enumeration"]
        PlatformID["Platform Identification<br/>Android · iOS · Windows"]
        DeviceInfo["Capture Device Info<br/>Model · Serial · OS Version<br/>Root/Jailbreak Status"]
    end

    subgraph Legal["Legal Authorization Phase"]
        CaseAuth["Case Metadata<br/>Case Number · Court Order Ref"]
        ConsentCapture["Consent Capture<br/>Court Order · Voluntary · Emergency"]
        ExaminerID["Examiner Identification"]
    end

    subgraph Extraction["Data Extraction Phase"]
        LevelSelect["Select Extraction Level<br/>Logical · File System · Physical"]
        ProfileSelect["Select Profile<br/>Textual · Media · Everything"]
        RunExtractor["Run Platform Extractor<br/>Yield Artifacts"]
        HashArtifact["Hash Each Artifact<br/>MD5 + SHA-256"]
    end

    subgraph Output["Output Phase"]
        StreamAPI["Stream to Server<br/>Encrypted real-time upload"]
        WriteDFXML["Write DFXML<br/>acquisition.dfxml"]
        WriteUFDR["Write UFDR Package<br/>{session_id}.ufdr"]
        WriteHTML["Generate HTML Report<br/>report.html"]
        MerkleRoot["Compute Merkle Root<br/>Session integrity hash"]
    end

    Start --> Auth --> Detection --> Legal --> Extraction --> Output

    style Start fill:#e94560,color:#fff
    style Auth fill:#0f3460,color:#fff
    style Detection fill:#533483,color:#fff
    style Legal fill:#c9184a,color:#fff
    style Extraction fill:#16213e,stroke:#533483,color:#fff
    style Output fill:#2d6a4f,color:#fff
```

---

### 2.2 File Upload & Background Processing Flow

How uploaded UFDR files are processed into searchable evidence:

```mermaid
flowchart TD
    IO["Investigating Officer<br/>Uploads UFDR File"]

    subgraph Upload["Upload Phase"]
        Validate["Validate File Format<br/>XML or JSON"]
        Store["Store File on Disk<br/>backend-node/uploads/"]
        CreateJob["Create Processing Job<br/>Track status"]
        QueueJob["Queue Job<br/>Bull Queue → Redis"]
    end

    subgraph Processing["Background Processing (Worker)"]
        ParseFile["Parse UFDR File<br/>Extract raw data objects"]
        ExtractMsg["Extract Messages<br/>SMS · WhatsApp · Telegram"]
        ExtractCalls["Extract Call Logs<br/>Duration · Direction · Time"]
        ExtractContacts["Extract Contacts<br/>Names · Numbers · Emails"]
    end

    subgraph NER["Entity Extraction"]
        Phones["📞 Phone Numbers<br/>International classification"]
        Emails["📧 Email Addresses"]
        IDs["🆔 Indian IDs<br/>Aadhaar · PAN · Passport"]
        URLs["🔗 URLs"]
        Crypto["₿ Crypto Addresses<br/>Bitcoin · Ethereum"]
        IPs["🌐 IP Addresses"]
    end

    subgraph Indexing["Parallel Database Indexing"]
        IndexPG["PostgreSQL<br/>Structured records"]
        IndexES["Elasticsearch<br/>Full-text index<br/>3 indices"]
        IndexNeo["Neo4j<br/>Communication graph<br/>Nodes & Relationships"]
        IndexVec["Vector DB<br/>Semantic embeddings"]
    end

    Complete["✅ Processing Complete<br/>Status: COMPLETED"]

    IO --> Upload
    Upload --> Processing
    Processing --> NER
    NER --> Indexing
    Indexing --> Complete

    style IO fill:#e94560,color:#fff
    style Upload fill:#0f3460,color:#fff
    style Processing fill:#533483,color:#fff
    style NER fill:#16213e,stroke:#e94560,color:#fff
    style Indexing fill:#2d6a4f,color:#fff
    style Complete fill:#2d6a4f,color:#fff
```

---

### 2.3 RAG Query Processing Flow

How natural language queries are transformed into evidence-backed answers:

```mermaid
flowchart TD
    IO["🔍 Investigating Officer<br/>Natural Language Query"]

    subgraph Backend["Backend Processing"]
        SendToAI["Forward to AI Service<br/>POST /api/query"]
    end

    subgraph AIService["AI Service — RAG Pipeline"]
        Decompose["1. Query Decomposition<br/>LLM breaks query into<br/>structured sub-queries"]
        LLM1[("LLM<br/>Ollama/Gemini")]

        subgraph ParallelSearch["2. Parallel Multi-Database Search"]
            direction LR
            PGSearch["PostgreSQL<br/>Devices · Sources<br/>Structured metadata"]
            ESSearch["Elasticsearch<br/>Messages · Calls · Contacts<br/>Full-text matching"]
            NeoSearch["Neo4j<br/>Relationships · Patterns<br/>Graph traversal"]
            VecSearch["Vector Search<br/>Semantic similarity<br/>Embedding match"]
        end

        Rank["3. Rank & Deduplicate<br/>Relevance scoring<br/>Remove duplicates"]
        Synthesize["4. Answer Synthesis<br/>LLM generates answer<br/>with evidence citations"]
        LLM2[("LLM<br/>Ollama/Gemini")]
        Score["5. Confidence Scoring<br/>0.0 – 1.0 scale"]
    end

    subgraph Response["Response"]
        SaveHistory["Save to Query History"]
        ReturnResult["Return Result<br/>Answer + Evidence + Score"]
    end

    IO --> Backend --> Decompose
    Decompose <--> LLM1
    Decompose --> ParallelSearch
    ParallelSearch --> Rank --> Synthesize
    Synthesize <--> LLM2
    Synthesize --> Score --> Response

    style IO fill:#e94560,color:#fff
    style AIService fill:#1a1a2e,stroke:#533483,color:#fff
    style ParallelSearch fill:#0f3460,color:#fff
    style Response fill:#2d6a4f,color:#fff
```

---

### 2.4 ML Analysis Pipeline Flow

How the anomaly detection and predictive analytics engines process case data:

```mermaid
flowchart TD
    Trigger["Analysis Triggered<br/>POST /api/analysis"]

    subgraph Orchestration["ML Model Orchestration"]
        Registry["Unified Model Registry<br/>Loads pre-trained models<br/>Manages model bundle state"]
    end

    subgraph FeatureEng["Feature Engineering Branches"]
        DecisionTreeFeats["Decision Tree Features<br/>Statistical aggregations"]
        TemporalFeats["Sequential Time-Series<br/>Temporal frequency formatting"]
        DNNFeats["Deep Neural Network Tensors<br/>Graph & Entity embeddings"]
    end

    subgraph Execution["Specialized Execution Engines"]
        AnomalyEngine["Anomaly Execution Engine<br/>Delegates model inferences"]
        DeepLearningHub["Deep Learning Analytics Hub<br/>Coordinates multiple subsystems"]
        
        XGB["XGBoost Classification<br/>Evidence profiling"]
        LSTMAE["LSTM Autoencoder Evaluation<br/>Time-series anomaly scoring"]
        DNN["DNN Inference<br/>Advanced pattern mapping"]
    end

    subgraph Results["Analysis Results"]
        AnomalyFlags["🚩 Anomaly Flags<br/>Suspicious patterns<br/>with confidence scores"]
        Predictions["🔮 Predictions<br/>Hidden links · Risk levels<br/>Next-step forecasts"]
        Patterns["📊 Patterns<br/>Temporal · Spatial<br/>Frequency clusters"]
    end

    Trigger --> Registry
    Registry --> DeepLearningHub
    Registry --> AnomalyEngine

    DeepLearningHub --> TemporalFeats & DNNFeats
    AnomalyEngine --> DecisionTreeFeats

    DecisionTreeFeats --> XGB
    TemporalFeats --> LSTMAE
    DNNFeats --> DNN

    XGB & LSTMAE & DNN --> Results

    style Trigger fill:#e94560,color:#fff
    style Orchestration fill:#533483,color:#fff
    style FeatureEng fill:#0f3460,color:#fff
    style Execution fill:#16213e,stroke:#533483,color:#fff
    style Results fill:#2d6a4f,color:#fff
```

---

### 2.5 Report Generation Flow

How the platform assembles court-ready PDF reports:

```mermaid
flowchart TD
    IO["Investigating Officer<br/>Select template & sections"]

    subgraph Gather["Data Aggregation"]
        direction LR
        CaseInfo["Case Info<br/>PostgreSQL"]
        DeviceInfo["Device Data<br/>PostgreSQL"]
        Queries["Query History<br/>PostgreSQL"]
        Bookmarks["Bookmarked Evidence<br/>PostgreSQL"]
        Evidence["Evidence<br/>Elasticsearch"]
        Network["Network Data<br/>Neo4j"]
    end

    Template["Apply Template<br/>Full Report · Executive Summary<br/>Evidence Report · Custom"]

    subgraph Generate["PDF Generation (PDFKit)"]
        Header["Header & Footer<br/>Agency branding"]
        CaseSection["Case Overview"]
        EvidenceSection["Evidence Tables"]
        TimelineSection["Timeline View"]
        QuerySection["AI Query Results"]
        BookmarkSection["Bookmarked Items"]
    end

    Store["Store Report<br/>File system + metadata"]
    Audit["Log to Audit Trail"]
    Download["📥 Download PDF"]

    IO --> Gather --> Template --> Generate --> Store --> Audit --> Download

    style IO fill:#e94560,color:#fff
    style Gather fill:#0f3460,color:#fff
    style Generate fill:#533483,color:#fff
    style Download fill:#2d6a4f,color:#fff
```

---

## Data Store Inventory

| Store | Technology | What It Holds |
|-------|-----------|---------------|
| **Users & Sessions** | PostgreSQL | User accounts, roles, active sessions, permissions |
| **Cases & Devices** | PostgreSQL | Investigation cases, assigned devices, processing jobs |
| **Evidence Metadata** | PostgreSQL | Bookmarks, entity tags, query history, reports |
| **Messages & Calls** | Elasticsearch | Full-text searchable SMS, chat messages, call logs |
| **Contacts** | Elasticsearch | Searchable contact records with phone/email |
| **Communication Graph** | Neo4j | Relationship network — who contacted whom, shared entities |
| **Semantic Embeddings** | ChromaDB / Qdrant | Vector representations of evidence for similarity search |
| **Job Queue** | Redis (Bull) | Background processing jobs with status tracking |
| **Session Cache** | Redis | JWT session validation and rate limiting state |
| **LLM Models** | Ollama / Gemini | Local or cloud LLM for query processing and answer generation |
| **File Storage** | Filesystem | Uploaded UFDR files, generated PDF reports |

---

## Data Transformation Summary

| # | Transformation | Input | Output | Location |
|---|---------------|-------|--------|----------|
| T1 | UFDR Parsing | XML/JSON file | Structured objects | `backend-node/services/parser/` |
| T2 | Entity Extraction (NER) | Text content | Phone, email, ID, URL, crypto entities | `backend-node/services/ner/` |
| T3 | Elasticsearch Indexing | Structured objects | Searchable documents | `backend-node/services/search/` |
| T4 | Neo4j Graph Building | Entities + relationships | Graph nodes and edges | `backend-node/services/graph/` |
| T5 | Embedding Generation | Text content | 384-dimensional vectors | `ai-service/app/services/embeddings.py` |
| T6 | Query Decomposition | Natural language | Structured sub-queries | `ai-service/app/services/rag.py` |
| T7 | Answer Synthesis | Ranked evidence + query | Natural language answer with citations | `ai-service/app/services/llm.py` |
| T8 | Report Compilation | Multi-source case data | PDF document | `backend-node/services/reports/` |
| T9 | Device Extraction | USB device | Forensic artifacts with hashes | `forensixd/extractors/` |
| T10 | ML Feature Engineering | Graph + temporal data | Feature tensors | `ai-service/app/services/anomaly_detector.py` |

---

## Security & Privacy Data Controls

| Control | Implementation |
|---------|---------------|
| **Encryption in Transit** | HTTPS/TLS for all API communication |
| **Password Storage** | bcrypt hashing with 12 salt rounds |
| **Token Security** | JWT with configurable expiration, secure signing |
| **Row-Level Security** | Officers only see their assigned cases |
| **Audit Logging** | Every data access recorded with user, timestamp, IP |
| **On-Premise AI** | LLM runs locally via Ollama — no data sent externally |
| **Chain of Custody** | MD5 + SHA-256 with Merkle root for forensixd extractions |
| **Data Isolation** | Cases isolated by assignment; supervisors limited to unit |
