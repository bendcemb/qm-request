import io
from datetime import datetime
from app.app import app

def run_tests():
    client = app.test_client()
    today_str = datetime.now().strftime('%Y-%m-%d')
    print("1. Testing /health...")
    res = client.get('/health')
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("   -> OK:", res.get_json())

    print("\n2. Testing /api/stats...")
    res = client.get('/api/stats')
    assert res.status_code == 200
    stats = res.get_json()
    assert 'total_tasks' in stats
    print(f"   -> OK: total_tasks={stats['total_tasks']}, pending={stats['pending']}, in_progress={stats['in_progress']}")

    print("\n3. Testing /api/tasks (list default without status filter - must exclude Completed and Cancelled)...")
    res = client.get('/api/tasks?limit=50')
    assert res.status_code == 200
    tasks_data = res.get_json()
    assert len(tasks_data['data']) > 0
    for item in tasks_data['data']:
        assert item['status'] not in ('Completed', 'Cancelled'), f"Task {item['task_id']} has status {item['status']}, which should be excluded from default tasks list!"
    print(f"   -> OK: fetched {len(tasks_data['data'])} tasks, total={tasks_data['total']} (verified: 0 Completed, 0 Cancelled)")

    print("\n4. Testing /api/tasks (create new task)...")
    new_task_payload = {
        'task_title': 'ทดสอบสร้างงานระบบตรวจสอบคุณภาพประจำสัปดาห์',
        'task_description': 'รายละเอียดงานตรวจสอบคุณภาพและเครื่องมือวัดตามข้อกำหนด ISO 9001',
        'category': 'Quality Control',
        'priority': '2-High',
        'assigned_to': 'qc.inspect@company.com',
        'target_date': '2026-10-20',
        'created_by': 'wanida@bpp.co.th'
    }
    res = client.post('/api/tasks', json=new_task_payload)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.data}"
    task_res = res.get_json()
    new_task_id = task_res['task_id']
    print(f"   -> OK: Created Task ID: {new_task_id}")

    print(f"\n5.1 Testing /api/tasks/{new_task_id}/logs before accept (must be rejected)...")
    log_data = {
        'reporter': 'qc.inspect@company.com',
        'work_summary': 'ตรวจสอบรายงานการสอบเทียบล็อตที่ 1 เรียบร้อย ไม่มีข้อบกพร่อง',
        'progress_pct': '50',
        'issue_blocker': 'รอเอกสารยืนยันจากแผนกคลังสินค้า',
        'log_date': today_str
    }
    res_before = client.post(f'/api/tasks/{new_task_id}/logs', json=log_data)
    assert res_before.status_code == 400, f"Expected 400, got {res_before.status_code}"
    print(f"   -> OK: Correctly rejected before accept: {res_before.get_json()}")

    print(f"\n5.2 Testing /api/tasks/{new_task_id}/accept (officer accepts task)...")
    res_accept = client.post(f'/api/tasks/{new_task_id}/accept', json={'accepted_by': 'qc.inspect@company.com'})
    assert res_accept.status_code == 200, f"Expected 200, got {res_accept.status_code}"
    print(f"   -> OK: Accepted: {res_accept.get_json()}")

    print(f"\n5.3 Testing /api/tasks/{new_task_id}/logs after accept (must succeed)...")
    # Test with sample dummy file
    file_bytes = io.BytesIO(b"Dummy evidence test content")
    data_with_file = dict(log_data)
    data_with_file['evidence_file'] = (file_bytes, 'test_evidence.pdf')

    res = client.post(f'/api/tasks/{new_task_id}/logs', data=data_with_file, content_type='multipart/form-data')
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.data}"
    log_res = res.get_json()
    print(f"   -> OK: Added Log ID: {log_res['log_id']}")

    print(f"\n6. Testing /api/tasks/{new_task_id} (get detail with timeline)...")
    res = client.get(f'/api/tasks/{new_task_id}')
    assert res.status_code == 200
    detail = res.get_json()
    assert detail['task_description'] == 'รายละเอียดงานตรวจสอบคุณภาพและเครื่องมือวัดตามข้อกำหนด ISO 9001'
    assert detail['created_by_name'] is not None
    assert detail['current_progress'] == 50
    assert len(detail['logs']) == 2 # 1 acceptance event log + 1 work progress log
    assert detail['logs'][0]['evidence_file'] is not None
    print(f"   -> OK: Verified task detail with task_description, status={detail['status']}, progress={detail['current_progress']}%, logs={len(detail['logs'])}")

    print(f"\n6.2 Testing Step 4: Progress 100% closes task (status must become Completed)...")
    res_100 = client.post(f'/api/tasks/{new_task_id}/logs', json={
        'reporter': 'qc.inspect@company.com',
        'work_summary': 'ส่งมอบงานครบถ้วน 100% ปิดงานสมบูรณ์',
        'progress_pct': '100',
        'log_date': today_str
    })
    assert res_100.status_code == 201
    res_detail_closed = client.get(f'/api/tasks/{new_task_id}')
    assert res_detail_closed.status_code == 200
    closed_detail = res_detail_closed.get_json()
    assert closed_detail['status'] == 'Completed'
    assert closed_detail['current_progress'] == 100
    assert closed_detail['completed_at'] is not None, "completed_at must be populated for completed task"
    print(f"   -> OK: Step 4 Verified! status={closed_detail['status']}, progress={closed_detail['current_progress']}%, completed_at={closed_detail['completed_at']}")

    # Verify completed_at appears in Completed tasks list query
    res_comp_tasks = client.get('/api/tasks?status=Completed')
    assert res_comp_tasks.status_code == 200
    comp_tasks_data = res_comp_tasks.get_json()['data']
    target_comp_task = next((t for t in comp_tasks_data if t['task_id'] == new_task_id), None)
    assert target_comp_task is not None, f"Task {new_task_id} must appear in Completed list"
    assert target_comp_task['completed_at'] is not None, "completed_at must be present in Completed tasks report data"
    print(f"   -> OK: Verified task in Completed report with completed_at={target_comp_task['completed_at']}")

    print(f"\n6.3 Testing cancel completed task {new_task_id} (must be rejected)...")
    res_cancel_closed = client.post(f'/api/tasks/{new_task_id}/cancel', json={'reason': 'ลองยกเลิกงานที่ปิดแล้ว'})
    assert res_cancel_closed.status_code == 400, f"Expected 400, got {res_cancel_closed.status_code}"
    print(f"   -> OK: Correctly rejected cancelling completed task: {res_cancel_closed.get_json()}")

    print("\n6.4 Testing create and cancel a Pending task...")
    res_pend = client.post('/api/tasks', json={
        'task_title': 'งานทดสอบยกเลิกขณะ Pending',
        'category': 'Quality Control',
        'priority': '3-Medium',
        'assigned_to': 'qc.inspect@company.com',
        'target_date': '2026-10-25',
        'created_by': 'wanida@bpp.co.th'
    })
    assert res_pend.status_code == 201
    cancel_task_id = res_pend.get_json()['task_id']
    res_cancel_pend = client.post(f'/api/tasks/{cancel_task_id}/cancel', json={'reason': 'ยกเลิกเนื่องจากแจ้งข้อมูลผิดพลาด'})
    assert res_cancel_pend.status_code == 200, f"Expected 200, got {res_cancel_pend.status_code}"
    res_pend_detail = client.get(f'/api/tasks/{cancel_task_id}')
    assert res_pend_detail.status_code == 200
    pend_detail = res_pend_detail.get_json()
    assert pend_detail['status'] == 'Cancelled'
    assert len(pend_detail['logs']) >= 1
    assert 'ขอยกเลิกงาน' in pend_detail['logs'][0]['work_summary']
    print(f"   -> OK: Cancelled Pending task verified! status={pend_detail['status']}, audit_log={pend_detail['logs'][0]['work_summary']}")

    print("\n7. Testing /api/export (Excel export)...")
    res = client.get('/api/export')
    assert res.status_code == 200
    assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in res.content_type
    print(f"   -> OK: Excel generated, byte size={len(res.data)}")

    print("\n8. Testing GET / (HTML Dashboard)...")
    res = client.get('/')
    assert res.status_code == 200
    assert b"QM-Request & Work Log" in res.data
    print("   -> OK: Web dashboard HTML served successfully.")

    print("\n9. Testing Admin Authentication and Deletion Privileges...")
    
    # 9.1 Status without login
    res_auth_st = client.get('/api/auth/status')
    assert res_auth_st.status_code == 200
    assert res_auth_st.get_json()['is_admin'] is False
    print("   -> OK: Initial auth status is_admin=False")

    # 9.2 Unauthorized deletions must return 403
    res_del_task_unauth = client.delete(f'/api/tasks/{new_task_id}')
    assert res_del_task_unauth.status_code == 403, f"Expected 403, got {res_del_task_unauth.status_code}"
    print("   -> OK: DELETE /api/tasks/<id> without login rejected with 403")

    res_del_log_unauth = client.delete(f'/api/tasks/{new_task_id}/logs/1')
    assert res_del_log_unauth.status_code == 403
    print("   -> OK: DELETE /api/tasks/<id>/logs/<id> without login rejected with 403")

    res_del_team_unauth = client.delete('/api/team/qc.inspect@company.com')
    assert res_del_team_unauth.status_code == 403
    print("   -> OK: DELETE /api/team/<email> without login rejected with 403")

    res_del_cat_unauth = client.delete('/api/categories/1')
    assert res_del_cat_unauth.status_code == 403
    print("   -> OK: DELETE /api/categories/<id> without login rejected with 403")

    # 9.3 Login with wrong password
    res_wrong = client.post('/api/auth/login', json={'password': 'wrong_password_123'})
    assert res_wrong.status_code == 401
    print("   -> OK: Login with wrong password rejected with 401")

    # 9.4 Login with correct password
    from app.config import Config
    res_login = client.post('/api/auth/login', json={'password': Config.ADMIN_PASSWORD})
    assert res_login.status_code == 200
    assert res_login.get_json()['is_admin'] is True
    print("   -> OK: Login with correct password succeeded, is_admin=True")

    # Check status after login
    res_auth_after = client.get('/api/auth/status')
    assert res_auth_after.get_json()['is_admin'] is True
    print("   -> OK: Status after login confirmed is_admin=True")

    # 9.5 Test Admin Category Deletion
    res_add_cat = client.post('/api/categories', json={'name': 'TempCatForDelete', 'description': 'ทดสอบลบ'})
    assert res_add_cat.status_code in (200, 201)
    cats = client.get('/api/categories').get_json()
    temp_cat = next((c for c in cats if c['name'] == 'TempCatForDelete'), None)
    assert temp_cat is not None
    res_del_cat = client.delete(f"/api/categories/{temp_cat['cat_id']}")
    assert res_del_cat.status_code == 200
    print("   -> OK: Admin deleted category successfully")

    # 9.6 Test Admin Team Member Deletion
    res_add_mem = client.post('/api/team', json={
        'emp_id': 'TEST999',
        'email': 'temp.member@company.com',
        'full_name': 'สมาชิกชั่วคราว',
        'role': 'Tester'
    })
    assert res_add_mem.status_code == 200
    res_del_mem = client.delete('/api/team/temp.member@company.com')
    assert res_del_mem.status_code == 200
    print("   -> OK: Admin deleted team member successfully")

    # 9.7 Test Admin Work Log Deletion with Progress Recalculation
    # Create a fresh task for log deletion test
    res_log_task = client.post('/api/tasks', json={
        'task_title': 'งานทดสอบลบ Log',
        'category': 'Quality Control',
        'priority': '3-Medium',
        'assigned_to': 'qc.inspect@company.com',
        'target_date': '2026-10-30',
        'created_by': 'wanida@bpp.co.th'
    })
    assert res_log_task.status_code == 201, f"Expected 201, got {res_log_task.status_code}: {res_log_task.data}"
    log_task_id = res_log_task.get_json()['task_id']
    client.post(f'/api/tasks/{log_task_id}/accept', json={'accepted_by': 'qc.inspect@company.com'})

    # Add log 1 (30%)
    res_l1 = client.post(f'/api/tasks/{log_task_id}/logs', json={
        'reporter': 'qc.inspect@company.com',
        'work_summary': 'ทำขั้นตอนที่ 1 คืบหน้า 30%',
        'progress_pct': '30',
        'log_date': today_str
    })
    l1_id = res_l1.get_json()['log_id']

    # Add log 2 (100% - closes task)
    res_l2 = client.post(f'/api/tasks/{log_task_id}/logs', json={
        'reporter': 'qc.inspect@company.com',
        'work_summary': 'ทำขั้นตอนที่ 2 เสร็จ 100%',
        'progress_pct': '100',
        'log_date': today_str
    })
    l2_id = res_l2.get_json()['log_id']

    # Verify task is Completed, progress 100%
    task_before_del = client.get(f'/api/tasks/{log_task_id}').get_json()
    assert task_before_del['status'] == 'Completed'
    assert task_before_del['current_progress'] == 100

    # Admin deletes Log 2
    res_del_log2 = client.delete(f'/api/tasks/{log_task_id}/logs/{l2_id}')
    assert res_del_log2.status_code == 200

    # Task should now revert back to In Progress, progress 30%
    task_after_del = client.get(f'/api/tasks/{log_task_id}').get_json()
    assert task_after_del['status'] == 'In Progress'
    assert task_after_del['current_progress'] == 30
    print(f"   -> OK: Work log deleted, progress correctly recalculated back to 30%, status reverted to {task_after_del['status']}!")

    # 9.8 Test Admin Task Deletion
    res_del_task = client.delete(f'/api/tasks/{log_task_id}')
    assert res_del_task.status_code == 200
    res_verify_gone = client.get(f'/api/tasks/{log_task_id}')
    assert res_verify_gone.status_code == 404
    print(f"   -> OK: Task {log_task_id} and its cascading logs completely deleted from database!")

    # 9.9 Logout
    res_logout = client.post('/api/auth/logout')
    assert res_logout.status_code == 200
    assert client.get('/api/auth/status').get_json()['is_admin'] is False
    # Subsequent delete should be 403 again
    res_del_after_logout = client.delete(f'/api/tasks/{new_task_id}')
    assert res_del_after_logout.status_code == 403
    print("   -> OK: Logout succeeded, subsequent deletion rejected with 403!")

    # Clean up the test task created in step 4
    # Log back in as admin to clean up
    client.post('/api/auth/login', json={'password': Config.ADMIN_PASSWORD})
    client.delete(f'/api/tasks/{new_task_id}')
    client.delete(f'/api/tasks/{cancel_task_id}')
    client.post('/api/auth/logout')

    print("\n==========================================")
    print(" ALL 10 INTEGRATION TESTS PASSED CLEANLY! ")
    print("==========================================")

if __name__ == '__main__':
    run_tests()

