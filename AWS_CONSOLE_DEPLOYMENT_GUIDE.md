# คู่มือการติดตั้งระบบบน AWS Management Console ทีละขั้นตอน (Step-by-Step Manual Guide)
## Secure 3-Tier Web Application on Cloud (Sports Prediction Platform)
### จัดทำขึ้นสำหรับเก็บภาพหน้าจอ (Screenshots) และจัดทำรายงาน Term Project 100%

---

## สารบัญขั้นตอนการติดตั้ง (Deployment Phases)

1. **Phase 1:** การสร้าง Virtual Private Cloud (VPC), Subnets, และ Routing Tables
2. **Phase 2:** การกำหนดกลุ่มความปลอดภัย (Security Groups Matrix)
3. **Phase 3:** การสร้าง IAM Roles แบบ Least Privilege
4. **Phase 4:** การติดตั้งฐานข้อมูล Amazon RDS PostgreSQL (DB Tier - Isolated)
5. **Phase 5:** การสร้าง Launch Template และ Auto Scaling Group (App Tier & Web Tier)
6. **Phase 6:** การติดตั้ง Application Load Balancer (ALB) และเปิดใช้งาน HTTPS (ACM)
7. **Phase 7:** การตั้งค่า Monitoring, Logging (CloudWatch & GuardDuty) และการแจ้งเตือน (SNS)
8. **Phase 8:** แผนการสำรองข้อมูล (RDS Automated Backup & EC2 Golden AMI)

---

## Phase 1: การสร้าง VPC, Subnets, และ Gateways

### 1.1 สร้าง Custom VPC
1. ไปที่ AWS Console ค้นหาบริการ **VPC** -> คลิก **Create VPC**
2. เลือก **VPC only**
   - **Name tag:** `apex-predict-vpc`
   - **IPv4 CIDR block:** `10.0.0.0/16`
   - **Tenancy:** `Default`
3. คลิก **Create VPC**
> 📸 **[จุดเก็บภาพ Screenshot 1]:** หน้าแสดงรายละเอียด VPC `apex-predict-vpc` พร้อมแสดง IPv4 CIDR `10.0.0.0/16`

---

### 1.2 สร้าง Subnets 6 ตัว (กระจาย 2 Availability Zones)
ไปที่เมนู **Subnets** -> คลิก **Create subnet** (เลือก VPC: `apex-predict-vpc`):

| Subnet Name | Availability Zone | IPv4 CIDR Block | ประเภท Subnet |
|---|---|---|---|
| `public-subnet-1a` | `ap-southeast-1a` | `10.0.1.0/24` | **Public** (ALB & NAT GW & Web 1) |
| `public-subnet-1b` | `ap-southeast-1b` | `10.0.2.0/24` | **Public** (ALB & Web 2) |
| `private-app-subnet-2a` | `ap-southeast-1a` | `10.0.10.0/24` | **Private** (EC2 App 1) |
| `private-app-subnet-2b` | `ap-southeast-1b` | `10.0.11.0/24` | **Private** (EC2 App 2) |
| `isolated-db-subnet-3a` | `ap-southeast-1a` | `10.0.20.0/24` | **Isolated** (RDS Primary) |
| `isolated-db-subnet-3b` | `ap-southeast-1b` | `10.0.21.0/24` | **Isolated** (RDS Standby Replica) |

*สำหรับ `public-subnet-1a` และ `1b`: ให้เลือก Subnet -> Actions -> **Edit subnet settings** -> ติ๊กถูก **Enable auto-assign public IPv4 address***
> 📸 **[จุดเก็บภาพ Screenshot 2]:** หน้ารายการ Subnets ทั้ง 6 ตัวที่สร้างเสร็จสมบูรณ์ แสดง CIDR Block ครบถ้วน

---

### 1.3 สร้าง Internet Gateway (IGW)
1. ไปที่เมนู **Internet Gateways** -> คลิก **Create internet gateway**
   - **Name tag:** `apex-igw`
2. คลิก **Actions** -> **Attach to VPC** -> เลือก `apex-predict-vpc`

---

### 1.4 สร้าง NAT Gateway (สำหรับ App Tier ให้ออกเน็ตดึง Feed ภายนอกได้)
1. ไปที่เมนู **NAT Gateways** -> คลิก **Create NAT gateway**
   - **Name:** `apex-nat-gateway`
   - **Subnet:** เลือก `public-subnet-1a` *(ต้องอยู่ใน Public Subnet เท่านั้น)*
   - **Connectivity type:** `Public`
   - **Elastic IP allocation ID:** คลิกปุ่ม **Allocate Elastic IP**
2. คลิก **Create NAT gateway** (รอสถานะเปลี่ยนเป็น Available)
> 📸 **[จุดเก็บภาพ Screenshot 3]:** หน้า NAT Gateway แสดง Elastic IP และ Subnet ต้นทาง

---

### 1.5 การกำหนด Route Tables
ไปที่ **Route Tables** สร้าง 3 ตารางดังนี้:

#### 1) `rtb-public` (สำหรับ Web Tier):
- ไปที่แท็บ **Routes** -> คลิก **Edit routes**
  - Destination: `0.0.0.0/0` -> Target: `Internet Gateway` (`apex-igw`)
- ไปที่แท็บ **Subnet associations** -> คลิก **Edit subnet associations**
  - ติ๊กเลือก: `public-subnet-1a`, `public-subnet-1b`

#### 2) `rtb-private-app` (สำหรับ App Tier):
- ไปที่แท็บ **Routes** -> คลิก **Edit routes**
  - Destination: `0.0.0.0/0` -> Target: `NAT Gateway` (`apex-nat-gateway`)
- ไปที่แท็บ **Subnet associations**
  - ติ๊กเลือก: `private-app-subnet-2a`, `private-app-subnet-2b`

#### 3) `rtb-isolated-db` (สำหรับ DB Tier):
- ในแท็บ **Routes** ให้คงไว้เฉพาะเส้นทางเริ่มต้น `10.0.0.0/16 -> local` **(ห้ามเพิ่ม 0.0.0.0/0 เด็ดขาด)**
- ไปที่แท็บ **Subnet associations**
  - ติ๊กเลือก: `isolated-db-subnet-3a`, `isolated-db-subnet-3b`
> 📸 **[จุดเก็บภาพ Screenshot 4]:** หน้า Route Tables แสดงรายการ Routes และ Subnet Associations ของทั้ง 3 ตาราง

---

## Phase 2: การตั้งค่า Security Groups (Zero Trust Chained Matrix)

ไปที่ **Security Groups** -> คลิก **Create security group** สร้างตามลำดับเพื่อให้อ้างอิง SG ID ได้:

### 2.1 `sg-alb` (Application Load Balancer)
- **VPC:** `apex-predict-vpc`
- **Inbound Rules:**
  - Type: `HTTPS` | Port: `443` | Source: `Anywhere-IPv4` (`0.0.0.0/0`)
  - Type: `HTTP` | Port: `80` | Source: `Anywhere-IPv4` (`0.0.0.0/0`)
- **Outbound Rules:** All traffic (หรือระบุเฉพาะ Port 80 ไปยัง `sg-web`)

### 2.2 `sg-web` (Web Tier EC2 - Nginx)
- **VPC:** `apex-predict-vpc`
- **Inbound Rules:**
  - Type: `HTTP` | Port: `80` | Source: **Custom -> เลือก `sg-alb`** *(ห้ามเปิด 0.0.0.0/0)*
- **Outbound Rules:**
  - Custom TCP | Port: `5000` | Destination: **`sg-app`**

### 2.3 `sg-app` (App Tier EC2 - Node.js Backend)
- **VPC:** `apex-predict-vpc`
- **Inbound Rules:**
  - Custom TCP | Port: `5000` | Source: **Custom -> เลือก `sg-web`** *(รับคำขอจาก Web Nginx เท่านั้น)*
- **Outbound Rules:**
  - PostgreSQL | Port: `5432` | Destination: **`sg-db`**
  - HTTPS | Port: `443` | Destination: `0.0.0.0/0` (สำหรับดึง External Sports Feed ผ่าน NAT Gateway)

### 2.4 `sg-db` (Database Tier - RDS PostgreSQL)
- **VPC:** `apex-predict-vpc`
- **Inbound Rules:**
  - PostgreSQL | Port: `5432` | Source: **Custom -> เลือก `sg-app`** *(รับคำขอจาก App Server เท่านั้น)*
- **Outbound Rules:**
  - ลบ Outbound Rules ออกทั้งหมด (Deny All)

> 💡 **เหตุผลด้าน Security ที่ต้องอธิบายในรายงาน:** การไม่เปิดพอร์ต 22 (SSH) ใน Security Group ใดๆ เลย ช่วยตัดความเสี่ยง Brute-force Attack 100% โดยเราจะบริหารจัดการเครื่องผ่าน **AWS Systems Manager (SSM)** แทน
> 📸 **[จุดเก็บภาพ Screenshot 5]:** ตาราง Inbound Rules ของ Security Groups ทั้ง 4 ตัวที่ผูก Chained Source เข้าหากัน

---

## Phase 3: การสร้าง IAM Role (Least Privilege)

1. ไปที่บริการ **IAM** -> เมนู **Roles** -> คลิก **Create role**
2. เลือก **AWS service** -> Use case: **EC2**
3. ค้นหาและแนบนโยบาย (Permissions policies):
   - `AmazonSSMManagedInstanceCore` *(อนุญาตให้ใช้ SSM Session Manager รีโมตเข้าเครื่องโดยไม่ต้องใช้ SSH)*
   - `CloudWatchAgentServerPolicy` *(อนุญาตให้ส่ง Logs และ Metrics เข้า CloudWatch)*
4. ตั้งชื่อ Role: `ApexEC2InstanceProfile`
5. คลิก **Create role**
> 📸 **[จุดเก็บภาพ Screenshot 6]:** หน้ารายละเอียด IAM Role `ApexEC2InstanceProfile` พร้อมนโยบายสิทธิ์ที่แนบไว้

---

## Phase 4: ติดตั้ง Amazon RDS PostgreSQL Multi-AZ (DB Tier)

### 4.1 สร้าง DB Subnet Group
1. ไปที่บริการ **RDS** -> เมนู **Subnet groups** -> คลิก **Create DB Subnet Group**
   - **Name:** `apex-db-subnet-group`
   - **VPC:** `apex-predict-vpc`
   - **Availability Zones:** เลือก `ap-southeast-1a` และ `ap-southeast-1b`
   - **Subnets:** ติ๊กเลือก `10.0.20.0/24` และ `10.0.21.0/24` (Isolated DB Subnets)
2. คลิก **Create**

### 4.2 สร้าง RDS PostgreSQL Database
1. ไปที่เมนู **Databases** -> คลิก **Create database**
2. **Choose a database creation method:** `Standard create`
3. **Engine type:** `PostgreSQL` (Version: 15 หรือ 16)
4. **Templates:** `Production` (หรือ `Dev/Test` สำหรับทดลอง)
5. **Availability and durability:**
   - เลือก **Multi-AZ DB instance** *(เพื่อทำ Synchronous Standby ข้าม AZ)*
6. **Settings:**
   - **DB instance identifier:** `apex-predict-db`
   - **Master username:** `apex_admin`
   - **Master password:** `SecurePassword2026!`
7. **Instance configuration:** `db.t3.micro` หรือ `db.t4g.medium`
8. **Connectivity:**
   - **Virtual private cloud (VPC):** `apex-predict-vpc`
   - **DB Subnet group:** `apex-db-subnet-group`
   - **Public access:** **No** *(รับประกันว่าไม่มี Public IP และตัดขาดจากโลกภายนอก)*
   - **VPC security group:** เลือก **Choose existing** -> เอา default ออก -> เลือก **`sg-db`**
9. **Encryption:**
   - ติ๊กถูก **Enable encryption** -> AWS KMS Key: `aws/rds` (AES-256)
10. **Backup:**
    - ติ๊กถูก **Enable automated backups** (Retention period: 7 days)
11. คลิก **Create database**
> 📸 **[จุดเก็บภาพ Screenshot 7]:** หน้ารายละเอียด RDS Database แสดงสถานะ Multi-AZ, Endpoint, Encryption KMS (Enabled), และ Public access = No

---

## Phase 5: การสร้าง Launch Template และ Auto Scaling Group (Web & App Tiers)

### 5.1 สร้าง Launch Template สำหรับ App Tier
1. ไปที่ **EC2** -> **Launch Templates** -> คลิก **Create launch template**
   - **Launch template name:** `apex-app-template`
   - **AMI:** `Amazon Linux 2023 AMI`
   - **Instance type:** `t3.micro`
   - **Key pair:** *Don't include in launch template* (เพราะเราใช้ SSM)
   - **Network settings:**
     - Security groups: เลือก **`sg-app`**
   - **Advanced details:**
     - **IAM instance profile:** เลือก `ApexEC2InstanceProfile`
     - **User data:** ใส่สคริปต์รัน Node.js:
       ```bash
       #!/bin/bash
       dnf update -y
       dnf install -y nodejs git
       # Clone repository หรือดาวน์โหลดไฟล์ backend
       cd /home/ec2-user
       git clone https://github.com/your-repo/cloudsec2.git
       cd cloudsec2/backend
       node src/server-standalone.js &
       ```

### 5.2 สร้าง Auto Scaling Group สำหรับ App Tier
1. ไปที่ **Auto Scaling Groups** -> คลิก **Create Auto Scaling group**
   - **Name:** `apex-app-asg`
   - **Launch template:** `apex-app-template`
   - **VPC:** `apex-predict-vpc`
   - **Subnets:** เลือก `private-app-subnet-2a` และ `private-app-subnet-2b`
   - **Group size:**
     - Desired capacity: `2`
     - Minimum capacity: `2`
     - Maximum capacity: `6`
   - **Scaling policies:** Target tracking scaling policy -> Target value: Average CPU utilization `75%`
> 📸 **[จุดเก็บภาพ Screenshot 8]:** หน้า Auto Scaling Group `apex-app-asg` แสดง Instance ทั้ง 2 ตัวใน Private Subnets ข้าม 2 AZs

---

### 5.3 ทำซ้ำขั้นตอนเดียวกันสำหรับ Web Tier
- **Launch Template:** `apex-web-template`
  - Security Group: `sg-web`
  - IAM Profile: `ApexEC2InstanceProfile`
  - User Data: ติดตั้ง Nginx และวางไฟล์ `index.html`
- **Auto Scaling Group:** `apex-web-asg`
  - Subnets: เลือก `public-subnet-1a` และ `public-subnet-1b`
  - Desired: `2`, Min: `2`, Max: `6`

---

## Phase 6: การติดตั้ง Application Load Balancer (ALB) และ HTTPS (ACM)

### 6.1 ขอใบรับรอง SSL/TLS ฟรีผ่าน AWS Certificate Manager (ACM)
1. ไปที่บริการ **Certificate Manager (ACM)** -> คลิก **Request a certificate**
2. เลือก **Request a public certificate**
   - **Fully qualified domain name:** ระบุโดเมนเนมของคุณ (เช่น `predict.yourdomain.com`)
   - **Validation method:** DNS validation (Route 53)
3. ยืนยัน CNAME Record บน Route 53 รอจนสถานะขึ้นเป็น **Issued**
> 📸 **[จุดเก็บภาพ Screenshot 9]:** หน้า Certificate Manager แสดงใบรับรองสถานะ "Issued" และรองรับ In-transit TLS 1.3

### 6.2 สร้าง Application Load Balancer
1. ไปที่ **EC2** -> **Load Balancers** -> คลิก **Create load balancer** -> เลือก **Application Load Balancer**
   - **Name:** `apex-public-alb`
   - **Scheme:** `Internet-facing`
   - **IP address type:** `IPv4`
   - **VPC:** `apex-predict-vpc`
   - **Mappings:** เลือก `public-subnet-1a` และ `public-subnet-1b`
   - **Security groups:** เลือก **`sg-alb`**
2. **Listeners and routing:**
   - **Listener 1 (HTTP 80):** ตั้งค่า Default action -> **Redirect to HTTPS 443** (Port 443, Status code: HTTP_301)
   - **Listener 2 (HTTPS 443):**
     - Forward to: Target Group `apex-web-tg` (พอร์ต 80)
     - Security policy: `ELBSecurityPolicy-TLS13-1-2-2021-06`
     - Default SSL/TLS certificate: เลือกใบรับรองจาก ACM ที่ขอไว้
3. คลิก **Create load balancer**
> 📸 **[จุดเก็บภาพ Screenshot 10]:** หน้ารายละเอียด ALB แสดง HTTPS Listener, ACM Certificate, และการตั้งค่า Redirect HTTP -> HTTPS

---

## Phase 7: การตั้งค่า Monitoring, Logging และ Alerting

### 7.1 สร้าง Amazon SNS Topic สำหรับการแจ้งเตือน
1. ไปที่ **Amazon SNS** -> เมนู **Topics** -> คลิก **Create topic**
   - Type: `Standard`
   - Name: `apex-security-alerts`
2. คลิก **Create subscription**
   - Protocol: `Email`
   - Endpoint: ใส่อีเมลของคุณ (ไปกดยืนยัน Confirm subscription ในอีเมล)

### 7.2 สร้าง CloudWatch Alarms
1. ไปที่ **CloudWatch** -> เมนู **Alarms** -> คลิก **Create alarm**
2. **Alarm 1: CPU Utilization สูงเกินกำหนด**
   - Metric: EC2 -> By Auto Scaling Group -> `apex-app-asg` -> CPUUtilization
   - Threshold: `Static` -> Greater than `75` เป็นเวลา 5 นาที
   - Action: ส่ง Notification ไปยัง SNS Topic `apex-security-alerts`
3. **Alarm 2: ตรวจจับ Unhealthy Hosts บน ALB**
   - Metric: ApplicationELB -> UnHealthyHostCount
   - Threshold: Greater than `0`
   - Action: ส่ง Notification ไปยัง SNS Topic `apex-security-alerts`
> 📸 **[จุดเก็บภาพ Screenshot 11]:** หน้า CloudWatch Alarms แสดงสถานะ OK (สีเขียว) และการผูกเข้ากับ SNS Notification

### 7.3 เปิดใช้งาน AWS CloudTrail และ Amazon GuardDuty
1. **CloudTrail:** ไปที่ CloudTrail -> **Create trail** -> ตั้งชื่อ `apex-mgmt-trail` -> ส่ง log เข้า S3 Bucket (Enable Log file integrity validation)
2. **GuardDuty:** ไปที่ GuardDuty -> คลิก **Enable GuardDuty** (เปิดระบบตรวจจับภัยคุกคามอัจฉริยะ)
> 📸 **[จุดเก็บภาพ Screenshot 12]:** หน้า Amazon GuardDuty และ CloudTrail แสดงสถานะ Active

---

## Phase 8: การสำรองข้อมูล (Backup & Golden AMI)

1. **สร้าง EC2 Golden AMI:**
   - ไปที่ EC2 Instances -> เลือกเครื่อง Web/App ที่ลงโค้ดเสร็จแล้ว -> Actions -> **Image and templates** -> **Create image**
   - ตั้งชื่อ `apex-web-golden-ami-v1`
2. **ทดสอบ RDS Snapshot:**
   - ไปที่ RDS Databases -> เลือก `apex-predict-db` -> Actions -> **Take snapshot**
   - ตั้งชื่อ `apex-db-manual-snapshot-termproject`
> 📸 **[จุดเก็บภาพ Screenshot 13]:** หน้ารายการ AMIs และ RDS Snapshots ที่พร้อมสำหรับกู้คืนกรณีฉุกเฉิน (Disaster Recovery)

---

## สรุปรายการภาพถ่ายหน้าจอที่ต้องใช้ในรายงาน (Checklist for Term Project Report)

- [ ] **Screenshot 1:** VPC และ CIDR Block `10.0.0.0/16`
- [ ] **Screenshot 2:** รายการ Subnets 6 ตัว (2 Public, 2 Private App, 2 Isolated DB)
- [ ] **Screenshot 3:** NAT Gateway ใน Public Subnet พร้อม Elastic IP
- [ ] **Screenshot 4:** ตาราง Route Tables ทั้ง 3 ตาราง (รวมถึง Isolated DB ที่ไม่มี 0.0.0.0/0)
- [ ] **Screenshot 5:** Chained Security Groups Inbound Rules (`sg-alb` -> `sg-web` -> `sg-app` -> `sg-db`)
- [ ] **Screenshot 6:** IAM Role `ApexEC2InstanceProfile` พร้อมนโยบาย SSM
- [ ] **Screenshot 7:** RDS PostgreSQL Multi-AZ แสดง Encryption KMS และ Public Access = No
- [ ] **Screenshot 8:** Auto Scaling Groups ทั้งฝั่ง Web และ App Tier
- [ ] **Screenshot 9:** ใบรับรอง SSL/TLS (ACM) สถานะ Issued
- [ ] **Screenshot 10:** Application Load Balancer แสดงกฎ Redirect HTTP -> HTTPS
- [ ] **Screenshot 11:** CloudWatch Alarms และ SNS Email Subscription
- [ ] **Screenshot 12:** CloudTrail และ GuardDuty Threat Detection
- [ ] **Screenshot 13:** EC2 AMI Snapshot และ RDS Database Backup
