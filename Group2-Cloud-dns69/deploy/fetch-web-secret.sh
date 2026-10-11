#!/bin/bash
# ดึงเฉพาะ jwt_secret จาก secret ของ web tier ไปไว้ใน /run (tmpfs หายเมื่อรีบูต)
# web tier มีสิทธิ์อ่านแค่ secret ตัวนี้ — มองไม่เห็นรหัสผ่านฐานข้อมูลเลย
set -euo pipefail
source /etc/dns69/web.env
aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$WEB_SECRET_ID" \
  --query SecretString --output text \
  | python3 -c 'import json,sys; print("JWT_SECRET=" + json.load(sys.stdin)["jwt_secret"])' \
  > /run/dns69-web-secret.env
chmod 600 /run/dns69-web-secret.env
