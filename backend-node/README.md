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
│   │   └── logger.js            # Winston logging setup
│   ├── models/
│   │   ├── User.js              # User model with RBAC
│   │   ├── Case.js              # Case management
│   │   ├── CaseQuery.js         # Query tracking
│   │   ├── EvidenceBookmark.js  # Evidence bookmarks
│   │   ├── CaseReport.js        # Report generation
│   │   ├── AuditLog.js          # Audit trail
│   │   └── index.js             # Model associations
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   └── caseAccess.js        # Case-level RBAC
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   └── caseController.js    # Case management logic
│   ├── routes/
│   │   ├── authRoutes.js        # Auth endpoints
│   │   └── caseRoutes.js        # Case endpoints
│   └── server.js                # Main application
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
# Edit .env with your configuration
```

3. **Setup database:**
```bash
# Run the enhanced init.sql from backend/database/init.sql
psql -U postgres -d ufdr_db -f ../backend/database/init.sql
```

4. **Start development server:**
```bash
npm run dev
```

## 🔑 API Endpoints

### Authentication

```
POST   /api/auth/login           # User login
GET    /api/auth/me              # Get current user
POST   /api/auth/logout          # Logout
POST   /api/auth/change-password # Change password
```

### Case Management

```
POST   /api/cases                # Create case (Admin only)
GET    /api/cases                # Get accessible cases
GET    /api/cases/statistics     # Get case statistics
GET    /api/cases/:caseId        # Get specific case
PUT    /api/cases/:caseId        # Update case
```

## 🔒 RBAC Implementation

### Permission System

```javascript
// Check if user has permission
User.hasPermission(role, permission)

// Middleware examples
authenticate              // Verify JWT token
authorize('admin')        // Require specific role
requirePermission('create_case')  // Require specific permission
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

## 📊 Database Models

### User
- Stores user credentials and role
- Supports hierarchical supervisor relationships
- Tracks login history

### Case
- Case metadata and assignment
- Status tracking (created → active → processing → ready_for_analysis)
- Unit-based organization

### CaseQuery
- Tracks all queries made by IOs
- Stores query text, filters, results
- Performance metrics (processing time, confidence)

### EvidenceBookmark
- IO-created bookmarks of important evidence
- Links to queries that found the evidence
- Supports notes and tags

### CaseReport
- Generated reports with digital signatures
- References bookmarks and queries
- PDF export capability

### AuditLog
- Comprehensive audit trail
- Tracks all user actions
- IP address and session tracking

## 🔐 Security Features

1. **JWT Authentication**
   - Secure token-based auth
   - Configurable expiration
   - Session tracking

2. **Password Security**
   - bcrypt hashing (12 rounds)
   - Password change tracking
   - Minimum complexity requirements

3. **Audit Logging**
   - All actions logged
   - Separate audit log file
   - IP and user agent tracking

4. **Input Validation**
   - Joi schema validation
   - SQL injection prevention (Sequelize ORM)
   - XSS protection (Helmet)

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

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- authController.test.js
```

## 🔄 Workflow Implementation

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

### Step 3: Upload UFDR (Coming Next)
```javascript
POST /api/cases/:caseId/upload
// Triggers parser → indexer → NER → graph
```

### Step 4: Query Data (Coming Next)
```javascript
POST /api/cases/:caseId/query
{
  "queryText": "Find all chats with foreign numbers discussing financial transactions"
}
```

### Step 5: Bookmark Evidence (Coming Next)
```javascript
POST /api/cases/:caseId/bookmarks
{
  "evidenceType": "message",
  "evidenceId": "msg_12345",
  "notes": "Suspicious transaction discussion"
}
```

### Step 6: Generate Report (Coming Next)
```javascript
POST /api/cases/:caseId/reports
{
  "title": "Evidentiary Report",
  "includedBookmarks": [1, 2, 3]
}
```

## 🚧 Next Steps

The following features are planned for implementation:

1. **User Management API** (Admin)
   - Create/update/delete users
   - Assign supervisors
   - Manage units

2. **UFDR Parser Service**
   - XML/JSON parsing
   - NER (Named Entity Recognition)
   - Entity tagging (phone numbers, crypto addresses, etc.)

3. **Search Service**
   - Natural language query processing
   - RAG implementation with OpenAI
   - Vector search with ChromaDB

4. **Evidence & Query APIs**
   - Bookmark management
   - Query history
   - Evidence linking

5. **Report Generation**
   - PDF generation
   - Digital signatures
   - Evidence compilation

6. **Graph Service**
   - Neo4j integration
   - Network visualization
   - Relationship analysis

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
