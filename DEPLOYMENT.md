# UFDR System - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env` in backend-node
- [ ] Copy `.env.example` to `.env` in ai-service
- [ ] Update JWT_SECRET in backend .env
- [ ] Update database passwords
- [ ] Configure CORS_ORIGIN for production domain

### 2. Database Setup
- [ ] Start PostgreSQL
- [ ] Start Elasticsearch
- [ ] Start Neo4j
- [ ] Start Redis
- [ ] Run database migrations (auto on first start)

### 3. Security
- [ ] Change default admin password
- [ ] Update JWT secret
- [ ] Configure firewall rules
- [ ] Enable HTTPS/SSL
- [ ] Set secure session cookies

### 4. Services
- [ ] Backend running on port 8080
- [ ] Frontend built and served
- [ ] AI service running (optional)
- [ ] All databases accessible

## Production Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 2: Manual Deployment

**Backend:**
```bash
cd backend-node
npm install --production
NODE_ENV=production node src/server.js
```

**Frontend:**
```bash
cd frontend
npm install
npm run build
# Serve dist/ folder with nginx or similar
```

**AI Service:**
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8005
```

## Post-Deployment

### 1. Verify Services
```bash
curl http://localhost:8080/health
curl http://localhost:5173
```

### 2. Create Admin User
```bash
cd backend-node
node scripts/reset-admin.js
```

### 3. Test Login
- Navigate to frontend URL
- Login with admin credentials
- Create test case
- Upload sample file

## Monitoring

- Check logs: `backend-node/logs/`
- Monitor database connections
- Track API response times
- Review audit logs

## Backup Strategy

### Daily Backups
- PostgreSQL database
- Uploaded files
- Configuration files

### Backup Commands
```bash
# PostgreSQL
docker exec ufdr-postgres pg_dump -U ufdr_user ufdr_db > backup.sql

# Files
tar -czf uploads-backup.tar.gz backend-node/uploads/
```

## Troubleshooting

**Service won't start:**
- Check logs in `backend-node/logs/`
- Verify database connections
- Check port availability

**Database connection failed:**
- Verify credentials in .env
- Check if databases are running
- Test connection manually

**Frontend not loading:**
- Check if backend is running
- Verify CORS configuration
- Check browser console for errors

## Support

For issues, check:
1. Application logs
2. Database logs
3. Docker logs (if using containers)
4. System resources (CPU, memory, disk)

---

**Status**: Ready for Production Deployment
