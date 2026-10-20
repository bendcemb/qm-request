# QM-Request & Daily Work Log System
ระบบแจ้งงานและบันทึกผลงานประจำวัน แผนกบริหารคุณภาพ (Quality Management - QM) พัฒนาด้วย **Python (Flask)** และ **PostgreSQL**

---

## 📌 ภาพรวมระบบ (System Overview)
ระบบเว็บแอปพลิเคชันที่ออกแบบตามข้อกำหนดโครงสร้างตารางในเอกสาร `qm-request.xlsx`:
1. **Tasks (ตารางงานหลัก)**: บันทึกข้อมูลการเปิดงาน, หมวดหมู่ระบบคุณภาพ, ระดับความสำคัญ (Priority 1-4), ผู้รับผิดชอบ, กำหนดส่ง (Due Date), ผู้เปิดงาน และสถานะ
2. **Logs (ตารางบันทึกผลงานประจำวัน)**: เจ้าหน้าที่รายงานความคืบหน้ารายวัน, % ความคืบหน้าสะสม (0-100%), ระบุปัญหาติดขัด (Issue / Blocker), และแนบไฟล์หลักฐาน (Evidence File)
3. **Team (ตารางรายชื่อเจ้าหน้าที่ในแผนก)**: รายชื่อทีมงาน QM, บทบาทหน้าที่ และสถานะการใช้งาน

---

## 🚀 ฟังก์ชันหลัก (Core Features)

* 📊 **Dashboard & Live KPIs**:
  * สรุปตัวเลขงานทั้งหมด, รอดำเนินการ, กำลังดำเนินการ, เสร็จสิ้นแล้ว
  * ป้ายแจ้งเตือนงานด่วนพิเศษ (`1-Urgent`) และงานที่เกินกำหนดส่ง (`Overdue`)
* 📝 **เปิดงานใหม่ (Create & Assign Task)**:
  * กำหนดชื่องาน, หมวดหมู่งาน QM, ระดับความสำคัญ, มอบหมายผู้รับผิดชอบ และ Due Date
  * ระบบ Auto-generate รหัสงานในรูปแบบ `QM-YYYYMM-XXX`
* 📋 **บันทึกผลงานประจำวัน (Daily Work Log)**:
  * บันทึกสิ่งที่ปฏิบัติงานจริงในแต่ละวัน
  * ปรับ % ความคืบหน้าสะสม (0-100%) พร้อมอัปเดตสถานะงานแม่อัตโนมัติ (เช่น 100% -> Completed)
  * บันทึกปัญหา / อุปสรรค (Blockers) เพื่อส่งต่อให้หัวหน้าช่วยประสานงาน
  * แนบไฟล์ภาพ/เอกสารหลักฐาน (รองรับ PDF, PNG, JPG, XLSX, DOCX)
* ⏳ **Task Timeline & Audit Trail**:
  * ดูประวัติการรายงานผลงานย้อนหลังทั้งหมดของแต่ละงานแบบไทม์ไลน์
  * ดาวน์โหลดดูไฟล์หลักฐานแนบย้อนหลังได้อย่างปลอดภัย
* 👥 **จัดการรายชื่อทีมงาน (Team Roster)**:
  * เพิ่มและตรวจสอบรายชื่อเจ้าหน้าที่และบทบาทในแผนก QM
* 📥 **ส่งออกข้อมูลเป็น Excel (.xlsx)**:
  * ส่งออกข้อมูลครบทั้ง 3 ชีต (`task`, `log`, `team`) ตามโครงสร้างเดิมของ `qm-request.xlsx`
* 🔌 **REST API สำหรับโปรเจ็คอื่นเรียกใช้งาน**:
  * รองรับการเชื่อมต่อจากภายนอกด้วย JSON Response

---

## 🗄️ โครงสร้างฐานข้อมูล (Database Schema)

### 1) ตาราง `qm_tasks`
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
| :--- | :--- | :--- |
| `task_id` | VARCHAR(30) PK | รหัสงาน เช่น `QM-202610-001` |
| `task_title` | VARCHAR(255) | ชื่องาน / หัวข้อประเด็นงาน |
| `category` | VARCHAR(100) | หมวดหมู่งาน เช่น Document Control, Internal Audit, CAR/PAR |
| `priority` | VARCHAR(20) | ระดับความสำคัญ (1-Urgent, 2-High, 3-Normal, 4-Low) |
| `assigned_to` | VARCHAR(120) | อีเมลเจ้าหน้าที่ QM ผู้รับผิดชอบ |
| `target_date` | DATE | วันที่กำหนดแล้วเสร็จ (Due Date) |
| `status` | VARCHAR(30) | สถานะ (Pending, In Progress, Under Review, Completed, Cancelled) |
| `created_by` | VARCHAR(120) | อีเมลผู้เปิดงาน (หัวหน้า/Lead) |
| `created_at` | TIMESTAMP | วัน-เวลาที่เปิดงาน |
| `updated_at` | TIMESTAMP | วัน-เวลาที่อัปเดตล่าสุด |

### 2) ตาราง `qm_logs`
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
| :--- | :--- | :--- |
| `log_id` | SERIAL PK | รหัสบันทึกผลงาน |
| `task_id` | VARCHAR(30) FK | เชื่อมกับ `qm_tasks.task_id` |
| `log_date` | DATE | วันที่ปฏิบัติงาน |
| `reporter` | VARCHAR(120) | อีเมลผู้บันทึกรายงาน |
| `work_summary`| TEXT | รายละเอียดการปฏิบัติงาน |
| `progress_pct`| INTEGER | ความคืบหน้าสะสม (0 - 100%) |
| `issue_blocker`| TEXT | ปัญหาที่ติดขัด / รอแผนกอื่นตอบกลับ (ถ้ามี) |
| `evidence_file`| VARCHAR(255) | ชื่อไฟล์หลักฐานที่เก็บในระบบ (UUID ป้องกัน Path Traversal) |
| `original_filename`| VARCHAR(255) | ชื่อไฟล์เดิมที่ผู้ใช้อัปโหลด |
| `logged_at` | TIMESTAMP | วัน-เวลาที่กดบันทึกจริง |

### 3) ตาราง `qm_team`
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
| :--- | :--- | :--- |
| `emp_id` | VARCHAR(50) | รหัสพนักงาน |
| `email` | VARCHAR(120) PK | อีเมลผู้ใช้งาน (Key ประจำตัว) |
| `full_name` | VARCHAR(150) | ชื่อ-นามสกุล |
| `role` | VARCHAR(100) | บทบาทหน้าที่ เช่น QM Manager, QMR Officer, Auditor |
| `is_active` | BOOLEAN | สถานะการใช้งาน (TRUE/FALSE) |

---

## 🛠️ วิธีการติดตั้งและรันใช้งาน

### วิธีที่ 1: รันด้วย Docker Compose (แนะนำสำหรับ Production)
โปรเจ็คเชื่อมต่อเครือข่าย `centralnet` และฐานข้อมูล `postgres-db`:

```bash
cd /home/admincomp/workspace/qm-request
docker compose up -d --build
```
* เปิดเบราว์เซอร์เข้าใช้งานที่: `http://localhost:5026` หรือ `http://<SERVER_IP>:5026`

### วิธีที่ 2: รันแบบ Development (Local Python)
```bash
cd /home/admincomp/workspace/qm-request
source .venv/bin/activate
pip install -r requirements.txt

# นำเข้าข้อมูลเริ่มต้น (ตารางและตัวอย่างงาน)
python init_db.py

# รันแอปพลิเคชัน
python main.py
```
* เปิดเบราว์เซอร์เข้าใช้งานที่: `http://localhost:5000`

---

## 🌐 เอกสาร REST API (สำหรับโปรเจ็คอื่นเชื่อมต่อ)

| Method | Endpoint | คำอธิบาย | พารามิเตอร์ / Body |
| :---: | :--- | :--- | :--- |
| `GET` | `/health` | ตรวจสอบสถานะ Server | - |
| `GET` | `/api/stats` | สรุปภาพรวม KPI | - |
| `GET` | `/api/tasks` | ค้นหาและดูรายการงาน | `?search=...&category=...&priority=...&status=...&page=1&limit=25` |
| `GET` | `/api/tasks/<task_id>` | ดูรายละเอียดงานและประวัติ Log | - |
| `POST` | `/api/tasks` | เปิดงานใหม่ | JSON: `{ "task_title": "...", "category": "...", "priority": "...", "assigned_to": "...", "target_date": "YYYY-MM-DD", "created_by": "..." }` |
| `POST` | `/api/tasks/<task_id>/logs` | บันทึกผลงานประจำวัน | `multipart/form-data`: `reporter`, `work_summary`, `progress_pct`, `issue_blocker`, `evidence_file` |
| `PUT` | `/api/tasks/<task_id>/status` | อัปเดตสถานะงาน | JSON: `{ "status": "In Progress" }` |
| `GET` | `/api/team` | ดึงรายชื่อทีมงานทั้งหมด | - |
| `POST` | `/api/team` | เพิ่ม/แก้ไขข้อมูลทีมงาน | JSON: `{ "emp_id": "...", "email": "...", "full_name": "...", "role": "..." }` |
| `GET` | `/api/export` | ดาวน์โหลด Excel (.xlsx) | - |
