# CopSight AI — System Architecture

This document provides a comprehensive view of the CopSight AI platform architecture, showing how each layer, component, and service interconnects to form the complete forensic analysis system.

---

## High-Level System Architecture

```mermaid
graph TB
    subgraph Clients["🖥️ CLIENT LAYER"]
        Browser["Web Browser<br/>React 19 · TypeScript · Vite<br/>Port 5173"]
        ForensixdCLI["forensixd CLI<br/>Standalone Executable<br/>Windows · macOS · Linux"]
    end

    subgraph Presentation["📱 PRESENTATION LAYER"]
        direction LR
        Pages["Pages<br/>Landing · Login · Admin<br/>IO · Supervisor"]
        Components["Components<br/>NetworkGraph · Timeline<br/>Alerts · AnomalyDetection<br/>PredictiveAnalytics"]
        State["State & Routing<br/>Zustand · React Router v6<br/>TailwindCSS · D3.js"]
    end

    subgraph Application["⚙️ APPLICATION LAYER"]
        Backend["Node.js API Gateway<br/>Express.js · Port 8080"]
        AIService["Unified API Gateway (AI Bridge)<br/>FastAPI · Port 8005<br/>Cross-Domain Router"]
    end

    subgraph BackendDetail["Node.js Internals"]
        Middleware["Middleware<br/>Helmet · CORS · Auth<br/>RBAC · Rate Limiting"]
        Routes["Routes<br/>auth · users · cases · upload<br/>query · bookmarks · reports<br/>cross-case · alerts · graph<br/>analysis · ingest · notifications<br/>integration · performance"]
        Controllers["Controllers<br/>auth · user · case · upload<br/>query · bookmark · report<br/>graph · notification"]
        Services["Services<br/>Parser · NER · Search<br/>Graph · AI · Reports<br/>Cache · Alert · Cross-Case<br/>Performance Monitor"]
        Workers["Workers<br/>Processing Worker<br/>Stream Worker<br/>Bull Queue"]
    end

    subgraph AIDetail["AI Service Internals"]
        AIRouters["API Routers<br/>Query · Embeddings<br/>Analysis · Indexing"]
        ModelRegistry["Unified Model Registry<br/>Model Bundle Management<br/>Memory & State Loading"]
        ExecutionEngines["Execution Engines<br/>Anomaly Execution Engine<br/>Deep Learning Analytics Hub<br/>Evidence Processing Pipeline"]
        RAGService["RAG Pipeline<br/>Retrieval & Synthesis"]
        AIWorker["Async Worker<br/>Background Jobs"]
    end

    subgraph Data["🗄️ DATA LAYER"]
        PG["PostgreSQL<br/>Port 5433<br/>Relational Data"]
        ES["Elasticsearch<br/>Port 9201<br/>Full-Text Search"]
        Neo["Neo4j<br/>Port 7688<br/>Graph Relations"]
        Redis["Redis<br/>Port 6380<br/>Queue & Cache"]
        Chroma["ChromaDB<br/>Port 8006<br/>Vector Embeddings"]
        Qdrant["Qdrant Cloud<br/>Production Vectors"]
    end

    subgraph LLM["🧠 LLM INFERENCE"]
        Ollama["Ollama<br/>Port 11434<br/>nomic-embed-text<br/>llama3.2"]
        Gemini["Google Gemini<br/>Cloud API<br/>Optional"]
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
        Main["cli.py<br/>Click CLI + Interactive Shell"]
    end

    subgraph Core["Core Engine"]
        Session["ForensicSession<br/>Session lifecycle<br/>Artifact registration"]
        Detector["DeviceDetector<br/>USB device scanning<br/>Platform identification"]
        Auth["AuthManager<br/>Browser-based login<br/>JWT token management"]
        Hasher["IntegrityHasher<br/>MD5 + SHA-256<br/>Merkle root"]
        Logger["AuditLogger<br/>JSONL chain-of-custody<br/>Tamper detection"]
    end

    subgraph Extractors["Platform Extractors"]
        Android["AndroidExtractor<br/>ADB Protocol"]
        iOS["iOSExtractor<br/>pymobiledevice3"]
        Windows["WindowsExtractor<br/>Direct / Image"]
        DiskImg["DiskImageExtractor<br/>E01 / DD / Raw"]
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
        UFDR["UFDRWriter<br/>.ufdr package"]
        DFXML["DFXMLWriter<br/>acquisition.dfxml"]
        Report["ReportWriter<br/>HTML report"]
        APIStream["ApiStreamWriter<br/>Encrypted real-time<br/>upload to server"]
    end

    subgraph Legal["Legal Compliance"]
        AuthZ["AuthorizationManager<br/>Court order · Consent<br/>Examiner ID"]
        CoC["ChainOfCustody<br/>Event logging<br/>Hash verification"]
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
        Helmet["Helmet<br/>Security Headers"]
        CORS["CORS<br/>Origin Control"]
        JWT["JWT Auth<br/>Token Validation"]
        RBAC["RBAC<br/>Role Check"]
        CaseAccess["Case Access<br/>Assignment Check"]
        RateLimit["Rate Limiter<br/>auth · search · upload · AI"]
        PerfMon["Performance<br/>Request Metrics"]
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
        Parser["UFDR Parser<br/>XML · JSON parsing"]
        NER["NER Engine<br/>Entity extraction<br/>Phone · Email · ID · URL · Crypto"]
        SearchSvc["Search Service<br/>Elasticsearch queries"]
        GraphSvc["Graph Service<br/>Neo4j operations"]
        AISvc["AI Client<br/>FastAPI bridge"]
        ReportGen["Report Generator<br/>PDFKit rendering"]
        CacheSvc["Cache Service<br/>Redis caching"]
        AlertSvc["Alert Service<br/>Rule engine"]
        CrossCaseSvc["Cross-Case Service<br/>Entity correlation"]
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
        AppShell["AppShell<br/>Layout + Navigation"]
        Navbar["Navbar<br/>Role-based menu"]
        Notifications["NotificationBell<br/>Real-time alerts"]
    end

    subgraph AdminPages["Admin Views"]
        AdminDash["AdminDashboard"]
        UserList["UserList · CreateUser · EditUser"]
        CaseList["CaseList · CreateCase · ViewCase"]
    end

    subgraph IOPages["Investigating Officer Views"]
        IODash["IODashboard"]
        CaseDetail["CaseDetail<br/>Upload · Process · Query"]
        QueryUI["QueryInterface<br/>NL Query + Results"]
        NetworkViz["NetworkGraph<br/>Interactive D3 Graph"]
        Bookmarks["Bookmarks<br/>Evidence Management"]
        Reports["ReportGenerator<br/>PDF Templates"]
        Entities["EntitiesView<br/>Entity Browser"]
    end

    subgraph AIComponents["AI Analysis Components"]
        AnomalyUI["AnomalyDetection<br/>ML Results Display"]
        PredictiveUI["PredictiveAnalytics<br/>Risk Scores & Leads"]
        CrossCase["CrossCaseConnections<br/>Shared Entity Discovery"]
        AdvancedAI["AdvancedAIFeatures<br/>Deep Analysis Dashboard"]
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
    Push["Git Push<br/>main/master"] --> Trigger["GitHub Actions<br/>build.yml"]

    subgraph Build["Cross-Platform Build"]
        direction TB
        Linux["Ubuntu<br/>Linux Binary"]
        Windows["Windows<br/>.exe Executable"]
        macOS["macOS<br/>Universal Binary"]
    end

    Trigger --> Build
    Build --> Artifacts["Upload Artifacts"]
    Artifacts -->|"Tagged Release"| Release["GitHub Release<br/>Downloadable Executables"]

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
