# Secure 3-Tier Web Application on AWS
## ระบบทายผลกีฬา (Cloud Sports Prediction & Betting Platform)
### เอกสารการออกแบบสถาปัตยกรรมคลาวด์ ความปลอดภัย และโครงสร้างระบบ (Cloud Security Architecture Report)

---

## 1. บทสรุปผู้บริหาร (Executive Summary)

โครงการนี้เป็นการออกแบบและพัฒนาเว็บแอปพลิเคชัน **ระบบทายผลกีฬา (Sports Prediction / Betting Platform)** ภายใต้สถาปัตยกรรม **3-Tier Web Application บน Amazon Web Services (AWS)** โดยมุ่งเน้น **Cloud Security Best Practices** สอดคล้องตามเกณฑ์มาตรฐานความปลอดภัยระดับสากล เช่น **AWS Well-Architected Framework (Security Pillar)**, **CIS AWS Foundations Benchmark**, และ **OWASP Top 10**

ระบบแยกสัดส่วนการทำงานออกเป็น 3 ระดับอย่างเด็ดขาด (Web Tier, App Tier, DB Tier) ข้าม Availability Zones เพื่อการรองรับ High Availability (HA), Fault Tolerance, และ Auto-scaling พร้อมมาตรการ **Zero Trust Network Access**, การปิดพอร์ตบริหารจัดการภายนอก (Zero Public SSH), และการเข้ารหัสข้อมูลทั้งในขณะพัก (At-Rest) และระหว่างส่ง (In-Transit)

---

## 2. แผนผังและสถาปัตยกรรม 3-Tier บน AWS (Architecture Design)

```
                              [ Users / Internet ]
                                       │
                                       ▼ (HTTPS : 443)
                         ┌───────────────────────────┐
                         │   Route 53 (DNS Service)  │
                         └─────────────┬─────────────┘
                                       │
                                       ▼ (HTTPS : 443)
                         ┌───────────────────────────┐
                         │   AWS WAF (Web ACLs)      │
                         │   - SQLi / XSS Inspection │
                         │   - Rate Limiting Shield  │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
  ═════════════════════════════ VPC: 10.0.0.0/16 ══════════════════════════════
  │                                                                            │
  │  [ PUBLIC SUBNETS ] (AZ-a: 10.0.1.0/24 | AZ-b: 10.0.2.0/24)                 │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │            Application Load Balancer (ALB) - Multi-AZ                │  │
  │  │            • SSL/TLS Termination via ACM (TLS 1.3)                   │  │
  │  └──────────────────────────────────┬───────────────────────────────────┘  │
  │                                     │                                      │
  │                     ┌───────────────┴───────────────┐                      │
  │                     ▼ (HTTP : 80 / sg-alb)          ▼                      │
  │             ┌───────────────┐               ┌───────────────┐              │
  │             │ EC2 Web (AZ-a)│               │ EC2 Web (AZ-b)│              │
  │             │ Nginx Proxy   │ ◄───[ASG]───► │ Nginx Proxy   │              │
  │             └───────┬───────┘               └───────┬───────┘              │
  │                     │                               │                      │
  │  ═══════════════════╪═══════════════════════════════╪════════════════════  │
  │  [ PRIVATE APP SUBNETS ] (AZ-a: 10.0.10.0/24 | AZ-b: 10.0.11.0/24)        │
  │                     └───────────────┬───────────────┘                      │
  │                                     ▼ (Custom TCP : 5000 / sg-web)         │
  │             ┌───────────────────────────────────────────────┐              │
  │             │      Internal App Tier Auto Scaling Group     │              │
  │             │    ┌───────────────────┐ ┌───────────────────┐│              │
  │             │    │  EC2 App 1 (AZ-a) │ │  EC2 App 2 (AZ-b) ││              │
  │             │    │  Node.js API      │ │  Node.js API      ││              │
  │             │    │  (Betting Engine) │ │  (Betting Engine) ││              │
  │             │    └─────────┬─────────┘ └─────────┬─────────┘│              │
  │             └──────────────┼─────────────────────┼──────────┘              │
  │                            │                     │                         │
  │  ══════════════════════════╪═════════════════════╪═══════════════════════  │
  │  [ ISOLATED DB SUBNETS ] (AZ-a: 10.0.20.0/24 | AZ-b: 10.0.21.0/24)         │
  │                            └──────────┬──────────┘                         │
  │                                       ▼ (PostgreSQL : 5432 / sg-app)       │
  │             ┌─────────────────────────────────────────────────────────┐    │
  │             │               Amazon RDS (PostgreSQL Multi-AZ)          │    │
  │             │    ┌──────────────────┐      ┌────────────────────┐     │    │
  │             │    │   Primary (AZ-a) │ ───► │ Synchronous Standby│     │    │
  │             │    │   (Read/Write)   │ (Sync│   Replica (AZ-b)   │     │    │
  │             │    └──────────────────┘ Repl)└────────────────────┘     │    │
  │             │    • Encrypted at Rest (AWS KMS CMK AES-256)            │    │
  │             └─────────────────────────────────────────────────────────┘    │
  │                                                                            │
  ══════════════════════════════════════════════════════════════════════════════
                                       ▲
                                       │ (HTTPS Outbound for Updates/APIs)
                         ┌─────────────┴─────────────┐
                         │  NAT Gateway (in Public)  │ ──► [ Internet Gateway ]
                         └───────────────────────────┘
```

---

## 3. การออกแบบเครือข่ายและการแบ่ง Subnet (VPC & Subnetting)

| Tier / ชั้นงาน | Subnet Type | Availability Zone | CIDR Block | Route Table Target | การเข้าถึงอินเทอร์เน็ต |
|---|---|---|---|---|---|
| **Edge / ALB & Web** | Public Subnet 1 | ap-southeast-1a | `10.0.1.0/24` | Internet Gateway (`igw-xxxx`) | เข้าได้โดยตรงผ่าน Public IP / DNS |
| **Edge / ALB & Web** | Public Subnet 2 | ap-southeast-1b | `10.0.2.0/24` | Internet Gateway (`igw-xxxx`) | รองรับทราฟฟิกจาก ALB ข้าม AZ |
| **App Tier** | Private Subnet 1 | ap-southeast-1a | `10.0.10.0/24` | NAT Gateway (`nat-xxxx`) | **ไม่มี Public IP**, ออกเน็ตทางเดียวผ่าน NAT |
| **App Tier** | Private Subnet 2 | ap-southeast-1b | `10.0.11.0/24` | NAT Gateway (`nat-xxxx`) | **ไม่มี Public IP**, ออกเน็ตทางเดียวผ่าน NAT |
| **DB Tier** | Isolated Subnet 1 | ap-southeast-1a | `10.0.20.0/24` | Local VPC เท่านั้น (`10.0.0.0/16`) | **ตัดขาดจากอินเทอร์เน็ตโดยสิ้นเชิง** |
| **DB Tier** | Isolated Subnet 2 | ap-southeast-1b | `10.0.21.0/24` | Local VPC เท่านั้น (`10.0.0.0/16`) | **ตัดขาดจากอินเทอร์เน็ตโดยสิ้นเชิง** |

---

### แผนผังโครงสร้างไอพี และ Routing Table (Mermaid Graph TD)

```mermaid
graph TD
    subgraph Internet_Zone ["อินเทอร์เน็ตภายนอก (External Traffic)"]
        UserClients["ผู้ใช้งานทั่วไป (0.0.0.0/0)"]
    end

    subgraph AWS_VPC ["AWS VPC: 10.0.0.0/16"]
        
        IGW["Internet Gateway (igw-xxxx)"]
        UserClients -->|HTTPS: 443| IGW

        subgraph Public_Tier ["1. Public Tier (ALB & Web Servers)"]
            RTB_Public["Public Route Table (rtb-public)\n• 10.0.0.0/16 -> local\n• 0.0.0.0/0 -> igw-xxxx"]
            IGW --- RTB_Public
            
            Subnet_Pub_A["Public Subnet AZ-a (10.0.1.0/24)\n• ALB ENI-a\n• NAT Gateway (10.0.1.50)\n• EC2 Web-1 (10.0.1.10)"]
            Subnet_Pub_B["Public Subnet AZ-b (10.0.2.0/24)\n• ALB ENI-b\n• EC2 Web-2 (10.0.2.10)"]
            
            RTB_Public --> Subnet_Pub_A
            RTB_Public --> Subnet_Pub_B
        end

        subgraph Private_App_Tier ["2. Private App Tier (Business Logic)"]
            RTB_App["Private App Route Table (rtb-private-app)\n• 10.0.0.0/16 -> local\n• 0.0.0.0/0 -> nat-xxxx"]
            
            Subnet_App_A["Private App Subnet AZ-a (10.0.10.0/24)\n• EC2 App-1 (10.0.10.15)"]
            Subnet_App_B["Private App Subnet AZ-b (10.0.11.0/24)\n• EC2 App-2 (10.0.11.15)"]
            
            RTB_App --> Subnet_App_A
            RTB_App --> Subnet_App_B
        end

        subgraph Isolated_DB_Tier ["3. Isolated DB Tier (Database Multi-AZ)"]
            RTB_DB["Isolated DB Route Table (rtb-isolated-db)\n• 10.0.0.0/16 -> local\n(ไม่มี 0.0.0.0/0 ตัดขาดเน็ต 100%)"]
            
            Subnet_DB_A["Isolated DB Subnet AZ-a (10.0.20.0/24)\n• RDS Primary (10.0.20.50)"]
            Subnet_DB_B["Isolated DB Subnet AZ-b (10.0.21.0/24)\n• RDS Standby (10.0.21.50)"]
            
            RTB_DB --> Subnet_DB_A
            RTB_DB --> Subnet_DB_B
        end

        %% Internal Traffic Flows
        Subnet_Pub_A -->|Port 5000: Internal API| Subnet_App_A
        Subnet_Pub_B -->|Port 5000: Internal API| Subnet_App_B
        
        Subnet_App_A -->|Port 5432: PostgreSQL| Subnet_DB_A
        Subnet_App_B -->|Port 5432: PostgreSQL| Subnet_DB_A
        
        Subnet_DB_A -.->|Sync Replication| Subnet_DB_B
        
        %% Outbound NAT Flow
        Subnet_App_A -.->|Outbound Updates| RTB_App
        RTB_App -.->|ชี้ Default Route| Subnet_Pub_A
    end

---

## 4. Security Groups Matrix & กลยุทธ์การกำหนดพอร์ต (Port Strategy)

ระบบใช้หลักการ **Least Privilege Network Access (Chained Security Groups)** โดยไม่อนุญาตให้อ้างอิง IP แบบกว้างๆ ภายในโครงสร้าง แต่จะผูกสิทธิการเข้าถึงด้วย **Security Group ID ของ Tier ก่อนหน้าเท่านั้น**

| Security Group ID | Tier | Inbound Rule (พอร์ต / โปรโตคอล) | Source (ต้นทางที่อนุญาต) | Outbound Rule (ปลายทาง) | เหตุผลความปลอดภัย (Security Rationale) |
|---|---|---|---|---|---|
| `sg-alb` | Load Balancer | **TCP 443 (HTTPS)** | `0.0.0.0/0` (Anywhere) | TCP 80 ไปยัง `sg-web` | รับเฉพาะ HTTPS จากผู้ใช้ มี AWS WAF ตรวจจับ Payload |
| `sg-alb` | Load Balancer | TCP 80 (HTTP) | `0.0.0.0/0` (Anywhere) | - | Redirect HTTP -> HTTPS อัตโนมัติ |
| `sg-web` | Web Tier (EC2) | **TCP 80** | **`sg-alb` เท่านั้น** | TCP 5000 ไปยัง `sg-app` | ห้ามบุคคลภายนอกเข้าถึง EC2 Web โดยตรง ป้องกัน Port Scan |
| `sg-app` | App Tier (EC2) | **TCP 5000** (API) | **`sg-web` เท่านั้น** | TCP 5432 ไปยัง `sg-db` | Application Engine ซ่อนอยู่ใน Private Subnet ไม่เปิดสู่โลกภายนอก |
| `sg-db` | Database (RDS) | **TCP 5432** (PostgreSQL) | **`sg-app` เท่านั้น** | ปิดทั้งหมด (Deny All) | ป้องกัน Database Exfiltration และตัดช่องทางการแฮกตรง |
| **Admin Access** | ทุก Tier | **ปิด TCP 22 (SSH)** | **ไม่อนุญาต 0.0.0.0/0** | HTTPS 443 ไปยัง AWS SSM | **ตัดความเสี่ยง Brute-force SSH 100%** โดยใช้ AWS Systems Manager |

### ทำไมถึงยกเลิก Bastion Host / SSH (Port 22) และใช้ AWS Systems Manager (SSM)?
1. **Zero Open Ports**: ไม่จำเป็นต้องเปิดพอร์ต 22 หรือทิ้ง Public IP ไว้สำหรับ Bastion Host ซึ่งเป็นเป้าหมายยอดนิยมของการโจมตีแบบ Brute-force หรือ Zero-day exploit
2. **Centralized Identity & Audit**: ผู้ดูแลระบบยืนยันตัวตนผ่าน AWS IAM และ MFA
3. **Session Logging**: บันทึกคำสั่งที่พิมพ์ในเทอร์มินัลลง AWS CloudWatch Logs และ S3 Bucket โดยไม่สามารถลบประวัติได้

---

## 5. Security Frameworks & เหตุผลในการเลือกใช้ (Security Rationale)

| Security Framework | การประยุกต์ใช้ในโครงการนี้ | วัตถุประสงค์เพื่อปกป้องระบบ |
|---|---|---|
| **AWS Well-Architected (Security Pillar)** | • Apply Security at All Layers (Defense-in-Depth)<br>• Least Privilege IAM Roles<br>• Automate Security Best Practices | เป็นกรอบอ้างอิงหลักของการตรวจประเมินคลาวด์ มั่นใจได้ว่าไม่มี Misconfiguration |
| **CIS AWS Foundations Benchmark** | • ปิดการใช้ Root Account ในการรันงานทั่วไป<br>• บังคับเปิดใช้งาน CloudTrail ในทุก Region<br>• บังคับเปิดใช้ Multi-Factor Authentication (MFA) | ลดความเสี่ยงจากการถูกขโมยสิทธิ์ Admin และเพิ่มความสอดคล้องตามเกณฑ์ Audit |
| **OWASP Top 10 (App Tier Defense)** | • **A01 Broken Access Control:** ตรวจสิทธิ์ JWT ในทุก Transaction<br>• **A03 Injection:** ใช้ Prepared Statements ป้องกัน SQL Injection<br>• **A04 Insecure Design:** มี Rate Limiter ป้องกันการยิงสแปมทายผล | ป้องกันช่องโหว่ระดับ Application Logic ในการคำนวณแต้มและทายผลกีฬา |
| **NIST SP 800-53 / NIST CSF** | • **Identify & Protect:** แบ่งโซน Network Segmentation<br>• **Detect:** AWS GuardDuty วิเคราะห์ทราฟฟิกผิดปกติ<br>• **Recover:** RDS Automated Backups ข้าม AZs | เสริมความแข็งแกร่งให้กระบวนการ Incident Response และ Business Continuity |

---

## 6. กลยุทธ์การป้องกันความปลอดภัยเชิงลึก (Defense-in-Depth Strategy)

1. **การปกป้องข้อมูล (Data Protection & Cryptography):**
   - **In-Transit:** บังคับใช้ TLS 1.3 บน ALB ผ่าน SSL Certificate จาก AWS Certificate Manager (ACM) และการเชื่อมต่อระหว่าง App -> Database เข้ารหัสด้วย SSL/TLS (`sslmode=require`)
   - **At-Rest:** ข้อมูลใน Amazon RDS และ EBS Volume บน EC2 ถูกเข้ารหัสด้วย **AWS KMS (Key Management Service)** อัลกอริทึม AES-256
2. **การจัดการสิทธิ์และข้อมูลลับ (IAM & Secrets Management):**
   - EC2 แต่ละเครื่องจะได้รับ **IAM Role / Instance Profile** ที่มีนโยบาย Least Privilege เท่านั้น **ไม่มีการฮาร์ดโค้ด AWS Access Key / Secret Key ในโค้ดหรือเซิร์ฟเวอร์เด็ดขาด**
   - รหัสผ่านฐานข้อมูลและ JWT Secret Key ถูกเก็บใน **AWS Secrets Manager** พร้อมตั้งเวลาหมุนเวียนคีย์ (Automatic Key Rotation)
3. **การป้องกัน Race Condition & Data Integrity ในระบบทายผล (Single & Parlay จดโพย):**
   - การตัดแต้มและการวางเดิมพันใน App Tier ทำงานผ่าน **ACID Transactions (`SELECT ... FOR UPDATE` หรือ Concurrency Mutex Lock)** เพื่อป้องกันปัญหา Double Spending เมื่อผู้ใช้ส่งคำขอพร้อมกันหลายครั้ง
   - ระบบจดโพยชุด (Parlay / Multi-bet) มีการคำนวณอัตราต่อรองทวีคูณ (Compounded Odds) แบบ Atomic และล็อกกระเป๋าเงินจนกว่าการสร้างตั๋วโพยจะเสร็จสมบูรณ์
4. **การเชื่อมต่อภายนอกผ่าน AWS NAT Gateway (Egress-Only Architecture):**
   - ในการดึงข้อมูลตารางแข่งขันสดจากผู้ให้บริการภายนอก (External Sports Data Provider) ตัว EC2 App Server (Private Subnet: `10.0.10.0/24`) จะส่งคำขอขาออก (Outbound HTTPS) ผ่าน **NAT Gateway (`10.0.1.50`)** ใน Public Subnet
   - โลกภายนอกไม่สามารถยิงคำขอขาเข้า (Inbound) มายัง App Tier ได้โดยเด็ดขาด ทำให้ระบบรักษาความปลอดภัยของ Private Tier ไว้ได้ 100%

---

## 7. โครงสร้างบทบาทผู้ใช้งาน (User Persona vs AWS 3-Tier Access Matrix)

เพื่อจำลองการแบ่งแยกหน้าที่ตามหลัก **Separation of Duties (SoD)** ระบบกำหนด User Persona ออกเป็น 3 บทบาทหลักที่สอดคล้องกับเลเยอร์ของ AWS ดังนี้:

| User Persona | บทบาทและหน้าที่ | สิทธิ์การเข้าถึง Web Tier (Public) | สิทธิ์การเข้าถึง App Tier (Private) | สิทธิ์การเข้าถึง DB Tier (Isolated) | กลไกความปลอดภัยและช่องทางที่อนุญาต |
|---|---|---|---|---|---|
| **1. ผู้ใช้ทั่วไป (End User / `player_alex`)** | เข้าเล่นหน้าบ้าน ทายผลคู่เดี่ยว/จดโพย ตรวจสอบคะแนนกระเป๋าเงิน | **อนุญาต** (HTTPS: 443 ผ่าน ALB) | **ห้ามเข้าถึงโดยตรง** (ถูกซ่อนไว้ใน Private Subnet) | **ห้ามเข้าถึงโดยตรง** (ตัดขาดอินเทอร์เน็ต) | เข้าผ่าน Web UI, คัดกรองด้วย AWS WAF, ยืนยันตัวตนด้วย JWT Token |
| **2. ผู้ดูแลระบบปฏิบัติการ (App Ops / `ops_manager`)** | จัดการตารางแข่ง ค่าน้ำ สรุปผลการแข่งขัน แจกแต้มรางวัล และดึง Feed ภายนอก | **อนุญาต** | **อนุญาต** ผ่าน Internal API และ **AWS Systems Manager (SSM)** | **ไม่อนุญาตแก้ไขตรง** (ต้องผ่าน App Engine เท่านั้น) | รีโมตเข้าบำรุงรักษาผ่าน SSM Session Manager โดย**ไม่เปิดพอร์ต 22 SSH** |
| **3. ผู้ตรวจสอบความปลอดภัย (CloudSec Auditor / `sec_auditor`)** | ตรวจสอบช่องโหว่ Audit Log การไหลของทราฟฟิก และความถูกต้องของสถาปัตยกรรม | **Read-Only** (ตรวจสอบ Log) | **Read-Only** (ตรวจสอบ Log & Metrics) | **Read-Only** (ตรวจสอบ Database Audit Ledger) | ตรวจสอบผ่าน AWS CloudTrail, GuardDuty, VPC Flow Logs, และ CloudWatch Logs |

---

## 7. การตรวจสอบ, บันทึก Log และการแจ้งเตือน (Monitoring & Logging)

1. **AWS CloudTrail:** บันทึกทุก API Call ที่เกิดขึ้นในระดับบัญชี AWS ป้องกันการเปลี่ยนแปลงโครงสร้างโดยไม่ได้รับอนุญาต
2. **Amazon CloudWatch:**
   - ติดตั้ง CloudWatch Unified Agent บน EC2 เพื่อมอนิเตอร์ CPU, RAM, Disk, และ Nginx Access Logs
   - **CloudWatch Alarms:**
     - เตือนเมื่อ CPU Utilization > 75% เป็นเวลา 5 นาที (ส่งสัญญาณขยาย Instance ผ่าน ASG)
     - เตือนเมื่อ HTTP 5XX Error Rate > 1% (แจ้งเตือนทีมวิศวกรผ่าน SNS ไปยัง Email/Telegram/Slack)
     - เตือนเมื่อ RDS Storage ต่ำกว่า 20%
3. **Amazon GuardDuty:** ตรวจจับภัยคุกคามอัจฉริยะ (Intelligent Threat Detection) ตรวจจับพฤติกรรมผิดปกติ เช่น มี EC2 พยายามเชื่อมต่อไปยัง Bitcoin Mining Pool หรือการทำ Reconnaissance จากภายนอก
4. **VPC Flow Logs:** บันทึก IP Traffic Metadata ทั้งหมดส่งเข้า S3 เพื่อการทำ Forensic Analysis ย้อนหลัง

---

## 8. แผนการสำรองข้อมูลและการกู้คืน (Backup & Disaster Recovery)

1. **Amazon RDS Automated Backup:**
   - เปิดระบบ Automated Backup เก็บ Retention Period ไว้ 7 วัน
   - รองรับ **Point-in-Time Recovery (PITR)** ย้อนกลับไปได้ระดับวินาที
   - เปิดฟีเจอร์ **Multi-AZ Synchronous Replication** เพื่อให้สลับเครื่องอัตโนมัติ (Automated Failover) หากเกิดเหตุภัยพิบัติใน Availability Zone ใดโซนหนึ่ง
2. **Amazon EC2 AMI & Golden Image:**
   - ใช้ AWS Backup / EC2 Lifecycle Manager สร้าง AMI Snapshot รายสัปดาห์ เพื่อให้ Auto Scaling Group สามารถสปินอัปเครื่องใหม่ที่มี Patch และซอฟต์แวร์พร้อมใช้งานได้ทันที

---

## 9. โครงสร้างซอร์สโค้ดของระบบ (Codebase Structure)

การจัดวางโครงสร้างโค้ดตามหลัก **Separation of Concerns** และ **Clean Architecture** เพื่อให้แต่ละส่วนงานแยกขาดจากกันตามแนวคิด 3-Tier:

```
sports-prediction-platform/
├── 📁 frontend/                         # Tier 1: Web Tier (Static / UI Presentation)
│   ├── index.html                      # Single-page Modern Sports Dashboard
│   ├── 📁 assets/
│   │   ├── css/tailwind.css
│   │   └── js/app.js                   # Client-side State, Odds calc, UI interactions
│   └── nginx.conf                      # Nginx Hardened Reverse Proxy Configuration
│
├── 📁 backend/                          # Tier 2: App Tier (Business Logic & Betting Engine)
│   ├── package.json
│   ├── src/
│   │   ├── server.js                   # App Entrypoint & Express Bootstrap
│   │   ├── 📁 config/
│   │   │   ├── aws-secrets.js          # Fetch DB credentials from AWS Secrets Manager
│   │   │   └── database.js             # PostgreSQL Connection Pool (SSL enabled)
│   │   ├── 📁 controllers/
│   │   │   ├── matchController.js      # Match listings, Live Odds updates
│   │   │   ├── betController.js        # Prediction placement, validation & settlement
│   │   │   └── userController.js       # Wallet, Point balance, Profile
│   │   ├── 📁 services/
│   │   │   ├── bettingService.js       # Core ACID transaction for point deductions
│   │   │   └── oddsCalculator.js       # Dynamic Odds algorithms
│   │   ├── 📁 middlewares/
│   │   │   ├── authMiddleware.js       # JWT & Role-Based Access Control (RBAC)
│   │   │   ├── rateLimiter.js          # Express-rate-limit (Anti-Brute Force / DoS)
│   │   │   ├── validator.js            # Input Sanitization (Joi / Zod) against XSS/SQLi
│   │   │   └── auditLogger.js          # CloudWatch Log streaming middleware
│   │   └── 📁 models/
│   │       ├── Match.js
│   │       ├── BetTransaction.js
│   │       └── UserWallet.js
│   └── tests/
│       └── security_test.js            # Unit & Integration Security Tests
│
├── 📁 database/                         # Tier 3: DB Tier (Schema, Migrations & Seeders)
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Tables: Users, Wallets, Matches, Odds, Bets
│   └── seeds/
│       └── initial_matches.sql         # Seed mock fixtures & historical data
│
└── 📁 infrastructure/                   # Cloud Infrastructure as Code (Terraform / CloudFormation)
    ├── main.tf                         # VPC, Subnets, Route Tables, Gateways
    ├── security_groups.tf              # Chained Security Groups Definition
    ├── compute_asg.tf                  # Launch Templates & ASG for Web/App
    ├── alb.tf                          # ALB, Listeners, Target Groups & ACM
    ├── rds.tf                          # Multi-AZ RDS PostgreSQL Instance & Subnet Group
    └── monitoring.tf                   # CloudWatch Alarms & SNS Notification Topics
```

---

## 10. สรุปคะแนนการประเมินตามเกณฑ์ (Term Project Rubric Alignment)

| หมวดการประเมิน (Evaluation Criteria) | ค่าน้ำหนัก | การตอบสนองในโครงการนี้ |
|---|---|---|
| **1. Security Architecture & Design** | **25%** | ออกแบบ VPC 3 ชั้น (Public, Private App, Isolated DB) ข้าม 2 AZs พร้อม WAF, ALB, Route 53 และ Chained Security Groups |
| **2. Functionality & Requirements** | **20%** | ระบบทายผลกีฬาครบวงจร (คู่บิ๊กแมตช์, รายการสด, ลีดเดอร์บอร์ด, การตัดแต้ม Wallet, คำนวณกำไร Real-time) |
| **3. Implementation & Configuration** | **20%** | มีผัง IP Subnet, ASG Launch Templates, Route Tables, NAT Gateways และโครงสร้าง Codebase พร้อมขึ้นระบบ |
| **4. Security Controls & Best Practices** | **15%** | ปิด Port 22 SSH (ใช้ SSM แทน), Least Privilege IAM Role, KMS Encryption At-Rest, ACM TLS 1.3 In-Transit |
| **5. Monitoring, Logging & Alerting** | **10%** | รองรับ CloudWatch Logs/Alarms, CloudTrail, GuardDuty และแผน Backup Multi-AZ + AMI Snapshot |
| **6. Documentation & Presentation** | **10%** | เอกสารรายงานฉบับสมบูรณ์ พร้อมสรุป Slide สำหรับนำเสนอ 10 นาที และ Mockup หน้าเว็บที่เชื่อมโยงกับสถาปัตยกรรม |
