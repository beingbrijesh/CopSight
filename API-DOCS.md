# CopSight AI — API Documentation

This document provides a comprehensive overview of the CopSight AI platform's REST APIs. The platform uses a microservices architecture with a Node.js API Gateway (Backend) handling user-facing requests and a Python FastAPI service (AI Service) handling machine learning tasks.

---

## 🌐 API Endpoints Overview

The platform exposes **78 API endpoints** across 15 route domains.

| Service | Port | Base URL | Auth Required |
|---------|------|----------|---------------|
| Node.js API Gateway | 8080 | `/api/*` | Yes (mostly) |
| Python AI Service | 8005 | `/api/*` | Handled internally by Gateway |

All API requests to the Node.js backend must include a valid JWT token in the `Authorization` header, except for public endpoints like `/api/auth/login`.

```http
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 1. Authentication & Users

### Auth Routes (`/api/auth`)
Handles login, logout, and session management.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/login` | Authenticate user and receive JWT | Public |
| `GET`  | `/api/auth/me` | Get current authenticated user details | All |
| `POST` | `/api/auth/logout` | Invalidate current session | All |
| `POST` | `/api/auth/change-password` | Change user password | All |

### User Routes (`/api/users`)
Handles user administration and role-based directory queries.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/users/` | Create a new user account | Admin |
| `GET`  | `/api/users/` | List all users (paginated) | Admin |
| `GET`  | `/api/users/supervisors` | List users with 'supervisor' role | Admin, IO |
| `GET`  | `/api/users/investigators` | List users with 'io' role | Admin, Supervisor |
| `GET`  | `/api/users/:userId` | Get specific user details | Admin |
| `PUT`  | `/api/users/:userId` | Update user details/roles | Admin |
| `POST` | `/api/users/:userId/reset-password`| Reset a user's password | Admin |
| `DELETE`| `/api/users/:userId` | Deactivate/delete a user | Admin |

---

## 🗂️ 2. Investigation Case Management

### Case Routes (`/api/cases`)
Manages the lifecycle of an investigation.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/cases/` | Create a new investigation case | Admin |
| `GET`  | `/api/cases/` | List assigned cases (filtered by role) | All |
| `GET`  | `/api/cases/statistics` | Get case status statistics dashboard | All |
| `GET`  | `/api/cases/:caseId` | Get full case details | Assigned |
| `GET`  | `/api/cases/:caseId/entities` | Get extracted entities for a case | Assigned |
| `GET`  | `/api/cases/:caseId/chats` | Get parsed chat messages for a case | Assigned |
| `PUT`  | `/api/cases/:caseId` | Update case status or priority | Assigned |
| `DELETE`| `/api/cases/:caseId` | Delete a case completely | Admin |
| `POST` | `/api/cases/:caseId/review` | Supervisor reviews a completed case | Supervisor |

---

## 📤 3. Evidence Ingestion & Integration

### Upload Routes (`/api/upload`)
Handles manual file uploads from the web UI.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/upload/` | Upload UFDR/XML/JSON evidence file | IO |
| `GET`  | `/api/upload/job/:jobId` | Check parsing/processing job status | IO |
| `GET`  | `/api/upload/case/:caseId/summary`| Get data extraction summary for case | Assigned |

### Ingestion Routes (`/api/ingest`)
Handles programmatic and streaming data ingestion.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/ingest/stream/case/:caseId` | Real-time encrypted stream from forensixd | API Token |
| `POST` | `/api/ingest/upload/case/:caseId` | Direct evidence payload upload | API Token |

### Integration Routes (`/api/integration`)
Webhooks and bulk operations.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/integration/webhook/analysis-complete`| Webhook callback | Internal |
| `POST` | `/api/integration/webhook/case-completed` | Webhook callback | Internal |
| `POST` | `/api/integration/webhook/evidence-extracted`| Webhook callback | Internal |
| `POST` | `/api/integration/bulk-operation` | Perform batch processing on evidence | Admin |
| `POST` | `/api/integration/external-evidence` | Ingest from external systems | API Token |
| `GET`  | `/api/integration/export/:caseId` | Export case data payload | Assigned |

---

## 🔍 4. Query, Search & Graph

### Query Routes (`/api/query`)
Natural language and structured search queries.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/query/execute` | Run natural language query (RAG) | Assigned |
| `POST` | `/api/query/stream` | Stream LLM response | Assigned |
| `GET`  | `/api/query/history/:caseId` | List previous queries for a case | Assigned |
| `GET`  | `/api/query/:queryId` | Get specific query result details | Assigned |

### Graph Routes (`/api/graph`)
Network visualization and relationship queries.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET`  | `/api/graph/case/:caseId/network` | Get full communication network graph | Assigned |
| `GET`  | `/api/graph/entity/:entityId/neighbors`| Get immediate connections for an entity| Assigned |
| `GET`  | `/api/graph/shortest-path` | Find path between two entities | Assigned |
| `GET`  | `/api/graph/communities/:caseId` | Get detected clusters/communities | Assigned |

### Bookmark Routes (`/api/bookmarks`)
Evidence tagging and organization.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/bookmarks/` | Bookmark an evidence artifact | Assigned |
| `GET`  | `/api/bookmarks/case/:caseId` | List bookmarks for a case | Assigned |
| `PUT`  | `/api/bookmarks/:bookmarkId` | Update bookmark notes/tags | Assigned |
| `DELETE`| `/api/bookmarks/:bookmarkId` | Remove a bookmark | Assigned |
| `POST` | `/api/bookmarks/reorder` | Reorder bookmarks for reporting | Assigned |

---

## 🤖 5. Machine Learning Analysis

### Analysis Routes (`/api/analysis`)
Advanced analytics and ML pipelines.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/analysis/anomalies` | Run anomaly detection on case | Assigned |
| `POST` | `/api/analysis/deep-learning` | Run LSTM temporal analysis | Assigned |
| `POST` | `/api/analysis/evidence-classification`| ML-based artifact classification | Assigned |
| `POST` | `/api/analysis/evidence-clustering` | Group similar evidence items | Assigned |
| `POST` | `/api/analysis/pattern-recognition` | Discover behavioral patterns | Assigned |
| `POST` | `/api/analysis/predictive-analysis` | Generate risk scores and leads | Assigned |
| `POST` | `/api/analysis/comprehensive-analysis`| Run full ML pipeline (heavy) | Assigned |
| `GET`  | `/api/analysis/summary/:caseId` | Get aggregated analysis results | Assigned |
| `POST` | `/api/analysis/train-model` | Trigger background model training | Admin |
| `POST` | `/api/analysis/hyperparameter-optimization`| Auto-tune ML models | Admin |
| `GET`  | `/api/analysis/model-stats` | Get ML model performance metrics | Admin |

### Cross-Case Routes (`/api/cross-case`)
Intelligence discovery across multiple investigations.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/cross-case/analyze/:caseId` | Find cross-case links for one case | Assigned |
| `POST` | `/api/cross-case/analyze-all` | Run global cross-case correlation | Admin |
| `GET`  | `/api/cross-case/connections/:caseId` | Get cross-case link results | Assigned |
| `GET`  | `/api/cross-case/shared-entities` | Search for a specific shared entity | All |
| `GET`  | `/api/cross-case/statistics` | Global network intelligence stats | Admin |

---

## 📊 6. System & Reporting

### Report Routes (`/api/reports`)
PDF and export generation.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/reports/generate` | Generate court-ready PDF report | Assigned |
| `GET`  | `/api/reports/history/:caseId` | List previously generated reports | Assigned |
| `GET`  | `/api/reports/templates` | List available report templates | All |

### Alert Routes (`/api/alerts`)
Automated notifications for discovered patterns.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/alerts/` | Create a new alert rule | Admin/Sup |
| `GET`  | `/api/alerts/` | List all alert rules | All |
| `GET`  | `/api/alerts/case/:caseId` | List triggered alerts for a case | Assigned |
| `PUT`  | `/api/alerts/:alertId/acknowledge`| Mark alert as acknowledged | Assigned |
| `PUT`  | `/api/alerts/:alertId/resolve` | Mark alert as resolved | Assigned |
| `GET`  | `/api/alerts/statistics` | Alert volume metrics | All |
| `POST` | `/api/alerts/run-detection` | Manually run alert matching | Admin |

### Notification Routes (`/api/notifications`)
User-specific UI notifications.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET`  | `/api/notifications/` | Get current user's notifications | All |
| `PUT`  | `/api/notifications/:notificationId/read`| Mark single notification read | All |
| `PUT`  | `/api/notifications/read-all` | Mark all notifications read | All |

### Performance Routes (`/api/performance`)
System health and metrics monitoring.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET`  | `/api/performance/health` | Load balancer health check | Public |
| `GET`  | `/api/performance/metrics` | System resource utilization | Admin |
| `GET`  | `/api/performance/insights` | API latency and usage analytics | Admin |
| `GET`  | `/api/performance/cache` | Redis cache status | Admin |
| `POST` | `/api/performance/cache/clear` | Clear system caches | Admin |

---

## 🔌 7. AI Service Internal Endpoints

These endpoints reside on the Python FastAPI service (port 8005) and are typically called by the Node.js backend, not directly by clients.

| Domain | Endpoint | Purpose |
|--------|----------|---------|
| **Core** | `GET /` | Service identifier |
| **Core** | `GET /health` | Health check and ML model status |
| **Embeddings** | `POST /api/embeddings/generate` | Generate vector embeddings for text |
| **Embeddings** | `GET /api/embeddings/test` | Validate embedding model connectivity |
| **Indexing** | `POST /api/index/case/:caseId` | Trigger vector indexing for a case |
| **Indexing** | `GET /api/index/test-embedding` | Validate vector DB (Chroma/Qdrant) |
| **Ingestion**| `POST /api/ingest/text` | Ingest raw text for processing |
| **Ingestion**| `POST /api/ingest/text/batch` | Batch ingest text records |
| **Ingestion**| `POST /api/ingest/media` | Ingest media files for OCR/vision |
| **Query** | `POST /api/query/relationships` | Process intent and extract entity relations |
| **Query** | `GET /api/query/graph/entity/:id/events` | Get timeline events for an entity |

---

> [!NOTE]
> All timestamps in API responses are standardized to **IST (Asia/Kolkata, UTC+05:30)** format.

> [!TIP]
> Use the Swagger UI available at `http://localhost:8005/docs` for interactive testing of the AI Service internal endpoints.
