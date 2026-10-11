#!/bin/bash
# ติดตั้ง app tier บน EC2 ใน private subnet
# ใช้:  sudo RELEASE_S3=s3://... APP_SECRET_ID=dns69/app AWS_REGION=ap-southeast-1 bash setup-api.sh
set -euo pipefail
: "${APP_SECRET_ID:?ต้องตั้ง APP_SECRET_ID}"
: "${AWS_REGION:=ap-southeast-1}"
bash "$(dirname "$0")/setup-common.sh"

cd /opt/dns69/api
npm ci
npm run build
npm prune --omit=dev

# ค่าอื่นทั้งหมด (host, user, password, jwt_secret) มาจาก Secrets Manager ตอน start
# ใส่ค่าหลอกไว้ให้ผ่านการตรวจ config — loadSecrets() เขียนทับก่อนใช้งานจริง
cat > /etc/dns69/api.env <<ENV
NODE_ENV=production
PORT=4000
DB_SSL=true
AWS_REGION=$AWS_REGION
SECRETS_MANAGER_SECRET_ID=$APP_SECRET_ID
DB_HOST=from-secret
DB_NAME=from-secret
DB_USER=from-secret
DB_PASSWORD=from-secret
JWT_SECRET=placeholder-overwritten-by-secrets-manager-at-start
ENV
chmod 640 /etc/dns69/api.env
chown -R dns69:dns69 /opt/dns69
chgrp dns69 /etc/dns69/api.env

cp /opt/dns69/deploy/dns69-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now dns69-api
sleep 3
curl -fsS localhost:4000/readyz && echo && echo "✅ app tier พร้อม — ทำ AMI จากเครื่องนี้ได้เลย"
