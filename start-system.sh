#!/bin/bash

echo "========================================"
echo "UFDR System - Unified Forensic Data Repository"
echo "Starting all services..."
echo "========================================"

echo ""
echo "[1/4] Starting Docker services (databases and backend)..."
docker-compose up -d

echo ""
echo "[2/4] Waiting for services to initialize..."
sleep 30

echo ""
echo "[3/4] Installing frontend dependencies..."
cd CopSight-react
npm install

echo ""
echo "[4/4] Starting frontend development server..."
echo ""
echo "========================================"
echo "UFDR System is starting up!"
echo "========================================"
echo ""
echo "Backend Services:"
echo "- API Gateway: http://localhost:8080"
echo "- Parser Service: http://localhost:8001"
echo "- Indexer Service: http://localhost:8002"
echo "- Search Service: http://localhost:8003"
echo "- Graph Service: http://localhost:8004"
echo ""
echo "Databases:"
echo "- PostgreSQL: localhost:5432"
echo "- Elasticsearch: http://localhost:9200"
echo "- Neo4j Browser: http://localhost:7474"
echo "- ChromaDB: http://localhost:8000"
echo ""
echo "Frontend will open at: http://localhost:5173"
echo "Default login: admin / admin123"
echo ""
echo "========================================"

# Open browser (works on most systems)
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:5173
elif command -v open > /dev/null; then
    open http://localhost:5173
fi

npm run dev
