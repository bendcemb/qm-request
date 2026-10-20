import logging
from datetime import datetime, date
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import Config

logger = logging.getLogger(__name__)

def get_db_connection():
    """Establish and return connection to PostgreSQL with RealDictCursor."""
    return psycopg2.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        dbname=Config.DB_NAME,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        connect_timeout=10,
        options='-c timezone=Asia/Bangkok',
        cursor_factory=RealDictCursor
    )

def serialize_row(row):
    """Serialize database row values into JSON-serializable types."""
    if row is None:
        return None
    serialized = {}
    for key, val in row.items():
        if isinstance(val, (datetime, date)):
            serialized[key] = val.strftime('%Y-%m-%d %H:%M:%S') if isinstance(val, datetime) else val.strftime('%Y-%m-%d')
        elif isinstance(val, Decimal):
            serialized[key] = float(val)
        else:
            serialized[key] = val
    return serialized

def init_database():
    """Create PostgreSQL tables if they don't exist and seed default categories on first run."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 1. Team Table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS qm_team (
                    emp_id VARCHAR(50),
                    email VARCHAR(120) PRIMARY KEY,
                    full_name VARCHAR(150) NOT NULL,
                    role VARCHAR(100) NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 2. Tasks Table (Parent)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS qm_tasks (
                    task_id VARCHAR(30) PRIMARY KEY,
                    task_title VARCHAR(255) NOT NULL,
                    task_description TEXT DEFAULT '',
                    category VARCHAR(100) NOT NULL,
                    priority VARCHAR(20) NOT NULL,
                    assigned_to VARCHAR(120) NOT NULL,
                    target_date DATE NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
                    created_by VARCHAR(120) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP
                );
            """)

            # 3. Logs Table (Child)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS qm_logs (
                    log_id SERIAL PRIMARY KEY,
                    task_id VARCHAR(30) NOT NULL REFERENCES qm_tasks(task_id) ON DELETE CASCADE,
                    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    reporter VARCHAR(120) NOT NULL,
                    work_summary TEXT NOT NULL,
                    progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
                    issue_blocker TEXT,
                    evidence_file VARCHAR(255),
                    original_filename VARCHAR(255),
                    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 4. Categories Table (user-managed via Settings)
            cur.execute("SELECT to_regclass('public.qm_categories') AS t;")
            categories_existed = cur.fetchone()['t'] is not None
            cur.execute("""
                CREATE TABLE IF NOT EXISTS qm_categories (
                    cat_id SERIAL PRIMARY KEY,
                    name VARCHAR(100) UNIQUE NOT NULL,
                    description VARCHAR(150) DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Indexing for high-performance searches and joins
            cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON qm_tasks(assigned_to);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON qm_tasks(status);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_category ON qm_tasks(category);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_logs_task_id ON qm_logs(task_id);")

            # Migration: Ensure completed_at column exists in qm_tasks
            cur.execute("ALTER TABLE qm_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON qm_tasks(completed_at);")

            # Migration: Ensure task_description column exists in qm_tasks
            cur.execute("ALTER TABLE qm_tasks ADD COLUMN IF NOT EXISTS task_description TEXT DEFAULT '';")

            # Backfill completed_at for existing Completed tasks if null
            cur.execute("""
                UPDATE qm_tasks t
                SET completed_at = COALESCE(
                    (SELECT logged_at FROM qm_logs WHERE task_id = t.task_id AND progress_pct = 100 ORDER BY logged_at DESC LIMIT 1),
                    t.updated_at
                )
                WHERE t.status = 'Completed' AND t.completed_at IS NULL;
            """)

            # Seed default categories only when the table is first created
            # (so the user can delete them all without them reappearing on restart)
            if not categories_existed:
                cur.execute("""
                    INSERT INTO qm_categories (name, description, sort_order) VALUES
                    ('Document Control', 'ควบคุมเอกสาร', 1),
                    ('Internal Audit', 'ตรวจประเมินภายใน', 2),
                    ('CAR / PAR', 'แก้ไข/ป้องกันข้อบกพร่อง', 3),
                    ('Quality Control', 'ควบคุมคุณภาพ', 4),
                    ('Customer Complaint', 'ข้อร้องเรียน', 5),
                    ('ISO 9001 Standard', 'มาตรฐานระบบ', 6),
                    ('Routine Work', 'งานประจำ', 7)
                    ON CONFLICT (name) DO NOTHING;
                """)

            conn.commit()
            logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()

def generate_task_id():
    """Generate sequential Task ID in format QM-YYYYMM-001."""
    now = datetime.now()
    prefix = f"QM-{now.strftime('%Y%m')}-"
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT task_id FROM qm_tasks 
                WHERE task_id LIKE %s 
                ORDER BY task_id DESC LIMIT 1
            """, (f"{prefix}%",))
            row = cur.fetchone()
            if row:
                last_id = row['task_id']
                last_num = int(last_id.split('-')[-1])
                new_num = last_num + 1
            else:
                new_num = 1
            return f"{prefix}{new_num:03d}"
    finally:
        if conn:
            conn.close()

def get_dashboard_stats():
    """Fetch KPI summary, overdue counts, categories breakdown, and recent activities."""
    stats = {
        'total_tasks': 0,
        'grand_total': 0,
        'pending': 0,
        'in_progress': 0,
        'completed': 0,
        'cancelled': 0,
        'urgent': 0,
        'overdue': 0,
        'avg_progress': {
            'pending': 0.0,
            'in_progress': 0.0,
            'completed': 100.0,
            'cancelled': 0.0,
            'overdue': None,
            'active': 0.0,
            'all': 0.0
        },
        'total_logs': 0,
        'category_stats': [],
        'priority_stats': [],
        'team_workload': []
    }
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 1. Status Counts & Overdue (Target Date < Current Date and not Completed/Cancelled)
            cur.execute("""
                SELECT 
                    COUNT(*) AS grand_total,
                    SUM(CASE WHEN status NOT IN ('Completed', 'Cancelled') THEN 1 ELSE 0 END) AS total,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
                    SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled,
                    SUM(CASE WHEN priority = '1-Urgent' AND status NOT IN ('Completed', 'Cancelled') THEN 1 ELSE 0 END) AS urgent,
                    SUM(CASE WHEN target_date < CURRENT_DATE AND status NOT IN ('Completed', 'Cancelled') THEN 1 ELSE 0 END) AS overdue
                FROM qm_tasks;
            """)
            counts = cur.fetchone()
            if counts:
                stats['total_tasks'] = counts.get('total') or 0
                stats['grand_total'] = counts.get('grand_total') or 0
                stats['pending'] = counts.get('pending') or 0
                stats['in_progress'] = counts.get('in_progress') or 0
                stats['completed'] = counts.get('completed') or 0
                stats['cancelled'] = counts.get('cancelled') or 0
                stats['urgent'] = counts.get('urgent') or 0
                stats['overdue'] = counts.get('overdue') or 0

            # 1.1 Average Progress Calculation per Status
            cur.execute("""
                WITH latest_logs AS (
                    SELECT DISTINCT ON (task_id) task_id, progress_pct 
                    FROM qm_logs 
                    ORDER BY task_id, log_date DESC, logged_at DESC
                ),
                task_prog AS (
                    SELECT 
                        t.task_id, 
                        t.status, 
                        t.target_date,
                        CASE 
                            WHEN t.status = 'Completed' THEN 100
                            ELSE COALESCE(l.progress_pct, 0)
                        END AS prog,
                        CASE 
                            WHEN t.target_date < CURRENT_DATE AND t.status NOT IN ('Completed', 'Cancelled') THEN TRUE 
                            ELSE FALSE 
                        END AS is_overdue
                    FROM qm_tasks t
                    LEFT JOIN latest_logs l ON t.task_id = l.task_id
                )
                SELECT 
                    COALESCE(ROUND(AVG(CASE WHEN status = 'Pending' THEN prog ELSE NULL END), 1), 0.0) AS avg_pending,
                    COALESCE(ROUND(AVG(CASE WHEN status = 'In Progress' THEN prog ELSE NULL END), 1), 0.0) AS avg_in_progress,
                    COALESCE(ROUND(AVG(CASE WHEN status = 'Completed' THEN prog ELSE NULL END), 1), 100.0) AS avg_completed,
                    COALESCE(ROUND(AVG(CASE WHEN status = 'Cancelled' THEN prog ELSE NULL END), 1), 0.0) AS avg_cancelled,
                    ROUND(AVG(CASE WHEN is_overdue = TRUE THEN prog ELSE NULL END), 1) AS avg_overdue,
                    COALESCE(ROUND(AVG(CASE WHEN status NOT IN ('Completed', 'Cancelled') THEN prog ELSE NULL END), 1), 0.0) AS avg_active,
                    COALESCE(ROUND(AVG(prog), 1), 0.0) AS avg_all
                FROM task_prog;
            """)
            prog_row = cur.fetchone()
            if prog_row:
                stats['avg_progress'] = {
                    'pending': float(prog_row['avg_pending']) if prog_row.get('avg_pending') is not None else 0.0,
                    'in_progress': float(prog_row['avg_in_progress']) if prog_row.get('avg_in_progress') is not None else 0.0,
                    'completed': float(prog_row['avg_completed']) if prog_row.get('avg_completed') is not None else 100.0,
                    'cancelled': float(prog_row['avg_cancelled']) if prog_row.get('avg_cancelled') is not None else 0.0,
                    'overdue': float(prog_row['avg_overdue']) if prog_row.get('avg_overdue') is not None else None,
                    'active': float(prog_row['avg_active']) if prog_row.get('avg_active') is not None else 0.0,
                    'all': float(prog_row['avg_all']) if prog_row.get('avg_all') is not None else 0.0
                }

            # 1.2 Total Logs Count
            cur.execute("SELECT COUNT(*) AS total_logs FROM qm_logs;")
            log_counts = cur.fetchone()
            if log_counts:
                stats['total_logs'] = log_counts.get('total_logs') or 0

            # 2. Categories breakdown (เฉพาะงานที่ยังไม่เสร็จสิ้นและไม่ยกเลิก)
            cur.execute("""
                SELECT category, COUNT(*) AS count
                FROM qm_tasks
                WHERE status NOT IN ('Completed', 'Cancelled')
                GROUP BY category
                ORDER BY count DESC;
            """)
            stats['category_stats'] = [serialize_row(r) for r in cur.fetchall()]

            # 3. Priority breakdown (เฉพาะงานที่ยังไม่เสร็จสิ้นและไม่ยกเลิก)
            cur.execute("""
                SELECT priority, COUNT(*) AS count
                FROM qm_tasks
                WHERE status NOT IN ('Completed', 'Cancelled')
                GROUP BY priority
                ORDER BY priority ASC;
            """)
            stats['priority_stats'] = [serialize_row(r) for r in cur.fetchall()]

            # 4. Team Workload
            cur.execute("""
                SELECT 
                    t.assigned_to, 
                    COALESCE(m.full_name, t.assigned_to) AS member_name,
                    COUNT(*) AS active_tasks
                FROM qm_tasks t
                LEFT JOIN qm_team m ON t.assigned_to = m.email
                WHERE t.status NOT IN ('Completed', 'Cancelled')
                GROUP BY t.assigned_to, m.full_name
                ORDER BY active_tasks DESC;
            """)
            stats['team_workload'] = [serialize_row(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
    finally:
        if conn:
            conn.close()
    return stats

def get_tasks(search='', category='', priority='', status='', assigned_to='', page=1, limit=50, sort_by='', sort_dir='asc'):
    """Retrieve filtered tasks with latest progress, log count, and optional column sorting."""
    results = {'data': [], 'total': 0, 'page': page, 'limit': limit, 'total_pages': 0}
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            where_clauses = ["1=1"]
            params = []

            if search:
                search_term = f"%{search.strip()}%"
                where_clauses.append("(t.task_id ILIKE %s OR t.task_title ILIKE %s OR t.assigned_to ILIKE %s OR m.full_name ILIKE %s)")
                params.extend([search_term, search_term, search_term, search_term])

            if category:
                where_clauses.append("t.category = %s")
                params.append(category)

            if priority:
                where_clauses.append("t.priority = %s")
                params.append(priority)

            if status:
                if status == 'Overdue':
                    where_clauses.append("t.target_date < CURRENT_DATE AND t.status NOT IN ('Completed', 'Cancelled')")
                elif status == 'all_with_completed':
                    pass
                else:
                    where_clauses.append("t.status = %s")
                    params.append(status)
            else:
                # "งานทั้งหมด" ต้องไม่รวมงานที่เสร็จสิ้นและงานยกเลิก
                where_clauses.append("t.status NOT IN ('Completed', 'Cancelled')")

            if assigned_to:
                where_clauses.append("t.assigned_to = %s")
                params.append(assigned_to)

            where_sql = " AND ".join(where_clauses)

            # Count total
            count_sql = f"""
                SELECT COUNT(*) AS cnt 
                FROM qm_tasks t
                LEFT JOIN qm_team m ON t.assigned_to = m.email
                WHERE {where_sql}
            """
            cur.execute(count_sql, tuple(params))
            total_count = cur.fetchone()['cnt']
            results['total'] = total_count
            results['total_pages'] = (total_count + limit - 1) // limit if limit > 0 else 0

            # Dynamic secure sorting
            SORT_MAP = {
                'task_id': 't.task_id',
                'task_title': 't.task_title',
                'category': 't.category',
                'priority': """CASE 
                    WHEN t.priority = '1-Urgent' THEN 1
                    WHEN t.priority = '2-High' THEN 2
                    WHEN t.priority = '3-Normal' THEN 3
                    WHEN t.priority = '4-Low' THEN 4
                    ELSE 5
                END""",
                'assigned_to': 'COALESCE(m.full_name, t.assigned_to)',
                'target_date': 't.target_date',
                'latest_progress': 'COALESCE(latest_log.progress_pct, 0)',
                'total_logs': 'COALESCE(log_count.cnt, 0)',
                'status': """CASE 
                    WHEN t.status = 'Pending' THEN 1
                    WHEN t.status = 'In Progress' THEN 2
                    WHEN t.status = 'Under Review' THEN 3
                    WHEN t.status = 'Completed' THEN 4
                    WHEN t.status = 'Cancelled' THEN 5
                    ELSE 6
                END""",
                'created_at': 't.created_at',
                'completed_at': 't.completed_at'
            }

            if sort_by in SORT_MAP:
                dir_sql = 'DESC' if str(sort_dir).lower() == 'desc' else 'ASC'
                order_sql = f"{SORT_MAP[sort_by]} {dir_sql}, t.task_id DESC"
            elif status == 'Completed':
                order_sql = "t.completed_at DESC NULLS LAST, t.updated_at DESC, t.task_id DESC"
            elif status == 'Pending':
                order_sql = "t.created_at DESC, t.task_id DESC"
            else:
                order_sql = """
                    CASE 
                        WHEN t.priority = '1-Urgent' AND t.status NOT IN ('Completed', 'Cancelled') THEN 1
                        WHEN t.target_date < CURRENT_DATE AND t.status NOT IN ('Completed', 'Cancelled') THEN 2
                        WHEN t.status IN ('Pending', 'In Progress') THEN 3
                        ELSE 4
                    END,
                    t.target_date ASC,
                    t.created_at DESC
                """

            # Paged query with latest progress
            offset = (page - 1) * limit
            query_sql = f"""
                SELECT 
                    t.task_id, t.task_title, t.task_description, t.category, t.priority,
                    t.assigned_to, COALESCE(m.full_name, t.assigned_to) AS assigned_name,
                    t.target_date, t.status, t.created_by, COALESCE(m2.full_name, t.created_by) AS created_by_name,
                    t.created_at, t.updated_at, t.completed_at,
                    CASE 
                        WHEN t.target_date < CURRENT_DATE AND t.status NOT IN ('Completed', 'Cancelled') THEN TRUE 
                        ELSE FALSE 
                    END AS is_overdue,
                    COALESCE(latest_log.progress_pct, 0) AS latest_progress,
                    COALESCE(log_count.cnt, 0) AS total_logs
                FROM qm_tasks t
                LEFT JOIN qm_team m ON t.assigned_to = m.email
                LEFT JOIN qm_team m2 ON t.created_by = m2.email
                LEFT JOIN LATERAL (
                    SELECT progress_pct FROM qm_logs 
                    WHERE task_id = t.task_id 
                    ORDER BY log_date DESC, logged_at DESC 
                    LIMIT 1
                ) latest_log ON TRUE
                LEFT JOIN (
                    SELECT task_id, COUNT(*) AS cnt 
                    FROM qm_logs GROUP BY task_id
                ) log_count ON log_count.task_id = t.task_id
                WHERE {where_sql}
                ORDER BY {order_sql}
                OFFSET %s LIMIT %s;
            """
            cur.execute(query_sql, tuple(params + [offset, limit]))
            rows = cur.fetchall()
            results['data'] = [serialize_row(r) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
    finally:
        if conn:
            conn.close()
    return results

def get_task_by_id(task_id):
    """Retrieve full details of single task along with its work logs."""
    conn = None
    data = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    t.task_id, t.task_title, t.task_description, t.category, t.priority,
                    t.assigned_to, COALESCE(m.full_name, t.assigned_to) AS assigned_name,
                    t.target_date, t.status, t.created_by, COALESCE(m2.full_name, t.created_by) AS created_by_name,
                    t.created_at, t.updated_at, t.completed_at,
                    CASE 
                        WHEN t.target_date < CURRENT_DATE AND t.status NOT IN ('Completed', 'Cancelled') THEN TRUE 
                        ELSE FALSE 
                    END AS is_overdue
                FROM qm_tasks t
                LEFT JOIN qm_team m ON t.assigned_to = m.email
                LEFT JOIN qm_team m2 ON t.created_by = m2.email
                WHERE t.task_id = %s;
            """, (task_id,))
            task_row = cur.fetchone()
            if not task_row:
                return None

            data = serialize_row(task_row)

            # Fetch all logs in chronological order
            cur.execute("""
                SELECT 
                    l.log_id, l.task_id, l.log_date, l.reporter,
                    COALESCE(m.full_name, l.reporter) AS reporter_name,
                    l.work_summary, l.progress_pct, l.issue_blocker,
                    l.evidence_file, l.original_filename, l.logged_at
                FROM qm_logs l
                LEFT JOIN qm_team m ON l.reporter = m.email
                WHERE l.task_id = %s
                ORDER BY l.log_date DESC, l.logged_at DESC;
            """, (task_id,))
            log_rows = cur.fetchall()
            data['logs'] = [serialize_row(l) for l in log_rows]
            data['current_progress'] = data['logs'][0]['progress_pct'] if data['logs'] else 0
    except Exception as e:
        logger.error(f"Error getting task by ID {task_id}: {e}")
    finally:
        if conn:
            conn.close()
    return data

def create_task(data):
    """Create a new task with parameterized values."""
    conn = None
    try:
        task_id = data.get('task_id') or generate_task_id()
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO qm_tasks (
                    task_id, task_title, task_description, category, priority, 
                    assigned_to, target_date, status, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING task_id;
            """, (
                task_id,
                data['task_title'].strip(),
                data.get('task_description', '').strip(),
                data['category'].strip(),
                data.get('priority', '3-Normal'),
                data['assigned_to'].strip(),
                data['target_date'],
                data.get('status', 'Pending'),
                data.get('created_by', 'system@company.com').strip()
            ))
            conn.commit()
            return task_id
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()

def update_task_status(task_id, status):
    """Update task status."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if status == 'Completed':
                cur.execute("""
                    UPDATE qm_tasks 
                    SET status = %s, updated_at = CURRENT_TIMESTAMP,
                        completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
                    WHERE task_id = %s;
                """, (status, task_id))
            else:
                cur.execute("""
                    UPDATE qm_tasks 
                    SET status = %s, updated_at = CURRENT_TIMESTAMP, completed_at = NULL
                    WHERE task_id = %s;
                """, (status, task_id))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error updating task status: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def accept_task(task_id, accepted_by=None):
    """Mark task as In Progress when officer accepts the task and log the acceptance event."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT t.task_id, t.status, t.assigned_to, COALESCE(m.full_name, t.assigned_to) AS officer_name
                FROM qm_tasks t
                LEFT JOIN qm_team m ON t.assigned_to = m.email
                WHERE t.task_id = %s;
            """, (task_id,))
            task = cur.fetchone()
            if not task:
                return False, 'ไม่พบงานที่ระบุ'

            status_raw = (task['status'] or '').strip()
            status_norm = status_raw.lower()
            if status_norm == 'in progress' or status_norm == 'กำลังดำเนินการ':
                return True, 'งานนี้อยู่ในสถานะ กำลังดำเนินการ เรียบร้อยแล้ว'

            if status_norm not in ('pending', 'รอดำเนินการ'):
                return False, f"งานนี้อยู่ในสถานะ {task['status']} แล้ว ไม่จำเป็นต้องกดรับงานซ้ำ"

            # Update status to 'In Progress'
            cur.execute("""
                UPDATE qm_tasks 
                SET status = 'In Progress', updated_at = CURRENT_TIMESTAMP, completed_at = NULL 
                WHERE task_id = %s;
            """, (task_id,))

            # Add an initial log indicating task acceptance
            reporter = (accepted_by or task['assigned_to'] or 'qm.officer@company.com').strip()
            officer_name = task['officer_name'] or reporter
            cur.execute("""
                INSERT INTO qm_logs (
                    task_id, log_date, reporter, work_summary, progress_pct
                ) VALUES (%s, CURRENT_DATE, %s, %s, %s);
            """, (
                task_id, 
                reporter,
                f"เจ้าหน้าที่ {officer_name} ได้กดรับมอบหมายงานเรียบร้อยแล้ว กำลังเริ่มดำเนินงาน",
                0
            ))

            conn.commit()
            return True, 'รับมอบหมายงานเรียบร้อยแล้ว สถานะเปลี่ยนเป็น กำลังดำเนินการ'
    except Exception as e:
        logger.error(f"Error accepting task {task_id}: {e}")
        if conn:
            conn.rollback()
        return False, str(e)
    finally:
        if conn:
            conn.close()

def cancel_task(task_id, reason=None, cancelled_by=None):
    """Mark task as Cancelled and log the cancellation event into qm_logs."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT t.task_id, t.status, t.assigned_to, COALESCE(m.full_name, t.assigned_to) AS officer_name
                FROM qm_tasks t
                LEFT JOIN qm_team m ON t.assigned_to = m.email
                WHERE t.task_id = %s;
            """, (task_id,))
            task = cur.fetchone()
            if not task:
                return False, 'ไม่พบงานที่ระบุ'

            status_raw = (task['status'] or '').strip()
            if status_raw.lower() in ('cancelled', 'ยกเลิก'):
                return True, 'งานนี้ถูกยกเลิกเรียบร้อยแล้ว'

            if status_raw.lower() in ('completed', 'เสร็จสิ้น'):
                return False, 'งานนี้ปิดสมบูรณ์แล้ว ไม่สามารถยกเลิกได้'

            # Update status to 'Cancelled'
            cur.execute("""
                UPDATE qm_tasks 
                SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP, completed_at = NULL 
                WHERE task_id = %s;
            """, (task_id,))

            # Add an audit log indicating cancellation
            reporter = (cancelled_by or task['assigned_to'] or 'qm.officer@company.com').strip()
            reason_text = (reason or '').strip() or 'ยกเลิกโดยผู้ใช้งาน'
            cur.execute("""
                INSERT INTO qm_logs (
                    task_id, log_date, reporter, work_summary, progress_pct, issue_blocker
                ) VALUES (%s, CURRENT_DATE, %s, %s, %s, %s);
            """, (
                task_id, 
                reporter,
                f"🚫 ขอยกเลิกงาน: {reason_text}",
                0,
                reason_text
            ))

            conn.commit()
            return True, 'ยกเลิกงานเรียบร้อยแล้ว'
    except Exception as e:
        logger.error(f"Error cancelling task {task_id}: {e}")
        if conn:
            conn.rollback()
        return False, str(e)
    finally:
        if conn:
            conn.close()

def add_work_log(data):
    """Add daily work log, and auto-update parent task status/progress."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            progress_pct = max(0, min(100, int(data.get('progress_pct', 0))))
            cur.execute("""
                INSERT INTO qm_logs (
                    task_id, log_date, reporter, work_summary, 
                    progress_pct, issue_blocker, evidence_file, original_filename
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING log_id;
            """, (
                data['task_id'],
                data.get('log_date') or datetime.now().strftime('%Y-%m-%d'),
                data['reporter'].strip(),
                data['work_summary'].strip(),
                progress_pct,
                data.get('issue_blocker', '').strip() or None,
                data.get('evidence_file'),
                data.get('original_filename')
            ))
            new_log_id = cur.fetchone()['log_id']

            # Auto-update task status based on progress
            if progress_pct == 100:
                new_status = 'Completed'
            else:
                # If currently Pending or Completed, move to In Progress when new log is < 100%
                cur.execute("SELECT status FROM qm_tasks WHERE task_id = %s;", (data['task_id'],))
                task_curr = cur.fetchone()
                if task_curr:
                    curr_st = (task_curr['status'] or '').strip().lower()
                    if curr_st in ('pending', 'รอดำเนินการ', 'completed', 'เสร็จสิ้น'):
                        new_status = 'In Progress'
                    else:
                        new_status = None
                else:
                    new_status = None

            if new_status == 'Completed':
                cur.execute("""
                    UPDATE qm_tasks 
                    SET status = %s, updated_at = CURRENT_TIMESTAMP,
                        completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
                    WHERE task_id = %s;
                """, (new_status, data['task_id']))
            elif new_status:
                cur.execute("""
                    UPDATE qm_tasks 
                    SET status = %s, updated_at = CURRENT_TIMESTAMP, completed_at = NULL 
                    WHERE task_id = %s;
                """, (new_status, data['task_id']))
            else:
                cur.execute("""
                    UPDATE qm_tasks 
                    SET updated_at = CURRENT_TIMESTAMP 
                    WHERE task_id = %s;
                """, (data['task_id'],))

            conn.commit()
            return new_log_id
    except Exception as e:
        logger.error(f"Error adding work log: {e}")
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()

def get_team_members(only_active=True):
    """Retrieve team members list."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            sql = "SELECT emp_id, email, full_name, role, is_active FROM qm_team"
            if only_active:
                sql += " WHERE is_active = TRUE"
            sql += " ORDER BY full_name ASC;"
            cur.execute(sql)
            return [serialize_row(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Error fetching team members: {e}")
        return []
    finally:
        if conn:
            conn.close()

def add_or_update_team_member(data, original_email=None):
    """Insert or update a team member, handling original email changes."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            emp_id = data.get('emp_id', '').strip()
            new_email = data['email'].strip().lower()
            full_name = data['full_name'].strip()
            role = data['role'].strip()
            is_active = bool(data.get('is_active', True))

            if original_email and original_email.strip().lower() != new_email:
                cur.execute("""
                    UPDATE qm_team 
                    SET emp_id = %s, email = %s, full_name = %s, role = %s, is_active = %s
                    WHERE email = %s;
                """, (emp_id, new_email, full_name, role, is_active, original_email.strip().lower()))
            else:
                cur.execute("""
                    INSERT INTO qm_team (emp_id, email, full_name, role, is_active)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (email) DO UPDATE 
                    SET emp_id = EXCLUDED.emp_id,
                        full_name = EXCLUDED.full_name,
                        role = EXCLUDED.role,
                        is_active = EXCLUDED.is_active;
                """, (emp_id, new_email, full_name, role, is_active))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error saving team member: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def delete_team_member(email):
    """Delete a team member by email."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM qm_team WHERE email = %s;", (email.strip().lower(),))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error deleting team member {email}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ----------------- Categories (Settings) -----------------

def get_categories(only_active=True):
    """Retrieve task categories ordered by sort_order, with usage count."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            sql = """
                SELECT c.cat_id, c.name, c.description, c.sort_order, c.is_active,
                       (SELECT COUNT(*) FROM qm_tasks t WHERE t.category = c.name) AS task_count
                FROM qm_categories c
            """
            if only_active:
                sql += " WHERE c.is_active = TRUE"
            sql += " ORDER BY c.sort_order ASC, c.name ASC;"
            cur.execute(sql)
            return [serialize_row(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        return []
    finally:
        if conn:
            conn.close()

def save_category(data, cat_id=None):
    """Insert or update a category. Renaming also updates existing tasks.
    Returns (success: bool, message: str)."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            name = data['name'].strip()
            description = (data.get('description') or '').strip()
            is_active = bool(data.get('is_active', True))

            cur.execute(
                "SELECT cat_id FROM qm_categories WHERE LOWER(name) = LOWER(%s) AND (%s IS NULL OR cat_id <> %s);",
                (name, cat_id, cat_id)
            )
            if cur.fetchone():
                return False, 'มีหมวดหมู่ชื่อนี้อยู่แล้ว'

            if cat_id:
                cur.execute("SELECT name FROM qm_categories WHERE cat_id = %s;", (cat_id,))
                row = cur.fetchone()
                if not row:
                    return False, 'ไม่พบหมวดหมู่ที่ต้องการแก้ไข'
                old_name = row['name']
                cur.execute("""
                    UPDATE qm_categories SET name = %s, description = %s, is_active = %s
                    WHERE cat_id = %s;
                """, (name, description, is_active, cat_id))
                if old_name != name:
                    cur.execute("UPDATE qm_tasks SET category = %s WHERE category = %s;", (name, old_name))
            else:
                cur.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM qm_categories;")
                next_order = cur.fetchone()['next']
                cur.execute("""
                    INSERT INTO qm_categories (name, description, sort_order, is_active)
                    VALUES (%s, %s, %s, %s);
                """, (name, description, next_order, is_active))
            conn.commit()
            return True, 'บันทึกหมวดหมู่เรียบร้อยแล้ว'
    except Exception as e:
        logger.error(f"Error saving category: {e}")
        if conn:
            conn.rollback()
        return False, 'บันทึกหมวดหมู่ไม่สำเร็จ'
    finally:
        if conn:
            conn.close()

def delete_category(cat_id):
    """Delete a category. Existing tasks keep their category text."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM qm_categories WHERE cat_id = %s;", (cat_id,))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        logger.error(f"Error deleting category {cat_id}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def export_all_data():
    """Retrieve raw data dicts for task, log, and team to export to Excel."""
    conn = None
    data = {'task': [], 'log': [], 'team': []}
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    task_id, task_title, task_description, category, priority, 
                    assigned_to, target_date, status, created_by, created_at,
                    completed_at
                FROM qm_tasks ORDER BY task_id ASC;
            """)
            data['task'] = [serialize_row(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT 
                    log_id, task_id, log_date, reporter, work_summary, 
                    progress_pct, issue_blocker, evidence_file, logged_at
                FROM qm_logs ORDER BY log_id ASC;
            """)
            data['log'] = [serialize_row(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT emp_id, email, full_name, role, is_active 
                FROM qm_team ORDER BY email ASC;
            """)
            data['team'] = [serialize_row(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Error exporting data: {e}")
    finally:
        if conn:
            conn.close()
    return data

def get_active_tasks_summary():
    """Retrieve active tasks for dropdown selector in work log modal."""
    conn = None
    tasks = []
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    t.task_id, t.task_title, t.category, t.priority, t.status, 
                    t.assigned_to, COALESCE(m.full_name, t.assigned_to) AS assigned_name,
                    t.target_date,
                    COALESCE(latest_log.progress_pct, 0) AS latest_progress
                FROM qm_tasks t
                LEFT JOIN qm_team m ON t.assigned_to = m.email
                LEFT JOIN LATERAL (
                    SELECT progress_pct FROM qm_logs 
                    WHERE task_id = t.task_id 
                    ORDER BY log_date DESC, logged_at DESC 
                    LIMIT 1
                ) latest_log ON TRUE
                WHERE t.status NOT IN ('Completed', 'Cancelled')
                ORDER BY 
                    CASE 
                        WHEN t.status = 'In Progress' THEN 1 
                        WHEN t.status = 'Pending' THEN 2 
                        ELSE 3 
                    END,
                    t.created_at DESC;
            """)
            tasks = [serialize_row(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Error fetching active tasks summary: {e}")
    finally:
        if conn:
            conn.close()
    return tasks

def get_all_work_logs(search='', reporter='', task_id='', log_date='', page=1, limit=25):
    """Retrieve filtered and paginated daily work logs with task details."""
    results = {'data': [], 'total': 0, 'page': page, 'limit': limit, 'total_pages': 0}
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            where_clauses = ["1=1"]
            params = []

            if search:
                search_term = f"%{search.strip()}%"
                where_clauses.append("(l.work_summary ILIKE %s OR l.issue_blocker ILIKE %s OR l.task_id ILIKE %s OR t.task_title ILIKE %s OR m.full_name ILIKE %s)")
                params.extend([search_term, search_term, search_term, search_term, search_term])

            if reporter:
                where_clauses.append("l.reporter = %s")
                params.append(reporter.strip())

            if task_id:
                where_clauses.append("l.task_id = %s")
                params.append(task_id.strip())

            if log_date:
                where_clauses.append("l.log_date = %s")
                params.append(log_date.strip())

            where_sql = " AND ".join(where_clauses)

            # Count total
            count_sql = f"""
                SELECT COUNT(*) AS cnt 
                FROM qm_logs l
                LEFT JOIN qm_tasks t ON l.task_id = t.task_id
                LEFT JOIN qm_team m ON l.reporter = m.email
                WHERE {where_sql}
            """
            cur.execute(count_sql, tuple(params))
            total_count = cur.fetchone()['cnt']
            results['total'] = total_count
            results['total_pages'] = (total_count + limit - 1) // limit if limit > 0 else 0

            # Paged query
            offset = (page - 1) * limit
            query_sql = f"""
                SELECT 
                    l.log_id, l.task_id, t.task_title, t.category, t.priority, t.status AS task_status,
                    l.log_date, l.reporter, COALESCE(m.full_name, l.reporter) AS reporter_name,
                    l.work_summary, l.progress_pct, l.issue_blocker,
                    l.evidence_file, l.original_filename, l.logged_at
                FROM qm_logs l
                LEFT JOIN qm_tasks t ON l.task_id = t.task_id
                LEFT JOIN qm_team m ON l.reporter = m.email
                WHERE {where_sql}
                ORDER BY l.log_date DESC, l.logged_at DESC
                OFFSET %s LIMIT %s;
            """
            cur.execute(query_sql, tuple(params + [offset, limit]))
            rows = cur.fetchall()
            results['data'] = [serialize_row(r) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching work logs: {e}")
    finally:
        if conn:
            conn.close()
    return results

def delete_task(task_id):
    """Delete a task and cascade delete its logs.
    Returns (success: bool, evidence_files: list[str], message: str)."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Check if task exists
            cur.execute("SELECT task_id FROM qm_tasks WHERE task_id = %s;", (task_id.strip(),))
            if not cur.fetchone():
                return False, [], 'ไม่พบงานที่ระบุ'

            # Gather all evidence files from logs before deleting
            cur.execute("SELECT evidence_file FROM qm_logs WHERE task_id = %s AND evidence_file IS NOT NULL;", (task_id.strip(),))
            files = [r['evidence_file'] for r in cur.fetchall() if r.get('evidence_file')]

            # Delete task (ON DELETE CASCADE handles qm_logs)
            cur.execute("DELETE FROM qm_tasks WHERE task_id = %s;", (task_id.strip(),))
            conn.commit()
            return True, files, f'ลบงาน {task_id} เรียบร้อยแล้ว'
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {e}")
        if conn:
            conn.rollback()
        return False, [], 'เกิดข้อผิดพลาดในการลบงาน'
    finally:
        if conn:
            conn.close()

def delete_work_log(task_id, log_id):
    """Delete a specific work log and recalculate the task's status and progress.
    Returns (success: bool, evidence_file: str|None, message: str)."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Fetch log to be deleted
            cur.execute("""
                SELECT log_id, task_id, evidence_file, progress_pct 
                FROM qm_logs 
                WHERE log_id = %s AND task_id = %s;
            """, (log_id, task_id.strip()))
            log_row = cur.fetchone()
            if not log_row:
                return False, None, 'ไม่พบบันทึกการทำงานที่ระบุ'

            evidence_file = log_row.get('evidence_file')

            # Delete the log
            cur.execute("DELETE FROM qm_logs WHERE log_id = %s AND task_id = %s;", (log_id, task_id.strip()))

            # Check remaining logs for this task
            cur.execute("""
                SELECT progress_pct, work_summary 
                FROM qm_logs 
                WHERE task_id = %s 
                ORDER BY log_date DESC, logged_at DESC 
                LIMIT 1;
            """, (task_id.strip(),))
            latest_remaining_log = cur.fetchone()

            # Check current task status
            cur.execute("SELECT status FROM qm_tasks WHERE task_id = %s;", (task_id.strip(),))
            curr_task = cur.fetchone()
            if curr_task:
                curr_status = (curr_task['status'] or '').strip()
                # Determine new status
                if not latest_remaining_log:
                    # No logs left at all
                    new_status = 'Pending' if curr_status != 'Cancelled' else 'Cancelled'
                else:
                    latest_pct = latest_remaining_log['progress_pct']
                    if latest_pct == 100:
                        new_status = 'Completed'
                    else:
                        if curr_status == 'Completed':
                            new_status = 'In Progress'
                        elif curr_status != 'Cancelled':
                            new_status = 'In Progress'
                        else:
                            new_status = 'Cancelled'

                if new_status == 'Completed':
                    cur.execute("""
                        UPDATE qm_tasks 
                        SET status = %s, updated_at = CURRENT_TIMESTAMP,
                            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
                        WHERE task_id = %s;
                    """, (new_status, task_id.strip()))
                else:
                    cur.execute("""
                        UPDATE qm_tasks 
                        SET status = %s, updated_at = CURRENT_TIMESTAMP, completed_at = NULL 
                        WHERE task_id = %s;
                    """, (new_status, task_id.strip()))

            conn.commit()
            return True, evidence_file, 'ลบบันทึกผลงานเรียบร้อยแล้ว'
    except Exception as e:
        logger.error(f"Error deleting work log {log_id} for task {task_id}: {e}")
        if conn:
            conn.rollback()
        return False, None, 'เกิดข้อผิดพลาดในการลบบันทึกผลงาน'
    finally:
        if conn:
            conn.close()


