# UFDR System - Quick Start Guide

**Get the system running in 5 minutes!**

---

## 🚀 Quick Start (3 Steps)

### Step 1: Start Databases
```bash
cd /Users/beingbrijesh/Desktop/Projects/UFDR
./START-ALL.sh
```

### Step 2: Start Backend
```bash
cd backend-node
npm run dev
```

### Step 3: Start Frontend
```bash
cd frontend
npm run dev
```

**Done!** Open http://localhost:5173

---

## 🔐 Login

**Default Admin Account:**
- Username: `admin`
- Password: `admin123`

---

## ✅ Verify Everything Works

### Run Automated Tests
```bash
./run-tests.sh
```

### Manual Verification
1. **Login** → http://localhost:5173
2. **Create User** → Admin → Users → Add User
3. **Create Case** → Admin → Cases → Create Case
4. **View Case** → Login as IO → View assigned case
5. **Upload File** → Case Detail → Upload UFDR file
6. **Execute Query** → Case Detail → Execute Query
7. **Generate Report** → Case Detail → Generate Report

---

## 🎯 Test Each Feature

### 1. User Management (2 min)
```
1. Login as admin
2. Go to Admin → Users
3. Click "Add User"
4. Create IO user:
   - Name: Test IO
   - Username: testio
   - Password: test123
   - Role: Investigating Officer
5. Click Create
✅ User created successfully
```

### 2. Case Management (2 min)
```
1. Go to Admin → Cases
2. Click "Create Case"
3. Fill details:
   - Case Number: TEST001
   - Case Name: Test Case
   - Assign to: testio
4. Click Create
✅ Case created and assigned
```

### 3. File Upload (3 min)
```
1. Logout and login as testio
2. Click on assigned case
3. Upload sample UFDR file
4. Wait for processing
✅ File processed and indexed
```

### 4. Query System (2 min)
```
1. Click "Execute Query"
2. Try example query:
   "Show me all communications with foreign numbers"
3. Click Execute
✅ Results displayed with AI answer
```

### 5. Bookmarks (1 min)
```
1. From query results, click bookmark icon
2. Go to Bookmarks page
3. View bookmarked evidence
✅ Bookmark saved
```

### 6. Report Generation (2 min)
```
1. Go to case detail
2. Click "Generate Report"
3. Select "Full Case Report"
4. Click "Generate PDF Report"
✅ PDF downloads
```

---

## 🔧 Troubleshooting

### Backend Won't Start
```bash
# Check if port 8080 is in use
lsof -ti:8080

# Kill process if needed
kill -9 $(lsof -ti:8080)

# Restart
cd backend-node && npm run dev
```

### Database Connection Error
```bash
# Restart databases
docker-compose restart

# Check status
docker ps
```

### Frontend Build Error
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📊 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | admin/admin123 |
| Backend API | http://localhost:8080 | - |
| Kibana | http://localhost:5601 | - |
| Neo4j Browser | http://localhost:7474 | neo4j/ufdr_password |
| AI Service | http://localhost:8005 | - |

---

## 🧪 Quick Health Check

```bash
# Check all services
curl http://localhost:8080/health
curl http://localhost:5173
curl http://localhost:9200
curl http://localhost:7474

# Or run automated tests
./run-tests.sh
```

---

## 📝 Common Tasks

### Create Sample Data
```bash
# Login as admin
# Create 3 users (IO, Supervisor, Admin)
# Create 5 cases
# Assign cases to IOs
```

### Test Complete Workflow
```bash
# 1. Admin creates case
# 2. Assigns to IO
# 3. IO uploads file
# 4. System processes
# 5. IO executes queries
# 6. IO bookmarks evidence
# 7. IO generates report
```

### Stop All Services
```bash
# Stop backend (Ctrl+C)
# Stop frontend (Ctrl+C)
# Stop databases
docker-compose down
```

---

## 🎓 Next Steps

1. **Read Full Documentation** → PROJECT-COMPLETE.md
2. **Review Testing Guide** → TESTING-GUIDE.md
3. **Check Integration** → INTEGRATION-VERIFIED.md
4. **Explore Features** → Use the system!

---

## ⚡ Pro Tips

- **Use Example Queries** - Click them in Query Interface
- **Bookmark Important Evidence** - Use bookmark button
- **Try Different Report Templates** - Executive Summary, Evidence Report, etc.
- **View Network Graph** - Visualize communication patterns
- **Check Timeline** - See chronological events
- **Export Bookmarks** - Download as JSON
- **Monitor Processing** - Check case detail page

---

## 🆘 Need Help?

1. **Check Logs**
   ```bash
   # Backend logs
   tail -f backend-node/logs/combined.log
   
   # Docker logs
   docker-compose logs -f
   ```

2. **Run Tests**
   ```bash
   ./run-tests.sh
   ```

3. **Check Documentation**
   - TESTING-GUIDE.md
   - INTEGRATION-VERIFIED.md
   - FINAL-VERIFICATION.md

---

**System Status**: ✅ Ready to Use  
**All Features**: ✅ Working  
**Documentation**: ✅ Complete

**Enjoy using the UFDR System!** 🎉
