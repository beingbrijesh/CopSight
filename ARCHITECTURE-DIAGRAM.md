# CopSight AI — System Architecture

This document provides a comprehensive view of the CopSight AI platform architecture, showing how each layer, component, and service interconnects to form the complete forensic analysis system.

---

## High-Level System Architecture

```mermaid
graph TB
    subgraph Clients["🖥️ CLIENT LAYER"]
        Browser["Web Browser<br/><small>React 19 · TypeScript · Vite<br/>Port 5173</small>"]
        ForensixdCLI["forensixd CLI<br/><small>Standalone Executable<br/>Windows · macOS · Linux</small>"]
    end

    subgraph Presentation["📱 PRESENTATION LAYER"]
        direction LR
        Pages["Pages<br/><small>Landing · Login · Admin<br/>IO · Supervisor</small>"]
        Components["Components<br/><small>NetworkGraph · Timeline<br/>Alerts · AnomalyDetection<br/>PredictiveAnalytics</small>"]
        State["State & Routing<br/><small>Zustand · React Router v6<br/>TailwindCSS · D3.js</small>"]
    end

    subgraph Application["⚙️ APPLICATION LAYER"]
        Backend["Node.js API Gateway<br/><small>Express.js · Port 8080</small>"]
        AIService["Unified API Gateway (AI Bridge)<br/><small>FastAPI · Port 8005<br/>Cross-Domain Router</small>"]
    end

    subgraph BackendDetail["Node.js Internals"]
        Middleware["Middleware<br/><small>Helmet · CORS · Auth<br/>RBAC · Rate Limiting</small>"]
        Routes["Routes<br/><small>auth · users · cases · upload<br/>query · bookmarks · reports<br/>cross-case · alerts · graph<br/>analysis · ingest · notifications<br/>integration · performance</small>"]
        Controllers["Controllers<br/><small>auth · user · case · upload<br/>query · bookmark · report<br/>graph · notification</small>"]
        Services["Services<br/><small>Parser · NER · Search<br/>Graph · AI · Reports<br/>Cache · Alert · Cross-Case<br/>Performance Monitor</small>"]
        Workers["Workers<br/><small>Processing Worker<br/>Stream Worker<br/>Bull Queue</small>"]
    end

    subgraph AIDetail["AI Service Internals"]
        AIRouters["API Routers<br/><small>Query · Embeddings<br/>Analysis · Indexing</small>"]
        ModelRegistry["Unified Model Registry<br/><small>Model Bundle Management<br/>Memory & State Loading</small>"]
        ExecutionEngines["Execution Engines<br/><small>Anomaly Execution Engine<br/>Deep Learning Analytics Hub<br/>Evidence Processing Pipeline</small>"]
        RAGService["RAG Pipeline<br/><small>Retrieval & Synthesis</small>"]
        AIWorker["Async Worker<br/><small>Background Jobs</small>"]
    end

    subgraph Data["🗄️ DATA LAYER"]
        PG["PostgreSQL<br/><small>Port 5433<br/>Relational Data</small>"]
        ES["Elasticsearch<br/><small>Port 9201<br/>Full-Text Search</small>"]
        Neo["Neo4j<br/><small>Port 7688<br/>Graph Relations</small>"]
        Redis["Redis<br/><small>Port 6380<br/>Queue & Cache</small>"]
        Chroma["ChromaDB<br/><small>Port 8006<br/>Vector Embeddings</small>"]
        Qdrant["Qdrant Cloud<br/><small>Production Vectors</small>"]
    end

    subgraph LLM["🧠 LLM INFERENCE"]
        Ollama["Ollama<br/><small>Port 11434<br/>nomic-embed-text<br/>llama3.2</small>"]
        Gemini["Google Gemini<br/><small>Cloud API<br/>Optional</small>"]
    end

    Browser -->|"HTTPS · REST · JWT"| Presentation
    Presentation -->|"REST · Axios"| Backend
    ForensixdCLI -->|"Encrypted API Stream"| Backend
    Backend --> BackendDetail
    Backend -->|"HTTP · REST"| AIService
    AIService --> AIDetail
    AIRouters --> ModelRegistry
    AIRouters --> RAGService
    ModelRegistry --> ExecutionEngines
    BackendDetail --> PG & ES & Neo & Redis
    AIDetail --> PG & ES & Neo & Chroma & Qdrant
    AIDetail --> Ollama & Gemini
    Workers --> Redis

    style Clients fill:#1a1a2e,stroke:#e94560,color:#fff
    style Presentation fill:#16213e,stroke:#0f3460,color:#fff
    style Application fill:#0f3460,stroke:#533483,color:#fff
    style BackendDetail fill:#16213e,stroke:#0f3460,color:#fff
    style AIDetail fill:#16213e,stroke:#533483,color:#fff
    style Data fill:#0f3460,stroke:#e94560,color:#fff
    style LLM fill:#533483,stroke:#e94560,color:#fff
```

---

## Forensixd CLI Architecture

The `forensixd` extraction engine operates as a standalone tool with its own modular architecture:

```mermaid
graph LR
    subgraph CLI["CLI Layer"]
        Main["cli.py<br/><small>Click CLI + Interactive Shell</small>"]
    end

    subgraph Core["Core Engine"]
        Session["ForensicSession<br/><small>Session lifecycle<br/>Artifact registration</small>"]
        Detector["DeviceDetector<br/><small>USB device scanning<br/>Platform identification</small>"]
        Auth["AuthManager<br/><small>Browser-based login<br/>JWT token management</small>"]
        Hasher["IntegrityHasher<br/><small>MD5 + SHA-256<br/>Merkle root</small>"]
        Logger["AuditLogger<br/><small>JSONL chain-of-custody<br/>Tamper detection</small>"]
    end

    subgraph Extractors["Platform Extractors"]
        Android["AndroidExtractor<br/><small>ADB Protocol</small>"]
        iOS["iOSExtractor<br/><small>pymobiledevice3</small>"]
        Windows["WindowsExtractor<br/><small>Direct / Image</small>"]
        DiskImg["DiskImageExtractor<br/><small>E01 / DD / Raw</small>"]
    end

    subgraph Parsers["Data Parsers"]
        SQLite["SQLiteParser"]
        Plist["PlistParser"]
        Registry["RegistryParser"]
        subgraph Apps["Application Parsers"]
            WA["WhatsApp"]
            TG["Telegram"]
            iMsg["iMessage"]
            Sig["Signal"]
            Br["Browsers"]
            CL["Call Logs"]
            Em["Email"]
        end
    end

    subgraph Writers["Output Writers"]
        UFDR["UFDRWriter<br/><small>.ufdr package</small>"]
        DFXML["DFXMLWriter<br/><small>acquisition.dfxml</small>"]
        Report["ReportWriter<br/><small>HTML report</small>"]
        APIStream["ApiStreamWriter<br/><small>Encrypted real-time<br/>upload to server</small>"]
    end

    subgraph Legal["Legal Compliance"]
        AuthZ["AuthorizationManager<br/><small>Court order · Consent<br/>Examiner ID</small>"]
        CoC["ChainOfCustody<br/><small>Event logging<br/>Hash verification</small>"]
    end

    Main --> Core
    Core --> Extractors
    Extractors --> Parsers
    Parsers --> Writers
    Core --> Legal

    style CLI fill:#e94560,color:#fff
    style Core fill:#0f3460,color:#fff
    style Extractors fill:#533483,color:#fff
    style Parsers fill:#16213e,stroke:#533483,color:#fff
    style Apps fill:#1a1a2e,stroke:#0f3460,color:#fff
    style Writers fill:#2d6a4f,color:#fff
    style Legal fill:#c9184a,color:#fff
```

---

## Backend Service Architecture

```mermaid
graph TD
    subgraph Middleware["Request Pipeline"]
        Helmet["Helmet<br/><small>Security Headers</small>"]
        CORS["CORS<br/><small>Origin Control</small>"]
        JWT["JWT Auth<br/><small>Token Validation</small>"]
        RBAC["RBAC<br/><small>Role Check</small>"]
        CaseAccess["Case Access<br/><small>Assignment Check</small>"]
        RateLimit["Rate Limiter<br/><small>auth · search · upload · AI</small>"]
        PerfMon["Performance<br/><small>Request Metrics</small>"]
    end

    subgraph Routes["Route Groups"]
        AuthR["Auth Routes"]
        UserR["User Routes"]
        CaseR["Case Routes"]
        UploadR["Upload Routes"]
        QueryR["Query Routes"]
        BookmarkR["Bookmark Routes"]
        ReportR["Report Routes"]
        CrossR["Cross-Case Routes"]
        AlertR["Alert Routes"]
        GraphR["Graph Routes"]
        AnalysisR["Analysis Routes"]
        IngestR["Ingest Routes"]
        NotifR["Notification Routes"]
        IntegR["Integration Routes"]
        PerfR["Performance Routes"]
    end

    subgraph ServiceLayer["Business Logic"]
        Parser["UFDR Parser<br/><small>XML · JSON parsing</small>"]
        NER["NER Engine<br/><small>Entity extraction<br/>Phone · Email · ID · URL · Crypto</small>"]
        SearchSvc["Search Service<br/><small>Elasticsearch queries</small>"]
        GraphSvc["Graph Service<br/><small>Neo4j operations</small>"]
        AISvc["AI Client<br/><small>FastAPI bridge</small>"]
        ReportGen["Report Generator<br/><small>PDFKit rendering</small>"]
        CacheSvc["Cache Service<br/><small>Redis caching</small>"]
        AlertSvc["Alert Service<br/><small>Rule engine</small>"]
        CrossCaseSvc["Cross-Case Service<br/><small>Entity correlation</small>"]
    end

    Middleware --> Routes --> ServiceLayer

    style Middleware fill:#0f3460,color:#fff
    style Routes fill:#16213e,stroke:#533483,color:#fff
    style ServiceLayer fill:#1a1a2e,stroke:#e94560,color:#fff
```

---

## Database Schema Overview

### PostgreSQL — Relational Data

```mermaid
erDiagram
    users ||--o{ cases : "assigned_to"
    users ||--o{ sessions : "has"
    users ||--o{ audit_log : "performed"
    cases ||--o{ devices : "contains"
    cases ||--o{ processing_jobs : "triggers"
    cases ||--o{ case_queries : "has"
    cases ||--o{ evidence_bookmarks : "has"
    cases ||--o{ case_reports : "generates"
    cases ||--o{ alerts : "triggers"
    cases }o--o{ cross_case_links : "linked"
    devices ||--o{ data_sources : "has"

    users {
        uuid id PK
        string username
        string password_hash
        enum role "admin | io | supervisor"
        string badge_number
        string unit
    }

    cases {
        uuid id PK
        string fir_number
        string title
        enum status "open | active | closed"
        enum priority "low | medium | high | critical"
        uuid assigned_to FK
    }

    devices {
        uuid id PK
        uuid case_id FK
        string platform
        string device_id
        string model
    }
```

### Elasticsearch — Search Indices

| Index | Documents | Key Fields |
|-------|-----------|------------|
| `copsight-messages` | SMS, WhatsApp, Telegram messages | sender, receiver, body, timestamp, source_app |
| `copsight-calls` | Call logs | caller, callee, duration, direction, timestamp |
| `copsight-contacts` | Contact records | name, phone_number, email, organization |

### Neo4j — Graph Schema

```mermaid
graph LR
    Case["🗂️ Case"] -->|HAS_DEVICE| Device["📱 Device"]
    Device -->|HAS_NUMBER| Phone["📞 PhoneNumber"]
    Phone -->|COMMUNICATED_WITH| Phone2["📞 PhoneNumber"]
    Case -->|HAS_ENTITY| Entity["🏷️ Entity"]
    Entity -->|LINKED_TO| Entity2["🏷️ Entity"]
    Contact["👤 Contact"] -->|HAS_NUMBER| Phone

    style Case fill:#0f3460,color:#fff
    style Device fill:#533483,color:#fff
    style Phone fill:#e94560,color:#fff
    style Phone2 fill:#e94560,color:#fff
    style Entity fill:#2d6a4f,color:#fff
    style Entity2 fill:#2d6a4f,color:#fff
    style Contact fill:#16213e,color:#fff
```

---

## Frontend Component Architecture

```mermaid
graph TD
    subgraph Shell["App Shell"]
        AppShell["AppShell<br/><small>Layout + Navigation</small>"]
        Navbar["Navbar<br/><small>Role-based menu</small>"]
        Notifications["NotificationBell<br/><small>Real-time alerts</small>"]
    end

    subgraph AdminPages["Admin Views"]
        AdminDash["AdminDashboard"]
        UserList["UserList · CreateUser · EditUser"]
        CaseList["CaseList · CreateCase · ViewCase"]
    end

    subgraph IOPages["Investigating Officer Views"]
        IODash["IODashboard"]
        CaseDetail["CaseDetail<br/><small>Upload · Process · Query</small>"]
        QueryUI["QueryInterface<br/><small>NL Query + Results</small>"]
        NetworkViz["NetworkGraph<br/><small>Interactive D3 Graph</small>"]
        Bookmarks["Bookmarks<br/><small>Evidence Management</small>"]
        Reports["ReportGenerator<br/><small>PDF Templates</small>"]
        Entities["EntitiesView<br/><small>Entity Browser</small>"]
    end

    subgraph AIComponents["AI Analysis Components"]
        AnomalyUI["AnomalyDetection<br/><small>ML Results Display</small>"]
        PredictiveUI["PredictiveAnalytics<br/><small>Risk Scores & Leads</small>"]
        CrossCase["CrossCaseConnections<br/><small>Shared Entity Discovery</small>"]
        AdvancedAI["AdvancedAIFeatures<br/><small>Deep Analysis Dashboard</small>"]
    end

    subgraph SharedComponents["Shared Components"]
        QueryResults["QueryResults"]
        QueryHistory["QueryHistory"]
        Timeline["Timeline"]
        AlertsPanel["AlertsPanel"]
        EvidenceChip["EvidenceChip · EvidenceDetailPanel"]
        Markdown["MarkdownRenderer"]
    end

    Shell --> AdminPages & IOPages
    IOPages --> AIComponents
    IOPages --> SharedComponents

    style Shell fill:#0f3460,color:#fff
    style AdminPages fill:#16213e,stroke:#533483,color:#fff
    style IOPages fill:#16213e,stroke:#e94560,color:#fff
    style AIComponents fill:#533483,color:#fff
    style SharedComponents fill:#1a1a2e,stroke:#0f3460,color:#fff
```

---

## CI/CD Pipeline

```mermaid
flowchart LR
    Push["Git Push<br/><small>main/master</small>"] --> Trigger["GitHub Actions<br/><small>build.yml</small>"]

    subgraph Build["Cross-Platform Build"]
        direction TB
        Linux["Ubuntu<br/><small>Linux Binary</small>"]
        Windows["Windows<br/><small>.exe Executable</small>"]
        macOS["macOS<br/><small>Universal Binary</small>"]
    end

    Trigger --> Build
    Build --> Artifacts["Upload Artifacts"]
    Artifacts -->|"Tagged Release"| Release["GitHub Release<br/><small>Downloadable Executables</small>"]

    style Push fill:#e94560,color:#fff
    style Build fill:#0f3460,color:#fff
    style Release fill:#2d6a4f,color:#fff
```

The CI/CD pipeline:
1. Triggers on pushes to `main`/`master` affecting forensixd code
2. Builds standalone executables on **Linux**, **Windows**, and **macOS** simultaneously
3. Injects production server URLs via GitHub Secrets
4. Bundles Android Platform Tools (ADB) into each executable
5. Creates GitHub Releases with downloadable binaries on tagged versions

---

## Service Communication Map

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Browser | Backend | HTTPS + JWT | All user interactions |
| forensixd CLI | Backend | HTTPS + JWT | Real-time evidence streaming |
| Backend | AI Service | HTTP REST | Query processing, analysis requests |
| Backend | PostgreSQL | TCP (Sequelize) | CRUD operations |
| Backend | Elasticsearch | HTTP | Full-text search and indexing |
| Backend | Neo4j | Bolt | Graph queries and mutations |
| Backend | Redis | TCP | Job queue, caching, sessions |
| AI Service | PostgreSQL | TCP (AsyncPG) | Data retrieval for analysis |
| AI Service | Elasticsearch | HTTP | Evidence search |
| AI Service | Neo4j | Bolt | Graph analysis |
| AI Service | ChromaDB/Qdrant | HTTP/gRPC | Vector similarity search |
| AI Service | Ollama | HTTP | LLM inference |
| AI Service | Gemini API | HTTPS | Cloud LLM (optional) |

---

## Port Reference

| Service | Port | Protocol |
|---------|------|----------|
| Frontend (Vite) | 5173 | HTTP |
| Backend API | 8080 | HTTP |
| AI Service | 8005 | HTTP |
| PostgreSQL | 5433 | TCP |
| Elasticsearch | 9201 | HTTP |
| Neo4j Browser | 7475 | HTTP |
| Neo4j Bolt | 7688 | Bolt |
| Redis | 6380 | TCP |
| ChromaDB | 8006 | HTTP |
| Kibana | 5601 | HTTP |
| Ollama | 11434 | HTTP |
