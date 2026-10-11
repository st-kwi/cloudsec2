#!/bin/bash
# ใช้กับ Ubuntu 24.04 — รันด้วย root ผ่าน SSM Session Manager (sudo -i)
# ติดตั้ง Node 22, AWS CLI, ผู้ใช้ระบบ dns69 แล้วดึงโค้ดจาก S3
set -euo pipefail
: "${RELEASE_S3:?ต้องตั้ง RELEASE_S3 เช่น s3://dns69-release-xxxx/dns69.zip}"

apt-get update -y
apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs unzip python3
snap install aws-cli --classic || true

id dns69 >/dev/null 2>&1 || useradd --system --home /opt/dns69 --shell /usr/sbin/nologin dns69
mkdir -p /opt/dns69 /etc/dns69

# ดึงโค้ดจาก S3 ด้วย IAM role ของเครื่อง — ไม่ต้องมี GitHub token บน EC2
aws s3 cp "$RELEASE_S3" /tmp/dns69.zip
rm -rf /opt/dns69/*
unzip -q /tmp/dns69.zip -d /opt/dns69
chmod +x /opt/dns69/deploy/*.sh
