from datetime import datetime, timedelta
import logging
from app.db import (
    init_database, 
    get_db_connection, 
    create_task, 
    add_work_log
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_sample_data():
    init_database()
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM qm_tasks;")
            row = cur.fetchone()
            if row and row['cnt'] > 0:
                logger.info("Tasks already exist, skipping seed.")
                return

        today = datetime.now().date()
        
        # Task 1
        t1 = {
            'task_id': 'QM-202610-001',
            'task_title': 'ทบทวนขั้นตอนการปฏิบัติงาน (SOP) ประจำปี 2026 สำหรับฝ่ายผลิต',
            'task_description': 'ดำเนินการตรวจสอบและปรับปรุงเอกสาร SOP ประจำปี 2026 ให้สอดคล้องกับมาตรฐาน ISO 9001:2015 ข้อกำหนด 7.5 และประสานงานกับหัวหน้าแผนกผลิต',
            'category': 'Document Control',
            'priority': '2-High',
            'assigned_to': 'doc.ctrl@company.com',
            'target_date': (today + timedelta(days=7)).strftime('%Y-%m-%d'),
            'status': 'In Progress',
            'created_by': 'qmr.lead@company.com'
        }
        create_task(t1)
        add_work_log({
            'task_id': 'QM-202610-001',
            'log_date': (today - timedelta(days=1)).strftime('%Y-%m-%d'),
            'reporter': 'doc.ctrl@company.com',
            'work_summary': 'รวบรวมแบบฟอร์มเดิมและส่งร่างแก้ไขให้ผู้จัดการฝ่ายผลิตตรวจสอบ',
            'progress_pct': 30,
            'issue_blocker': 'รอการยืนยันขั้นตอน Flowchart จากหัวหน้ากะกลางคืน'
        })
        add_work_log({
            'task_id': 'QM-202610-001',
            'log_date': today.strftime('%Y-%m-%d'),
            'reporter': 'doc.ctrl@company.com',
            'work_summary': 'ปรับปรุงเนื้อหา SOP ตาม Comment และเตรียมจัดพิมพ์ฉบับสมบูรณ์',
            'progress_pct': 55,
            'issue_blocker': ''
        })

        # Task 2
        t2 = {
            'task_id': 'QM-202610-002',
            'task_title': 'ตรวจประเมินคุณภาพภายใน (Internal Quality Audit) ISO 9001:2015 รอบ 2',
            'task_description': 'จัดทำ Audit Plan และลงพื้นที่ตรวจประเมินตาม Checklist ในฝ่ายจัดซื้อ คลังสินค้า และฝ่ายวิศวกรรม พร้อมสรุปผล Findings',
            'category': 'Internal Audit',
            'priority': '1-Urgent',
            'assigned_to': 'audit.iso@company.com',
            'target_date': (today + timedelta(days=3)).strftime('%Y-%m-%d'),
            'status': 'In Progress',
            'created_by': 'qmr.lead@company.com'
        }
        create_task(t2)
        add_work_log({
            'task_id': 'QM-202610-002',
            'log_date': today.strftime('%Y-%m-%d'),
            'reporter': 'audit.iso@company.com',
            'work_summary': 'จัดทำ Audit Checklist และส่งนัดหมายเวลาตรวจประเมินให้แต่ละฝ่าย',
            'progress_pct': 70,
            'issue_blocker': 'แผนกจัดซื้อขอเลื่อนตรวจเป็นช่วงบ่ายเนื่องจากมีตรวจรับสินค้า'
        })

        # Task 3
        t3 = {
            'task_id': 'QM-202610-003',
            'task_title': 'ออกใบแจ้งข้อบกพร่อง CAR/PAR หมายเลข CAR-2026-04 จากข้อร้องเรียนลูกค้า',
            'task_description': 'วิเคราะห์หาสาเหตุที่แท้จริง (Root Cause Analysis - 5 Whys) กรณีลูกค้าร้องเรียนสินค้ามีตำหนิ และกำหนดมาตรการป้องกันการเกิดซ้ำ',
            'category': 'CAR / PAR',
            'priority': '1-Urgent',
            'assigned_to': 'qmr.lead@company.com',
            'target_date': (today + timedelta(days=4)).strftime('%Y-%m-%d'),
            'status': 'Pending',
            'created_by': 'qmr.lead@company.com'
        }
        create_task(t3)

        # Task 4
        t4 = {
            'task_id': 'QM-202610-004',
            'task_title': 'สอบเทียบเครื่องมือวัดแผนก QC (Calibration Schedule Q4)',
            'task_description': 'รวบรวมเครื่องมือวัด Micrometer, Vernier Caliper และ Gauge Block ส่งสอบเทียบกับห้องปฏิบัติการที่ได้รับการรับรอง ISO/IEC 17025',
            'category': 'Quality Control',
            'priority': '3-Normal',
            'assigned_to': 'qc.inspect@company.com',
            'target_date': (today - timedelta(days=2)).strftime('%Y-%m-%d'),
            'status': 'Completed',
            'created_by': 'qmr.lead@company.com'
        }
        create_task(t4)
        add_work_log({
            'task_id': 'QM-202610-004',
            'log_date': (today - timedelta(days=2)).strftime('%Y-%m-%d'),
            'reporter': 'qc.inspect@company.com',
            'work_summary': 'นำเครื่องมือเข้าสอบเทียบกับ Lab ภายนอก ได้รับใบรับรองครบถ้วน',
            'progress_pct': 100,
            'issue_blocker': ''
        })

        logger.info("Sample tasks and logs seeded successfully.")
    finally:
        conn.close()

if __name__ == '__main__':
    seed_sample_data()
