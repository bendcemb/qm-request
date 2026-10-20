/**
 * QM-Request & Daily Work Log Application
 * Interactive Vanilla JavaScript Controller
 * Built strictly with safe DOM manipulation (zero innerHTML)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    const state = {
        activeTab: 'tasks',
        page: 1,
        limit: 15,
        search: '',
        category: '',
        priority: '',
        status: '',
        assigned_to: '',
        sortBy: '',
        sortDir: 'asc',
        totalPages: 1,
        totalTasks: 0,
        activeTaskForLog: null,
        taskToCancel: null,
        // Logs View State
        logsPage: 1,
        logsLimit: 15,
        logsSearch: '',
        logsReporter: '',
        logsDate: '',
        logsTotalPages: 1,
        logsTotal: 0,
        activeTasksList: [],
        isAdmin: false,
        pendingDeleteAction: null
    };

    // Base URL resolution for both direct port access and Nginx reverse proxy subpaths (e.g. /qm-request/)
    const getBasePath = () => {
        if (window.APP_CONFIG && window.APP_CONFIG.basePath) {
            let b = window.APP_CONFIG.basePath;
            return b.endsWith('/') ? b : b + '/';
        }
        let p = window.location.pathname;
        if (!p.endsWith('/')) {
            p = p.substring(0, p.lastIndexOf('/') + 1);
        }
        return p || '/';
    };
    const BASE_PATH = getBasePath();

    // Elements Cache
    const el = {
        // Stats
        statTotal: document.getElementById('stat-total'),
        statPending: document.getElementById('stat-pending'),
        statProgress: document.getElementById('stat-progress'),
        statCompleted: document.getElementById('stat-completed'),
        statUrgent: document.getElementById('stat-urgent'),
        statOverdue: document.getElementById('stat-overdue'),
        statsSection: document.getElementById('stats-section'),

        // Status Report Tabs & Panes
        statusTabsNav: document.querySelector('.status-tabs-nav'),
        statusTabBtns: document.querySelectorAll('.status-tab-btn'),
        paneTasks: document.getElementById('pane-tasks'),
        paneStatusSummary: document.getElementById('pane-status-summary'),
        tableViewTitle: document.getElementById('table-view-title'),
        badgeStatusAll: document.getElementById('badge-status-all'),
        badgeStatusPending: document.getElementById('badge-status-pending'),
        badgeStatusProgress: document.getElementById('badge-status-progress'),
        badgeStatusCompleted: document.getElementById('badge-status-completed'),
        badgeStatusOverdue: document.getElementById('badge-status-overdue'),
        badgeStatusCancelled: document.getElementById('badge-status-cancelled'),

        // Filters
        inputSearch: document.getElementById('input-search'),
        btnClearSearch: document.getElementById('btn-clear-search'),
        selectCategory: document.getElementById('select-category'),
        selectPriority: document.getElementById('select-priority'),
        selectAssignee: document.getElementById('select-assignee'),
        btnResetFilters: document.getElementById('btn-reset-filters'),

        // Table & Views
        tasksTable: document.getElementById('tasks-table'),
        tasksTbody: document.getElementById('tasks-tbody'),
        thTargetDateTitle: document.getElementById('th-target-date-title'),
        thColProgress: document.getElementById('th-col-progress'),
        thProgressTitle: document.getElementById('th-progress-title'),
        thColStatus: document.getElementById('th-col-status'),
        thStatusTitle: document.getElementById('th-status-title'),
        countDisplay: document.getElementById('count-display'),
        loadingState: document.getElementById('loading-state'),
        emptyState: document.getElementById('empty-state'),
        paginationBar: document.getElementById('pagination-bar'),
        paginationInfo: document.getElementById('pagination-info'),
        paginationControls: document.getElementById('pagination-controls'),

        // Actions
        btnOpenCreate: document.getElementById('btn-open-create-task'),
        btnOpenLog: document.getElementById('btn-open-log-work'),
        btnPaneAddLog: document.getElementById('btn-pane-add-log'),
        btnExportExcel: document.getElementById('btn-export-excel'),
        btnManageTeam: document.getElementById('btn-manage-team'),

        // Modals
        modalCreate: document.getElementById('modal-create-task'),
        modalLog: document.getElementById('modal-log-work'),
        modalDetail: document.getElementById('modal-task-detail'),
        modalTeam: document.getElementById('modal-team'),
        detailModalBody: document.getElementById('detail-modal-body'),
        btnDetailAcceptTask: document.getElementById('btn-detail-accept-task'),
        btnDetailCancelTask: document.getElementById('btn-detail-cancel-task'),
        modalCancelTask: document.getElementById('modal-cancel-task'),
        cancelTaskPromptText: document.getElementById('cancel-task-prompt-text'),
        cancelReasonInput: document.getElementById('cancel-reason-input'),
        btnConfirmCancelTask: document.getElementById('btn-confirm-cancel-task'),

        // Forms
        formCreate: document.getElementById('form-create-task'),
        formLog: document.getElementById('form-log-work'),
        formTeam: document.getElementById('form-add-team-member'),

        // Log Inputs
        logTaskId: document.getElementById('log-task-id'),
        logTaskSelectGroup: document.getElementById('log-task-select-group'),
        logTaskSelect: document.getElementById('log-task-select'),
        logTaskBanner: document.getElementById('log-task-banner'),
        logBannerTitle: document.getElementById('log-banner-title'),
        logBannerBadge: document.getElementById('log-banner-badge'),
        logBannerStatus: document.getElementById('log-banner-status'),
        logBannerAssignee: document.getElementById('log-banner-assignee'),
        logBannerDue: document.getElementById('log-banner-due'),
        logBannerProgress: document.getElementById('log-banner-progress'),
        logPendingAlert: document.getElementById('log-pending-alert'),
        btnModalAcceptPending: document.getElementById('btn-modal-accept-pending'),
        logDate: document.getElementById('log-date'),
        logProgressSlider: document.getElementById('log-progress-slider'),
        progressValText: document.getElementById('progress-val-text'),

        // Logs View Controls
        inputSearchLogs: document.getElementById('input-search-logs'),
        btnClearSearchLogs: document.getElementById('btn-clear-search-logs'),
        selectReporterLogs: document.getElementById('select-reporter-logs'),
        inputDateLogs: document.getElementById('input-date-logs'),
        btnResetLogsFilters: document.getElementById('btn-reset-logs-filters'),
        logsTable: document.getElementById('logs-table'),
        logsTbody: document.getElementById('logs-tbody'),
        logsCountDisplay: document.getElementById('logs-count-display'),
        logsEmptyState: document.getElementById('logs-empty-state'),
        logsLoadingState: document.getElementById('logs-loading-state'),
        logsPaginationBar: document.getElementById('logs-pagination-bar'),
        logsPaginationInfo: document.getElementById('logs-pagination-info'),
        logsPaginationControls: document.getElementById('logs-pagination-controls'),

        // Team
        teamList: document.getElementById('team-members-list'),

        // Admin & Delete Modals
        adminBadge: document.getElementById('admin-status-badge'),
        btnAdminQuickLogout: document.getElementById('btn-admin-quick-logout'),
        btnAdminLoginMenu: document.getElementById('btn-admin-login-menu'),
        btnAdminLoginMenuText: document.getElementById('btn-admin-login-menu-text'),
        adminMenuIcon: document.getElementById('admin-menu-icon'),
        modalAdminLogin: document.getElementById('modal-admin-login'),
        formAdminLogin: document.getElementById('form-admin-login'),
        adminPasswordInput: document.getElementById('admin-password-input'),
        adminLoginError: document.getElementById('admin-login-error'),
        btnToggleAdminPassword: document.getElementById('btn-toggle-admin-password'),
        iconToggleAdminPassword: document.getElementById('icon-toggle-admin-password'),
        btnSubmitAdminLogin: document.getElementById('btn-submit-admin-login'),
        btnSubmitAdminLoginText: document.getElementById('btn-submit-admin-login-text'),
        modalConfirmDelete: document.getElementById('modal-confirm-delete'),
        deleteConfirmMessage: document.getElementById('delete-confirm-message'),
        btnConfirmDeleteExecute: document.getElementById('btn-confirm-delete-execute'),
        btnDetailDeleteTask: document.getElementById('btn-detail-delete-task'),

        // Toasts
        toastContainer: document.getElementById('toast-container')
    };

    // Set today's date in default date pickers
    const todayStr = new Date().toISOString().split('T')[0];
    if (el.logDate) el.logDate.value = todayStr;
    const createTargetDate = document.getElementById('create-task-target-date');
    if (createTargetDate) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        createTargetDate.value = nextWeek.toISOString().split('T')[0];
    }

    // ==========================================
    // Notification Toast System
    // ==========================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'fa-solid fa-circle-check text-success' : 'fa-solid fa-circle-exclamation text-danger';

        const textSpan = document.createElement('span');
        textSpan.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(textSpan);
        el.toastContainer.appendChild(toast);

        // Animation in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // Fetch & Render Stats
    // ==========================================
    async function loadStats() {
        try {
            const res = await fetch(`${BASE_PATH}api/stats`);
            if (!res.ok) throw new Error('Failed to fetch stats');
            const data = await res.json();

            if (el.statTotal) el.statTotal.textContent = data.total_tasks || 0;
            if (el.statPending) el.statPending.textContent = data.pending || 0;
            if (el.statProgress) el.statProgress.textContent = data.in_progress || 0;
            if (el.statCompleted) el.statCompleted.textContent = data.completed || 0;
            if (el.statUrgent) el.statUrgent.textContent = data.urgent || 0;
            if (el.statOverdue) el.statOverdue.textContent = data.overdue || 0;

            if (el.badgeStatusAll) el.badgeStatusAll.textContent = data.total_tasks || 0;
            if (el.badgeStatusPending) el.badgeStatusPending.textContent = data.pending || 0;
            if (el.badgeStatusProgress) el.badgeStatusProgress.textContent = data.in_progress || 0;
            if (el.badgeStatusCompleted) el.badgeStatusCompleted.textContent = data.completed || 0;
            if (el.badgeStatusOverdue) el.badgeStatusOverdue.textContent = data.overdue || 0;
            if (el.badgeStatusCancelled) el.badgeStatusCancelled.textContent = data.cancelled || 0;

            state.latestStats = data;
            if (state.activeTab === '__summary__') {
                renderStatusSummaryView();
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    }

    // ==========================================
    // Fetch & Render Tasks Table
    // ==========================================
    async function loadTasks() {
        el.loadingState.style.display = 'block';
        el.emptyState.style.display = 'none';
        el.tasksTable.style.display = 'none';

        try {
            const query = new URLSearchParams({
                search: state.search,
                category: state.category,
                priority: state.priority,
                status: state.status,
                assigned_to: state.assigned_to,
                sort_by: state.sortBy,
                sort_dir: state.sortDir,
                page: state.page,
                limit: state.limit
            });

            const res = await fetch(`${BASE_PATH}api/tasks?${query.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch tasks');
            const result = await res.json();

            state.totalTasks = result.total;
            state.totalPages = result.total_pages;
            el.countDisplay.textContent = result.total;

            renderTable(result.data);
            renderPagination(result.page, result.total_pages, result.total);
        } catch (err) {
            console.error('Error loading tasks:', err);
            showToast('เกิดข้อผิดพลาดในการโหลดรายการงาน', 'error');
        } finally {
            el.loadingState.style.display = 'none';
        }
    }

    function renderTable(tasks) {
        el.tasksTbody.replaceChildren();

        if (!tasks || tasks.length === 0) {
            el.emptyState.style.display = 'block';
            el.tasksTable.style.display = 'none';
            return;
        }

        el.emptyState.style.display = 'none';
        el.tasksTable.style.display = 'table';

        tasks.forEach(task => {
            const tr = document.createElement('tr');

            const st = (task.status || '').trim();
            const isPending = st.toLowerCase() === 'pending' || st === 'รอดำเนินการ';
            const isInProgress = st.toLowerCase() === 'in progress' || st === 'กำลังดำเนินการ';
            const isCompleted = st.toLowerCase() === 'completed' || st === 'เสร็จสิ้น' || st === 'ปิดงานแล้ว';
            const isCancelled = st.toLowerCase() === 'cancelled' || st === 'ยกเลิก';

            // 1. Task ID
            const tdId = document.createElement('td');
            const spanId = document.createElement('span');
            spanId.className = 'task-id-badge';
            spanId.textContent = task.task_id;
            tdId.appendChild(spanId);

            // 2. Task Title
            const tdTitle = document.createElement('td');
            tdTitle.className = 'task-title-cell';
            const divTitle = document.createElement('div');
            divTitle.className = 'task-title-text';
            divTitle.textContent = task.task_title;
            tdTitle.appendChild(divTitle);

            // 3. Category
            const tdCat = document.createElement('td');
            const spanCat = document.createElement('span');
            spanCat.className = 'category-tag';
            spanCat.textContent = task.category;
            tdCat.appendChild(spanCat);

            // 4. Priority
            const tdPri = document.createElement('td');
            const spanPri = document.createElement('span');
            spanPri.className = `badge ${getPriorityClass(task.priority)}`;
            spanPri.textContent = formatPriorityLabel(task.priority);
            tdPri.appendChild(spanPri);

            // 5. Assigned To (แสดงเฉพาะชื่อเพื่อความกระชับ)
            const tdAssign = document.createElement('td');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'assignee-name';
            nameSpan.textContent = task.assigned_name || task.assigned_to;
            nameSpan.title = `${task.assigned_name || ''} (${task.assigned_to})`;
            tdAssign.appendChild(nameSpan);

            // 6. Target Date
            const tdDate = document.createElement('td');
            const dateSpan = document.createElement('span');
            dateSpan.className = 'date-text';
            dateSpan.textContent = task.target_date;
            if (task.is_overdue && !isCompleted && !isCancelled) {
                dateSpan.classList.add('overdue-alert');
                const alertIcon = document.createElement('i');
                alertIcon.className = 'fa-solid fa-triangle-exclamation';
                alertIcon.style.marginRight = '4px';
                dateSpan.prepend(alertIcon);
            }
            tdDate.appendChild(dateSpan);

            // 7. Progress or Log Count (ในรายงานเสร็จสิ้น: เอาความคืบหน้าออก เหลือแต่แสดงจำนวน log / ในรอดำเนินการ: แสดงวันเวลาที่แจ้งงาน)
            const tdProg = document.createElement('td');

            if (state.status === 'Completed') {
                tdProg.style.textAlign = 'center';
                const logBadge = document.createElement('span');
                logBadge.className = 'log-count-pill';
                logBadge.title = `บันทึกผลงานทั้งหมด ${task.total_logs} รายการ`;
                const logIcon = document.createElement('i');
                logIcon.className = 'fa-solid fa-clipboard-list';
                const logTxt = document.createElement('span');
                logTxt.textContent = `${task.total_logs} log`;
                logBadge.appendChild(logIcon);
                logBadge.appendChild(logTxt);
                tdProg.appendChild(logBadge);
            } else if (state.status === 'Pending') {
                const createdDiv = document.createElement('div');
                createdDiv.className = 'created-at-cell';
                createdDiv.title = `วันเวลาที่แจ้งงาน: ${task.created_at || '-'}`;
                const createdIcon = document.createElement('i');
                createdIcon.className = 'fa-regular fa-calendar-plus text-primary';
                const createdTxt = document.createElement('span');
                createdTxt.textContent = task.created_at || '-';
                createdDiv.appendChild(createdIcon);
                createdDiv.appendChild(createdTxt);
                tdProg.appendChild(createdDiv);
            } else {
                const progWrapper = document.createElement('div');
                progWrapper.className = 'progress-bar-cell';
                const progTrack = document.createElement('div');
                progTrack.className = 'progress-track';
                const progFill = document.createElement('div');
                progFill.className = 'progress-fill';
                const progressPct = task.latest_progress || 0;
                progFill.style.width = `${progressPct}%`;
                progTrack.appendChild(progFill);

                const progLabelWrap = document.createElement('div');
                progLabelWrap.className = 'progress-label-wrap';
                const progVal = document.createElement('span');
                progVal.textContent = `${progressPct}%`;
                const logCnt = document.createElement('span');
                logCnt.textContent = `(${task.total_logs} log)`;
                progLabelWrap.appendChild(progVal);
                progLabelWrap.appendChild(logCnt);

                progWrapper.appendChild(progTrack);
                progWrapper.appendChild(progLabelWrap);
                tdProg.appendChild(progWrapper);
            }

            // 8. Status / Completed At (ในรายงานเสร็จสิ้น: เอาสถานะออก แสดงเป็นวันเวลาปิดงาน)
            const tdStat = document.createElement('td');

            if (state.status === 'Completed') {
                const compDiv = document.createElement('div');
                compDiv.className = 'completed-at-cell';
                compDiv.title = `วันเวลาที่ปิดงาน: ${task.completed_at || '-'}`;
                const compIcon = document.createElement('i');
                compIcon.className = 'fa-solid fa-calendar-check text-success';
                const compText = document.createElement('span');
                compText.textContent = task.completed_at || '-';
                compDiv.appendChild(compIcon);
                compDiv.appendChild(compText);
                tdStat.appendChild(compDiv);
            } else {
                const spanStat = document.createElement('span');

                if (task.is_overdue && !isCompleted && !isCancelled) {
                    spanStat.className = 'badge status-overdue';
                    const iOverdue = document.createElement('i');
                    iOverdue.className = 'fa-solid fa-triangle-exclamation';
                    spanStat.appendChild(iOverdue);
                    spanStat.appendChild(document.createTextNode(' เกินกำหนด'));
                    tdStat.appendChild(spanStat);
                } else if (isPending) {
                    spanStat.className = 'badge status-pending';
                    const iPending = document.createElement('i');
                    iPending.className = 'fa-solid fa-clock';
                    spanStat.appendChild(iPending);
                    spanStat.appendChild(document.createTextNode(' รอรับงาน (Pending)'));
                    tdStat.appendChild(spanStat);
                } else if (isInProgress) {
                    spanStat.className = 'badge status-in-progress';
                    const iProg = document.createElement('i');
                    iProg.className = 'fa-solid fa-bars-progress';
                    spanStat.appendChild(iProg);
                    spanStat.appendChild(document.createTextNode(' กำลังดำเนินการ'));
                    tdStat.appendChild(spanStat);
                } else if (isCompleted) {
                    spanStat.className = 'badge status-completed';
                    const iComp = document.createElement('i');
                    iComp.className = 'fa-solid fa-circle-check';
                    spanStat.appendChild(iComp);
                    spanStat.appendChild(document.createTextNode(' ปิดงานแล้ว (100%)'));
                    tdStat.appendChild(spanStat);
                } else if (isCancelled) {
                    spanStat.className = 'badge status-cancelled';
                    const iCancel = document.createElement('i');
                    iCancel.className = 'fa-solid fa-ban';
                    spanStat.appendChild(iCancel);
                    spanStat.appendChild(document.createTextNode(' ยกเลิกแล้ว (Cancelled)'));
                    tdStat.appendChild(spanStat);
                } else {
                    spanStat.className = `badge ${getStatusClass(task.status)}`;
                    spanStat.textContent = task.status;
                    tdStat.appendChild(spanStat);
                }
            }

            // 9. Actions
            const tdAct = document.createElement('td');
            const actGroup = document.createElement('div');
            actGroup.className = 'action-buttons-group';

            if (isPending) {
                // ขั้นที่ 2: ผู้รับผิดชอบกดรับงาน เพื่อแสดงผล In Progress
                const btnAccept = document.createElement('button');
                btnAccept.type = 'button';
                btnAccept.className = 'btn-action-pill btn-action-accept';
                btnAccept.title = 'กดรับงานนี้ (เปลี่ยนสถานะเป็น กำลังดำเนินการ / In Progress)';
                const iconAccept = document.createElement('i');
                iconAccept.className = 'fa-solid fa-handshake';
                const txtAccept = document.createElement('span');
                txtAccept.textContent = 'กดรับงาน';
                btnAccept.appendChild(iconAccept);
                btnAccept.appendChild(txtAccept);
                btnAccept.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleAcceptTask(task, btnAccept);
                });
                actGroup.appendChild(btnAccept);

                const btnLog = document.createElement('button');
                btnLog.type = 'button';
                btnLog.className = 'btn-icon-action btn-icon-log';
                btnLog.title = 'บันทึกความคืบหน้า (รับงานและบันทึกผลงานให้อัตโนมัติ)';
                const iconLog = document.createElement('i');
                iconLog.className = 'fa-solid fa-clipboard-check';
                btnLog.appendChild(iconLog);
                btnLog.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openLogWorkModal(task);
                });
                actGroup.appendChild(btnLog);

                const btnDetail = document.createElement('button');
                btnDetail.type = 'button';
                btnDetail.className = 'btn-icon-action';
                btnDetail.title = 'ดูรายละเอียดและไทม์ไลน์';
                const iconDetail = document.createElement('i');
                iconDetail.className = 'fa-solid fa-eye';
                btnDetail.appendChild(iconDetail);
                btnDetail.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTaskDetailModal(task.task_id);
                });
                actGroup.appendChild(btnDetail);

                const btnCancel = document.createElement('button');
                btnCancel.type = 'button';
                btnCancel.className = 'btn-icon-action btn-icon-cancel';
                btnCancel.title = 'ยกเลิกงานนี้ (Cancel)';
                const iconCancel = document.createElement('i');
                iconCancel.className = 'fa-solid fa-ban';
                btnCancel.appendChild(iconCancel);
                btnCancel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openCancelConfirmModal(task);
                });
                actGroup.appendChild(btnCancel);
            } else if (isInProgress) {
                // ขั้นที่ 3: ผู้รับผิดชอบเข้ามาบันทึกความคืบหน้า
                const btnLog = document.createElement('button');
                btnLog.type = 'button';
                btnLog.className = 'btn-action-pill btn-action-progress-log';
                btnLog.title = 'บันทึกความคืบหน้าระหว่างดำเนินงาน';
                const iconLog = document.createElement('i');
                iconLog.className = 'fa-solid fa-clipboard-check';
                const txtLog = document.createElement('span');
                txtLog.textContent = 'บันทึกความคืบหน้า';
                btnLog.appendChild(iconLog);
                btnLog.appendChild(txtLog);
                btnLog.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openLogWorkModal(task);
                });
                actGroup.appendChild(btnLog);

                const btnDetail = document.createElement('button');
                btnDetail.type = 'button';
                btnDetail.className = 'btn-icon-action';
                btnDetail.title = 'ดูรายละเอียดและไทม์ไลน์';
                const iconDetail = document.createElement('i');
                iconDetail.className = 'fa-solid fa-eye';
                btnDetail.appendChild(iconDetail);
                btnDetail.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTaskDetailModal(task.task_id);
                });
                actGroup.appendChild(btnDetail);

                const btnCancel = document.createElement('button');
                btnCancel.type = 'button';
                btnCancel.className = 'btn-icon-action btn-icon-cancel';
                btnCancel.title = 'ยกเลิกงานนี้ (Cancel)';
                const iconCancel = document.createElement('i');
                iconCancel.className = 'fa-solid fa-ban';
                btnCancel.appendChild(iconCancel);
                btnCancel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openCancelConfirmModal(task);
                });
                actGroup.appendChild(btnCancel);
            } else if (isCompleted) {
                // ขั้นที่ 4: ครบ 100% เท่ากับปิดงาน (Completed)
                const btnDetail = document.createElement('button');
                btnDetail.type = 'button';
                btnDetail.className = 'btn-action-pill btn-action-completed-view';
                btnDetail.title = 'งานปิดสมบูรณ์แล้ว คลิกดูประวัติสรุป';
                const iconDetail = document.createElement('i');
                iconDetail.className = 'fa-solid fa-circle-check';
                const txtDetail = document.createElement('span');
                txtDetail.textContent = 'ดูสรุปปิดงาน';
                btnDetail.appendChild(iconDetail);
                btnDetail.appendChild(txtDetail);
                btnDetail.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTaskDetailModal(task.task_id);
                });
                actGroup.appendChild(btnDetail);
            } else {
                // สถานะอื่นๆ (เช่น ยกเลิก)
                const btnDetail = document.createElement('button');
                btnDetail.type = 'button';
                btnDetail.className = 'btn-icon-action';
                btnDetail.title = 'ดูรายละเอียด';
                const iconDetail = document.createElement('i');
                iconDetail.className = 'fa-solid fa-eye';
                btnDetail.appendChild(iconDetail);
                btnDetail.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTaskDetailModal(task.task_id);
                });
                actGroup.appendChild(btnDetail);
            }

            // Admin Only: Delete Task Button
            if (state.isAdmin) {
                const btnDeleteTask = document.createElement('button');
                btnDeleteTask.type = 'button';
                btnDeleteTask.className = 'btn-icon-action btn-icon-delete';
                btnDeleteTask.title = 'ลบงานนี้ (เฉพาะ Admin)';
                const iconDel = document.createElement('i');
                iconDel.className = 'fa-solid fa-trash';
                btnDeleteTask.appendChild(iconDel);
                btnDeleteTask.addEventListener('click', (e) => {
                    e.stopPropagation();
                    confirmDeleteTask(task.task_id, task.task_title);
                });
                actGroup.appendChild(btnDeleteTask);
            }

            tdAct.appendChild(actGroup);

            // Append all cells
            tr.appendChild(tdId);
            tr.appendChild(tdTitle);
            tr.appendChild(tdCat);
            tr.appendChild(tdPri);
            tr.appendChild(tdAssign);
            tr.appendChild(tdDate);
            tr.appendChild(tdProg);
            tr.appendChild(tdStat);
            tr.appendChild(tdAct);

            el.tasksTbody.appendChild(tr);
        });
    }

    function renderPagination(currentPage, totalPages, totalCount) {
        el.paginationControls.replaceChildren();

        if (totalCount === 0 || totalPages <= 1) {
            el.paginationBar.style.display = 'none';
            return;
        }

        el.paginationBar.style.display = 'flex';
        el.paginationInfo.textContent = `แสดงหน้า ${currentPage} จาก ${totalPages} (รวม ${totalCount} รายการ)`;

        // Prev Button
        const btnPrev = document.createElement('button');
        btnPrev.type = 'button';
        btnPrev.className = 'btn-page';
        btnPrev.disabled = currentPage <= 1;
        const iconPrev = document.createElement('i');
        iconPrev.className = 'fa-solid fa-chevron-left';
        btnPrev.appendChild(iconPrev);
        btnPrev.addEventListener('click', () => {
            if (state.page > 1) {
                state.page--;
                loadTasks();
            }
        });
        el.paginationControls.appendChild(btnPrev);

        // Page Number Buttons
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
                const btnP = document.createElement('button');
                btnP.type = 'button';
                btnP.className = `btn-page ${p === currentPage ? 'active' : ''}`;
                btnP.textContent = p;
                btnP.addEventListener('click', () => {
                    state.page = p;
                    loadTasks();
                });
                el.paginationControls.appendChild(btnP);
            }
        }

        // Next Button
        const btnNext = document.createElement('button');
        btnNext.type = 'button';
        btnNext.className = 'btn-page';
        btnNext.disabled = currentPage >= totalPages;
        const iconNext = document.createElement('i');
        iconNext.className = 'fa-solid fa-chevron-right';
        btnNext.appendChild(iconNext);
        btnNext.addEventListener('click', () => {
            if (state.page < totalPages) {
                state.page++;
                loadTasks();
            }
        });
        el.paginationControls.appendChild(btnNext);
    }

    // Helper formatting
    function getPriorityClass(priority) {
        if (!priority) return 'priority-normal';
        if (priority.includes('Urgent')) return 'priority-urgent';
        if (priority.includes('High')) return 'priority-high';
        if (priority.includes('Low')) return 'priority-low';
        return 'priority-normal';
    }

    function formatPriorityLabel(priority) {
        if (!priority) return 'Normal';
        if (priority.includes('Urgent')) return 'ด่วนพิเศษ';
        if (priority.includes('High')) return 'สำคัญสูง';
        if (priority.includes('Low')) return 'ทั่วไป';
        return 'ปกติ';
    }

    function getStatusClass(status) {
        switch (status) {
            case 'Pending': return 'status-pending';
            case 'In Progress': return 'status-in-progress';
            case 'Under Review': return 'status-under-review';
            case 'Completed': return 'status-completed';
            case 'Cancelled': return 'status-cancelled';
            default: return 'status-pending';
        }
    }

    // ==========================================
    // Modals Control
    // ==========================================
    function openModal(modalEl) {
        modalEl.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('show');
        const anyOpen = document.querySelectorAll('.modal-backdrop.show');
        if (anyOpen.length === 0) {
            document.body.style.overflow = '';
        }
    }

    // Attach close triggers
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-close');
            const targetModal = document.getElementById(targetId);
            if (targetModal) closeModal(targetModal);
        });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // ==========================================
    // Modal 1: Create Task
    // ==========================================
    // Pick the default task creator: role containing "lead" first, then manager/หัวหน้า, else first member
    function applyDefaultCreator() {
        const sel = document.getElementById('create-task-created-by');
        if (!sel) return;
        const opts = Array.from(sel.options).filter(o => o.value);
        if (opts.length === 0) return;
        const roleOf = o => (o.dataset.role || '').toLowerCase();
        const lead = opts.find(o => roleOf(o).includes('lead'))
            || opts.find(o => /manager|หัวหน้า|qmr/.test(roleOf(o)))
            || opts[0];
        sel.value = lead.value;
    }
    applyDefaultCreator();

    // Quick Date Preset Chips for New Task
    const quickDateChips = document.querySelectorAll('#quick-date-chips .btn-date-chip');
    if (quickDateChips.length > 0 && createTargetDate) {
        quickDateChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const days = parseInt(chip.dataset.days, 10);
                const d = new Date();
                d.setDate(d.getDate() + days);
                createTargetDate.value = d.toISOString().split('T')[0];
                quickDateChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });
        createTargetDate.addEventListener('change', () => {
            quickDateChips.forEach(c => c.classList.remove('active'));
        });
    }

    el.btnOpenCreate.addEventListener('click', () => {
        el.formCreate.reset();
        applyDefaultCreator();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        if (createTargetDate) {
            createTargetDate.value = nextWeek.toISOString().split('T')[0];
            quickDateChips.forEach(c => c.classList.toggle('active', c.dataset.days === '7'));
        }
        openModal(el.modalCreate);
        setTimeout(() => {
            const titleInput = document.getElementById('create-task-title');
            if (titleInput) titleInput.focus();
        }, 80);
    });

    el.formCreate.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-create-task');
        submitBtn.disabled = true;

        try {
            const formData = new FormData(el.formCreate);
            const payload = Object.fromEntries(formData.entries());

            const res = await fetch(`${BASE_PATH}api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to create task');

            showToast(`เปิดงานสำเร็จ รหัส: ${result.task_id}`, 'success');
            closeModal(el.modalCreate);
            loadStats();
            loadTasks();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // ==========================================
    // Modal 2: Log Work Progress
    // ==========================================
    async function loadActiveTasksDropdown(selectedTaskId = null) {
        if (!el.logTaskSelect) return;
        try {
            const res = await fetch(`${BASE_PATH}api/tasks/active`);
            if (!res.ok) throw new Error('Failed to fetch active tasks');
            state.activeTasksList = await res.json();

            el.logTaskSelect.replaceChildren();

            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.disabled = true;
            defaultOpt.textContent = '-- เลือกงาน QM ที่ต้องการบันทึกผลงาน --';
            if (!selectedTaskId) defaultOpt.selected = true;
            el.logTaskSelect.appendChild(defaultOpt);

            state.activeTasksList.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.task_id;
                const statusTag = t.status === 'Pending' ? '[รอดำเนินการ]' : `[${t.status}]`;
                opt.textContent = `${t.task_id}: ${t.task_title} ${statusTag} (${t.assigned_name || t.assigned_to})`;
                if (selectedTaskId && t.task_id === selectedTaskId) {
                    opt.selected = true;
                }
                el.logTaskSelect.appendChild(opt);
            });
        } catch (err) {
            console.error('Error loading active tasks for select:', err);
        }
    }

    function selectTaskForLog(task) {
        if (!task) return;
        state.activeTaskForLog = task;
        el.logTaskId.value = task.task_id;
        if (el.logTaskSelect) el.logTaskSelect.value = task.task_id;

        // Hide task dropdown and show compact single-line strip
        if (el.logTaskSelectGroup) el.logTaskSelectGroup.style.display = 'none';
        if (el.logTaskBanner) el.logTaskBanner.style.display = 'flex';
        if (el.logBannerTitle) el.logBannerTitle.textContent = task.task_title;
        if (el.logBannerBadge) el.logBannerBadge.textContent = task.task_id;
        if (el.logBannerStatus) {
            el.logBannerStatus.className = `badge ${getStatusClass(task.status)}`;
            el.logBannerStatus.textContent = task.status;
        }
        if (el.logBannerAssignee) el.logBannerAssignee.textContent = task.assigned_name || task.assigned_to;
        if (el.logBannerDue) el.logBannerDue.textContent = task.target_date || '-';
        const curProgress = task.latest_progress || task.current_progress || 0;
        if (el.logBannerProgress) el.logBannerProgress.textContent = `${curProgress}%`;

        // Notice if Pending
        const st = (task.status || '').trim().toLowerCase();
        const isPending = st === 'pending' || st === 'รอดำเนินการ';
        if (el.logPendingAlert) {
            el.logPendingAlert.style.display = isPending ? 'flex' : 'none';
        }

        if (el.btnModalAcceptPending) {
            el.btnModalAcceptPending.onclick = async (e) => {
                e.preventDefault();
                if (state.activeTaskForLog) {
                    await handleAcceptTask(state.activeTaskForLog, el.btnModalAcceptPending);
                    state.activeTaskForLog.status = 'In Progress';
                    if (el.logBannerStatus) {
                        el.logBannerStatus.className = 'badge status-in-progress';
                        el.logBannerStatus.textContent = 'In Progress';
                    }
                    if (el.logPendingAlert) {
                        el.logPendingAlert.style.display = 'none';
                    }
                }
            };
        }

        // Pre-select reporter if matching
        if (task.assigned_to) {
            const reporterSelect = document.getElementById('log-reporter');
            if (reporterSelect) {
                reporterSelect.value = task.assigned_to;
            }
        }

        // Slider default to current or +10%
        const nextProg = Math.min(100, curProgress + (curProgress === 100 ? 0 : 10));
        updateProgressUI(nextProg);
    }

    function updateProgressUI(val) {
        val = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
        if (el.logProgressSlider) el.logProgressSlider.value = val;
        if (el.progressValText) el.progressValText.textContent = `${val}%`;

        // Update chips active class
        const chips = document.querySelectorAll('.btn-preset-chip');
        chips.forEach(chip => {
            const chipPct = parseInt(chip.getAttribute('data-pct'), 10);
            if (chipPct === val) {
                chip.classList.add('active-preset');
            } else {
                chip.classList.remove('active-preset');
            }
        });

        // 100% Complete Indicator
        const completeAlert = document.getElementById('log-complete-alert');
        const submitIcon = document.getElementById('btn-submit-log-icon');
        const submitText = document.getElementById('btn-submit-log-text');
        const submitBtn = document.getElementById('btn-submit-log');

        if (val === 100) {
            if (completeAlert) completeAlert.style.display = 'flex';
            if (submitBtn) {
                submitBtn.className = 'btn btn-emerald';
            }
            if (submitIcon) submitIcon.className = 'fa-solid fa-flag-checkered';
            if (submitText) submitText.textContent = ' 🏁 บันทึกและปิดงาน (100%)';
        } else {
            if (completeAlert) completeAlert.style.display = 'none';
            if (submitBtn) {
                submitBtn.className = 'btn btn-primary';
            }
            if (submitIcon) submitIcon.className = 'fa-solid fa-floppy-disk';
            if (submitText) submitText.textContent = ` บันทึกความคืบหน้า (${val}%)`;
        }
    }

    async function openLogWorkModal(task = null) {
        // Reset form inputs
        document.getElementById('log-work-summary').value = '';
        document.getElementById('log-issue-blocker').value = '';
        document.getElementById('log-evidence-file').value = '';
        if (el.logDate) el.logDate.value = new Date().toISOString().split('T')[0];

        // Fetch fresh list of active tasks for dropdown
        await loadActiveTasksDropdown(task ? task.task_id : null);

        // Reset extra fields panel to collapsed by default
        const extraPanel = document.getElementById('extra-fields-panel');
        const extraArrow = document.getElementById('extra-toggle-arrow');
        if (extraPanel) extraPanel.style.display = 'none';
        if (extraArrow) extraArrow.className = 'fa-solid fa-chevron-down toggle-arrow';

        if (task) {
            selectTaskForLog(task);
        } else {
            // Opened directly from header without preselected task
            state.activeTaskForLog = null;
            el.logTaskId.value = '';
            if (el.logTaskSelectGroup) el.logTaskSelectGroup.style.display = 'block';
            if (el.logTaskBanner) el.logTaskBanner.style.display = 'none';
            if (el.logPendingAlert) el.logPendingAlert.style.display = 'none';
            updateProgressUI(50);
        }

        openModal(el.modalLog);
    }

    if (el.logTaskSelect) {
        el.logTaskSelect.addEventListener('change', (e) => {
            const taskId = e.target.value;
            const found = state.activeTasksList.find(t => t.task_id === taskId);
            if (found) {
                selectTaskForLog(found);
            }
        });
    }

    el.logProgressSlider.addEventListener('input', (e) => {
        updateProgressUI(e.target.value);
    });

    // Preset chip listeners
    const presetChips = document.querySelectorAll('.btn-preset-chip');
    presetChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            const pct = chip.getAttribute('data-pct');
            if (pct !== null) {
                updateProgressUI(parseInt(pct, 10));
            }
        });
    });

    // Toggle extra fields listener
    const btnToggleExtra = document.getElementById('btn-toggle-extra-log');
    if (btnToggleExtra) {
        btnToggleExtra.addEventListener('click', (e) => {
            e.preventDefault();
            const extraPanel = document.getElementById('extra-fields-panel');
            const extraArrow = document.getElementById('extra-toggle-arrow');
            if (extraPanel) {
                const isHidden = extraPanel.style.display === 'none' || !extraPanel.style.display;
                extraPanel.style.display = isHidden ? 'block' : 'none';
                if (extraArrow) {
                    extraArrow.className = isHidden 
                        ? 'fa-solid fa-chevron-up toggle-arrow' 
                        : 'fa-solid fa-chevron-down toggle-arrow';
                }
            }
        });
    }

    el.formLog.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = el.logTaskId.value || (el.logTaskSelect ? el.logTaskSelect.value : '');
        if (!taskId) {
            showToast('กรุณาเลือกงานที่ต้องการบันทึกผลงาน', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-log');
        submitBtn.disabled = true;

        try {
            const formData = new FormData(el.formLog);
            formData.set('task_id', taskId);
            formData.set('auto_accept', 'true');

            const res = await fetch(`${BASE_PATH}api/tasks/${encodeURIComponent(taskId)}/logs`, {
                method: 'POST',
                body: formData
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to submit log');

            const progressVal = parseInt(formData.get('progress_pct') || '0', 10);
            if (progressVal === 100) {
                showToast('🎉 ความคืบหน้าครบ 100% — ปิดงาน (Completed) เรียบร้อยแล้ว!', 'success');
            } else {
                showToast('บันทึกความคืบหน้าเรียบร้อยแล้ว (สถานะ: กำลังดำเนินการ)', 'success');
            }

            closeModal(el.modalLog);
            loadStats();
            loadTasks();
            if (state.activeTab === 'logs') {
                loadLogs();
            }

            // If detail modal is open, refresh detail view
            if (el.modalDetail.classList.contains('show')) {
                openTaskDetailModal(taskId);
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // ==========================================
    // Modal 3: Task Details & Timeline
    // ==========================================
    async function openTaskDetailModal(taskId) {
        el.detailModalBody.replaceChildren();
        el.detailModalBody.scrollTop = 0;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'state-container';
        const spinner = document.createElement('i');
        spinner.className = 'fa-solid fa-circle-notch fa-spin state-spinner';
        const p = document.createElement('p');
        p.textContent = 'กำลังโหลดประวัติผลงาน...';
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(p);
        el.detailModalBody.appendChild(loadingDiv);

        openModal(el.modalDetail);

        try {
            const res = await fetch(`${BASE_PATH}api/tasks/${encodeURIComponent(taskId)}`);
            if (!res.ok) throw new Error('Failed to fetch details');
            const task = await res.json();

            state.activeTaskForLog = task;
            renderTaskDetailView(task);
            el.detailModalBody.scrollTop = 0;
        } catch (err) {
            el.detailModalBody.replaceChildren();
            const errP = document.createElement('p');
            errP.className = 'text-danger';
            errP.textContent = 'ไม่สามารถโหลดข้อมูลงานได้';
            el.detailModalBody.appendChild(errP);
        }
    }

    function renderTaskDetailView(task) {
        el.detailModalBody.replaceChildren();

        // 4-Step Stepper in Detail View
        const stepperDiv = document.createElement('div');
        stepperDiv.className = 'modal-workflow-stepper';

        // Step 1: แจ้งงาน
        const s1 = document.createElement('div');
        s1.className = 'm-step passed';
        if (task.created_at) s1.title = `แจ้งงานเมื่อ: ${task.created_at}`;
        const s1c = document.createElement('div');
        s1c.className = 'm-step-circle';
        s1c.textContent = '✓';
        const s1t = document.createElement('span');
        s1t.textContent = '1. แจ้งงานแล้ว';
        s1.appendChild(s1c);
        s1.appendChild(s1t);
        stepperDiv.appendChild(s1);

        const arr1 = document.createElement('span');
        arr1.className = 'm-step-arrow';
        const arr1Icon = document.createElement('i');
        arr1Icon.className = 'fa-solid fa-chevron-right';
        arr1.appendChild(arr1Icon);
        stepperDiv.appendChild(arr1);

        // Step 2: รับงาน
        const isAccepted = task.status !== 'Pending';
        const s2 = document.createElement('div');
        s2.className = `m-step ${isAccepted ? 'passed' : 'current'}`;
        const s2c = document.createElement('div');
        s2c.className = 'm-step-circle';
        s2c.textContent = isAccepted ? '✓' : '2';
        const s2t = document.createElement('span');
        s2t.textContent = isAccepted ? '2. รับงานแล้ว' : '2. รอกดรับงาน';
        s2.appendChild(s2c);
        s2.appendChild(s2t);
        stepperDiv.appendChild(s2);

        const arr2 = document.createElement('span');
        arr2.className = 'm-step-arrow';
        const arr2Icon = document.createElement('i');
        arr2Icon.className = 'fa-solid fa-chevron-right';
        arr2.appendChild(arr2Icon);
        stepperDiv.appendChild(arr2);

        // Step 3: บันทึกความคืบหน้า
        const isDone = task.status === 'Completed' || (task.current_progress >= 100);
        const inProgress = task.status === 'In Progress';
        const s3 = document.createElement('div');
        s3.className = `m-step ${isDone ? 'passed' : (inProgress ? 'current' : '')}`;
        const s3c = document.createElement('div');
        s3c.className = 'm-step-circle';
        s3c.textContent = isDone ? '✓' : '3';
        const s3t = document.createElement('span');
        s3t.textContent = `3. ความคืบหน้า (${task.current_progress || 0}%)`;
        s3.appendChild(s3c);
        s3.appendChild(s3t);
        stepperDiv.appendChild(s3);

        const arr3 = document.createElement('span');
        arr3.className = 'm-step-arrow';
        const arr3Icon = document.createElement('i');
        arr3Icon.className = 'fa-solid fa-chevron-right';
        arr3.appendChild(arr3Icon);
        stepperDiv.appendChild(arr3);

        // Step 4: ครบ 100% ปิดงาน
        const s4 = document.createElement('div');
        s4.className = `m-step ${isDone ? 'passed' : ''}`;
        if (isDone && task.completed_at) s4.title = `ปิดงานเมื่อ: ${task.completed_at}`;
        const s4c = document.createElement('div');
        s4c.className = 'm-step-circle';
        s4c.textContent = isDone ? '✓' : '4';
        const s4t = document.createElement('span');
        s4t.textContent = isDone ? '4. ปิดงานสมบูรณ์' : '4. ปิดงาน (ครบ 100%)';
        s4.appendChild(s4c);
        s4.appendChild(s4t);
        stepperDiv.appendChild(s4);

        el.detailModalBody.appendChild(stepperDiv);

        // Header Card
        const headerCard = document.createElement('div');
        headerCard.className = 'detail-task-header';

        const topRow = document.createElement('div');
        topRow.className = 'detail-header-top';

        const titleDiv = document.createElement('div');
        const badge = document.createElement('span');
        badge.className = 'task-id-badge';
        badge.textContent = task.task_id;
        badge.style.marginBottom = '6px';
        const h3 = document.createElement('h3');
        h3.className = 'detail-task-title';
        h3.textContent = task.task_title;
        titleDiv.appendChild(badge);
        titleDiv.appendChild(h3);

        const statusBadge = document.createElement('span');
        statusBadge.className = `badge ${getStatusClass(task.status)}`;
        statusBadge.textContent = task.status;
        topRow.appendChild(titleDiv);
        topRow.appendChild(statusBadge);

        // Metadata Grid
        const metaGrid = document.createElement('div');
        metaGrid.className = 'detail-meta-grid';

        const creatorDisplay = (task.created_by_name && task.created_by_name !== task.created_by) 
            ? `${task.created_by_name} (${task.created_by})` 
            : task.created_by;

        const metaItems = [
            { icon: 'fa-tag', label: 'หมวดหมู่', val: task.category },
            { icon: 'fa-flag', label: 'ความสำคัญ', val: formatPriorityLabel(task.priority) },
            { icon: 'fa-user-check', label: 'ผู้รับผิดชอบ', val: `${task.assigned_name || task.assigned_to}` },
            { icon: 'fa-calendar', label: 'กำหนดเสร็จ', val: task.target_date },
            { icon: 'fa-clock', label: 'วันเวลาที่แจ้งงาน', val: task.created_at || '-' },
            { icon: 'fa-user-pen', label: 'ผู้เปิดงาน', val: creatorDisplay },
            { icon: 'fa-chart-pie', label: 'ความคืบหน้าสะสม', val: `${task.current_progress || 0}%` }
        ];

        if (task.status === 'Completed' || task.completed_at) {
            metaItems.push({
                icon: 'fa-calendar-check',
                label: 'วันเวลาที่ปิดงาน',
                val: task.completed_at || '-'
            });
        }

        metaItems.forEach(item => {
            const div = document.createElement('div');
            const i = document.createElement('i');
            i.className = `fa-solid ${item.icon}`;
            i.style.marginRight = '6px';
            i.style.color = '#6366f1';
            const strong = document.createElement('strong');
            strong.textContent = `${item.label}: `;
            const span = document.createElement('span');
            span.textContent = item.val;

            div.appendChild(i);
            div.appendChild(strong);
            div.appendChild(span);
            metaGrid.appendChild(div);
        });

        headerCard.appendChild(topRow);
        headerCard.appendChild(metaGrid);

        // Detailed Task Description Block (ด้านบน)
        const descBox = document.createElement('div');
        descBox.className = 'detail-desc-box';

        const descHeader = document.createElement('div');
        descHeader.className = 'detail-desc-heading';
        const descIcon = document.createElement('i');
        descIcon.className = 'fa-solid fa-align-left';
        descIcon.style.marginRight = '6px';
        descIcon.style.color = '#6366f1';
        const descHeadingText = document.createElement('strong');
        descHeadingText.textContent = 'รายละเอียดงาน / ขอบเขตงาน:';
        descHeader.appendChild(descIcon);
        descHeader.appendChild(descHeadingText);

        const descBody = document.createElement('div');
        descBody.className = 'detail-desc-content';
        if (task.task_description && task.task_description.trim()) {
            descBody.textContent = task.task_description.trim();
        } else {
            descBody.className += ' text-muted italic';
            descBody.textContent = 'ไม่ได้ระบุรายละเอียดงานเพิ่มเติมตอนเปิดงาน';
        }

        descBox.appendChild(descHeader);
        descBox.appendChild(descBody);
        headerCard.appendChild(descBox);

        el.detailModalBody.appendChild(headerCard);

        // Timeline Section
        const timelineTitle = document.createElement('h4');
        timelineTitle.className = 'timeline-section-title';
        const timeIcon = document.createElement('i');
        timeIcon.className = 'fa-solid fa-clock-rotate-left text-primary';
        const titleText = document.createTextNode(` ไทม์ไลน์บันทึกผลงานประจำวัน (${task.logs ? task.logs.length : 0} รายการ)`);
        timelineTitle.appendChild(timeIcon);
        timelineTitle.appendChild(titleText);
        el.detailModalBody.appendChild(timelineTitle);

        if (!task.logs || task.logs.length === 0) {
            const emptyLog = document.createElement('div');
            emptyLog.className = 'state-container';
            emptyLog.style.padding = '1.5rem';
            const p = document.createElement('p');
            p.textContent = task.status === 'Pending'
                ? 'ยังไม่มีบันทึกผลงาน เนื่องจากงานอยู่ในสถานะรอดำเนินการ (กรุณากดปุ่ม "รับงานนี้" เพื่อเริ่มงาน)'
                : 'ยังไม่มีประวัติการบันทึกผลงานในรายการนี้';
            emptyLog.appendChild(p);
            el.detailModalBody.appendChild(emptyLog);
        } else {
            const timeline = document.createElement('div');
            timeline.className = 'timeline';

            task.logs.forEach(log => {
                const item = document.createElement('div');
                item.className = 'timeline-item';

                const dot = document.createElement('div');
                dot.className = 'timeline-dot';
                item.appendChild(dot);

                const card = document.createElement('div');
                card.className = 'timeline-card';

                // Card Header
                const cardHeader = document.createElement('div');
                cardHeader.className = 'timeline-card-header';
                const reporter = document.createElement('span');
                reporter.className = 'timeline-reporter';
                reporter.textContent = `${log.reporter_name || log.reporter}`;
                const dateSpan = document.createElement('span');
                dateSpan.className = 'timeline-date';
                dateSpan.textContent = `วันที่ ${log.log_date} | บันทึกเมื่อ: ${log.logged_at}`;
                cardHeader.appendChild(reporter);
                cardHeader.appendChild(dateSpan);

                if (state.isAdmin) {
                    const btnDelLog = document.createElement('button');
                    btnDelLog.type = 'button';
                    btnDelLog.className = 'btn-icon-action btn-icon-delete-sm';
                    btnDelLog.title = 'ลบบันทึกผลงานนี้ (เฉพาะ Admin)';
                    const delIcon = document.createElement('i');
                    delIcon.className = 'fa-solid fa-trash';
                    btnDelLog.appendChild(delIcon);
                    btnDelLog.addEventListener('click', (e) => {
                        e.stopPropagation();
                        confirmDeleteWorkLog(task.task_id, log.log_id, log.work_summary);
                    });
                    cardHeader.appendChild(btnDelLog);
                }

                card.appendChild(cardHeader);

                // Progress badge
                const progBadge = document.createElement('div');
                progBadge.style.marginBottom = '6px';
                const pb = document.createElement('span');
                pb.className = 'badge status-in-progress';
                pb.textContent = `ความคืบหน้าสะสม: ${log.progress_pct}%`;
                progBadge.appendChild(pb);
                card.appendChild(progBadge);

                // Work Summary
                const workP = document.createElement('p');
                workP.className = 'timeline-work';
                workP.textContent = log.work_summary;
                card.appendChild(workP);

                // Issue Blocker if any
                if (log.issue_blocker) {
                    const blockerDiv = document.createElement('div');
                    blockerDiv.className = 'timeline-blocker';
                    const warnIcon = document.createElement('i');
                    warnIcon.className = 'fa-solid fa-triangle-exclamation';
                    warnIcon.style.marginRight = '6px';
                    const blockerText = document.createTextNode(`ปัญหาที่ติดขัด: ${log.issue_blocker}`);
                    blockerDiv.appendChild(warnIcon);
                    blockerDiv.appendChild(blockerText);
                    card.appendChild(blockerDiv);
                }

                // Evidence file attachment if any
                if (log.evidence_file) {
                    const evidenceLink = document.createElement('a');
                    evidenceLink.className = 'timeline-evidence';
                    evidenceLink.href = `${BASE_PATH}uploads/${encodeURIComponent(log.evidence_file)}`;
                    evidenceLink.target = '_blank';
                    evidenceLink.rel = 'noopener noreferrer';
                    const fileIcon = document.createElement('i');
                    fileIcon.className = 'fa-solid fa-paperclip';
                    const linkText = document.createTextNode(` เอกสารแนบ: ${log.original_filename || log.evidence_file}`);
                    evidenceLink.appendChild(fileIcon);
                    evidenceLink.appendChild(linkText);
                    card.appendChild(evidenceLink);
                }

                item.appendChild(card);
                timeline.appendChild(item);
            });

            el.detailModalBody.appendChild(timeline);
        }

        // Configure footer buttons based on status
        updateDetailFooterButtons(task);
    }

    function updateDetailFooterButtons(task) {
        if (!el.btnDetailAcceptTask) return;
        const st = (task.status || '').trim().toLowerCase();
        const isPending = st === 'pending' || st === 'รอดำเนินการ';
        const isInProgress = st === 'in progress' || st === 'กำลังดำเนินการ';

        if (isPending) {
            el.btnDetailAcceptTask.style.display = 'inline-flex';
            el.btnDetailAcceptTask.disabled = false;
            el.btnDetailAcceptTask.replaceChildren();
            const acceptIcon = document.createElement('i');
            acceptIcon.className = 'fa-solid fa-handshake';
            el.btnDetailAcceptTask.appendChild(acceptIcon);
            el.btnDetailAcceptTask.appendChild(document.createTextNode(' กดรับงานนี้ (เริ่มดำเนินการ In Progress)'));
        } else {
            el.btnDetailAcceptTask.style.display = 'none';
        }

        if (el.btnDetailCancelTask) {
            if (isPending || isInProgress) {
                el.btnDetailCancelTask.style.display = 'inline-flex';
                el.btnDetailCancelTask.disabled = false;
            } else {
                el.btnDetailCancelTask.style.display = 'none';
            }
        }

        if (el.btnDetailDeleteTask) {
            if (state.isAdmin) {
                el.btnDetailDeleteTask.style.display = 'inline-flex';
                el.btnDetailDeleteTask.onclick = () => {
                    confirmDeleteTask(task.task_id, task.task_title);
                };
            } else {
                el.btnDetailDeleteTask.style.display = 'none';
            }
        }
    }

    async function handleAcceptTask(task, btnEl = null) {
        if (!task || !task.task_id) {
            showToast('ไม่พบข้อมูลงานที่ต้องการรับมอบหมาย', 'error');
            return;
        }

        // Show immediate loading indicator on the clicked button if provided
        let originalChildren = null;
        if (btnEl) {
            btnEl.disabled = true;
            originalChildren = Array.from(btnEl.childNodes).map(n => n.cloneNode(true));
            btnEl.replaceChildren();
            const spinIcon = document.createElement('i');
            spinIcon.className = 'fa-solid fa-spinner fa-spin';
            btnEl.appendChild(spinIcon);
            btnEl.appendChild(document.createTextNode(' กำลังรับงาน...'));
        }

        try {
            const res = await fetch(`${BASE_PATH}api/tasks/${encodeURIComponent(task.task_id)}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accepted_by: task.assigned_to || '' })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to accept task');

            showToast(result.message || `🤝 รับมอบหมายงาน ${task.task_id} สำเร็จ! สถานะเปลี่ยนเป็น กำลังดำเนินการ (In Progress)`, 'success');

            // Update in-memory active task
            if (state.activeTaskForLog && state.activeTaskForLog.task_id === task.task_id) {
                state.activeTaskForLog.status = 'In Progress';
            }

            // Refresh stats and tasks table
            loadStats();
            loadTasks();

            // Refresh detail modal if open
            if (el.modalDetail && el.modalDetail.classList.contains('show')) {
                openTaskDetailModal(task.task_id);
            }

            // Refresh Daily Work Log modal if open for this task
            if (el.modalLog && el.modalLog.classList.contains('show') && state.activeTaskForLog && state.activeTaskForLog.task_id === task.task_id) {
                if (el.logBannerStatus) {
                    el.logBannerStatus.className = 'badge status-in-progress';
                    el.logBannerStatus.textContent = 'In Progress';
                }
                if (el.logPendingAlert) {
                    el.logPendingAlert.style.display = 'none';
                }
            }
        } catch (err) {
            showToast(err.message, 'error');
            if (btnEl && originalChildren) {
                btnEl.disabled = false;
                btnEl.replaceChildren(...originalChildren);
            }
        }
    }

    if (el.btnDetailAcceptTask) {
        el.btnDetailAcceptTask.addEventListener('click', () => {
            if (state.activeTaskForLog) {
                handleAcceptTask(state.activeTaskForLog, el.btnDetailAcceptTask);
            }
        });
    }

    if (el.btnDetailCancelTask) {
        el.btnDetailCancelTask.addEventListener('click', () => {
            if (state.activeTaskForLog) {
                openCancelConfirmModal(state.activeTaskForLog);
            }
        });
    }

    function openCancelConfirmModal(task) {
        if (!task || !task.task_id) return;
        state.taskToCancel = task;
        if (el.cancelTaskPromptText) {
            const title = task.task_title || task.task_id;
            el.cancelTaskPromptText.textContent = `คุณต้องการยกเลิกงาน "${task.task_id}: ${title}" ใช่หรือไม่?`;
        }
        if (el.cancelReasonInput) {
            el.cancelReasonInput.value = '';
        }
        openModal(el.modalCancelTask);
    }

    async function handleConfirmCancelTask() {
        if (!state.taskToCancel || !state.taskToCancel.task_id) return;
        const task = state.taskToCancel;
        const reason = el.cancelReasonInput ? el.cancelReasonInput.value.trim() : '';
        const submitBtn = el.btnConfirmCancelTask;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.replaceChildren();
            const spin = document.createElement('i');
            spin.className = 'fa-solid fa-spinner fa-spin';
            submitBtn.appendChild(spin);
            submitBtn.appendChild(document.createTextNode(' กำลังยกเลิก...'));
        }

        try {
            const res = await fetch(`${BASE_PATH}api/tasks/${encodeURIComponent(task.task_id)}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason || 'ยกเลิกโดยผู้ใช้งาน' })
            });
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || 'Failed to cancel task');
            }

            showToast(`🚫 ยกเลิกงาน ${task.task_id} เรียบร้อยแล้ว`, 'info');
            closeModal(el.modalCancelTask);

            // If detail modal is open for this task, refresh it so user sees the updated status and timeline
            if (el.modalDetail && el.modalDetail.classList.contains('show')) {
                openTaskDetailModal(task.task_id);
            }
            // If log modal is open, close it
            if (el.modalLog && el.modalLog.classList.contains('show')) {
                closeModal(el.modalLog);
            }

            loadStats();
            loadTasks();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.replaceChildren();
                const banIcon = document.createElement('i');
                banIcon.className = 'fa-solid fa-ban';
                submitBtn.appendChild(banIcon);
                submitBtn.appendChild(document.createTextNode(' ยืนยันยกเลิกงาน'));
            }
        }
    }

    if (el.btnConfirmCancelTask) {
        el.btnConfirmCancelTask.addEventListener('click', handleConfirmCancelTask);
    }


    // ==========================================
    // Modal 4: Team Management (Add, Edit, Delete)
    // ==========================================
    const teamForm = {
        title: document.getElementById('team-form-title'),
        icon: document.getElementById('team-form-icon'),
        empId: document.getElementById('team-emp-id'),
        email: document.getElementById('team-email'),
        fullname: document.getElementById('team-fullname'),
        role: document.getElementById('team-role'),
        isActive: document.getElementById('team-is-active'),
        origEmail: document.getElementById('team-original-email'),
        btnCancel: document.getElementById('btn-cancel-edit-team'),
        btnSubmitText: document.getElementById('btn-submit-team-text'),
        btnSubmitIcon: document.getElementById('btn-submit-team-icon')
    };

    function resetTeamForm() {
        el.formTeam.reset();
        if (teamForm.origEmail) teamForm.origEmail.value = '';
        if (teamForm.title) teamForm.title.textContent = 'เพิ่มสมาชิกใหม่';
        if (teamForm.icon) teamForm.icon.className = 'fa-solid fa-user-plus';
        if (teamForm.btnSubmitText) teamForm.btnSubmitText.textContent = 'บันทึกสมาชิก';
        if (teamForm.btnSubmitIcon) teamForm.btnSubmitIcon.className = 'fa-solid fa-plus';
        if (teamForm.btnCancel) teamForm.btnCancel.style.display = 'none';
        if (teamForm.isActive) teamForm.isActive.value = 'true';
    }

    if (teamForm.btnCancel) {
        teamForm.btnCancel.addEventListener('click', resetTeamForm);
    }

    el.btnManageTeam.addEventListener('click', () => {
        resetTeamForm();
        loadTeamList();
        openModal(el.modalTeam);
    });

    async function loadTeamList() {
        el.teamList.replaceChildren();
        try {
            const res = await fetch(`${BASE_PATH}api/team`);
            if (!res.ok) throw new Error('Failed to fetch team');
            const members = await res.json();

            // Synchronize all assignee dropdowns across the page
            syncAllAssigneeDropdowns(members);

            if (members.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-muted';
                empty.textContent = 'ยังไม่มีสมาชิกในระบบ';
                el.teamList.appendChild(empty);
                return;
            }

            members.forEach(m => {
                const item = document.createElement('div');
                item.className = 'team-item';

                const info = document.createElement('div');
                info.className = 'team-item-info';
                const name = document.createElement('span');
                name.className = 'team-item-name';
                name.textContent = `${m.full_name} (${m.emp_id || '-'})`;
                const role = document.createElement('span');
                role.className = 'team-item-role';
                role.textContent = `${m.role} • ${m.email}`;
                info.appendChild(name);
                info.appendChild(role);

                const rightWrap = document.createElement('div');
                rightWrap.className = 'team-item-actions';

                const status = document.createElement('span');
                status.className = `badge ${m.is_active ? 'status-completed' : 'status-cancelled'}`;
                status.textContent = m.is_active ? 'Active' : 'Inactive';
                rightWrap.appendChild(status);

                // Edit Button
                const btnEdit = document.createElement('button');
                btnEdit.type = 'button';
                btnEdit.className = 'btn-icon-action btn-edit-member';
                btnEdit.title = 'แก้ไขข้อมูลสมาชิก';
                const iconEdit = document.createElement('i');
                iconEdit.className = 'fa-solid fa-pen-to-square';
                btnEdit.appendChild(iconEdit);
                btnEdit.addEventListener('click', () => {
                    teamForm.origEmail.value = m.email;
                    teamForm.empId.value = m.emp_id || '';
                    teamForm.email.value = m.email;
                    teamForm.fullname.value = m.full_name;
                    teamForm.role.value = m.role;
                    if (teamForm.isActive) teamForm.isActive.value = m.is_active ? 'true' : 'false';

                    teamForm.title.textContent = `แก้ไขข้อมูล: ${m.full_name}`;
                    teamForm.icon.className = 'fa-solid fa-user-pen';
                    teamForm.btnSubmitText.textContent = 'อัปเดตข้อมูล';
                    teamForm.btnSubmitIcon.className = 'fa-solid fa-check';
                    teamForm.btnCancel.style.display = 'inline-flex';

                    teamForm.fullname.focus();
                });
                rightWrap.appendChild(btnEdit);

                // Delete Button (Admin Only)
                if (state.isAdmin) {
                    const btnDelete = document.createElement('button');
                    btnDelete.type = 'button';
                    btnDelete.className = 'btn-icon-action btn-delete-member';
                    btnDelete.title = 'ลบสมาชิก (เฉพาะ Admin)';
                    const iconDelete = document.createElement('i');
                    iconDelete.className = 'fa-solid fa-trash-can text-danger';
                    btnDelete.appendChild(iconDelete);
                    btnDelete.addEventListener('click', () => {
                        showDeleteConfirmModal(`คุณต้องการลบสมาชิก "${m.full_name}" (${m.email}) ออกจากระบบหรือไม่?`, async () => {
                            try {
                                const delRes = await fetch(`${BASE_PATH}api/team/${encodeURIComponent(m.email)}`, {
                                    method: 'DELETE'
                                });
                                const delJson = await delRes.json();
                                if (!delRes.ok) throw new Error(delJson.error || 'ลบสมาชิกไม่สำเร็จ');

                                showToast('ลบสมาชิกออกจากระบบเรียบร้อยแล้ว', 'success');
                                if (teamForm.origEmail.value === m.email) {
                                    resetTeamForm();
                                }
                                loadTeamList();
                            } catch (err) {
                                showToast(err.message, 'error');
                            }
                        });
                    });
                    rightWrap.appendChild(btnDelete);
                }

                item.appendChild(info);
                item.appendChild(rightWrap);
                el.teamList.appendChild(item);
            });
        } catch (err) {
            console.error('Error loading team:', err);
        }
    }

    // Function to synchronize all team dropdowns across the application
    function syncAllAssigneeDropdowns(members) {
        const activeMembers = members.filter(m => m.is_active);
        const dropdowns = [
            { el: el.selectAssignee, defaultText: 'เจ้าหน้าที่ทุกคน' },
            { el: el.selectReporterLogs, defaultText: 'เจ้าหน้าที่ทุกคน' },
            { el: document.getElementById('create-task-assigned'), defaultText: 'เลือกเจ้าหน้าที่ผู้รับผิดชอบ' },
            { el: document.getElementById('log-reporter'), defaultText: null }
        ];

        dropdowns.forEach(d => {
            if (!d.el) return;
            const currentVal = d.el.value;
            d.el.replaceChildren();

            if (d.defaultText) {
                const optDef = document.createElement('option');
                optDef.value = '';
                optDef.textContent = d.defaultText;
                d.el.appendChild(optDef);
            }

            activeMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.email;
                opt.textContent = m.full_name; // แสดงเฉพาะชื่อเพื่อความกระชับ
                d.el.appendChild(opt);
            });

            if (currentVal) {
                d.el.value = currentVal;
            }
        });

        // Creator dropdown (shows name + role, defaults to Lead)
        const creatorSel = document.getElementById('create-task-created-by');
        if (creatorSel) {
            const prevVal = creatorSel.value;
            creatorSel.replaceChildren();
            const optDef = document.createElement('option');
            optDef.value = '';
            optDef.disabled = true;
            optDef.textContent = 'เลือกผู้เปิดงาน';
            creatorSel.appendChild(optDef);
            activeMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.email;
                opt.dataset.role = m.role || '';
                opt.textContent = `${m.full_name} — ${m.role}`;
                creatorSel.appendChild(opt);
            });
            if (prevVal && activeMembers.some(m => m.email === prevVal)) {
                creatorSel.value = prevVal;
            } else {
                applyDefaultCreator();
            }
        }
    }

    el.formTeam.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const origEmail = teamForm.origEmail ? teamForm.origEmail.value.trim() : '';
            const payload = {
                original_email: origEmail,
                emp_id: teamForm.empId.value.trim(),
                email: teamForm.email.value.trim(),
                full_name: teamForm.fullname.value.trim(),
                role: teamForm.role.value.trim(),
                is_active: teamForm.isActive ? (teamForm.isActive.value === 'true') : true
            };

            const res = await fetch(`${BASE_PATH}api/team`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to save member');

            showToast(origEmail ? 'อัปเดตข้อมูลสมาชิกเรียบร้อยแล้ว' : 'บันทึกข้อมูลสมาชิกใหม่สำเร็จ', 'success');
            resetTeamForm();
            loadTeamList();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ==========================================
    // Modal 4b: Category Settings (Add, Edit, Delete)
    // ==========================================
    const catModal = document.getElementById('modal-categories');
    const catListEl = document.getElementById('categories-list');
    const catForm = {
        form: document.getElementById('form-category'),
        id: document.getElementById('cat-id'),
        name: document.getElementById('cat-name'),
        description: document.getElementById('cat-description'),
        isActive: document.getElementById('cat-is-active'),
        title: document.getElementById('cat-form-title'),
        icon: document.getElementById('cat-form-icon'),
        btnCancel: document.getElementById('btn-cancel-edit-cat'),
        btnSubmitText: document.getElementById('btn-submit-cat-text'),
        btnSubmitIcon: document.getElementById('btn-submit-cat-icon')
    };

    const categoryLabel = c => c.description ? `${c.name} (${c.description})` : c.name;

    function resetCategoryForm() {
        catForm.form.reset();
        catForm.id.value = '';
        catForm.isActive.value = 'true';
        catForm.title.textContent = 'เพิ่มหมวดหมู่ใหม่';
        catForm.icon.className = 'fa-solid fa-plus';
        catForm.btnSubmitText.textContent = 'บันทึกหมวดหมู่';
        catForm.btnSubmitIcon.className = 'fa-solid fa-plus';
        catForm.btnCancel.style.display = 'none';
    }

    function syncCategoryDropdowns(categories) {
        const active = categories.filter(c => c.is_active);
        const targets = [
            { el: el.selectCategory, defaultText: 'ทุกหมวดหมู่งาน QM', disabledDefault: false },
            { el: document.getElementById('create-task-category'), defaultText: 'เลือกหมวดหมู่', disabledDefault: true }
        ];
        targets.forEach(t => {
            if (!t.el) return;
            const prev = t.el.value;
            t.el.replaceChildren();
            const optDef = document.createElement('option');
            optDef.value = '';
            optDef.textContent = t.defaultText;
            if (t.disabledDefault) optDef.disabled = true;
            t.el.appendChild(optDef);
            active.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = categoryLabel(c);
                t.el.appendChild(opt);
            });
            t.el.value = active.some(c => c.name === prev) ? prev : '';
        });
        // Keep the task filter state consistent if the selected category disappeared
        if (state.category && !active.some(c => c.name === state.category)) {
            state.category = '';
            state.page = 1;
            loadTasks();
        }
    }

    async function loadCategoryList() {
        catListEl.replaceChildren();
        try {
            const res = await fetch(`${BASE_PATH}api/categories`);
            if (!res.ok) throw new Error('โหลดหมวดหมู่ไม่สำเร็จ');
            const categories = await res.json();
            syncCategoryDropdowns(categories);

            if (categories.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-muted';
                empty.textContent = 'ยังไม่มีหมวดหมู่ กรุณาเพิ่มหมวดหมู่ก่อนเปิดงาน';
                catListEl.appendChild(empty);
                return;
            }

            categories.forEach(c => {
                const item = document.createElement('div');
                item.className = 'team-item';

                const info = document.createElement('div');
                info.className = 'team-item-info';
                const name = document.createElement('span');
                name.className = 'team-item-name';
                name.textContent = c.name;
                const sub = document.createElement('span');
                sub.className = 'team-item-role';
                sub.textContent = `${c.description || '-'} • ใช้งานแล้ว ${c.task_count} งาน`;
                info.appendChild(name);
                info.appendChild(sub);

                const actions = document.createElement('div');
                actions.className = 'team-item-actions';

                const status = document.createElement('span');
                status.className = `badge ${c.is_active ? 'status-completed' : 'status-cancelled'}`;
                status.textContent = c.is_active ? 'Active' : 'Inactive';
                actions.appendChild(status);

                const btnEdit = document.createElement('button');
                btnEdit.type = 'button';
                btnEdit.className = 'btn-icon-action btn-edit-member';
                btnEdit.title = 'แก้ไขหมวดหมู่';
                const iEdit = document.createElement('i');
                iEdit.className = 'fa-solid fa-pen-to-square';
                btnEdit.appendChild(iEdit);
                btnEdit.addEventListener('click', () => {
                    catForm.id.value = c.cat_id;
                    catForm.name.value = c.name;
                    catForm.description.value = c.description || '';
                    catForm.isActive.value = c.is_active ? 'true' : 'false';
                    catForm.title.textContent = `แก้ไขหมวดหมู่: ${c.name}`;
                    catForm.icon.className = 'fa-solid fa-pen';
                    catForm.btnSubmitText.textContent = 'อัปเดตหมวดหมู่';
                    catForm.btnSubmitIcon.className = 'fa-solid fa-check';
                    catForm.btnCancel.style.display = 'inline-flex';
                    catForm.name.focus();
                });
                actions.appendChild(btnEdit);

                // Delete Button (Admin Only)
                if (state.isAdmin) {
                    const btnDel = document.createElement('button');
                    btnDel.type = 'button';
                    btnDel.className = 'btn-icon-action btn-delete-member';
                    btnDel.title = 'ลบหมวดหมู่ (เฉพาะ Admin)';
                    const iDel = document.createElement('i');
                    iDel.className = 'fa-solid fa-trash-can text-danger';
                    btnDel.appendChild(iDel);
                    btnDel.addEventListener('click', () => {
                        const warn = c.task_count > 0
                            ? ` (มีงาน ${c.task_count} งานใช้หมวดนี้อยู่ งานเดิมจะยังคงชื่อหมวดเดิม)`
                            : '';
                        showDeleteConfirmModal(`ต้องการลบหมวดหมู่ "${c.name}" หรือไม่?${warn}`, async () => {
                            try {
                                const delRes = await fetch(`${BASE_PATH}api/categories/${encodeURIComponent(c.cat_id)}`, { method: 'DELETE' });
                                const delJson = await delRes.json();
                                if (!delRes.ok) throw new Error(delJson.error || 'ลบไม่สำเร็จ');
                                showToast('ลบหมวดหมู่เรียบร้อยแล้ว', 'success');
                                if (catForm.id.value === String(c.cat_id)) resetCategoryForm();
                                loadCategoryList();
                            } catch (err) {
                                showToast(err.message, 'error');
                            }
                        });
                    });
                    actions.appendChild(btnDel);
                }

                item.appendChild(info);
                item.appendChild(actions);
                catListEl.appendChild(item);
            });
        } catch (err) {
            console.error('Error loading categories:', err);
            showToast(err.message, 'error');
        }
    }

    catForm.btnCancel.addEventListener('click', resetCategoryForm);

    document.getElementById('btn-manage-categories').addEventListener('click', () => {
        resetCategoryForm();
        loadCategoryList();
        openModal(catModal);
    });

    catForm.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isEdit = !!catForm.id.value;
        try {
            const payload = {
                cat_id: catForm.id.value || null,
                name: catForm.name.value.trim(),
                description: catForm.description.value.trim(),
                is_active: catForm.isActive.value === 'true'
            };
            const res = await fetch(`${BASE_PATH}api/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'บันทึกไม่สำเร็จ');
            showToast(isEdit ? 'อัปเดตหมวดหมู่เรียบร้อยแล้ว' : 'เพิ่มหมวดหมู่ใหม่สำเร็จ', 'success');
            resetCategoryForm();
            loadCategoryList();
            if (isEdit) loadTasks();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ==========================================
    // Filter & Search Controls
    // ==========================================
    let searchDebounceTimeout = null;

    el.inputSearch.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        el.btnClearSearch.style.display = val ? 'block' : 'none';

        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            state.search = val;
            state.page = 1;
            loadTasks();
        }, 350);
    });

    el.btnClearSearch.addEventListener('click', () => {
        el.inputSearch.value = '';
        el.btnClearSearch.style.display = 'none';
        state.search = '';
        state.page = 1;
        loadTasks();
    });

    el.selectCategory.addEventListener('change', (e) => {
        state.category = e.target.value;
        state.page = 1;
        loadTasks();
    });

    el.selectPriority.addEventListener('change', (e) => {
        state.priority = e.target.value;
        state.page = 1;
        loadTasks();
    });

    el.selectAssignee.addEventListener('change', (e) => {
        state.assigned_to = e.target.value;
        state.page = 1;
        loadTasks();
    });

    function resetTaskFilters(resetPriority = true) {
        if (el.inputSearch) el.inputSearch.value = '';
        if (el.btnClearSearch) el.btnClearSearch.style.display = 'none';
        if (el.selectCategory) el.selectCategory.value = '';
        if (el.selectAssignee) el.selectAssignee.value = '';
        state.search = '';
        state.category = '';
        state.assigned_to = '';

        if (resetPriority) {
            if (el.selectPriority) el.selectPriority.value = '';
            state.priority = '';
        }

        state.sortBy = '';
        state.sortDir = 'asc';
        updateSortHeaders();
    }

    el.btnResetFilters.addEventListener('click', () => {
        resetTaskFilters(true);
        state.status = '';
        updateActiveStatusTabBtn('');
        updateTableHeaderTheme('');
        if (el.tableViewTitle) {
            el.tableViewTitle.textContent = getStatusReportTitle('');
        }
        state.page = 1;
        loadTasks();
    });

    // Quick filter click on stat cards (Auto-reset filters so table matches the card's count directly)
    if (el.statsSection) {
        el.statsSection.addEventListener('click', (e) => {
            const card = e.target.closest('.stat-card');
            if (!card) return;

            const statStatus = card.getAttribute('data-status');
            const statPriority = card.getAttribute('data-priority');

            if (statStatus !== null) {
                // Reset filters and switch tab
                resetTaskFilters(true);
                switchStatusTab(statStatus, false);
            } else if (statPriority !== null) {
                // When clicking Urgent card: switch to active tasks tab and filter by Urgent
                resetTaskFilters(false);
                if (el.selectPriority) el.selectPriority.value = statPriority;
                state.priority = statPriority;
                switchStatusTab('', false);
            }
        });
    }

    // ==========================================
    // Table Header Sorting Controller
    // ==========================================
    function updateSortHeaders() {
        if (!el.tasksTable) return;
        const sortableHeaders = el.tasksTable.querySelectorAll('.sortable-th');
        sortableHeaders.forEach(th => {
            const field = th.getAttribute('data-sort');
            const icon = th.querySelector('.sort-icon');
            if (field === state.sortBy) {
                th.classList.add('sort-active');
                th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
                if (icon) {
                    icon.className = state.sortDir === 'asc' 
                        ? 'fa-solid fa-sort-up sort-icon' 
                        : 'fa-solid fa-sort-down sort-icon';
                }
            } else {
                th.classList.remove('sort-active');
                th.removeAttribute('aria-sort');
                if (icon) {
                    icon.className = 'fa-solid fa-sort sort-icon';
                }
            }
        });
    }

    if (el.tasksTable) {
        // Event delegation on tasksTable for rock-solid click handling
        el.tasksTable.addEventListener('click', (e) => {
            const th = e.target.closest('.sortable-th');
            if (!th) return;

            const sortField = th.getAttribute('data-sort');
            if (!sortField) return;

            if (state.sortBy === sortField) {
                if (state.sortDir === 'asc') {
                    state.sortDir = 'desc';
                } else {
                    // Return to default smart sort
                    state.sortBy = '';
                    state.sortDir = 'asc';
                }
            } else {
                state.sortBy = sortField;
                state.sortDir = 'asc';
            }

            state.page = 1;
            updateSortHeaders();
            loadTasks();
        });

        el.tasksTable.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const th = e.target.closest('.sortable-th');
                if (th) {
                    e.preventDefault();
                    th.click();
                }
            }
        });
    }

    // ==========================================
    // Export Excel
    // ==========================================
    el.btnExportExcel.addEventListener('click', () => {
        showToast('กำลังดาวน์โหลดไฟล์ Excel...', 'success');
        window.location.href = `${BASE_PATH}api/export`;
    });

    // ==========================================
    // Daily Work Logs View Controller
    // ==========================================
    async function loadLogs() {
        if (!el.logsTable || !el.logsTbody) return;
        if (el.logsLoadingState) el.logsLoadingState.style.display = 'block';
        if (el.logsEmptyState) el.logsEmptyState.style.display = 'none';
        if (el.logsTable) el.logsTable.style.display = 'none';

        try {
            const query = new URLSearchParams({
                search: state.logsSearch,
                reporter: state.logsReporter,
                log_date: state.logsDate,
                page: state.logsPage,
                limit: state.logsLimit
            });

            const res = await fetch(`${BASE_PATH}api/logs?${query.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch logs');
            const result = await res.json();

            state.logsTotal = result.total;
            state.logsTotalPages = result.total_pages;
            if (el.logsCountDisplay) el.logsCountDisplay.textContent = result.total;
            if (el.badgeLogsCount) el.badgeLogsCount.textContent = result.total;

            renderLogsTable(result.data);
            renderLogsPagination(result.page, result.total_pages, result.total);
        } catch (err) {
            console.error('Error loading logs:', err);
            showToast('เกิดข้อผิดพลาดในการโหลดบันทึกผลงาน', 'error');
        } finally {
            if (el.logsLoadingState) el.logsLoadingState.style.display = 'none';
        }
    }

    function renderLogsTable(logs) {
        if (!el.logsTbody) return;
        el.logsTbody.replaceChildren();

        if (!logs || logs.length === 0) {
            if (el.logsEmptyState) el.logsEmptyState.style.display = 'block';
            if (el.logsTable) el.logsTable.style.display = 'none';
            return;
        }

        if (el.logsEmptyState) el.logsEmptyState.style.display = 'none';
        if (el.logsTable) el.logsTable.style.display = 'table';

        logs.forEach(log => {
            const tr = document.createElement('tr');

            // 1. Date
            const tdDate = document.createElement('td');
            const spanDate = document.createElement('span');
            spanDate.className = 'date-text';
            spanDate.textContent = log.log_date;
            tdDate.appendChild(spanDate);

            // 2. Task ID (Clickable badge)
            const tdId = document.createElement('td');
            const btnId = document.createElement('button');
            btnId.type = 'button';
            btnId.className = 'task-id-badge';
            btnId.style.border = 'none';
            btnId.style.cursor = 'pointer';
            btnId.title = 'คลิกดูรายละเอียดงาน';
            btnId.textContent = log.task_id;
            btnId.addEventListener('click', () => openTaskDetailModal(log.task_id));
            tdId.appendChild(btnId);

            // 3. Task Title
            const tdTitle = document.createElement('td');
            const divTitle = document.createElement('div');
            divTitle.className = 'task-title-text';
            divTitle.textContent = log.task_title || '-';
            tdTitle.appendChild(divTitle);
            if (log.category) {
                const catSpan = document.createElement('span');
                catSpan.className = 'category-tag';
                catSpan.style.marginTop = '4px';
                catSpan.textContent = log.category;
                tdTitle.appendChild(catSpan);
            }

            // 4. Reporter
            const tdReporter = document.createElement('td');
            const repSpan = document.createElement('span');
            repSpan.className = 'assignee-name';
            repSpan.textContent = log.reporter_name || log.reporter;
            repSpan.title = log.reporter;
            tdReporter.appendChild(repSpan);

            // 5. Work Summary
            const tdSummary = document.createElement('td');
            const pSummary = document.createElement('p');
            pSummary.style.lineHeight = '1.45';
            pSummary.style.color = 'var(--text-primary)';
            pSummary.textContent = log.work_summary;
            tdSummary.appendChild(pSummary);

            // 6. Progress
            const tdProg = document.createElement('td');
            const progBadge = document.createElement('span');
            progBadge.className = 'badge status-in-progress';
            progBadge.textContent = `${log.progress_pct}%`;
            tdProg.appendChild(progBadge);

            // 7. Blocker / Issue
            const tdBlocker = document.createElement('td');
            if (log.issue_blocker) {
                const bDiv = document.createElement('div');
                bDiv.className = 'timeline-blocker';
                bDiv.style.margin = '0';
                bDiv.style.fontSize = '0.8rem';
                const warnIcon = document.createElement('i');
                warnIcon.className = 'fa-solid fa-triangle-exclamation';
                warnIcon.style.marginRight = '4px';
                const textB = document.createTextNode(log.issue_blocker);
                bDiv.appendChild(warnIcon);
                bDiv.appendChild(textB);
                tdBlocker.appendChild(bDiv);
            } else {
                const dash = document.createElement('span');
                dash.className = 'text-muted';
                dash.textContent = '-';
                tdBlocker.appendChild(dash);
            }

            // 8. Evidence File
            const tdFile = document.createElement('td');
            if (log.evidence_file) {
                const link = document.createElement('a');
                link.className = 'timeline-evidence';
                link.style.margin = '0';
                link.style.display = 'inline-flex';
                link.href = `${BASE_PATH}uploads/${encodeURIComponent(log.evidence_file)}`;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                const fIcon = document.createElement('i');
                fIcon.className = 'fa-solid fa-paperclip';
                fIcon.style.marginRight = '4px';
                const fText = document.createTextNode(log.original_filename || 'ดูไฟล์');
                link.appendChild(fIcon);
                link.appendChild(fText);
                tdFile.appendChild(link);
            } else {
                const dash = document.createElement('span');
                dash.className = 'text-muted';
                dash.textContent = '-';
                tdFile.appendChild(dash);
            }

            // 9. Actions (View task details)
            const tdAct = document.createElement('td');
            tdAct.style.textAlign = 'center';
            const btnView = document.createElement('button');
            btnView.type = 'button';
            btnView.className = 'btn-icon-action';
            btnView.title = 'ดูรายละเอียดงานและไทม์ไลน์';
            const iconEye = document.createElement('i');
            iconEye.className = 'fa-solid fa-eye';
            btnView.appendChild(iconEye);
            btnView.addEventListener('click', () => openTaskDetailModal(log.task_id));
            tdAct.appendChild(btnView);

            // Admin Only: Delete Work Log
            if (state.isAdmin) {
                const btnDelLog = document.createElement('button');
                btnDelLog.type = 'button';
                btnDelLog.className = 'btn-icon-action btn-icon-delete';
                btnDelLog.title = 'ลบบันทึกผลงานนี้ (เฉพาะ Admin)';
                btnDelLog.style.marginLeft = '4px';
                const iconDel = document.createElement('i');
                iconDel.className = 'fa-solid fa-trash';
                btnDelLog.appendChild(iconDel);
                btnDelLog.addEventListener('click', () => {
                    confirmDeleteWorkLog(log.task_id, log.log_id, log.work_summary);
                });
                tdAct.appendChild(btnDelLog);
            }

            tr.appendChild(tdDate);
            tr.appendChild(tdId);
            tr.appendChild(tdTitle);
            tr.appendChild(tdReporter);
            tr.appendChild(tdSummary);
            tr.appendChild(tdProg);
            tr.appendChild(tdBlocker);
            tr.appendChild(tdFile);
            tr.appendChild(tdAct);

            el.logsTbody.appendChild(tr);
        });
    }

    function renderLogsPagination(currentPage, totalPages, totalCount) {
        if (!el.logsPaginationControls) return;
        el.logsPaginationControls.replaceChildren();

        if (totalCount === 0 || totalPages <= 1) {
            if (el.logsPaginationBar) el.logsPaginationBar.style.display = 'none';
            return;
        }

        if (el.logsPaginationBar) el.logsPaginationBar.style.display = 'flex';
        if (el.logsPaginationInfo) el.logsPaginationInfo.textContent = `แสดงหน้า ${currentPage} จาก ${totalPages} (รวม ${totalCount} รายการ)`;

        // Prev Button
        const btnPrev = document.createElement('button');
        btnPrev.type = 'button';
        btnPrev.className = 'btn-page';
        btnPrev.disabled = currentPage <= 1;
        const iconPrev = document.createElement('i');
        iconPrev.className = 'fa-solid fa-chevron-left';
        btnPrev.appendChild(iconPrev);
        btnPrev.addEventListener('click', () => {
            if (state.logsPage > 1) {
                state.logsPage--;
                loadLogs();
            }
        });
        el.logsPaginationControls.appendChild(btnPrev);

        // Page Numbers
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
                const btnP = document.createElement('button');
                btnP.type = 'button';
                btnP.className = `btn-page ${p === currentPage ? 'active' : ''}`;
                btnP.textContent = p;
                btnP.addEventListener('click', () => {
                    state.logsPage = p;
                    loadLogs();
                });
                el.logsPaginationControls.appendChild(btnP);
            }
        }

        // Next Button
        const btnNext = document.createElement('button');
        btnNext.type = 'button';
        btnNext.className = 'btn-page';
        btnNext.disabled = currentPage >= totalPages;
        const iconNext = document.createElement('i');
        iconNext.className = 'fa-solid fa-chevron-right';
        btnNext.appendChild(iconNext);
        btnNext.addEventListener('click', () => {
            if (state.logsPage < totalPages) {
                state.logsPage++;
                loadLogs();
            }
        });
        el.logsPaginationControls.appendChild(btnNext);
    }

    // ==========================================
    // Status Report Tabs Controller (รายงานตามสถานะ)
    // ==========================================
    const statusTitleMap = {
        '': 'รายงานสถานะ: งานทั้งหมด (ไม่รวมงานเสร็จสิ้น/ยกเลิก)',
        'Pending': 'รายงานสถานะ: รอดำเนินการ (Pending)',
        'In Progress': 'รายงานสถานะ: กำลังดำเนินการ (In Progress)',
        'Completed': 'รายงานเสร็จสิ้น (Completed)',
        'Overdue': 'รายงานสถานะ: เกินกำหนดส่ง (Overdue)',
        'Cancelled': 'รายงานสถานะ: ยกเลิก (Cancelled)',
        '__summary__': 'รายงานสรุปภาพรวมตามสถานะ'
    };

    function getStatusReportTitle(st) {
        return statusTitleMap[st] || `รายงาน: ${st}`;
    }

    function updateActiveStatusTabBtn(status) {
        const btns = document.querySelectorAll('.status-tab-btn');
        btns.forEach(btn => {
            const btnStatus = btn.getAttribute('data-status');
            const isActive = btnStatus === status;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    function updateTableHeaderTheme(status) {
        const themeMap = {
            '': 'all',
            'all': 'all',
            'Pending': 'pending',
            'In Progress': 'in-progress',
            'Completed': 'completed',
            'Overdue': 'overdue',
            'Cancelled': 'cancelled'
        };
        const theme = themeMap[status] || 'all';
        const section = document.querySelector('.tasks-table-section');
        if (section) {
            section.setAttribute('data-status-theme', theme);
        }
        const table = document.getElementById('tasks-table');
        if (table) {
            table.setAttribute('data-status-theme', theme);
        }
    }

    function switchStatusTab(status, autoResetFilters = true) {
        state.activeTab = status;
        updateActiveStatusTabBtn(status);
        updateTableHeaderTheme(status);

        if (autoResetFilters) {
            resetTaskFilters(true);
        }

        if (status === '__summary__') {
            // Display Summary Report view
            if (el.paneTasks) el.paneTasks.style.display = 'none';
            if (el.paneStatusSummary) el.paneStatusSummary.style.display = 'flex';
            renderStatusSummaryView();
        } else {
            // Display Tasks Table for this status
            if (el.paneTasks) el.paneTasks.style.display = 'flex';
            if (el.paneStatusSummary) el.paneStatusSummary.style.display = 'none';

            state.status = status;
            state.page = 1;

            if (el.tableViewTitle) {
                el.tableViewTitle.textContent = getStatusReportTitle(status);
            }

            if (el.thProgressTitle) {
                if (status === 'Completed') {
                    el.thProgressTitle.textContent = 'จำนวน log';
                    if (el.thColProgress) {
                        el.thColProgress.setAttribute('data-sort', 'total_logs');
                        el.thColProgress.title = 'คลิกเพื่อเรียงลำดับตามจำนวน log';
                    }
                } else if (status === 'Pending') {
                    el.thProgressTitle.textContent = 'วันเวลาที่แจ้งงาน';
                    if (el.thColProgress) {
                        el.thColProgress.setAttribute('data-sort', 'created_at');
                        el.thColProgress.title = 'คลิกเพื่อเรียงลำดับตามวันเวลาที่แจ้งงาน';
                    }
                } else {
                    el.thProgressTitle.textContent = 'ความคืบหน้า';
                    if (el.thColProgress) {
                        el.thColProgress.setAttribute('data-sort', 'latest_progress');
                        el.thColProgress.title = 'คลิกเพื่อเรียงลำดับตามความคืบหน้า';
                    }
                }
            }

            if (el.thStatusTitle) {
                if (status === 'Completed') {
                    el.thStatusTitle.textContent = 'วันเวลาปิดงาน';
                    if (el.thColStatus) {
                        el.thColStatus.setAttribute('data-sort', 'completed_at');
                        el.thColStatus.title = 'คลิกเพื่อเรียงลำดับตามวันเวลาปิดงาน';
                    }
                } else {
                    el.thStatusTitle.textContent = 'สถานะ';
                    if (el.thColStatus) {
                        el.thColStatus.setAttribute('data-sort', 'status');
                        el.thColStatus.title = 'คลิกเพื่อเรียงลำดับตามสถานะ';
                    }
                }
            }

            if (el.thTargetDateTitle) {
                el.thTargetDateTitle.textContent = 'กำหนดส่ง';
            }

            loadTasks();
        }
    }

    // Attach click listeners to Status Tab Buttons
    document.querySelectorAll('.status-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetStatus = btn.getAttribute('data-status');
            switchStatusTab(targetStatus);
        });
    });

    // ==========================================
    // Status Summary Matrix & Distribution Bar Renderer
    // ==========================================
    function renderStatusSummaryView() {
        const stats = state.latestStats;
        if (!stats) return;

        const grandTotal = stats.grand_total || ((stats.total_tasks || 0) + (stats.completed || 0) + (stats.cancelled || 0));
        const activeTotal = stats.total_tasks || 0;
        const totalHero = document.getElementById('summary-total-hero');
        if (totalHero) totalHero.textContent = activeTotal;

        const compRate = grandTotal > 0 ? (((stats.completed || 0) / grandTotal) * 100).toFixed(1) : 0;
        const compEl = document.getElementById('dist-completion-rate');
        if (compEl) compEl.textContent = `อัตราปิดงานสำเร็จ: ${compRate}%`;

        // Progress bar segments
        const segComp = document.getElementById('seg-completed');
        const segProg = document.getElementById('seg-progress');
        const segPend = document.getElementById('seg-pending');
        const segOver = document.getElementById('seg-overdue');
        const segCanc = document.getElementById('seg-cancelled');

        if (grandTotal > 0) {
            if (segComp) segComp.style.width = `${(((stats.completed || 0) / grandTotal) * 100).toFixed(1)}%`;
            if (segProg) segProg.style.width = `${(((stats.in_progress || 0) / grandTotal) * 100).toFixed(1)}%`;
            if (segPend) segPend.style.width = `${(((stats.pending || 0) / grandTotal) * 100).toFixed(1)}%`;
            if (segOver) segOver.style.width = `${(((stats.overdue || 0) / grandTotal) * 100).toFixed(1)}%`;
            if (segCanc) segCanc.style.width = `${(((stats.cancelled || 0) / grandTotal) * 100).toFixed(1)}%`;
        }

        // Summary Breakdown Table
        const tbody = document.getElementById('status-summary-tbody');
        if (!tbody) return;
        tbody.replaceChildren();

        const avg = stats.avg_progress || {};
        const avgPending = avg.pending !== undefined ? avg.pending : 0;
        const avgInProgress = avg.in_progress !== undefined ? avg.in_progress : 0;
        const avgCompleted = avg.completed !== undefined ? avg.completed : 100;
        const avgCancelled = avg.cancelled !== undefined ? avg.cancelled : 0;
        const avgOverdue = avg.overdue !== null && avg.overdue !== undefined ? avg.overdue : null;

        const statusRows = [
            { 
                key: 'Pending', 
                label: 'รอดำเนินการ (Pending)', 
                badgeClass: 'badge status-pending', 
                count: stats.pending || 0, 
                urgent: 0, 
                overdue: 0, 
                avgProg: `${avgPending.toFixed(1)}%`, 
                fillWidth: avgPending 
            },
            { 
                key: 'In Progress', 
                label: 'กำลังดำเนินการ (In Progress)', 
                badgeClass: 'badge status-in-progress', 
                count: stats.in_progress || 0, 
                urgent: stats.urgent || 0, 
                overdue: stats.overdue || 0, 
                avgProg: `${avgInProgress.toFixed(1)}%`, 
                fillWidth: avgInProgress 
            },
            { 
                key: 'Completed', 
                label: 'เสร็จสิ้น (Completed)', 
                badgeClass: 'badge status-completed', 
                count: stats.completed || 0, 
                urgent: 0, 
                overdue: 0, 
                avgProg: `${avgCompleted.toFixed(1)}%`, 
                fillWidth: avgCompleted 
            },
            { 
                key: 'Overdue', 
                label: 'เกินกำหนดส่ง (Overdue)', 
                badgeClass: 'badge status-overdue', 
                count: stats.overdue || 0, 
                urgent: 0, 
                overdue: stats.overdue || 0, 
                avgProg: avgOverdue !== null ? `${avgOverdue.toFixed(1)}%` : '-', 
                fillWidth: avgOverdue !== null ? avgOverdue : 0 
            },
            { 
                key: 'Cancelled', 
                label: 'ยกเลิก (Cancelled)', 
                badgeClass: 'badge status-cancelled', 
                count: stats.cancelled || 0, 
                urgent: 0, 
                overdue: 0, 
                avgProg: (stats.cancelled || 0) > 0 ? `${avgCancelled.toFixed(1)}%` : '-', 
                fillWidth: avgCancelled 
            }
        ];

        statusRows.forEach(cfg => {
            const tr = document.createElement('tr');
            const pct = grandTotal > 0 ? ((cfg.count / grandTotal) * 100).toFixed(1) : '0.0';

            const tdStat = document.createElement('td');
            const spanBadge = document.createElement('span');
            spanBadge.className = cfg.badgeClass;
            spanBadge.textContent = cfg.label;
            tdStat.appendChild(spanBadge);
            tr.appendChild(tdStat);

            const tdCount = document.createElement('td');
            tdCount.style.textAlign = 'center';
            tdCount.style.fontWeight = '700';
            tdCount.textContent = cfg.count;
            tr.appendChild(tdCount);

            const tdPct = document.createElement('td');
            tdPct.style.textAlign = 'center';
            tdPct.textContent = `${pct}%`;
            tr.appendChild(tdPct);

            const tdUrgent = document.createElement('td');
            tdUrgent.style.textAlign = 'center';
            tdUrgent.textContent = cfg.urgent > 0 ? cfg.urgent : '-';
            tr.appendChild(tdUrgent);

            const tdOver = document.createElement('td');
            tdOver.style.textAlign = 'center';
            tdOver.textContent = cfg.overdue > 0 ? cfg.overdue : '-';
            tr.appendChild(tdOver);

            const tdProg = document.createElement('td');
            const progTrack = document.createElement('div');
            progTrack.className = 'progress-track';
            progTrack.style.height = '6px';
            progTrack.style.marginBottom = '4px';
            const progFill = document.createElement('div');
            progFill.className = 'progress-fill';
            progFill.style.width = `${Math.min(100, Math.max(0, cfg.fillWidth))}%`;
            progTrack.appendChild(progFill);
            const progTxt = document.createElement('span');
            progTxt.style.fontSize = '0.75rem';
            progTxt.style.color = 'var(--text-secondary)';
            progTxt.textContent = cfg.avgProg;
            tdProg.appendChild(progTrack);
            tdProg.appendChild(progTxt);
            tr.appendChild(tdProg);

            const tdAction = document.createElement('td');
            tdAction.style.textAlign = 'center';
            const btnGo = document.createElement('button');
            btnGo.type = 'button';
            btnGo.className = 'btn btn-outline btn-xs';
            btnGo.innerHTML = '<i class="fa-solid fa-arrow-right"></i> ดูกลุ่มงาน';
            btnGo.addEventListener('click', () => {
                switchStatusTab(cfg.key);
            });
            tdAction.appendChild(btnGo);
            tr.appendChild(tdAction);

            tbody.appendChild(tr);
        });

        // Summary Footer Row (ภาพรวมเฉลี่ยงาน Active)
        const trFoot = document.createElement('tr');
        trFoot.className = 'status-summary-footer-row';
        trFoot.style.background = 'rgba(30, 41, 59, 0.4)';
        trFoot.style.fontWeight = '700';
        trFoot.style.borderTop = '2px solid var(--border-color)';

        const avgActive = avg.active !== undefined ? avg.active : 0;
        trFoot.innerHTML = `
            <td>
                <span style="display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-chart-line text-primary"></i>
                    <strong>เฉลี่ยงานที่กำลังดำเนินการ (Active)</strong>
                </span>
            </td>
            <td style="text-align: center; font-weight: 700;">${stats.total_tasks || 0}</td>
            <td style="text-align: center;">${grandTotal > 0 ? (((stats.total_tasks || 0) / grandTotal) * 100).toFixed(1) : '0.0'}%</td>
            <td style="text-align: center;">${stats.urgent > 0 ? stats.urgent : '-'}</td>
            <td style="text-align: center;">${stats.overdue > 0 ? stats.overdue : '-'}</td>
            <td>
                <div class="progress-track" style="height: 6px; margin-bottom: 4px;">
                    <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, avgActive))}%;"></div>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-primary); font-weight: 600;">${avgActive.toFixed(1)}%</span>
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn btn-primary btn-xs" id="btn-summary-view-active">
                    <i class="fa-solid fa-arrow-right"></i> ดูกลุ่มงาน
                </button>
            </td>
        `;
        const btnViewActive = trFoot.querySelector('#btn-summary-view-active');
        if (btnViewActive) {
            btnViewActive.addEventListener('click', () => switchStatusTab(''));
        }
        tbody.appendChild(trFoot);
    }

    if (el.btnOpenLog) el.btnOpenLog.addEventListener('click', () => openLogWorkModal(null));

    // ==========================================
    // Logs Filter Listeners
    // ==========================================
    let searchLogsDebounce = null;
    if (el.inputSearchLogs) {
        el.inputSearchLogs.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (el.btnClearSearchLogs) el.btnClearSearchLogs.style.display = val ? 'block' : 'none';

            clearTimeout(searchLogsDebounce);
            searchLogsDebounce = setTimeout(() => {
                state.logsSearch = val;
                state.logsPage = 1;
                loadLogs();
            }, 350);
        });
    }

    if (el.btnClearSearchLogs) {
        el.btnClearSearchLogs.addEventListener('click', () => {
            el.inputSearchLogs.value = '';
            el.btnClearSearchLogs.style.display = 'none';
            state.logsSearch = '';
            state.logsPage = 1;
            loadLogs();
        });
    }

    if (el.selectReporterLogs) {
        el.selectReporterLogs.addEventListener('change', (e) => {
            state.logsReporter = e.target.value;
            state.logsPage = 1;
            loadLogs();
        });
    }

    if (el.inputDateLogs) {
        el.inputDateLogs.addEventListener('change', (e) => {
            state.logsDate = e.target.value;
            state.logsPage = 1;
            loadLogs();
        });
    }

    if (el.btnResetLogsFilters) {
        el.btnResetLogsFilters.addEventListener('click', () => {
            if (el.inputSearchLogs) el.inputSearchLogs.value = '';
            if (el.btnClearSearchLogs) el.btnClearSearchLogs.style.display = 'none';
            if (el.selectReporterLogs) el.selectReporterLogs.value = '';
            if (el.inputDateLogs) el.inputDateLogs.value = '';

            state.logsSearch = '';
            state.logsReporter = '';
            state.logsDate = '';
            state.logsPage = 1;
            loadLogs();
        });
    }

    // ==========================================
    // 4-Step Streamlined Workflow Strip Toggle & Listeners
    // ==========================================
    const wfPanel = document.getElementById('workflow-panel');
    const wfHeader = document.getElementById('workflow-toggle-header');
    const wfGrid = document.getElementById('workflow-steps-grid');
    const btnToggleWf = document.getElementById('btn-toggle-workflow');
    const wfToggleIcon = document.getElementById('wf-toggle-icon');
    const wfToggleText = document.getElementById('wf-toggle-text');

    function toggleWorkflow() {
        if (!wfPanel || !wfGrid) return;
        const isCollapsed = wfPanel.classList.toggle('is-collapsed');
        if (isCollapsed) {
            wfGrid.style.display = 'none';
            if (btnToggleWf) btnToggleWf.setAttribute('aria-expanded', 'false');
            if (wfToggleText) wfToggleText.textContent = 'แสดงขั้นตอน';
            if (wfToggleIcon) {
                wfToggleIcon.classList.remove('fa-chevron-up');
                wfToggleIcon.classList.add('fa-chevron-down');
            }
        } else {
            wfGrid.style.display = 'grid';
            if (btnToggleWf) btnToggleWf.setAttribute('aria-expanded', 'true');
            if (wfToggleText) wfToggleText.textContent = 'พับเก็บขั้นตอน';
            if (wfToggleIcon) {
                wfToggleIcon.classList.remove('fa-chevron-down');
                wfToggleIcon.classList.add('fa-chevron-up');
            }
        }
    }

    if (wfHeader) {
        wfHeader.addEventListener('click', (e) => {
            if (e.target.closest('#btn-toggle-workflow')) return;
            toggleWorkflow();
        });
    }
    if (btnToggleWf) {
        btnToggleWf.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWorkflow();
        });
    }

    const wfStep2 = document.getElementById('wf-step-2');
    const wfStep3 = document.getElementById('wf-step-3');
    const wfStep4 = document.getElementById('wf-step-4');

    if (wfStep2) {
        wfStep2.addEventListener('click', () => {
            switchStatusTab('Pending');
            showToast('แสดงรายการงานที่: รอดำเนินการ (รอรับงาน)', 'info');
        });
    }

    if (wfStep3) {
        wfStep3.addEventListener('click', () => {
            switchStatusTab('In Progress');
            showToast('แสดงรายการงานที่: กำลังดำเนินการ (บันทึกความคืบหน้า)', 'info');
        });
    }

    if (wfStep4) {
        wfStep4.addEventListener('click', () => {
            switchStatusTab('Completed');
            showToast('แสดงรายการงานที่: เสร็จสิ้น / ปิดงานแล้ว (100%)', 'info');
        });
    }

    // ==========================================
    // Settings Dropdown Menu Controller
    // ==========================================
    const dropdownSettings = document.getElementById('dropdown-settings');
    const btnSettingsToggle = document.getElementById('btn-settings-toggle');

    if (btnSettingsToggle && dropdownSettings) {
        btnSettingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownSettings.classList.toggle('open');
            btnSettingsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Close on clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownSettings.contains(e.target)) {
                dropdownSettings.classList.remove('open');
                btnSettingsToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dropdownSettings.classList.contains('open')) {
                dropdownSettings.classList.remove('open');
                btnSettingsToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close dropdown when an item is clicked
        dropdownSettings.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                dropdownSettings.classList.remove('open');
                btnSettingsToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ==========================================
    // Admin Authentication & Deletion Controller
    // ==========================================

    async function checkAdminStatus() {
        try {
            const res = await fetch(`${BASE_PATH}api/auth/status`);
            if (res.ok) {
                const data = await res.json();
                state.isAdmin = Boolean(data.is_admin);
                updateAdminUI();
            }
        } catch (err) {
            console.error('Error checking admin status:', err);
        }
    }

    function updateAdminUI() {
        if (state.isAdmin) {
            if (el.adminBadge) el.adminBadge.classList.remove('d-none');
            if (el.btnAdminLoginMenuText) el.btnAdminLoginMenuText.textContent = 'ออกจากระบบ Admin';
            if (el.adminMenuIcon) el.adminMenuIcon.className = 'fa-solid fa-right-from-bracket text-danger';
            if (el.btnDetailDeleteTask && state.activeTaskForLog) el.btnDetailDeleteTask.style.display = 'inline-flex';
        } else {
            if (el.adminBadge) el.adminBadge.classList.add('d-none');
            if (el.btnAdminLoginMenuText) el.btnAdminLoginMenuText.textContent = 'เข้าสู่ระบบ Admin';
            if (el.adminMenuIcon) el.adminMenuIcon.className = 'fa-solid fa-lock text-warning';
            if (el.btnDetailDeleteTask) el.btnDetailDeleteTask.style.display = 'none';
        }
    }

    function openAdminLoginModal() {
        if (el.adminPasswordInput) el.adminPasswordInput.value = '';
        if (el.adminLoginError) {
            el.adminLoginError.textContent = '';
            el.adminLoginError.style.display = 'none';
        }
        if (el.modalAdminLogin) openModal(el.modalAdminLogin);
        setTimeout(() => {
            if (el.adminPasswordInput) el.adminPasswordInput.focus();
        }, 150);
    }

    // Toggle password visibility
    if (el.btnToggleAdminPassword && el.adminPasswordInput) {
        el.btnToggleAdminPassword.addEventListener('click', () => {
            const isPwd = el.adminPasswordInput.type === 'password';
            el.adminPasswordInput.type = isPwd ? 'text' : 'password';
            if (el.iconToggleAdminPassword) {
                el.iconToggleAdminPassword.className = isPwd ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            }
        });
    }

    // Handle Admin Login submission
    if (el.formAdminLogin) {
        el.formAdminLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = el.adminPasswordInput ? el.adminPasswordInput.value.trim() : '';
            if (!password) {
                if (el.adminLoginError) {
                    el.adminLoginError.textContent = 'กรุณากรอกรหัสผ่าน Admin';
                    el.adminLoginError.style.display = 'block';
                }
                return;
            }

            if (el.btnSubmitAdminLogin) el.btnSubmitAdminLogin.disabled = true;
            if (el.btnSubmitAdminLoginText) el.btnSubmitAdminLoginText.textContent = 'กำลังตรวจสอบ...';
            if (el.adminLoginError) el.adminLoginError.style.display = 'none';

            try {
                const res = await fetch(`${BASE_PATH}api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'รหัสผ่าน Admin ไม่ถูกต้อง');
                }

                state.isAdmin = true;
                updateAdminUI();
                closeModal(el.modalAdminLogin);
                showToast('เข้าสู่ระบบ Admin สำเร็จ สามารถจัดการและลบข้อมูลได้แล้ว', 'success');

                // Refresh views with newly enabled admin delete buttons
                loadTasks();
                loadStats();
                if (state.activeTab === 'logs') loadLogsView();
                if (el.modalTeam && el.modalTeam.classList.contains('show')) loadTeamList();
                if (el.modalCategories && el.modalCategories.classList.contains('show')) loadCategoryList();
                if (el.modalDetail && el.modalDetail.classList.contains('show') && state.activeTaskForLog) {
                    openTaskDetailModal(state.activeTaskForLog.task_id);
                }
            } catch (err) {
                if (el.adminLoginError) {
                    el.adminLoginError.textContent = err.message;
                    el.adminLoginError.style.display = 'block';
                }
            } finally {
                if (el.btnSubmitAdminLogin) el.btnSubmitAdminLogin.disabled = false;
                if (el.btnSubmitAdminLoginText) el.btnSubmitAdminLoginText.textContent = 'เข้าสู่ระบบ';
            }
        });
    }

    // Handle Admin Logout
    async function handleAdminLogout() {
        try {
            await fetch(`${BASE_PATH}api/auth/logout`, { method: 'POST' });
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            state.isAdmin = false;
            updateAdminUI();
            showToast('ออกจากระบบ Admin เรียบร้อยแล้ว', 'info');

            // Refresh views
            loadTasks();
            if (state.activeTab === 'logs') loadLogsView();
            if (el.modalTeam && el.modalTeam.classList.contains('show')) loadTeamList();
            if (el.modalCategories && el.modalCategories.classList.contains('show')) loadCategoryList();
            if (el.modalDetail && el.modalDetail.classList.contains('show') && state.activeTaskForLog) {
                openTaskDetailModal(state.activeTaskForLog.task_id);
            }
        }
    }

    // Quick logout button in header badge
    if (el.btnAdminQuickLogout) {
        el.btnAdminQuickLogout.addEventListener('click', (e) => {
            e.stopPropagation();
            handleAdminLogout();
        });
    }

    // Admin login / logout button in settings menu
    if (el.btnAdminLoginMenu) {
        el.btnAdminLoginMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdownSettings) dropdownSettings.classList.remove('open');
            if (state.isAdmin) {
                handleAdminLogout();
            } else {
                openAdminLoginModal();
            }
        });
    }

    // Custom Delete Confirmation Modal Logic (Replaces window.confirm)
    function showDeleteConfirmModal(message, onConfirm) {
        state.pendingDeleteAction = onConfirm;
        if (el.deleteConfirmMessage) el.deleteConfirmMessage.textContent = message;
        if (el.modalConfirmDelete) openModal(el.modalConfirmDelete);
    }

    if (el.btnConfirmDeleteExecute) {
        el.btnConfirmDeleteExecute.addEventListener('click', async () => {
            if (state.pendingDeleteAction) {
                const action = state.pendingDeleteAction;
                state.pendingDeleteAction = null;
                el.btnConfirmDeleteExecute.disabled = true;
                try {
                    await action();
                } finally {
                    el.btnConfirmDeleteExecute.disabled = false;
                    closeModal(el.modalConfirmDelete);
                }
            } else {
                closeModal(el.modalConfirmDelete);
            }
        });
    }

    function confirmDeleteTask(taskId, taskTitle) {
        if (!state.isAdmin) {
            openAdminLoginModal();
            return;
        }
        showDeleteConfirmModal(
            `คุณต้องการลบงาน "${taskTitle || taskId}" (รหัส: ${taskId}) ใช่หรือไม่? ข้อมูลประวัติการบันทึกผลงานและไฟล์แนบทั้งหมดจะถูกลบถาวร`,
            async () => {
                try {
                    const res = await fetch(`${BASE_PATH}api/tasks/${encodeURIComponent(taskId)}`, {
                        method: 'DELETE'
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'ลบงานไม่สำเร็จ');

                    showToast(data.message || 'ลบงานเรียบร้อยแล้ว', 'success');
                    if (el.modalDetail && el.modalDetail.classList.contains('show')) {
                        closeModal(el.modalDetail);
                    }
                    loadTasks();
                    loadStats();
                    if (state.activeTab === 'logs') loadLogsView();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        );
    }

    function confirmDeleteWorkLog(taskId, logId, workSummary) {
        if (!state.isAdmin) {
            openAdminLoginModal();
            return;
        }
        const snippet = workSummary ? `"${workSummary.length > 50 ? workSummary.substring(0, 50) + '...' : workSummary}"` : `ID: ${logId}`;
        showDeleteConfirmModal(
            `คุณต้องการลบบันทึกผลงาน ${snippet} ใช่หรือไม่? ความคืบหน้าของงานจะถูกคำนวณใหม่ตามบันทึกล่าสุดที่เหลืออยู่`,
            async () => {
                try {
                    const res = await fetch(`${BASE_PATH}api/tasks/${encodeURIComponent(taskId)}/logs/${encodeURIComponent(logId)}`, {
                        method: 'DELETE'
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'ลบบันทึกไม่สำเร็จ');

                    showToast(data.message || 'ลบบันทึกผลงานเรียบร้อยแล้ว', 'success');
                    if (el.modalDetail && el.modalDetail.classList.contains('show')) {
                        openTaskDetailModal(taskId);
                    }
                    loadTasks();
                    loadStats();
                    if (state.activeTab === 'logs') loadLogsView();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        );
    }

    // ==========================================
    // Initial Load
    // ==========================================
    checkAdminStatus();
    updateTableHeaderTheme(state.status || '');
    loadStats();
    loadTasks();
});
