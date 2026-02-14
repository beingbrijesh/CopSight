# UFDR Backend - Node.js/Express Implementation

## 🎯 Overview

This is the Node.js/Express backend for the UFDR (Unified Forensic Data Repository) system, implementing strict Role-Based Access Control (RBAC) for digital forensics investigations.

## 🏗️ Architecture

### Three-Tier Role System

1. **Admin** - System administration only (NO access to case data)
   - Create/manage users
   - Create empty case shells and assign to IOs
   - Monitor system health
   - View audit logs

2. **Investigating Officer (IO)** - Full access to assigned cases
   - Upload UFDR files
   - Execute queries
   - Bookmark evidence
   - Generate reports

3. **Supervisor** - Read-only oversight of unit cases
   - View case progress
   - Review queries and bookmarks
   - Monitor investigations

## 📁 Project Structure

```
backend-node/
├── src/
│   ├── config/
│   │   ├── database.js          # Sequelize configuration
│   │   ├── databases.js         # Multi-DB connections (ES, Neo4j, Redis)
│   │   └── logger.js            # Winston logging setup
│   ├── models/
│   │   ├── User.js              # User model with RBAC
│   │   ├── Case.js              # Case management
│   │   ├── Device.js            # Extracted device info
│   │   ├── DataSource.js        # Data sources per device
│   │   ├── ProcessingJob.js     # Background job tracking
│   │   ├── CaseQuery.js         # Query tracking
│   │   ├── EvidenceBookmark.js  # Evidence bookmarks
│   │   ├── CaseReport.js        # Report generation
│   │   ├── EntityTag.js         # Extracted entities
│   │   ├── AuditLog.js          # Audit trail
│   │   ├── Alert.js             # System/case alerts
│   │   ├── AlertRule.js         # Alert triggering rules
│   │   ├── CrossCaseLink.js     # Cross-case relationships
│   │   ├── CaseSharedEntity.js  # Shared entities across cases
│   │   └── index.js             # Model associations
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication + authorize()
│   │   ├── rbac.js              # Role-based access control
│   │   ├── caseAccess.js        # Case-level access enforcement
│   │   ├── upload.js            # Multer file upload config
│   │   └── rateLimit.js         # API rate limiting
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── userController.js    # User management
│   │   ├── caseController.js    # Case management
│   │   ├── uploadController.js  # File upload + processing
│   │   ├── queryController.js   # Query execution
│   │   ├── bookmarkController.js # Evidence bookmarks
│   │   └── reportController.js  # Report generation
│   ├── routes/
│   │   ├── authRoutes.js        # Auth endpoints (4)
│   │   ├── userRoutes.js        # User endpoints (7)
│   │   ├── caseRoutes.js        # Case endpoints (7)
│   │   ├── uploadRoutes.js      # Upload endpoints (3)
│   │   ├── queryRoutes.js       # Query endpoints (3)
│   │   ├── bookmarkRoutes.js    # Bookmark endpoints (5)
│   │   ├── reportRoutes.js      # Report endpoints (3)
│   │   ├── crossCaseRoutes.js   # Cross-case intelligence (5)
│   │   ├── alertRoutes.js       # Alert management (7)
│   │   ├── integrationRoutes.js # External integrations (12)
│   │   └── performanceRoutes.js # Monitoring (5)
│   ├── services/
│   │   ├── parser/              # UFDR file parser
│   │   ├── ner/                 # Entity extraction (NER)
│   │   ├── search/              # Elasticsearch operations
│   │   ├── graph/               # Neo4j operations
│   │   ├── ai/                  # AI service client + embeddings
│   │   └── reports/             # PDF generation (PDFKit)
│   ├── queues/
│   │   └── processingQueue.js   # Bull queue configuration
│   ├── workers/
│   │   └── processingWorker.js  # Background job processor
│   └── server.js                # Express app entry point
├── scripts/                     # Utility scripts (reset-admin.js)
├── uploads/                     # Uploaded files directory
├── logs/                        # Application logs
├── package.json
├── .env.example
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL 15+
- npm >= 9.0.0

### Installation

1. **Install dependencies:**
```bash
cd backend-node
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

3. **Start development server:**
```bash
npm run dev
```

The server will start on port 8080 with auto-reload.

## 🔑 API Endpoints (61 total)

### Authentication (4 endpoints)
```
POST   /api/auth/login           # User login
GET    /api/auth/me              # Get current user
POST   /api/auth/logout          # Logout
POST   /api/auth/change-password # Change password
```

### User Management (7 endpoints)
```
POST   /api/users                # Create user (Admin)
GET    /api/users                # List users (Admin)
GET    /api/users/:id            # Get user details
PUT    /api/users/:id            # Update user (Admin)
POST   /api/users/:id/reset-password # Reset password (Admin)
GET    /api/users/officers       # List investigating officers
GET    /api/users/supervisors    # List supervisors
```

### Case Management (7 endpoints)
```
POST   /api/cases                # Create case (Admin)
GET    /api/cases                # Get accessible cases
GET    /api/cases/statistics     # Get case statistics
GET    /api/cases/:caseId        # Get specific case
PUT    /api/cases/:caseId        # Update case
GET    /api/cases/:caseId/chats  # Get case chats
GET    /api/cases/:caseId/network # Get communication network
```

### File Upload (3 endpoints)
```
POST   /api/upload/case/:id      # Upload UFDR file
GET    /api/upload/job/:id       # Get processing job status
GET    /api/upload/case/:id/processing-summary # Get summary
```

### Query (3 endpoints)
```
POST   /api/query/case/:id       # Execute natural language query
GET    /api/query/case/:id/history # Get query history
GET    /api/query/:id            # Get specific query result
```

### Bookmarks (5 endpoints)
```
POST   /api/bookmarks            # Create bookmark
GET    /api/bookmarks/case/:id   # List case bookmarks
PUT    /api/bookmarks/:id        # Update bookmark
DELETE /api/bookmarks/:id        # Delete bookmark
POST   /api/bookmarks/case/:id/reorder # Reorder bookmarks
```

### Reports (3 endpoints)
```
POST   /api/reports/case/:id/generate # Generate PDF report
GET    /api/reports/case/:id/history  # Get report history
GET    /api/reports/templates         # Get available templates
```

### Cross-Case Intelligence (5 endpoints)
```
GET    /api/cross-case/search         # Search across cases
GET    /api/cross-case/statistics     # Cross-case statistics
GET    /api/cross-case/shared-entities # Find shared entities
GET    /api/cross-case/links          # Get case links
POST   /api/cross-case/links          # Create case link
```

### Alerts (7 endpoints)
```
GET    /api/alerts               # List alerts
POST   /api/alerts               # Create alert
PUT    /api/alerts/:id           # Update alert
DELETE /api/alerts/:id           # Delete alert
GET    /api/alerts/rules         # List alert rules
POST   /api/alerts/rules         # Create alert rule
PUT    /api/alerts/rules/:id     # Update alert rule
```

### Integration (12 endpoints)
Webhook management, bulk operations, data transformation, and sync endpoints.

### Performance (5 endpoints)
System metrics, health checks, and monitoring endpoints.

## 🔒 RBAC Implementation

### Permission System

```javascript
// Middleware examples
authenticate              // Verify JWT token
authorize('admin')        // Require specific role
checkCaseAccess          // Verify case-level access
```

### Access Rules

**Admin:**
- ✅ Create users and cases
- ✅ View case metadata
- ❌ Cannot view case data/evidence

**Investigating Officer:**
- ✅ Full access to assigned cases
- ✅ Upload, query, bookmark, report
- ❌ Cannot access other officers' cases

**Supervisor:**
- ✅ Read-only access to unit cases
- ✅ View queries, bookmarks, reports
- ❌ Cannot modify cases or upload data

## 📊 Database Models (14)

| Model | Description |
|-------|-------------|
| **User** | User credentials, roles, supervisor hierarchy |
| **Case** | Case metadata, assignment, status workflow |
| **Device** | Extracted device information from UFDR files |
| **DataSource** | Data sources per device (SMS, calls, contacts) |
| **ProcessingJob** | Background job tracking and status |
| **CaseQuery** | Query execution history with results |
| **EvidenceBookmark** | Bookmarked evidence with notes and tags |
| **CaseReport** | Generated report metadata and file paths |
| **EntityTag** | NER-extracted entities (phones, emails, etc.) |
| **AuditLog** | Comprehensive audit trail |
| **Alert** | System and case alerts |
| **AlertRule** | Alert triggering rules |
| **CrossCaseLink** | Links between related cases |
| **CaseSharedEntity** | Shared entities across cases |

## 🔐 Security Features

1. **JWT Authentication**
   - Secure token-based auth
   - JWT_SECRET validated at startup (server won't start without it)
   - Configurable expiration

2. **Password Security**
   - bcrypt hashing (12 rounds)
   - Password change tracking

3. **Access Control**
   - Role-based access control (RBAC) with 3 roles
   - Case-level access enforcement (`checkCaseAccess` middleware)
   - `authorize()` middleware supports both variadic and array syntax

4. **API Protection**
   - Rate limiting (auth, search, upload, general)
   - Helmet security headers
   - CORS with configurable origins
   - Input validation via Sequelize ORM

5. **Audit Logging**
   - All actions logged with Winston
   - Separate audit log file
   - IP and user agent tracking

## 📝 Logging

### Log Levels
- **error**: Critical errors
- **warn**: Warnings and security events
- **info**: General information
- **debug**: Detailed debugging (dev only)

### Log Files
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only
- `logs/audit.log` - Security audit trail

## 🔄 Workflow

### Step 1: Case Creation (Admin)
```javascript
POST /api/cases
{
  "caseNumber": "NIA-2025-087",
  "title": "Investigation Title",
  "assignedTo": 5,  // IO user ID
  "supervisorId": 3,
  "unit": "Cyber Crime"
}
```

### Step 2: IO Login & View Cases
```javascript
POST /api/auth/login
GET /api/cases  // Returns only assigned cases
```

### Step 3: Upload UFDR File
```javascript
POST /api/upload/case/:caseId
// File processed via Bull queue in background
// Monitor with GET /api/upload/job/:jobId
```

### Step 4: Query Data
```javascript
POST /api/query/case/:caseId
{
  "queryText": "Find all chats with foreign numbers discussing financial transactions"
}
```

### Step 5: Bookmark Evidence
```javascript
POST /api/bookmarks
{
  "caseId": 1,
  "evidenceType": "message",
  "evidenceId": "msg_12345",
  "notes": "Suspicious transaction discussion"
}
```

### Step 6: Generate Report
```javascript
POST /api/reports/case/:caseId/generate
{
  "templateType": "full_case_report",
  "sections": ["case_info", "evidence", "queries", "bookmarks"]
}
```

## 📞 Support

For issues or questions, check the logs:
```bash
tail -f logs/combined.log
tail -f logs/audit.log
```

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for Digital Forensics Investigations**
