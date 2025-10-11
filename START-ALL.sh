#!/bin/bash

echo "🚀 UFDR System Startup Script"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Start databases
echo "📊 Starting database services..."
docker-compose up -d postgresql elasticsearch redis neo4j

echo "⏳ Waiting for databases to be ready (15 seconds)..."
sleep 15

# Check database health
echo ""
echo "🔍 Checking database health..."

if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL ready${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL not responding${NC}"
fi

if curl -s http://localhost:9200 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Elasticsearch ready${NC}"
else
    echo -e "${YELLOW}⚠ Elasticsearch not responding${NC}"
fi

if docker exec ufdr-redis redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✓ Redis ready${NC}"
else
    echo -e "${YELLOW}⚠ Redis not responding${NC}"
fi

if curl -s http://localhost:7474 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Neo4j ready${NC}"
else
    echo -e "${YELLOW}⚠ Neo4j not responding${NC}"
fi

echo ""
echo "=============================="
echo "✅ Database services started!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Start Backend (in new terminal):"
echo "   cd backend-node && npm run dev"
echo ""
echo "2. Start Frontend (in new terminal):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. (Optional) Start AI Service (in new terminal):"
echo "   cd ai-service"
echo "   source venv/bin/activate"
echo "   uvicorn app.main:app --reload --port 8005"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend: http://localhost:8080"
echo "   Kibana: http://localhost:5601"
echo "   Neo4j: http://localhost:7474"
echo ""
echo "5. Default login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "=============================="
