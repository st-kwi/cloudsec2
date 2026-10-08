# APEX PREDICT — Cloud Sports Prediction & Betting Platform
## Secure 3-Tier Web Application on AWS (Term Project Group 2)

เอกสารแนะนำโครงการและ **คู่มือขั้นตอนการนำโค้ดขึ้นระบบคลาวด์ AWS (AWS Code Deployment Guide)** ภายใต้สถาปัตยกรรม **Secure 3-Tier Web Application** ที่สอดคล้องตามมาตรฐาน **AWS Well-Architected Framework (Security Pillar)**, **CIS AWS Foundations Benchmark** และ **OWASP Top 10**

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมสถาปัตยกรรมระบบ (Architecture Overview)](#1-ภาพรวมสถาปัตยกรรมระบบ-architecture-overview)
2. [การทดสอบและรันระบบบนเครื่อง Local (Quick Start)](#2-การทดสอบและรันระบบบนเครื่อง-local-quick-start)
3. [ขั้นตอนการนำโค้ดขึ้น AWS อย่างละเอียด (Step-by-Step Code Deployment)](#3-ขั้นตอนการนำโค้ดขึ้น-aws-อย่างละเอียด-step-by-step-code-deployment)
   - [Step 1: เตรียมโค้ดขึ้น GitHub Repository](#step-1-เตรียมโค้ดขึ้น-github-repository)
   - [Step 2: Deploy Tier 3 — Database Tier (RDS PostgreSQL Multi-AZ)](#step-2-deploy-tier-3--database-tier-rds-postgresql-multi-az)
   - [Step 3: Deploy Tier 2 — App Tier (Node.js Backend ใน Private Subnet)](#step-3-deploy-tier-2--app-tier-nodejs-backend-ใน-private-subnet)
   - [Step 4: Deploy Tier 1 — Web Tier (Nginx Reverse Proxy ใน Public Subnet)](#step-4-deploy-tier-1--web-tier-nginx-reverse-proxy-ใน-public-subnet)
   - [Step 5: ตั้งค่า Edge Tier (Public ALB, ACM TLS 1.3, AWS WAF, Route 53)](#step-5-ตั้งค่า-edge-tier-public-alb-acm-tls-13-aws-waf-route-53)
4. [การตรวจสอบและทดสอบความถูกต้องของระบบ (Verification)](#4-การตรวจสอบและทดสอบความถูกต้องของระบบ-verification)
5. [เทคนิคขั้นสูง: การทำ EC2 Golden AMI Snapshot](#5-เทคนิคขั้นสูง-การทำ-ec2-golden-ami-snapshot)
6. [ตารางพอร์ตและความปลอดภัย (Chained Security Groups Matrix)](#6-ตารางพอร์ตและความปลอดภัย-chained-security-groups-matrix)
7. [ข้อมูลบัญชีสำหรับทดสอบระบบ (Demo Accounts)](#7-ข้อมูลบัญชีสำหรับทดสอบระบบ-demo-accounts)

---

## 1. ภาพรวมสถาปัตยกรรมระบบ (Architecture Overview)

ระบบถูกออกแบบให้แยกสัดส่วนการทำงานออกเป็น 3 ระดับอย่างเด็ดขาดข้าม **2 Availability Zones (`ap-southeast-1a`, `ap-southeast-1b`)** บน AWS VPC (`10.0.0.0/16`):

```text
[ Users / Internet ] 
         │ (HTTPS : 443)
         ▼
[ AWS Route 53 ] ──► [ AWS WAF (Web ACL) ] ──► [ Public ALB (apex-public-alb) ]
                                                        │ (HTTP : 80 / sg-alb -> sg-web)
                                                        ▼
                                       ┌───────────────────────────────────┐
                                       │ Tier 1: Web Tier (Public Subnets) │
                                       │ • EC2 Nginx Reverse Proxy (ASG)   │
                                       └─────────────────┬─────────────────┘
                                                         │ (TCP : 5000 / sg-web -> sg-int-alb)
                                                         ▼
                                       ┌───────────────────────────────────┐
                                       │ Internal ALB (apex-internal-alb)  │
                                       └─────────────────┬─────────────────┘
                                                         │ (TCP : 5000 / sg-int-alb -> sg-app)
                                                         ▼
                                       ┌────────────────────────────────────┐
                                       │ Tier 2: App Tier (Private Subnets) │
                                       │ • EC2 Node.js Betting Engine (ASG) │
                                       │ • ออกเน็ตผ่าน NAT Gateway (Egress) │
                                       └─────────────────┬──────────────────┘
                                                         │ (TCP : 5432 / sg-app -> sg-db)
                                                         ▼
                                       ┌─────────────────────────────────────┐
                                       │ Tier 3: DB Tier (Isolated Subnets)  │
                                       │ • Amazon RDS PostgreSQL (Multi-AZ)  │
                                       │ • ตัดขาดจากเน็ต 100% (Local only)    │
                                       └─────────────────────────────────────┘
```

* **Zero Public SSH:** ปิดพอร์ต 22 (SSH) ในทุก Security Group 100% โดยผู้ดูแลระบบเข้าบริหารจัดการผ่าน **AWS Systems Manager (SSM) Session Manager**
* **In-Transit & At-Rest Encryption:** เข้ารหัส HTTPS TLS 1.3 ผ่าน ACM และเข้ารหัส RDS/EBS ด้วย **AWS KMS (AES-256)**

---

## 2. การทดสอบและรันระบบบนเครื่อง Local (Quick Start)

สามารถรันระบบจำลองบนเครื่อง Local ได้ด้วยคำสั่งเดียว:

```powershell
# เปิด PowerShell ที่โฟลเดอร์โปรเจกต์
node backend\src\server-standalone.js
```

เมื่อรันสำเร็จ สามารถเข้าใช้งานได้ทันทีผ่าน 3 URL:
1. **หน้าแอปพลิเคชันทายผลกีฬา:** [http://localhost:5000](http://localhost:5000)
2. **หน้าคู่มือติดตั้ง AWS และรวบรวมภาพ Screenshot (S01–S22):** [http://localhost:5000/deployment-guide.html](http://localhost:5000/deployment-guide.html)
3. **หน้ารายงานสถาปัตยกรรมคลาวด์ฉบับสมบูรณ์:** [http://localhost:5000/report/cloud-security-report-gemini.html](http://localhost:5000/report/cloud-security-report-gemini.html)

---

## 3. ขั้นตอนการนำโค้ดขึ้น AWS อย่างละเอียด (Step-by-Step Code Deployment)

### Step 1: เตรียมโค้ดขึ้น GitHub Repository

นำซอร์สโค้ดจากเครื่องขึ้น GitHub เพื่อเป็นศูนย์กลางให้เครื่อง EC2 ดึงโค้ดไปติดตั้ง:

```bash
git init
git add .
git commit -m "feat: complete secure 3-tier sports prediction platform"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/cloudsec2.git
git push -u origin main
```

---

### Step 2: Deploy Tier 3 — Database Tier (RDS PostgreSQL Multi-AZ)

ฐานข้อมูล **Amazon RDS** อยู่ใน **Isolated Subnet (`10.0.20.0/24`, `10.0.21.0/24`)** ซึ่งไม่มีทางออกอินเทอร์เน็ตและไม่มี Public IP ดังนั้นจึงไม่สามารถต่อจากคอมพิวเตอร์ภายนอกได้ตรงๆ 

#### วิธีการ Deploy Schema (`database/init.sql`):
1. สร้างฐานข้อมูล RDS PostgreSQL บน AWS Console:
   * **DB Identifier:** `apex-predict-db`
   * **Engine:** PostgreSQL 15 หรือ 16
   * **Multi-AZ:** เลือก Multi-AZ DB Instance (Synchronous Standby)
   * **VPC:** `apex-predict-vpc`
   * **DB Subnet Group:** `apex-db-subnet-group` (Isolated Subnets)
   * **Public Access:** **No**
   * **VPC Security Group:** เลือก `sg-db`
   * **Master Username:** `apex_admin`
   * **Master Password:** `SecurePassword2026!`
   * **KMS Encryption:** Enabled (`aws/rds`)
2. รอให้ RDS สถานะเปลี่ยนเป็น **Available** และคัดลอกค่า **Endpoint** (เช่น `apex-predict-db.c123456789.ap-southeast-1.rds.amazonaws.com`)
3. เมื่อสร้างเครื่อง EC2 App Server (ใน Step 3) เสร็จแล้ว ให้รีโมตเข้าเครื่อง App Server ผ่าน **AWS Systems Manager (SSM) Session Manager** แล้วรันคำสั่ง Execute ไฟล์ `init.sql`:
   ```bash
   cd /opt/cloudsec2/database
   PGPASSWORD='SecurePassword2026!' psql -h <RDS_ENDPOINT> -U apex_admin -d apex_predict_db -f init.sql
   ```

---

### Step 3: Deploy Tier 2 — App Tier (Node.js Backend ใน Private Subnet)

App Server ทำงานอยู่ใน **Private Subnet (`10.0.10.0/24`, `10.0.11.0/24`)** ไม่มี Public IP โดยจะออกอินเทอร์เน็ตผ่าน **NAT Gateway** เพื่อดึงโค้ดจาก GitHub และอัปเดตแพ็กเกจ

#### 3.1 สร้าง Internal Application Load Balancer (Internal ALB):
1. ไปที่ **EC2 -> Load Balancers -> Create load balancer** -> เลือก Application Load Balancer
   * **Name:** `apex-internal-alb`
   * **Scheme:** **Internal** *(สำคัญ: ไม่เปิดสู่อินเทอร์เน็ต)*
   * **VPC:** `apex-predict-vpc`
   * **Subnets:** เลือก `private-app-subnet-2a` และ `private-app-subnet-2b`
   * **Security groups:** เลือก `sg-int-alb`
2. **Listener:** HTTP Port `5000` -> Forward to Target Group `apex-app-tg`
   * **Target Type:** Instances
   * **Protocol / Port:** HTTP `5000`
   * **Health Check Path:** `/api/health`
3. บันทึกค่า **DNS Name ของ Internal ALB** ไว้ (เช่น `internal-apex-internal-alb-12345.ap-southeast-1.elb.amazonaws.com`)

#### 3.2 สร้าง Launch Template สำหรับ App Tier (`apex-app-template`):
1. ไปที่ **EC2 -> Launch Templates -> Create launch template**
   * **Name:** `apex-app-template`
   * **AMI:** Amazon Linux 2023
   * **Instance Type:** `t3.micro`
   * **Key pair:** *Don't include in launch template* (เพราะเราใช้ SSM)
   * **Security groups:** เลือก `sg-app`
   * **IAM instance profile:** เลือก `ApexEC2InstanceProfile` (มีนโยบาย SSM + CloudWatch)
2. เลื่อนลงไปที่ **Advanced details -> User data** วางสคริปต์นี้:

```bash
#!/bin/bash
set -euxo pipefail

# 1. ติดตั้ง Node.js, Git และ PostgreSQL Client
dnf update -y
dnf install -y nodejs git postgresql15

# 2. ดึงโค้ดโปรเจกต์จาก GitHub (ออกเน็ตผ่าน NAT Gateway)
git clone https://github.com/<YOUR_GITHUB_USERNAME>/cloudsec2.git /opt/cloudsec2

# 3. สร้างไฟล์ Environment Variables
cat > /etc/apex-app.env <<'EOF'
PORT=5000
NODE_ENV=production
JWT_SECRET=super_secure_aws_term_project_secret_key_2026
DB_HOST=<YOUR_RDS_ENDPOINT>
DB_PORT=5432
DB_NAME=apex_predict_db
DB_USER=apex_admin
DB_PASSWORD=SecurePassword2026!
EOF
chmod 600 /etc/apex-app.env

# 4. ตั้งค่า systemd ให้รัน Node.js เป็น Background Service อัตโนมัติ
cat > /etc/systemd/system/apex-app.service <<'EOF'
[Unit]
Description=Apex Predict App Tier Engine
After=network-online.target

[Service]
WorkingDirectory=/opt/cloudsec2/backend
EnvironmentFile=/etc/apex-app.env
ExecStart=/usr/bin/node src/server-standalone.js
Restart=always
User=ec2-user

[Install]
WantedBy=multi-user.target
EOF

# 5. สั่งเริ่มการทำงาน Service
systemctl daemon-reload
systemctl enable --now apex-app
```

#### 3.3 สร้าง Auto Scaling Group (`apex-app-asg`):
* **Launch Template:** `apex-app-template`
* **VPC:** `apex-predict-vpc`
* **Subnets:** `private-app-subnet-2a` และ `private-app-subnet-2b`
* **Load balancing:** Attach to an existing target group -> เลือก `apex-app-tg`
* **Group size:** Desired: `2`, Min: `2`, Max: `6`
* **Scaling policy:** Target Tracking (CPU Utilization `75%`)

---

### Step 4: Deploy Tier 1 — Web Tier (Nginx Reverse Proxy ใน Public Subnet)

Web Server ทำหน้าที่เสิร์ฟไฟล์ Static Web (HTML/CSS/JS) และส่งต่อคำขอ `/api/*` ไปยัง Internal ALB

#### 4.1 สร้าง Launch Template สำหรับ Web Tier (`apex-web-template`):
1. ไปที่ **EC2 -> Launch Templates -> Create launch template**
   * **Name:** `apex-web-template`
   * **AMI:** Amazon Linux 2023
   * **Instance Type:** `t3.micro`
   * **Security groups:** เลือก `sg-web`
   * **IAM instance profile:** เลือก `ApexEC2InstanceProfile`
2. เลื่อนลงไปที่ **Advanced details -> User data** วางสคริปต์นี้:

```bash
#!/bin/bash
set -euxo pipefail

# 1. ติดตั้ง Nginx และ Git
dnf update -y
dnf install -y nginx git

# 2. ดึงโค้ดโปรเจกต์จาก GitHub
git clone https://github.com/<YOUR_GITHUB_USERNAME>/cloudsec2.git /opt/cloudsec2

# 3. คัดลอกไฟล์หน้าเว็บทั้งหมดไปไว้ที่ Nginx Web Root
mkdir -p /usr/share/nginx/html/report
cp /opt/cloudsec2/frontend/*.html /usr/share/nginx/html/
cp /opt/cloudsec2/report/*.html /usr/share/nginx/html/report/
cp /opt/cloudsec2/report/*.pdf /usr/share/nginx/html/report/

# 4. กำหนดค่า Reverse Proxy ส่งต่อไปยัง Internal ALB
INTERNAL_ALB_DNS="<YOUR_INTERNAL_ALB_DNS>"

cat > /etc/nginx/conf.d/apex.conf <<EOF
server {
    listen 80;
    server_name localhost;

    # Security Headers (OWASP Hardening)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # เสิร์ฟไฟล์ Static หน้าเว็บ
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # ส่งต่อคำขอ API ไปยัง App Tier ผ่าน Internal ALB
    location /api/ {
        proxy_pass http://${INTERNAL_ALB_DNS}:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
    }
}
EOF

# 5. เริ่มต้น Nginx
systemctl enable --now nginx
```

#### 4.2 สร้าง Auto Scaling Group (`apex-web-asg`):
* **Launch Template:** `apex-web-template`
* **Subnets:** `public-subnet-1a` และ `public-subnet-1b`
* **Load balancing:** Attach to Target Group `apex-web-tg` (Port 80)
* **Group size:** Desired: `2`, Min: `2`, Max: `6`

---

### Step 5: ตั้งค่า Edge Tier (Public ALB, ACM TLS 1.3, AWS WAF, Route 53)

1. **ขอใบรับรอง SSL/TLS (ACM):**
   * ไปที่ **AWS Certificate Manager** -> Request a public certificate -> ระบุโดเมนเนม -> Validate ผ่าน Route 53 จนได้สถานะ **Issued**
2. **สร้าง Public Application Load Balancer (`apex-public-alb`):**
   * **Scheme:** **Internet-facing**
   * **VPC:** `apex-predict-vpc` (เลือก `public-subnet-1a` และ `public-subnet-1b`)
   * **Security groups:** `sg-alb`
   * **Listener 1 (HTTP 80):** ตั้งค่า Default Action เป็น **Redirect to HTTPS Port 443 (HTTP 301)**
   * **Listener 2 (HTTPS 443):**
     * Forward to Target Group `apex-web-tg` (Port 80)
     * Security Policy: `ELBSecurityPolicy-TLS13-1-2-2021-06` (TLS 1.3)
     * Default SSL Certificate: เลือกใบรับรองจาก ACM
3. **ผูก AWS WAF Web ACL (`apex-waf-acl`):**
   * สร้าง Web ACL ประเภท Regional (`ap-southeast-1`)
   * เพิ่ม Managed Rules: `AWSManagedRulesCommonRuleSet`, `AWSManagedRulesSQLiRuleSet`, `AWSManagedRulesKnownBadInputsRuleSet`
   * เพิ่ม Rate-based Rule: จำกัด 1,000 คำขอ / 5 นาทีต่อ IP
   * Associated AWS Resources: ผูกเข้ากับ `apex-public-alb`
4. **ตั้งค่า DNS บน Route 53:**
   * สร้าง `A Record` (เปิด Alias) -> ชี้ไปยัง DNS Name ของ `apex-public-alb`

---

## 4. การตรวจสอบและทดสอบความถูกต้องของระบบ (Verification)

เมื่อ Deploy ครบทุก Tier แล้ว ให้ดำเนินการตรวจสอบตามขั้นตอน:

1. **ตรวจสอบสถานะสุขภาพเครื่อง (Health Checks):**
   * ตรวจสอบ Target Group `apex-web-tg` (Port 80) -> สถานะเครื่องต้องขึ้น **Healthy** ทั้ง 2 AZs
   * ตรวจสอบ Target Group `apex-app-tg` (Port 5000) -> สถานะเครื่องต้องขึ้น **Healthy** ทั้ง 2 AZs
2. **ตรวจสอบการเชื่อมต่อ App Tier ผ่าน SSM Session Manager:**
   * บน AWS Console -> EC2 -> เลือก App Instance -> คลิก **Connect -> Session Manager**
   * พิมพ์คำสั่ง:
     ```bash
     curl -i http://localhost:5000/api/health
     ```
     *(ต้องได้รับ HTTP 200 OK และ JSON ระบุสถานะ "UP")*
3. **ตรวจสอบหน้าเว็บผ่าน HTTPS:**
   * เปิดเบราว์เซอร์เข้าที่โดเมนเนมของคุณ (เช่น `https://predict.yourdomain.com/`)
   * ตรวจสอบสัญลักษณ์ **แม่กุญแจเขียว (SSL/TLS 1.3)**
   * ทดสอบ Login ด้วยบัญชี `player_alex` รหัสผ่าน `Password123!`
   * ทดสอบวางเดิมพันคู่บิ๊กแมตช์ เพื่อพิสูจน์ว่า Web Tier ส่งคำขอผ่าน Internal ALB ไปตัดคะแนนที่ App Tier และบันทึกลง RDS PostgreSQL สำเร็จ

---

## 5. เทคนิคขั้นสูง: การทำ EC2 Golden AMI Snapshot

เพื่อความรวดเร็วและเสถียรภาพสูงสุด ไม่ต้องให้เครื่อง EC2 ทำการ `git clone` และดาวน์โหลดโค้ดใหม่ทุกครั้งที่ Auto Scaling ขยายตัว:

1. นำเครื่อง EC2 ต้นแบบ (ที่ติดตั้งโค้ดและรัน Service สำเร็จแล้ว 1 เครื่อง)
2. ไปที่ **EC2 Instances -> Actions -> Image and templates -> Create image**
3. ตั้งชื่อ AMI: `apex-app-golden-ami-v1` (สำหรับ App) และ `apex-web-golden-ami-v1` (สำหรับ Web)
4. อัปเดต Launch Template ให้ชี้มาใช้ AMI ดังกล่าว แทน Amazon Linux 2023 แบบเริ่มต้น

---

## 6. ตารางพอร์ตและความปลอดภัย (Chained Security Groups Matrix)

| Security Group | Tier | Inbound Port | Source ที่อนุญาต | Outbound Destination | วัตถุประสงค์ด้านความปลอดภัย |
|---|---|---|---|---|---|
| `sg-alb` | Public ALB | TCP 443 / 80 | `0.0.0.0/0` (Internet) | TCP 80 ไป `sg-web` | รับเฉพาะทราฟฟิก HTTPS จากภายนอก |
| `sg-web` | Web Tier | TCP 80 | **`sg-alb` เท่านั้น** | TCP 5000 ไป `sg-int-alb`<br>TCP 443 ไป NAT/SSM | ป้องกันไม่ให้ใครยิงตรงหา EC2 Web |
| `sg-int-alb` | Internal ALB | TCP 5000 | **`sg-web` เท่านั้น** | TCP 5000 ไป `sg-app` | รับคำขอ Reverse Proxy ในเน็ตเวิร์กภายใน |
| `sg-app` | App Tier | TCP 5000 | **`sg-int-alb` เท่านั้น** | TCP 5432 ไป `sg-db`<br>TCP 443 ไป NAT Gateway | Backend ซ่อนตัวใน Private Subnet |
| `sg-db` | Database Tier | TCP 5432 | **`sg-app` เท่านั้น** | **Deny All (ลบออกทั้งหมด)** | ฐานข้อมูลตัดขาดจากโลกภายนอก 100% |
| **Admin Access** | ทุก Tier | **ปิด TCP 22 100%** | **ไม่อนุญาตทุกกรณี** | HTTPS 443 ไป AWS SSM | **ขจัดความเสี่ยง SSH Brute-force 100%** |

---

## 7. ข้อมูลบัญชีสำหรับทดสอบระบบ (Demo Accounts)

| บทบาท (Role) | Username | Password | สิทธิ์ตามสถาปัตยกรรม AWS 3-Tier |
|---|---|---|---|
| **ผู้ใช้งานทั่วไป (End User)** | `player_alex` | `Password123!` | เข้าใช้งานหน้าเว็บ ทายผลเดี่ยว/สเต็ป ตรวจสอบแต้มกระเป๋าเงิน |
| **ผู้ดูแลระบบ (App Ops)** | `ops_manager` | `OpsAdmin2026!` | จัดการผลการแข่งขัน อัปเดตค่าน้ำ ดึงข้อมูลผ่าน NAT Gateway |
| **ผู้ตรวจสอบความปลอดภัย (Auditor)** | `sec_auditor` | `AuditSec2026!` | ตรวจสอบ Audit Log, Security Groups Matrix และสถานะระบบ |

---

**จัดทำโดย:** กลุ่ม Group 2 — โครงการ Term Project วิชา Cloud Security Architecture  
**เอกสารอ้างอิงเพิ่มเติม:**
* [คู่มือการติดตั้งบน AWS Console ฉบับเต็ม (Markdown)](AWS_CONSOLE_DEPLOYMENT_GUIDE.md)
* [เอกสารการวิเคราะห์สถาปัตยกรรมและความปลอดภัย (Markdown)](ARCHITECTURE_AND_SECURITY.md)
* [หน้ารายงานสถาปัตยกรรมคลาวด์และฟอร์มสมาชิก Group 2 (HTML)](report/cloud-security-report-gemini.html)
* [หน้าเว็บคู่มือติดตั้งแบบโต้ตอบและเก็บภาพ Screenshot (HTML)](frontend/deployment-guide.html)
