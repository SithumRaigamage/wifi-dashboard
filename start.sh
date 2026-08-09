#!/usr/bin/env bash

# WiFi Monitoring Dashboard Startup Script
# Starts both Node.js backend and React/Vite frontend processes cleanly.

set -e

# Resolve project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color formatting
BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BOLD}${CYAN}==========================================${NC}"
echo -e "${BOLD}${CYAN}      WiFi Monitoring Dashboard           ${NC}"
echo -e "${BOLD}${CYAN}==========================================${NC}"
echo ""

# 1. Check prerequisites
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed or not in PATH.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed or not in PATH.${NC}"
    exit 1
fi

# 2. Cleanup handler for background processes
SERVER_PID=""
CLIENT_PID=""

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down WiFi Dashboard services...${NC}"
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo -e "${CYAN}Stopping backend (PID: $SERVER_PID)...${NC}"
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" 2>/dev/null; then
        echo -e "${CYAN}Stopping frontend (PID: $CLIENT_PID)...${NC}"
        kill "$CLIENT_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}All services stopped successfully.${NC}"
    exit 0
}

# Trap Ctrl+C (SIGINT), SIGTERM, and EXIT
trap cleanup SIGINT SIGTERM EXIT

# 3. Ensure backend dependencies are installed
if [ ! -d "$PROJECT_DIR/server/node_modules" ]; then
    echo -e "${YELLOW}Backend node_modules not found. Installing dependencies in server/...${NC}"
    (cd "$PROJECT_DIR/server" && npm install)
fi

# 4. Ensure frontend dependencies are installed
if [ ! -d "$PROJECT_DIR/client/node_modules" ]; then
    echo -e "${YELLOW}Frontend node_modules not found. Installing dependencies in client/...${NC}"
    (cd "$PROJECT_DIR/client" && npm install)
fi

# 5. Start Backend
echo -e "${GREEN}Starting backend server (http://localhost:4000)...${NC}"
(cd "$PROJECT_DIR/server" && npm start) &
SERVER_PID=$!

# Wait briefly for backend to initialize
sleep 1

# 6. Start Frontend
echo -e "${GREEN}Starting frontend dev server (http://localhost:5173)...${NC}"
(cd "$PROJECT_DIR/client" && npm run dev) &
CLIENT_PID=$!

echo ""
echo -e "${BOLD}${GREEN}==========================================${NC}"
echo -e "${BOLD}${GREEN}  WiFi Dashboard is running!              ${NC}"
echo -e "  Frontend UI: ${CYAN}http://localhost:5173${NC}"
echo -e "  Backend API: ${CYAN}http://localhost:4000${NC}"
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services."
echo -e "${BOLD}${GREEN}==========================================${NC}"
echo ""

# Wait for both processes
wait $SERVER_PID $CLIENT_PID
