#!/bin/bash
# ติดตั้ง web tier บน EC2 ใน public subnet
# ใช้:  sudo RELEASE_S3=s3://... WEB_SECRET_ID=dns69/web \
#            API_ORIGIN=http://internal-dns69-app-alb-xxxx.ap-southeast-1.elb.amazonaws.com \
#            AWS_REGION=ap-southeast-1 bash setup-web.sh
set -euo pipefail
: "${WEB_SECRET_ID:?ต้องตั้ง WEB_SECRET_ID}"
: "${API_ORIGIN:?ต้องตั้ง API_ORIGIN เป็น DNS ของ internal ALB}"
: "${AWS_REGION:=ap-southeast-1}"
bash "$(dirname "$0")/setup-common.sh"

cd /opt/dns69/web
npm ci
# API_ORIGIN ต้องมีทั้งตอน build และตอนรัน (Next.js ฝังค่า rewrite ไว้ใน build ด้วย)
API_ORIGIN="$API_ORIGIN" npm run build
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public || true

cat > /etc/dns69/web.env <<ENV
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
API_ORIGIN=$API_ORIGIN
AWS_REGION=$AWS_REGION
WEB_SECRET_ID=$WEB_SECRET_ID
ENV
chmod 640 /etc/dns69/web.env
chown -R dns69:dns69 /opt/dns69
chgrp dns69 /etc/dns69/web.env

cp /opt/dns69/deploy/dns69-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now dns69-web
sleep 4
curl -fsS localhost:3000/healthz && echo && echo "✅ web tier พร้อม — ทำ AMI จากเครื่องนี้ได้เลย"
