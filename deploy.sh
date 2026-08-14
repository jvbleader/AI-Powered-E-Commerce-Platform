#!/bin/bash
# ==============================================================================
# AI-Powered E-Commerce Platform — Deploy Script (Pha 1: HTTP + IP)
# Chạy trên EC2 instance (Ubuntu/Amazon Linux) đã cài Docker + Docker Compose
# ==============================================================================
set -euo pipefail

# Màu cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} AI E-Commerce Platform - Deploy${NC}"
echo -e "${GREEN}========================================${NC}"

# -----------------------------------------------------------------------------
# 1. Kiểm tra Docker
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Kiểm tra Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker chưa được cài. Hãy cài Docker trước.${NC}"
    exit 1
fi
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose (v2) chưa được cài.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker $(docker --version | cut -d' ' -f3)${NC}"
echo -e "${GREEN}✓ $(docker compose version)${NC}"

# -----------------------------------------------------------------------------
# 2. Kiểm tra .env đã có SERVER_IP chưa
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/5] Kiểm tra cấu hình .env...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}.env không tồn tại. Hãy copy từ .env.example:${NC}"
    echo "  cp .env.example .env"
    exit 1
fi

SERVER_IP=$(grep -E '^SERVER_IP=' .env | cut -d'=' -f2)
if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" = "YOUR_EC2_PUBLIC_IP" ]; then
    # Tự động detect public IP
    DETECTED_IP=$(curl -sf http://checkip.amazonaws.com || curl -sf https://ifconfig.me || echo "")
    if [ -n "$DETECTED_IP" ]; then
        echo -e "${YELLOW}Phát hiện Public IP: ${DETECTED_IP}${NC}"
        read -p "Sử dụng IP này? [Y/n]: " confirm
        confirm=${confirm:-Y}
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            sed -i "s/^SERVER_IP=.*/SERVER_IP=${DETECTED_IP}/" .env
            echo -e "${GREEN}✓ Đã cập nhật SERVER_IP=${DETECTED_IP} trong .env${NC}"
        else
            echo -e "${RED}Hãy cập nhật SERVER_IP trong .env rồi chạy lại.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Không thể detect IP. Hãy cập nhật SERVER_IP trong .env.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ SERVER_IP=${SERVER_IP}${NC}"
fi

# Kiểm tra backend/.env
if [ ! -f backend/.env ]; then
    echo -e "${RED}backend/.env không tồn tại. Hãy copy từ backend/.env.example:${NC}"
    echo "  cp backend/.env.example backend/.env"
    exit 1
fi

# Cập nhật VNPay URLs trong backend/.env nếu vẫn là placeholder
CURRENT_IP=$(grep -E '^SERVER_IP=' .env | cut -d'=' -f2)
if grep -q "YOUR_EC2_PUBLIC_IP" backend/.env 2>/dev/null; then
    sed -i "s/YOUR_EC2_PUBLIC_IP/${CURRENT_IP}/g" backend/.env
    echo -e "${GREEN}✓ Đã cập nhật VNPay URLs trong backend/.env${NC}"
fi

echo -e "${GREEN}✓ Cấu hình .env OK${NC}"

# -----------------------------------------------------------------------------
# 3. Build Docker images
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Build Docker images...${NC}"
docker compose build --no-cache
echo -e "${GREEN}✓ Build hoàn tất${NC}"

# -----------------------------------------------------------------------------
# 4. Khởi động stack
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Khởi động services...${NC}"
docker compose up -d
echo -e "${GREEN}✓ Đã khởi động${NC}"

# -----------------------------------------------------------------------------
# 5. Kiểm tra trạng thái
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Kiểm tra trạng thái...${NC}"
sleep 5

echo ""
docker compose ps
echo ""

# Chờ backend healthy
echo -e "${YELLOW}Đang chờ backend khởi động...${NC}"
RETRIES=0
MAX_RETRIES=30
while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -sf http://127.0.0.1/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend healthy!${NC}"
        break
    fi
    RETRIES=$((RETRIES + 1))
    echo -n "."
    sleep 5
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
    echo -e "\n${YELLOW}Backend chưa sẵn sàng. Kiểm tra logs:${NC}"
    echo "  docker compose logs --tail=30 backend"
fi

FINAL_IP=$(grep -E '^SERVER_IP=' .env | cut -d'=' -f2)
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Deploy hoàn tất!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Frontend: ${GREEN}http://${FINAL_IP}${NC}"
echo -e "  API:      ${GREEN}http://${FINAL_IP}/api/health${NC}"
echo ""
echo -e "${YELLOW}Lệnh hữu ích:${NC}"
echo "  docker compose ps              # Trạng thái containers"
echo "  docker compose logs -f backend  # Logs backend"
echo "  docker compose logs -f frontend # Logs frontend"
echo "  docker compose logs -f nginx    # Logs nginx"
echo "  docker compose down             # Dừng stack"
echo "  docker compose up -d            # Khởi động lại"
echo ""
