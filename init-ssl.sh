#!/bin/bash
# ==============================================================================
# Khởi tạo SSL Certificate với Let's Encrypt (chạy 1 lần duy nhất)
# Usage: sudo ./init-ssl.sh
# ==============================================================================
set -euo pipefail

DOMAIN="shepoo.id.vn"
EMAIL="phamduyhai01271105@gmail.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} SSL Certificate Setup — ${DOMAIN}${NC}"
echo -e "${GREEN}========================================${NC}"

# -----------------------------------------------------------------------------
# 1. Kiểm tra DNS
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Kiểm tra DNS...${NC}"
RESOLVED_IP=$(dig +short ${DOMAIN} 2>/dev/null || nslookup ${DOMAIN} 2>/dev/null | grep -oP '(?<=Address:\s)\d+\.\d+\.\d+\.\d+' | tail -1 || echo "")
if [ -z "$RESOLVED_IP" ]; then
    echo -e "${RED}Không resolve được ${DOMAIN}. Kiểm tra DNS đã trỏ chưa.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ${DOMAIN} → ${RESOLVED_IP}${NC}"

# -----------------------------------------------------------------------------
# 2. Tạo dummy certificate (để nginx start được)
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/5] Tạo dummy certificate...${NC}"
CERT_PATH="certbot_certs"

docker compose run --rm --entrypoint "" certbot sh -c "\
    mkdir -p /etc/letsencrypt/live/${DOMAIN} && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
        -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
        -subj '/CN=localhost' 2>/dev/null"

echo -e "${GREEN}✓ Dummy certificate created${NC}"

# -----------------------------------------------------------------------------
# 3. Start nginx với dummy cert
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Khởi động nginx...${NC}"
docker compose up -d nginx
sleep 3
echo -e "${GREEN}✓ Nginx started${NC}"

# -----------------------------------------------------------------------------
# 4. Xóa dummy cert + Lấy certificate thật từ Let's Encrypt
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Yêu cầu certificate từ Let's Encrypt...${NC}"

# Xóa dummy
docker compose run --rm --entrypoint "" certbot sh -c "\
    rm -rf /etc/letsencrypt/live/${DOMAIN} && \
    rm -rf /etc/letsencrypt/archive/${DOMAIN} && \
    rm -f /etc/letsencrypt/renewal/${DOMAIN}.conf"

# Lấy certificate thật
docker compose run --rm certbot certonly \
    --webroot \
    -w /var/www/certbot \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d ${DOMAIN} \
    -d www.${DOMAIN}

echo -e "${GREEN}✓ Certificate issued!${NC}"

# -----------------------------------------------------------------------------
# 5. Reload nginx với certificate thật
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Reload nginx...${NC}"
docker compose exec nginx nginx -s reload
echo -e "${GREEN}✓ Nginx reloaded with SSL${NC}"

# -----------------------------------------------------------------------------
# Setup auto-renewal cron (mỗi 12 tiếng)
# -----------------------------------------------------------------------------
CRON_CMD="0 */12 * * * cd $(pwd) && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload"
(crontab -l 2>/dev/null | grep -v "certbot renew" ; echo "$CRON_CMD") | crontab -
echo -e "${GREEN}✓ Auto-renewal cron đã được thêm${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} SSL Setup hoàn tất!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo -e "  ${GREEN}https://${DOMAIN}/api/health${NC}"
echo ""
