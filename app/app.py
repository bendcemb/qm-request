import os
import io
import uuid
import time
import hmac
import logging
from functools import wraps
from pathlib import Path
from flask import (
    Flask, render_template, request, jsonify, 
    send_file, send_from_directory, abort, session
)
from werkzeug.utils import secure_filename
import pandas as pd
from app.config import Config
from app.db import (
    init_database,
    get_dashboard_stats,
    get_tasks,
    get_task_by_id,
    create_task,
    update_task_status,
    accept_task,
    cancel_task,
    delete_task,
    add_work_log,
    delete_work_log,
    get_team_members,
    add_or_update_team_member,
    delete_team_member,
    export_all_data,
    get_active_tasks_summary,
    get_all_work_logs,
    get_categories,
    save_category,
    delete_category
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.config.from_object(Config)
# Handle reverse proxy headers (X-Forwarded-Prefix: /qm-request)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Session cookie security configuration
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# In-memory rate limiting for admin login attempts (IP -> list of timestamps)
_login_failed_attempts = {}

def is_login_rate_limited(ip):
    now = time.time()
    attempts = _login_failed_attempts.get(ip, [])
    valid_attempts = [t for t in attempts if now - t < 60]
    _login_failed_attempts[ip] = valid_attempts
    return len(valid_attempts) >= 5

def record_failed_login(ip):
    now = time.time()
    attempts = _login_failed_attempts.get(ip, [])
    attempts.append(now)
    _login_failed_attempts[ip] = [t for t in attempts if now - t < 60]

def reset_login_attempts(ip):
    _login_failed_attempts.pop(ip, None)

def admin_required(f):
    """Decorator to enforce Admin authentication on sensitive endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({'error': 'ต้องใช้สิทธิ์ผู้ดูแลระบบ (Admin) ในการดำเนินการนี้'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Ensure uploads directory exists
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

# Security Headers
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

def is_allowed_file(filename):
    """Check if file extension is within whitelist."""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in Config.ALLOWED_EXTENSIONS

# ----------------- Web UI Routes -----------------

@app.route('/')
def index():
    """Render main web dashboard."""
    team = get_team_members(only_active=True)
    categories = get_categories(only_active=True)
    return render_template('index.html', team=team, categories=categories)

@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'qm-request'}), 200

@app.route('/favicon.ico')
def favicon():
    """Serve favicon icon."""
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

# ----------------- Authentication Routes -----------------

@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    """Verify Master Admin Passcode and grant admin session."""
    client_ip = request.remote_addr or 'unknown'
    if is_login_rate_limited(client_ip):
        return jsonify({'error': 'พยายามเข้าสู่ระบบผิดพลาดบ่อยเกินไป กรุณารอ 1 นาทีแล้วลองใหม่'}), 429

    payload = request.get_json(silent=True) or request.form.to_dict()
    password = str(payload.get('password', '')).strip()

    if not password:
        return jsonify({'error': 'กรุณากรอกรหัสผ่าน Admin'}), 400

    expected_pwd = Config.ADMIN_PASSWORD
    # Constant-time comparison to prevent timing attacks
    if hmac.compare_digest(password, expected_pwd):
        reset_login_attempts(client_ip)
        session['is_admin'] = True
        return jsonify({'success': True, 'message': 'เข้าสู่ระบบ Admin สำเร็จ', 'is_admin': True})
    else:
        record_failed_login(client_ip)
        return jsonify({'error': 'รหัสผ่าน Admin ไม่ถูกต้อง'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    """Clear Admin session."""
    session.clear()
    return jsonify({'success': True, 'message': 'ออกจากระบบ Admin เรียบร้อยแล้ว', 'is_admin': False})

@app.route('/api/auth/status')
def api_auth_status():
    """Check current Admin authentication status."""
    return jsonify({'is_admin': bool(session.get('is_admin', False))})

# ----------------- REST API Endpoints -----------------

@app.route('/api/stats')
def api_stats():
    """Fetch dashboard KPI metrics."""
    try:
        stats = get_dashboard_stats()
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error in api_stats: {e}")
        return jsonify({'error': 'Failed to retrieve stats'}), 500

@app.route('/api/tasks')
def api_get_tasks():
    """Search and filter tasks."""
    try:
        search = request.args.get('search', '').strip()[:100]
        category = request.args.get('category', '').strip()[:100]
        priority = request.args.get('priority', '').strip()[:20]
        status = request.args.get('status', '').strip()[:30]
        assigned_to = request.args.get('assigned_to', '').strip()[:120]
        
        try:
            page = max(1, int(request.args.get('page', 1)))
        except ValueError:
            page = 1
            
        try:
            limit = min(100, max(1, int(request.args.get('limit', 25))))
        except ValueError:
            limit = 25
            
        sort_by = request.args.get('sort_by', '').strip()[:30]
        sort_dir = request.args.get('sort_dir', 'asc').strip()[:10]
        
        data = get_tasks(
            search=search,
            category=category,
            priority=priority,
            status=status,
            assigned_to=assigned_to,
            page=page,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir
        )
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error in api_get_tasks: {e}")
        return jsonify({'error': 'Failed to fetch tasks'}), 500

@app.route('/api/tasks/<task_id>')
def api_get_task_detail(task_id):
    """Get single task details with work logs timeline."""
    try:
        task = get_task_by_id(task_id.strip())
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        return jsonify(task)
    except Exception as e:
        logger.error(f"Error in api_get_task_detail: {e}")
        return jsonify({'error': 'Failed to fetch task details'}), 500

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
@admin_required
def api_delete_task(task_id):
    """Delete a task and its associated logs and evidence files (Admin only)."""
    try:
        task_clean = task_id.strip()
        success, files, msg = delete_task(task_clean)
        if not success:
            return jsonify({'error': msg}), 404

        # Clean up evidence files from disk securely
        for fname in files:
            safe_name = secure_filename(fname)
            if safe_name and safe_name == fname:
                target_path = os.path.join(Config.UPLOAD_FOLDER, safe_name)
                if os.path.isfile(target_path):
                    try:
                        os.remove(target_path)
                    except Exception as fe:
                        logger.warning(f"Could not remove evidence file {target_path}: {fe}")

        return jsonify({'success': True, 'message': msg})
    except Exception as e:
        logger.error(f"Error in api_delete_task {task_id}: {e}")
        return jsonify({'error': 'เกิดข้อผิดพลาดในการลบงาน'}), 500

@app.route('/api/tasks', methods=['POST'])
def api_create_task():
    """Create a new QM task."""
    try:
        payload = request.get_json(silent=True) or request.form.to_dict()
        
        # Validation
        task_title = payload.get('task_title', '').strip()
        task_description = str(payload.get('task_description', '')).strip()[:2000]
        category = payload.get('category', '').strip()
        assigned_to = payload.get('assigned_to', '').strip()
        target_date = payload.get('target_date', '').strip()
        priority = payload.get('priority', '3-Normal').strip()
        created_by = payload.get('created_by', '').strip().lower()
        
        if not task_title or not category or not assigned_to or not target_date or not created_by:
            return jsonify({'error': 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'}), 400

        active_emails = {m['email'].lower() for m in get_team_members(only_active=True)}
        if created_by not in active_emails:
            return jsonify({'error': 'ผู้เปิดงานต้องเป็นสมาชิกในทีม QM ที่ยัง Active'}), 400

        active_categories = {c['name'] for c in get_categories(only_active=True)}
        if category not in active_categories:
            return jsonify({'error': 'หมวดหมู่งานไม่ถูกต้อง หรือถูกปิดใช้งานแล้ว'}), 400
            
        new_task_id = create_task({
            'task_title': task_title,
            'task_description': task_description,
            'category': category,
            'priority': priority,
            'assigned_to': assigned_to,
            'target_date': target_date,
            'created_by': created_by,
            'status': 'Pending'
        })
        
        return jsonify({
            'success': True,
            'message': 'เปิดงานระบบ QM สำเร็จ',
            'task_id': new_task_id
        }), 201
    except Exception as e:
        logger.error(f"Error in api_create_task: {e}")
        return jsonify({'error': 'Failed to create task'}), 500

@app.route('/api/tasks/<task_id>/status', methods=['PUT', 'POST'])
def api_update_status(task_id):
    """Update task status."""
    try:
        payload = request.get_json(silent=True) or request.form.to_dict()
        status = payload.get('status', '').strip()
        valid_statuses = {'Pending', 'In Progress', 'Under Review', 'Completed', 'Cancelled'}
        if status not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400
            
        success = update_task_status(task_id.strip(), status)
        if success:
            return jsonify({'success': True, 'message': 'อัปเดตสถานะงานสำเร็จ'})
        else:
            return jsonify({'error': 'Task not found or update failed'}), 404
    except Exception as e:
        logger.error(f"Error in api_update_status: {e}")
@app.route('/api/tasks/<task_id>/accept', methods=['POST'])
def api_accept_task(task_id):
    """Officer accepts task, changing status from Pending to In Progress."""
    try:
        payload = request.get_json(silent=True) or request.form.to_dict() or {}
        accepted_by = payload.get('accepted_by')
        success, message = accept_task(task_id.strip(), accepted_by=accepted_by)
        if success:
            return jsonify({'success': True, 'message': message})
        return jsonify({'error': message}), 400
    except Exception as e:
        logger.error(f"Error in api_accept_task: {e}")
        return jsonify({'error': 'Failed to accept task'}), 500

@app.route('/api/tasks/<task_id>/cancel', methods=['POST'])
def api_cancel_task(task_id):
    """Cancel a task with optional reason."""
    try:
        payload = request.get_json(silent=True) or request.form.to_dict() or {}
        reason = payload.get('reason', '').strip()
        cancelled_by = payload.get('cancelled_by')
        success, message = cancel_task(task_id.strip(), reason=reason, cancelled_by=cancelled_by)
        if success:
            return jsonify({'success': True, 'message': message})
        return jsonify({'error': message}), 400
    except Exception as e:
        logger.error(f"Error in api_cancel_task: {e}")
        return jsonify({'error': 'Failed to cancel task'}), 500

@app.route('/api/tasks/active')
def api_active_tasks():
    """Retrieve active tasks for dropdown selectors in work log forms."""
    try:
        tasks = get_active_tasks_summary()
        return jsonify(tasks)
    except Exception as e:
        logger.error(f"Error in api_active_tasks: {e}")
        return jsonify({'error': 'Failed to retrieve active tasks'}), 500

@app.route('/api/tasks/<task_id>/logs', methods=['POST'])
def api_add_log(task_id):
    """Add daily work log with optional file attachment."""
    try:
        task = get_task_by_id(task_id.strip())
        if not task:
            return jsonify({'error': 'Task not found'}), 404
            
        # Form or JSON
        reporter = request.form.get('reporter') or (request.json.get('reporter') if request.is_json else None)
        work_summary = request.form.get('work_summary') or (request.json.get('work_summary') if request.is_json else None)
        progress_pct = request.form.get('progress_pct') or (request.json.get('progress_pct') if request.is_json else 0)
        issue_blocker = request.form.get('issue_blocker', '') or (request.json.get('issue_blocker', '') if request.is_json else '')
        log_date = request.form.get('log_date') or (request.json.get('log_date') if request.is_json else None)
        auto_accept = request.form.get('auto_accept') in ('true', '1', True) or (request.is_json and request.json.get('auto_accept'))

        if task.get('status') == 'Pending':
            if not auto_accept:
                return jsonify({'error': 'ต้องกดรับงานก่อน จึงจะสามารถบันทึกผลงานได้'}), 400
            # Auto accept task
            accept_task(task_id.strip(), accepted_by=reporter)
            
        if not reporter or not work_summary:
            return jsonify({'error': 'กรุณากรอกผู้บันทึกและรายละเอียดการปฏิบัติงาน'}), 400
            
        try:
            progress_val = max(0, min(100, int(progress_pct)))
        except ValueError:
            progress_val = 0
            
        # Handle file upload safely
        evidence_filename = None
        original_filename = None
        
        if 'evidence_file' in request.files:
            file = request.files['evidence_file']
            if file and file.filename != '':
                if not is_allowed_file(file.filename):
                    return jsonify({'error': 'นามสกุลไฟล์ไม่ถูกต้อง (อนุญาตเฉพาะ .pdf, .png, .jpg, .xlsx, .docx)'}), 400
                    
                orig_clean = secure_filename(file.filename)
                ext = orig_clean.rsplit('.', 1)[1].lower() if '.' in orig_clean else 'bin'
                unique_name = f"{uuid.uuid4().hex}.{ext}"
                save_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
                file.save(save_path)
                evidence_filename = unique_name
                original_filename = orig_clean
                
        log_id = add_work_log({
            'task_id': task_id.strip(),
            'log_date': log_date,
            'reporter': reporter.strip(),
            'work_summary': work_summary.strip(),
            'progress_pct': progress_val,
            'issue_blocker': issue_blocker.strip(),
            'evidence_file': evidence_filename,
            'original_filename': original_filename
        })
        
        return jsonify({
            'success': True,
            'message': 'บันทึกผลการปฏิบัติงานเรียบร้อยแล้ว',
            'log_id': log_id
        }), 201
    except Exception as e:
        logger.error(f"Error in api_add_log: {e}")
        return jsonify({'error': 'Failed to add work log'}), 500

@app.route('/api/tasks/<task_id>/logs/<int:log_id>', methods=['DELETE'])
@admin_required
def api_delete_work_log(task_id, log_id):
    """Delete a work log and recalculate parent task progress/status (Admin only)."""
    try:
        task_clean = task_id.strip()
        success, evidence_file, msg = delete_work_log(task_clean, log_id)
        if not success:
            return jsonify({'error': msg}), 404

        # Clean up evidence file if present
        if evidence_file:
            safe_name = secure_filename(evidence_file)
            if safe_name and safe_name == evidence_file:
                target_path = os.path.join(Config.UPLOAD_FOLDER, safe_name)
                if os.path.isfile(target_path):
                    try:
                        os.remove(target_path)
                    except Exception as fe:
                        logger.warning(f"Could not remove evidence file {target_path}: {fe}")

        return jsonify({'success': True, 'message': msg})
    except Exception as e:
        logger.error(f"Error in api_delete_work_log {log_id}: {e}")
        return jsonify({'error': 'เกิดข้อผิดพลาดในการลบบันทึกผลงาน'}), 500

@app.route('/api/logs', methods=['GET'])
def api_get_logs():
    """Retrieve filtered and paginated daily work logs across all tasks."""
    try:
        search = request.args.get('search', '').strip()[:100]
        reporter = request.args.get('reporter', '').strip()[:120]
        task_id = request.args.get('task_id', '').strip()[:30]
        log_date = request.args.get('log_date', '').strip()[:20]
        
        try:
            page = max(1, int(request.args.get('page', 1)))
        except ValueError:
            page = 1
            
        try:
            limit = min(100, max(1, int(request.args.get('limit', 25))))
        except ValueError:
            limit = 25
            
        data = get_all_work_logs(
            search=search,
            reporter=reporter,
            task_id=task_id,
            log_date=log_date,
            page=page,
            limit=limit
        )
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error in api_get_logs: {e}")
        return jsonify({'error': 'Failed to fetch work logs'}), 500

@app.route('/api/logs', methods=['POST'])
def api_post_logs():
    """General endpoint to record a daily work log."""
    task_id = request.form.get('task_id') or (request.json.get('task_id') if request.is_json else None)
    if not task_id:
        return jsonify({'error': 'กรุณาระบุรหัสงาน (task_id)'}), 400
    return api_add_log(task_id.strip())

@app.route('/api/team')
def api_team():
    """Retrieve team members list."""
    try:
        members = get_team_members(only_active=False)
        return jsonify(members)
    except Exception as e:
        logger.error(f"Error in api_team: {e}")
        return jsonify({'error': 'Failed to retrieve team members'}), 500

@app.route('/api/team', methods=['POST'])
def api_save_team():
    """Add or update team member."""
    try:
        payload = request.get_json(silent=True) or request.form.to_dict()
        email = payload.get('email', '').strip()
        full_name = payload.get('full_name', '').strip()
        role = payload.get('role', '').strip()
        emp_id = payload.get('emp_id', '').strip()
        is_active = payload.get('is_active', True)
        if isinstance(is_active, str):
            is_active = is_active.lower() in ('true', '1')
        original_email = payload.get('original_email', '').strip() or None
        
        if not email or not full_name or not role:
            return jsonify({'error': 'กรุณากรอก Email, ชื่อ-นามสกุล, และบทบาท'}), 400
            
        success = add_or_update_team_member({
            'emp_id': emp_id,
            'email': email,
            'full_name': full_name,
            'role': role,
            'is_active': is_active
        }, original_email=original_email)
        if success:
            return jsonify({'success': True, 'message': 'บันทึกข้อมูลสมาชิกสำเร็จ'})
        return jsonify({'error': 'Failed to save member'}), 500
    except Exception as e:
        logger.error(f"Error saving team member: {e}")
        return jsonify({'error': 'Failed to save team member'}), 500

@app.route('/api/team/<path:email>', methods=['DELETE'])
@admin_required
def api_delete_team(email):
    """Delete a team member (Admin only)."""
    try:
        email_clean = email.strip().lower()
        success = delete_team_member(email_clean)
        if success:
            return jsonify({'success': True, 'message': 'ลบสมาชิกเรียบร้อยแล้ว'})
        return jsonify({'error': 'Failed to delete member'}), 500
    except Exception as e:
        logger.error(f"Error in api_delete_team: {e}")
        return jsonify({'error': 'Failed to delete member'}), 500

# ----------------- Category Settings API -----------------

@app.route('/api/categories')
def api_categories():
    """List categories (all, including inactive) for settings and dropdowns."""
    return jsonify(get_categories(only_active=False))

@app.route('/api/categories', methods=['POST'])
def api_save_category():
    """Add a new category, or update when cat_id is supplied."""
    try:
        payload = request.get_json(silent=True) or request.form.to_dict()
        name = str(payload.get('name', '')).strip()
        description = str(payload.get('description', '')).strip()
        is_active = payload.get('is_active', True)
        if isinstance(is_active, str):
            is_active = is_active.lower() in ('true', '1')
        cat_id = payload.get('cat_id') or None
        if cat_id is not None:
            try:
                cat_id = int(cat_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'รหัสหมวดหมู่ไม่ถูกต้อง'}), 400

        if not name:
            return jsonify({'error': 'กรุณากรอกชื่อหมวดหมู่'}), 400
        if len(name) > 100 or len(description) > 150:
            return jsonify({'error': 'ชื่อหมวดหมู่ไม่เกิน 100 ตัวอักษร และคำอธิบายไม่เกิน 150 ตัวอักษร'}), 400

        ok, msg = save_category(
            {'name': name, 'description': description, 'is_active': bool(is_active)},
            cat_id=cat_id
        )
        if ok:
            return jsonify({'success': True, 'message': msg})
        return jsonify({'error': msg}), 400
    except Exception as e:
        logger.error(f"Error in api_save_category: {e}")
        return jsonify({'error': 'Failed to save category'}), 500

@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
@admin_required
def api_delete_category(cat_id):
    """Delete a category (existing tasks keep their category text, Admin only)."""
    if delete_category(cat_id):
        return jsonify({'success': True, 'message': 'ลบหมวดหมู่เรียบร้อยแล้ว'})
    return jsonify({'error': 'ไม่พบหมวดหมู่ หรือลบไม่สำเร็จ'}), 404

@app.route('/uploads/<filename>')
def serve_upload(filename):
    """Safely serve uploaded evidence files."""
    # Prevent path traversal
    safe_name = secure_filename(filename)
    if not safe_name or safe_name != filename:
        abort(404)
    file_path = os.path.join(Config.UPLOAD_FOLDER, safe_name)
    if not os.path.isfile(file_path):
        abort(404)
    return send_from_directory(Config.UPLOAD_FOLDER, safe_name, as_attachment=False)

@app.route('/api/export')
def api_export_excel():
    """Export tasks, logs, and team to Excel with multiple sheets matching qm-request.xlsx."""
    try:
        data = export_all_data()
        output = io.BytesIO()
        
        df_task = pd.DataFrame(data['task'])
        df_log = pd.DataFrame(data['log'])
        df_team = pd.DataFrame(data['team'])
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_task.to_excel(writer, index=False, sheet_name='task')
            df_log.to_excel(writer, index=False, sheet_name='log')
            df_team.to_excel(writer, index=False, sheet_name='team')
            
        output.seek(0)
        filename = f"QM_Request_Export_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        logger.error(f"Error in api_export_excel: {e}")
        return jsonify({'error': 'Export failed'}), 500

# Initialize tables when starting
init_database()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.DEBUG)
