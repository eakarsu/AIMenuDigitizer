#!/bin/bash

# AI Menu Digitizer - Start Script
# This script cleans ports, sets up database, seeds data, and starts the application
# with hot reload for development

set -e

echo "============================================"
echo "  AI Menu Digitizer - Starting Application"
echo "============================================"
echo ""

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to clean ports
clean_ports() {
    echo -e "${YELLOW}[1/6] Cleaning used ports...${NC}"

    # Kill processes on backend port (3001)
    lsof -ti:${BACKEND_PORT:-3001} 2>/dev/null | xargs kill -9 2>/dev/null || true

    # Kill processes on frontend port (3000)
    lsof -ti:${FRONTEND_PORT:-3000} 2>/dev/null | xargs kill -9 2>/dev/null || true

    # Also clean port 5000 if somehow used
    lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null || true

    # Clean any stale node processes for this project
    pkill -f "nodemon.*backend" 2>/dev/null || true
    pkill -f "vite.*frontend" 2>/dev/null || true

    sleep 1
    echo -e "${GREEN}   Ports cleaned${NC}"
}

# Function to check PostgreSQL
check_postgres() {
    echo -e "${YELLOW}[2/6] Checking PostgreSQL...${NC}"

    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${YELLOW}   Starting PostgreSQL...${NC}"
        # Try to start PostgreSQL (macOS with Homebrew)
        if command -v brew &> /dev/null; then
            brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
        fi
        sleep 3

        if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
            echo -e "${RED}   ERROR: PostgreSQL is not running. Please start it manually.${NC}"
            exit 1
        fi
    fi

    echo -e "${GREEN}   PostgreSQL is running${NC}"
}

# Function to setup database
setup_database() {
    echo -e "${YELLOW}[3/6] Setting up database...${NC}"

    # Create user if not exists
    psql -h localhost -p 5432 -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER:-menuuser}'" 2>/dev/null | grep -q 1 || \
        psql -h localhost -p 5432 -U postgres -c "CREATE USER ${DB_USER:-menuuser} WITH PASSWORD '${DB_PASSWORD:-menupass123}' CREATEDB;" 2>/dev/null || true

    # Create database if not exists
    psql -h localhost -p 5432 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME:-menudigitizer}'" 2>/dev/null | grep -q 1 || \
        psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE ${DB_NAME:-menudigitizer} OWNER ${DB_USER:-menuuser};" 2>/dev/null || true

    echo -e "${GREEN}   Database setup complete${NC}"
}

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}[4/6] Installing dependencies...${NC}"

    # Backend dependencies
    cd backend
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo -e "${BLUE}   Installing backend dependencies...${NC}"
        npm install --silent
    else
        echo -e "${BLUE}   Backend dependencies up to date${NC}"
    fi
    cd ..

    # Frontend dependencies
    cd frontend
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo -e "${BLUE}   Installing frontend dependencies...${NC}"
        npm install --silent
    else
        echo -e "${BLUE}   Frontend dependencies up to date${NC}"
    fi
    cd ..

    echo -e "${GREEN}   Dependencies installed${NC}"
}

# Function to run migrations and seed
seed_database() {
    echo -e "${YELLOW}[5/6] Running migrations and seeding database...${NC}"

    cd backend
    npm run db:setup 2>&1 | while IFS= read -r line; do
        echo -e "${BLUE}   $line${NC}"
    done
    cd ..

    echo -e "${GREEN}   Database seeded with sample data${NC}"
}

# Function to start backend with hot reload
start_backend() {
    echo -e "${PURPLE}   Starting backend server (port ${BACKEND_PORT:-3001}) with hot reload...${NC}"
    cd backend
    npm run dev &
    BACKEND_PID=$!
    cd ..
}

# Function to start frontend with hot reload
start_frontend() {
    echo -e "${PURPLE}   Starting frontend server (port ${FRONTEND_PORT:-3000}) with hot reload...${NC}"
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"

    # Kill backend
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi

    # Kill frontend
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    # Kill any remaining processes on the ports
    lsof -ti:${BACKEND_PORT:-3001} 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:${FRONTEND_PORT:-3000} 2>/dev/null | xargs kill -9 2>/dev/null || true

    echo -e "${GREEN}Application stopped${NC}"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    clean_ports
    check_postgres
    setup_database
    install_dependencies
    seed_database

    echo ""
    echo -e "${YELLOW}[6/6] Starting servers with hot reload...${NC}"

    start_backend
    sleep 3
    start_frontend

    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Application is running!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${BLUE}  Frontend:  http://localhost:${FRONTEND_PORT:-3000}${NC}"
    echo -e "${BLUE}  Backend:   http://localhost:${BACKEND_PORT:-3001}${NC}"
    echo ""
    echo -e "${PURPLE}  Demo Login:${NC}"
    echo -e "${PURPLE}    Email:    demo@menudigitizer.com${NC}"
    echo -e "${PURPLE}    Password: demo123456${NC}"
    echo ""
    echo -e "${YELLOW}  Hot reload enabled - changes will auto-refresh${NC}"
    echo -e "${YELLOW}  Press Ctrl+C to stop the application${NC}"
    echo ""

    # Wait for processes
    wait
}

# Run main function
main
