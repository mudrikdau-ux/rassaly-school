// admin.js - Rasally School Admin Panel
// Connected to Backend API via api.js

(function() {
    'use strict';

    // ============================================
    // API CONFIGURATION
    // ============================================
    const API_BASE = 'http://localhost:5000/api';

    // ============================================
    // API HELPER FUNCTIONS
    // ============================================
    function getToken() {
        return localStorage.getItem('token') || localStorage.getItem('auth_token');
    }

    function getUser() {
        const user = localStorage.getItem('user') || localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }

    function clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('admin_theme');
    }

    async function apiRequest(endpoint, method, data, isBlob) {
        method = method || 'GET';
        isBlob = isBlob || false;
        var token = getToken();
        var headers = {};
        
        // ============================================
        // FIX: Ensure payrollMonth is in YYYY-MM-DD format
        // ============================================
        if (data && typeof data === 'object' && !(data instanceof FormData)) {
            // If there's a payrollMonth field, ensure it's YYYY-MM-DD
            if (data.payrollMonth) {
                var monthVal = data.payrollMonth;
                // If it's YYYY-MM, convert to YYYY-MM-DD
                if (/^\d{4}-\d{2}$/.test(monthVal)) {
                    data.payrollMonth = monthVal + '-01';
                    console.log('✅ Converted payrollMonth to:', data.payrollMonth);
                }
            }
            headers['Content-Type'] = 'application/json';
        }
        
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        
        var options = { method: method, headers: headers };
        if (data) {
            options.body = data instanceof FormData ? data : JSON.stringify(data);
        }
        
        try {
            var response = await fetch(API_BASE + endpoint, options);
            if (isBlob) {
                if (!response.ok) throw new Error('Download failed');
                return response;
            }
            var result = await response.json();
            if (!response.ok) {
                if (response.status === 401) { clearSession(); window.location.href = 'index.html'; }
                throw new Error(result.message || 'Request failed');
            }
            return result;
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('Unable to connect to server.');
            }
            throw error;
        }
    }

    function downloadBlob(blob, filename) {
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // ============================================
    // DATE HELPER FUNCTIONS (FIXED)
    // ============================================
    function formatPayrollMonth(value) {
        // Handles YYYY-MM, YYYY-MM-DD, or empty
        if (!value) {
            var now = new Date();
            return now.getFullYear() + '-' + 
                   String(now.getMonth() + 1).padStart(2, '0') + '-01';
        }
        if (value.length === 7) {
            // YYYY-MM format - append -01
            return value + '-01';
        }
        if (value.length === 10) {
            // Already YYYY-MM-DD
            return value;
        }
        // Try to parse as date
        try {
            var d = new Date(value);
            if (!isNaN(d.getTime())) {
                return d.getFullYear() + '-' + 
                       String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(d.getDate()).padStart(2, '0');
            }
        } catch (e) {}
        // Default to current month first day
        var now = new Date();
        return now.getFullYear() + '-' + 
               String(now.getMonth() + 1).padStart(2, '0') + '-01';
    }

    function displayPayrollMonth(value) {
        if (!value) return 'N/A';
        try {
            var parts = value.split('-');
            if (parts.length >= 2) {
                var d = new Date(parts[0], parts[1] - 1, parts[2] || 1);
                return d.toLocaleString('default', { month: 'long', year: 'numeric' });
            }
        } catch (e) {}
        return value;
    }

    // ============================================
    // FORCE YYYY-MM-DD FOR PAYROLL (NEW)
    // ============================================
    function getPayrollDate() {
        var monthInput = document.getElementById('payrollMonth');
        if (!monthInput || !monthInput.value) {
            var now = new Date();
            return now.getFullYear() + '-' + 
                   String(now.getMonth() + 1).padStart(2, '0') + '-01';
        }
        
        var value = monthInput.value;
        
        // If it's already YYYY-MM-DD, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        
        // If it's YYYY-MM, append -01
        if (/^\d{4}-\d{2}$/.test(value)) {
            return value + '-01';
        }
        
        // Fallback: try to parse as date
        try {
            var d = new Date(value);
            if (!isNaN(d.getTime())) {
                return d.getFullYear() + '-' + 
                       String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(d.getDate()).padStart(2, '0');
            }
        } catch (e) {}
        
        // Final fallback
        var now = new Date();
        return now.getFullYear() + '-' + 
               String(now.getMonth() + 1).padStart(2, '0') + '-01';
    }

    // ============================================
    // AUTH CHECK
    // ============================================
    async function checkAuth() {
        var token = getToken();
        if (!token) { window.location.href = 'index.html'; return false; }
        try {
            var response = await apiRequest('/auth/me', 'GET');
            if (response.success && response.data) {
                var role = response.data.role;
                if (role !== 'admin') { window.location.href = 'index.html'; return false; }
                // Update profile display
                var profileName = document.querySelector('.profile-name');
                var profileRole = document.querySelector('.profile-role');
                if (profileName) profileName.textContent = response.data.fullName || 'Admin User';
                if (profileRole) profileRole.textContent = response.data.position || 'System Administrator';
                return true;
            }
        } catch (e) {
            window.location.href = 'index.html';
            return false;
        }
        return false;
    }

    // ============================================
    // DOM HELPERS
    // ============================================
    var $ = function(s) { return document.querySelector(s); };
    var $$ = function(s) { return document.querySelectorAll(s); };

    function showToast(msg, type) {
        type = type || 'info';
        var container = document.getElementById('toastContainer');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'all .3s ease'; setTimeout(function() { toast.remove(); }, 300); }, 3500);
    }

    function formatTZS(amount) {
        return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(amount || 0);
    }

    function formatTime(d) {
        if (!d) return '';
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    function showLoading(el) {
        if (el) { el.disabled = true; el.classList.add('loading'); }
    }

    function hideLoading(el, text) {
        if (el) { el.disabled = false; el.classList.remove('loading'); if (text) el.textContent = text; }
    }

    // ============================================
    // CLOCK
    // ============================================
    function updateClock() {
        var now = new Date();
        var timeEl = document.getElementById('currentTime');
        var dateEl = document.getElementById('currentDate');
        if (timeEl) timeEl.textContent = formatTime(now);
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).split(',')[0];
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ============================================
    // SIDEBAR & NAVIGATION
    // ============================================
    var sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            var sb = document.getElementById('sidebar');
            if (window.innerWidth <= 768) sb.classList.toggle('mobile-open');
            else sb.classList.toggle('collapsed');
        });
    }

    $$('.nav-item[data-section]').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var section = this.dataset.section;
            $$('.nav-item').forEach(function(n) { n.classList.remove('active'); });
            this.classList.add('active');
            $$('.section').forEach(function(s) { s.classList.remove('active'); });
            var target = document.getElementById(section + 'Section');
            if (target) target.classList.add('active');
            if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('mobile-open');

            // Load section data
            if (section === 'dashboard') loadDashboard();
            else if (section === 'users') loadUsers();
            else if (section === 'attendance') loadAttendance();
            else if (section === 'payroll') loadPayroll();
            else if (section === 'permissions') loadPermissions();
        });
    });

    // Quick action buttons
    $$('.action-btn[data-navigate]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var nav = document.querySelector('.nav-item[data-section="' + btn.dataset.navigate + '"]');
            if (nav) nav.click();
        });
    });

    // Dropdowns
    var notificationBtn = document.getElementById('notificationBtn');
    var profileBtn = document.getElementById('profileBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('notificationDropdown').classList.toggle('hidden'); document.getElementById('profileDropdown').classList.add('hidden'); });
    }
    if (profileBtn) {
        profileBtn.addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('profileDropdown').classList.toggle('hidden'); document.getElementById('notificationDropdown').classList.add('hidden'); });
    }
    document.addEventListener('click', function() { $$('.dropdown').forEach(function(d) { d.classList.add('hidden'); }); });

    // ============================================
    // DASHBOARD
    // ============================================
    var charts = {};

    async function loadDashboard() {
        try {
            var response = await apiRequest('/admin/dashboard', 'GET');
            if (response.success && response.data) {
                var data = response.data;
                // Update summary cards
                var totalUsersEl = document.getElementById('totalUsers');
                var totalHREl = document.getElementById('totalHR');
                var presentTodayEl = document.getElementById('presentToday');
                var pendingPermsEl = document.getElementById('pendingPerms');
                if (totalUsersEl) totalUsersEl.textContent = data.summary ? data.summary.totalUsers : 0;
                if (totalHREl) totalHREl.textContent = data.summary ? data.summary.hrOfficers : 0;
                if (presentTodayEl) presentTodayEl.textContent = data.summary ? data.summary.presentToday : 0;
                if (pendingPermsEl) pendingPermsEl.textContent = data.summary ? data.summary.pendingRequests : 0;

                // Render charts
                renderAttendanceChart(data.attendanceOverview);
                renderUserDistributionChart(data.userDistribution);
                renderPayrollChart(data.payrollStatistics);
                renderLeaveChart(data.leaveStatistics);

                // Recent activities
                var feed = document.getElementById('activityFeed');
                if (feed && data.recentActivities) {
                    feed.innerHTML = data.recentActivities.map(function(a) {
                        var icon = 'fa-info-circle';
                        if (a.action && a.action.includes('USER')) icon = 'fa-user-plus';
                        else if (a.action && a.action.includes('ATTENDANCE')) icon = 'fa-calendar-check';
                        else if (a.action && a.action.includes('PAYROLL')) icon = 'fa-money-bill';
                        else if (a.action && a.action.includes('PERMISSION')) icon = 'fa-clipboard-check';
                        return '<div class="activity-item"><i class="fas ' + icon + ' text-info"></i><div><p>' + (a.description || a.action) + '</p><small>' + (a.timeAgo || '') + '</small></div></div>';
                    }).join('');
                }

                // Unread notifications count
                var notifCount = document.getElementById('notificationCount');
                if (notifCount && data.notifications) {
                    notifCount.textContent = data.notifications.unreadCount || 0;
                }
            }
        } catch (error) {
            console.error('Dashboard load error:', error.message);
            showToast('Failed to load dashboard data.', 'error');
        }
    }

    function renderAttendanceChart(data) {
        if (charts.attendanceChart) charts.attendanceChart.destroy();
        var ctx = document.getElementById('attendanceChart');
        if (!ctx || !data) return;
        charts.attendanceChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: data.labels || [], datasets: data.datasets || [] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderUserDistributionChart(data) {
        if (charts.userChart) charts.userChart.destroy();
        var ctx = document.getElementById('userChart');
        if (!ctx || !data) return;
        charts.userChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: data.labels || [], datasets: [{ data: data.counts || [], backgroundColor: ['#3182ce','#f0b84d','#38a169'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderPayrollChart(data) {
        if (charts.payrollChart) charts.payrollChart.destroy();
        var ctx = document.getElementById('payrollChart');
        if (!ctx || !data) return;
        charts.payrollChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: (data.labels || []).slice(0, 6), datasets: [{ label: 'Payroll (TZS)', data: (data.values || []).slice(0, 6), backgroundColor: '#d69e2e' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderLeaveChart(data) {
        if (charts.leaveChart) charts.leaveChart.destroy();
        var ctx = document.getElementById('leaveChart');
        if (!ctx || !data) return;
        charts.leaveChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: data.labels || [], datasets: [{ data: data.counts || [], backgroundColor: ['#38a169','#e53e3e','#d69e2e'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // ============================================
    // USER MANAGEMENT
    // ============================================
    async function loadUsers(search, dept, role, status) {
        var tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var params = {};
            if (search) params.search = search;
            if (dept) params.department = dept;
            if (role) params.role = role;
            if (status) params.status = status;
            var query = Object.entries(params).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
            var response = await apiRequest('/users' + (query ? '?' + query : ''), 'GET');
            if (response.success && response.data) {
                var users = response.data;
                if (users.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">No users found</td></tr>';
                    return;
                }
                tbody.innerHTML = users.map(function(u) {
                    var roleBadge = u.role === 'admin' ? 'badge-info' : u.role === 'hr' ? 'badge-warning' : 'badge-success';
                    var statusBadge = u.status === 'active' ? 'badge-success' : u.status === 'suspended' ? 'badge-danger' : 'badge-warning';
                    return '<tr>' +
                        '<td>' + (u.employee_id || u.id) + '</td>' +
                        '<td>' + u.full_name + '</td>' +
                        '<td>' + u.email + '</td>' +
                        '<td>' + (u.department || '—') + '</td>' +
                        '<td>' + (u.position || '—') + '</td>' +
                        '<td><span class="badge ' + roleBadge + '">' + u.role + '</span></td>' +
                        '<td><span class="badge ' + statusBadge + '">' + u.status + '</span></td>' +
                        '<td>' +
                            '<button class="btn btn-sm btn-outline view-user" data-id="' + u.id + '" title="View"><i class="fas fa-eye"></i></button> ' +
                            '<button class="btn btn-sm btn-outline edit-user" data-id="' + u.id + '" title="Edit"><i class="fas fa-edit"></i></button> ' +
                            '<button class="btn btn-sm btn-outline toggle-user" data-id="' + u.id + '" data-status="' + u.status + '" title="' + (u.status === 'active' ? 'Suspend' : 'Activate') + '"><i class="fas ' + (u.status === 'active' ? 'fa-ban' : 'fa-check') + '"></i></button> ' +
                            '<button class="btn btn-sm btn-danger del-user" data-id="' + u.id + '" title="Delete"><i class="fas fa-trash"></i></button>' +
                        '</td></tr>';
                }).join('');

                // Bind events
                tbody.querySelectorAll('.view-user').forEach(function(b) { b.addEventListener('click', function() { viewUser(this.dataset.id); }); });
                tbody.querySelectorAll('.edit-user').forEach(function(b) { b.addEventListener('click', function() { editUser(this.dataset.id); }); });
                tbody.querySelectorAll('.toggle-user').forEach(function(b) { b.addEventListener('click', function() { toggleUserStatus(this.dataset.id, this.dataset.status); }); });
                tbody.querySelectorAll('.del-user').forEach(function(b) { b.addEventListener('click', function() { confirmDeleteUser(this.dataset.id); }); });
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Error loading users</td></tr>';
            showToast('Failed to load users.', 'error');
        }
    }

    // Register User Form
    var registerForm = document.getElementById('registerUserForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var data = {
                fullName: document.getElementById('regName').value,
                employeeId: document.getElementById('regEmpId').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone').value,
                department: document.getElementById('regDept').value,
                position: document.getElementById('regPosition').value,
                role: document.getElementById('regRole').value,
                username: document.getElementById('regUsername').value,
                password: document.getElementById('regPassword').value
            };
            // Map role
            if (data.role === 'HR Officer') data.role = 'hr';
            else if (data.role === 'Admin') { showToast('Cannot create admin users through this form.', 'error'); return; }
            else data.role = 'employee';

            try {
                await apiRequest('/users', 'POST', data);
                showToast('User registered successfully!', 'success');
                registerForm.reset();
                loadUsers();
            } catch (error) {
                showToast(error.message || 'Failed to register user.', 'error');
            }
        });
    }

    async function viewUser(id) {
        try {
            var response = await apiRequest('/users/' + id, 'GET');
            if (response.success && response.data) {
                var u = response.data;
                var body = document.getElementById('userDetailBody');
                body.innerHTML = '<p><strong>ID:</strong> ' + (u.employee_id || u.id) + '</p>' +
                    '<p><strong>Name:</strong> ' + u.full_name + '</p>' +
                    '<p><strong>Email:</strong> ' + u.email + '</p>' +
                    '<p><strong>Phone:</strong> ' + (u.phone || '—') + '</p>' +
                    '<p><strong>Department:</strong> ' + (u.department || '—') + '</p>' +
                    '<p><strong>Position:</strong> ' + (u.position || '—') + '</p>' +
                    '<p><strong>Role:</strong> ' + u.role + '</p>' +
                    '<p><strong>Username:</strong> ' + (u.username || '—') + '</p>' +
                    '<p><strong>Status:</strong> ' + u.status + '</p>';
                document.getElementById('userDetailModal').classList.remove('hidden');
            }
        } catch (error) {
            showToast('Failed to load user details.', 'error');
        }
    }

    var editUserId = null;
    async function editUser(id) {
        try {
            var response = await apiRequest('/users/' + id, 'GET');
            if (response.success && response.data) {
                var u = response.data;
                editUserId = id;
                var form = document.getElementById('editUserForm');
                form.innerHTML = '<div class="form-row"><div class="form-group"><label>Name</label><input type="text" class="form-control" id="editName" value="' + u.full_name + '"></div><div class="form-group"><label>Email</label><input type="email" class="form-control" id="editEmail" value="' + u.email + '"></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="editPhone" value="' + (u.phone || '') + '"></div><div class="form-group"><label>Department</label><input type="text" class="form-control" id="editDept" value="' + (u.department || '') + '"></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>Position</label><input type="text" class="form-control" id="editPosition" value="' + (u.position || '') + '"></div><div class="form-group"><label>Status</label><select class="form-control" id="editStatus"><option value="active"' + (u.status === 'active' ? ' selected' : '') + '>Active</option><option value="suspended"' + (u.status === 'suspended' ? ' selected' : '') + '>Suspended</option></select></div></div>';
                document.getElementById('editUserModal').classList.remove('hidden');
            }
        } catch (error) {
            showToast('Failed to load user for editing.', 'error');
        }
    }

    var saveEditBtn = document.getElementById('saveEditUserBtn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', async function() {
            if (!editUserId) return;
            var data = {
                fullName: document.getElementById('editName').value,
                email: document.getElementById('editEmail').value,
                phone: document.getElementById('editPhone').value,
                department: document.getElementById('editDept').value,
                position: document.getElementById('editPosition').value,
                status: document.getElementById('editStatus').value
            };
            try {
                await apiRequest('/users/' + editUserId, 'PUT', data);
                document.getElementById('editUserModal').classList.add('hidden');
                loadUsers();
                showToast('User updated!', 'success');
            } catch (error) {
                showToast(error.message || 'Failed to update user.', 'error');
            }
        });
    }

    async function toggleUserStatus(id, currentStatus) {
        var endpoint = currentStatus === 'active' ? '/users/' + id + '/suspend' : '/users/' + id + '/unsuspend';
        try {
            await apiRequest(endpoint, 'PATCH');
            loadUsers();
            showToast('User status updated!', 'success');
        } catch (error) {
            showToast(error.message || 'Failed to update user status.', 'error');
        }
    }

    var deleteUserId = null;
    function confirmDeleteUser(id) {
        deleteUserId = id;
        document.getElementById('confirmTitle').textContent = 'Delete User';
        document.getElementById('confirmMessage').textContent = 'Are you sure you want to delete this user?';
        document.getElementById('confirmActionBtn').className = 'btn btn-danger';
        document.getElementById('confirmModal').classList.remove('hidden');
    }

    var confirmActionBtn = document.getElementById('confirmActionBtn');
if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', async function() {
        if (!deleteUserId) return;
        try {
            var response = await apiRequest('/users/' + deleteUserId, 'DELETE');
            if (response.success) {
                loadUsers();
                showToast('User deleted!', 'info');
            } else {
                showToast(response.message || 'Failed to delete user.', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast(error.message || 'Failed to delete user.', 'error');
        }
        deleteUserId = null;
        document.getElementById('confirmModal').classList.add('hidden');
    });
}
    // Search & Filters
    var userSearch = document.getElementById('userSearch');
    if (userSearch) userSearch.addEventListener('input', function() { loadUsers(this.value, document.getElementById('userDeptFilter').value, document.getElementById('userRoleFilter').value, document.getElementById('userStatusFilter').value); });
    var userDeptFilter = document.getElementById('userDeptFilter');
    if (userDeptFilter) userDeptFilter.addEventListener('change', function() { loadUsers(document.getElementById('userSearch').value, this.value, document.getElementById('userRoleFilter').value, document.getElementById('userStatusFilter').value); });
    var userRoleFilter = document.getElementById('userRoleFilter');
    if (userRoleFilter) userRoleFilter.addEventListener('change', function() { loadUsers(document.getElementById('userSearch').value, document.getElementById('userDeptFilter').value, this.value, document.getElementById('userStatusFilter').value); });
    var userStatusFilter = document.getElementById('userStatusFilter');
    if (userStatusFilter) userStatusFilter.addEventListener('change', function() { loadUsers(document.getElementById('userSearch').value, document.getElementById('userDeptFilter').value, document.getElementById('userRoleFilter').value, this.value); });

    // Refresh button
    var refreshUsersBtn = document.getElementById('refreshUsersBtn');
    if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', function() { loadUsers(); });

    // ============================================
    // ATTENDANCE MANAGEMENT
    // ============================================
    async function loadAttendance(search, date) {
        var tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var params = {};
            if (search) params.search = search;
            if (date) params.date = date;
            var query = Object.entries(params).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
            var response = await apiRequest('/attendance' + (query ? '?' + query : ''), 'GET');
            if (response.success && response.data) {
                var records = response.data;
                if (records.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">No records found</td></tr>';
                    return;
                }
                tbody.innerHTML = records.map(function(a) {
                    var emp = a.employee || {};
                    return '<tr>' +
                        '<td>' + (emp.fullName || '—') + '</td>' +
                        '<td>' + (a.date || '—') + '</td>' +
                        '<td>' + (a.checkIn || '—') + '</td>' +
                        '<td>' + (a.checkOut || '—') + '</td>' +
                        '<td>' + (a.hoursWorked || '—') + '</td>' +
                        '<td><span class="badge ' + (a.status === 'Present' ? 'badge-success' : 'badge-warning') + '">' + (a.status || '—') + '</span></td>' +
                        '<td>' + (a.location && a.location.address ? a.location.address + ' (' + a.location.distanceFromSchool + 'm)' : '—') + '</td>' +
                        '<td><button class="btn btn-sm btn-outline view-att" data-id="' + a.id + '"><i class="fas fa-eye"></i></button></td>' +
                        '</tr>';
                }).join('');
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Error loading attendance</td></tr>';
            showToast('Failed to load attendance.', 'error');
        }
    }

    var attSearch = document.getElementById('attSearch');
    if (attSearch) attSearch.addEventListener('input', function() { loadAttendance(this.value, document.getElementById('attDateFilter').value); });
    var attDateFilter = document.getElementById('attDateFilter');
    if (attDateFilter) attDateFilter.addEventListener('change', function() { loadAttendance(document.getElementById('attSearch').value, this.value); });

    var refreshAttBtn = document.getElementById('refreshAttBtn');
    if (refreshAttBtn) refreshAttBtn.addEventListener('click', function() { loadAttendance(); });

    var exportAttBtn = document.getElementById('exportAttBtn');
    if (exportAttBtn) {
        exportAttBtn.addEventListener('click', async function() {
            try {
                var date = document.getElementById('attDateFilter').value;
                var url = '/attendance/export/csv';
                if (date) url += '?date=' + date;
                var response = await apiRequest(url, 'GET', null, true);
                var blob = await response.blob();
                downloadBlob(blob, 'attendance.csv');
                showToast('Exported!', 'success');
            } catch (error) {
                showToast('Export failed.', 'error');
            }
        });
    }

    // ============================================
    // PAYROLL MANAGEMENT (COMPLETELY FIXED)
    // ============================================
    var currentPayroll = {};

    function calcSalary() {
        var basic = parseFloat(document.getElementById('basicSalary').value) || 0;
        var allowances = parseFloat(document.getElementById('allowances').value) || 0;
        var overtime = parseFloat(document.getElementById('overtime').value) || 0;
        var tax = parseFloat(document.getElementById('tax').value) || 0;
        var deductions = parseFloat(document.getElementById('deductions').value) || 0;
        var net = basic + allowances + overtime - tax - deductions;
        var netEl = document.getElementById('netSalaryResult');
        if (netEl) netEl.textContent = formatTZS(net);
        currentPayroll = { basic: basic, allowances: allowances, overtime: overtime, tax: tax, deductions: deductions, net: net };
    }

    ['basicSalary','allowances','overtime','tax','deductions'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', calcSalary);
    });

    // Calculate Salary Button - FIXED
    var calcSalaryBtn = document.getElementById('calcSalaryBtn');
    if (calcSalaryBtn) {
        calcSalaryBtn.addEventListener('click', function() {
            // FIX: Use getPayrollDate() to ensure YYYY-MM-DD format
            var payrollDate = getPayrollDate();
            
            var data = {
                employeeId: parseInt(document.getElementById('payrollEmployee').value) || 0,
                payrollMonth: payrollDate,  // Now always YYYY-MM-DD
                basicSalary: parseFloat(document.getElementById('basicSalary').value) || 0,
                allowances: parseFloat(document.getElementById('allowances').value) || 0,
                overtime: parseFloat(document.getElementById('overtime').value) || 0,
                tax: parseFloat(document.getElementById('tax').value) || 0,
                deductions: parseFloat(document.getElementById('deductions').value) || 0
            };
            
            console.log('📊 Calculating payroll with:', data); // Debug log
            
            apiRequest('/payroll/calculate', 'POST', data).then(function(response) {
                if (response.success && response.data) {
                    var d = response.data;
                    currentPayroll = d;
                    var netEl = document.getElementById('netSalaryResult');
                    if (netEl) netEl.textContent = formatTZS(d.netSalary);
                    showToast('Salary calculated!', 'success');
                }
            }).catch(function(error) {
                showToast(error.message || 'Calculation failed.', 'error');
            });
        });
    }

    // Save Payroll Button - FIXED
    var savePayrollBtn = document.getElementById('savePayrollBtn');
    if (savePayrollBtn) {
        savePayrollBtn.addEventListener('click', async function() {
            var empId = document.getElementById('payrollEmployee').value;
            if (!empId) { 
                showToast('Please select an employee.', 'error'); 
                return; 
            }
            
            // FIX: Use getPayrollDate() to ensure YYYY-MM-DD format
            var payrollDate = getPayrollDate();
            
            var data = {
                employeeId: parseInt(empId),
                payrollMonth: payrollDate,  // Now always YYYY-MM-DD
                basicSalary: parseFloat(document.getElementById('basicSalary').value) || 0,
                allowances: parseFloat(document.getElementById('allowances').value) || 0,
                overtime: parseFloat(document.getElementById('overtime').value) || 0,
                tax: parseFloat(document.getElementById('tax').value) || 0,
                deductions: parseFloat(document.getElementById('deductions').value) || 0
            };
            
            console.log('💾 Saving payroll with:', data); // Debug log
            
            try {
                var response = await apiRequest('/payroll', 'POST', data);
                showToast('Payroll saved!', 'success');
                loadPayrollRecords();
            } catch (error) {
                showToast(error.message || 'Failed to save payroll.', 'error');
            }
        });
    }

    // Generate Payslip Button - FIXED
    var genPayslipBtn = document.getElementById('genPayslipBtn');
    if (genPayslipBtn) {
        genPayslipBtn.addEventListener('click', function() {
            var emp = document.getElementById('payrollEmployee').selectedOptions[0];
            var monthValue = document.getElementById('payrollMonth').value;
            
            // Format for display using getPayrollDate
            var displayMonth = 'N/A';
            try {
                var dateStr = getPayrollDate();
                var parts = dateStr.split('-');
                if (parts.length >= 2) {
                    var d = new Date(parts[0], parts[1] - 1, parts[2] || 1);
                    displayMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                }
            } catch (e) {}
            
            var body = document.getElementById('payslipBody');
            body.innerHTML = '<div class="payslip-content"><h3>RASALLY SCHOOL PAYSLIP</h3>' +
                '<p><strong>Employee:</strong> ' + (emp ? emp.textContent : 'N/A') + '</p>' +
                '<p><strong>Month:</strong> ' + displayMonth + '</p>' +
                '<hr>' +
                '<p><strong>Basic Salary:</strong> ' + formatTZS(currentPayroll.basic || 0) + '</p>' +
                '<p><strong>Allowances:</strong> ' + formatTZS(currentPayroll.allowances || 0) + '</p>' +
                '<p><strong>Overtime:</strong> ' + formatTZS(currentPayroll.overtime || 0) + '</p>' +
                '<p style="color:#e53e3e;"><strong>Tax:</strong> -' + formatTZS(currentPayroll.tax || 0) + '</p>' +
                '<p style="color:#e53e3e;"><strong>Deductions:</strong> -' + formatTZS(currentPayroll.deductions || 0) + '</p>' +
                '<hr>' +
                '<h2><strong>Net Salary: ' + formatTZS(currentPayroll.net || 0) + '</strong></h2>' +
                '<p style="font-size:10px;color:#999;text-align:center;margin-top:20px;">Generated on ' + new Date().toLocaleDateString() + '</p>' +
                '</div>';
            document.getElementById('payslipModal').classList.remove('hidden');
        });
    }

    // Load Payroll Records
    async function loadPayrollRecords(search) {
        var tbody = document.getElementById('payrollTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var url = '/payroll';
            if (search) url += '?search=' + encodeURIComponent(search);
            var response = await apiRequest(url, 'GET');
            if (response.success && response.data) {
                var records = response.data;
                if (records.length === 0) { 
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">No records</td></tr>'; 
                    return; 
                }
                tbody.innerHTML = records.map(function(p) {
                    // Format month for display
                    var displayMonth = p.payrollMonth || p.month || '—';
                    try {
                        var parts = displayMonth.split('-');
                        if (parts.length >= 2) {
                            var d = new Date(parts[0], parts[1] - 1, parts[2] || 1);
                            displayMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                        }
                    } catch (e) {}
                    
                    return '<tr>' +
                        '<td>' + (p.employee ? p.employee.fullName : '—') + '</td>' +
                        '<td>' + displayMonth + '</td>' +
                        '<td>' + formatTZS(p.basicSalary) + '</td>' +
                        '<td>' + formatTZS((p.allowances || 0) + (p.overtimePay || 0)) + '</td>' +
                        '<td>' + formatTZS((p.tax || 0) + (p.deductions || 0)) + '</td>' +
                        '<td><strong>' + formatTZS(p.netSalary) + '</strong></td>' +
                        '<td><span class="badge ' + (p.status === 'Paid' ? 'badge-success' : 'badge-info') + '">' + p.status + '</span></td>' +
                        '<td><button class="btn btn-sm btn-outline edit-pay" data-id="' + p.id + '"><i class="fas fa-edit"></i></button></td>' +
                        '</tr>';
                }).join('');
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Error loading records</td></tr>';
            console.error('Payroll load error:', error);
        }
    }

    // Load Payroll - FIXED with default date
    function loadPayroll() {
        // Set default month to current month in YYYY-MM format for input
        var monthInput = document.getElementById('payrollMonth');
        if (monthInput) {
            var now = new Date();
            var defaultMonth = now.getFullYear() + '-' + 
                              String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = defaultMonth;
        }
        
        loadPayrollRecords();
        
        // Load employees into select
        apiRequest('/users?role=employee&status=active', 'GET').then(function(response) {
            if (response.success && response.data) {
                var sel = document.getElementById('payrollEmployee');
                if (sel) {
                    sel.innerHTML = '<option value="">Select Employee</option>' + 
                        response.data.map(function(u) { 
                            return '<option value="' + u.id + '">' + u.full_name + ' (' + (u.employee_id || u.id) + ')</option>'; 
                        }).join('');
                }
            }
        }).catch(function() {});
    }

    var payrollSearch = document.getElementById('payrollSearch');
    if (payrollSearch) payrollSearch.addEventListener('input', function() { loadPayrollRecords(this.value); });

    var refreshPayrollBtn = document.getElementById('refreshPayrollBtn');
    if (refreshPayrollBtn) refreshPayrollBtn.addEventListener('click', function() { loadPayroll(); });

    // ============================================
    // PERMISSION MANAGEMENT
    // ============================================
    async function loadPermissions() {
        var tbody = document.getElementById('permTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var statusF = document.getElementById('permStatusFilter') ? document.getElementById('permStatusFilter').value : '';
            var typeF = document.getElementById('permTypeFilter') ? document.getElementById('permTypeFilter').value : '';
            var params = {};
            if (statusF) params.status = statusF;
            if (typeF) params.type = typeF;
            var query = Object.entries(params).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
            var response = await apiRequest('/permissions' + (query ? '?' + query : ''), 'GET');
            if (response.success && response.data) {
                var records = response.data;
                if (records.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">No requests</td></tr>'; return; }
                tbody.innerHTML = records.map(function(p) {
                    var statusBadge = p.status === 'Approved' ? 'badge-success' : p.status === 'Rejected' ? 'badge-danger' : 'badge-warning';
                    var actions = '<button class="btn btn-sm btn-outline info-perm" data-id="' + p.id + '"><i class="fas fa-info-circle"></i></button> ';
                    if (p.hasDocument) actions += '<button class="btn btn-sm btn-outline doc-perm" data-id="' + p.id + '"><i class="fas fa-paperclip"></i></button> ';
                    if (p.status === 'Pending') actions += '<button class="btn btn-sm btn-success app-perm" data-id="' + p.id + '"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger rej-perm" data-id="' + p.id + '"><i class="fas fa-times"></i></button>';
                    return '<tr>' +
                        '<td>' + (p.employee ? p.employee.fullName : '—') + '</td>' +
                        '<td>' + (p.typeLabel || p.type) + '</td>' +
                        '<td>' + p.startDate + ' - ' + p.endDate + '</td>' +
                        '<td>' + p.days + '</td>' +
                        '<td>' + (p.reason || '—') + '</td>' +
                        '<td><span class="badge ' + statusBadge + '">' + p.status + '</span></td>' +
                        '<td>' + actions + '</td></tr>';
                }).join('');

                tbody.querySelectorAll('.info-perm').forEach(function(b) { b.addEventListener('click', function() { viewPermissionDetail(this.dataset.id); }); });
                tbody.querySelectorAll('.doc-perm').forEach(function(b) { b.addEventListener('click', function() { downloadPermissionDoc(this.dataset.id); }); });
                tbody.querySelectorAll('.app-perm').forEach(function(b) { b.addEventListener('click', function() { approvePermission(this.dataset.id); }); });
                tbody.querySelectorAll('.rej-perm').forEach(function(b) { b.addEventListener('click', function() { rejectPermission(this.dataset.id); }); });
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Error loading requests</td></tr>';
        }
    }

    async function viewPermissionDetail(id) {
        try {
            var response = await apiRequest('/permissions/' + id, 'GET');
            if (response.success && response.data) {
                var p = response.data;
                var body = document.getElementById('userDetailBody');
                body.innerHTML = '<p><strong>Employee:</strong> ' + (p.employee ? p.employee.fullName : '—') + '</p>' +
                    '<p><strong>Type:</strong> ' + (p.typeLabel || p.type) + '</p>' +
                    '<p><strong>Dates:</strong> ' + p.startDate + ' - ' + p.endDate + ' (' + p.days + ' days)</p>' +
                    '<p><strong>Reason:</strong> ' + (p.reason || '—') + '</p>' +
                    '<p><strong>Status:</strong> ' + p.status + '</p>' +
                    '<p><strong>Document:</strong> ' + (p.document && p.document.available ? p.document.originalName : 'None') + '</p>';
                if (p.review && p.review.reviewedBy) {
                    body.innerHTML += '<p><strong>Reviewed By:</strong> ' + p.review.reviewedBy + '</p><p><strong>Review Comment:</strong> ' + (p.review.comment || '—') + '</p>';
                }
                document.getElementById('userDetailModal').classList.remove('hidden');
            }
        } catch (error) {
            showToast('Failed to load details.', 'error');
        }
    }

    async function downloadPermissionDoc(id) {
        try {
            var response = await apiRequest('/permissions/' + id + '/document/download', 'GET', null, true);
            var blob = await response.blob();
            downloadBlob(blob, 'document_' + id);
            showToast('Document downloaded!', 'success');
        } catch (error) {
            showToast('No document or download failed.', 'error');
        }
    }

    async function approvePermission(id) {
        try {
            await apiRequest('/permissions/' + id + '/approve', 'PATCH', { comment: 'Approved by Admin.' });
            loadPermissions();
            showToast('Approved!', 'success');
        } catch (error) {
            showToast(error.message || 'Failed to approve.', 'error');
        }
    }

    async function rejectPermission(id) {
        var reason = prompt('Rejection reason:');
        if (!reason) return;
        try {
            await apiRequest('/permissions/' + id + '/reject', 'PATCH', { comment: reason });
            loadPermissions();
            showToast('Rejected.', 'warning');
        } catch (error) {
            showToast(error.message || 'Failed to reject.', 'error');
        }
    }

    var permStatusFilter = document.getElementById('permStatusFilter');
    if (permStatusFilter) permStatusFilter.addEventListener('change', loadPermissions);
    var permTypeFilter = document.getElementById('permTypeFilter');
    if (permTypeFilter) permTypeFilter.addEventListener('change', loadPermissions);

    var refreshPermBtn = document.getElementById('refreshPermBtn');
    if (refreshPermBtn) refreshPermBtn.addEventListener('click', loadPermissions);

    // ============================================
    // REPORTS
    // ============================================
    $$('.report-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            var type = this.dataset.report;
            var url = '';
            var filename = type + '_report.csv';
            try {
                if (type.startsWith('attendance')) {
                    var date = prompt('Enter date (YYYY-MM-DD) or leave blank for all:', new Date().toISOString().split('T')[0]);
                    url = '/attendance/export/csv' + (date ? '?date=' + date : '');
                    filename = 'attendance_report.csv';
                } else if (type.startsWith('payroll')) {
                    var month = prompt('Enter month (YYYY-MM-):', '2026-07');
                    url = '/reports/payroll/monthly-summary/csv?year=' + (month ? month.split('-')[0] : '2026') + '&month=' + (month ? month.split('-')[1] : '7');
                    filename = 'payroll_report.csv';
                } else if (type.startsWith('perm')) {
                    var st = type.replace('perm-', '');
                    url = '/reports/permissions/csv?status=' + st;
                    filename = 'permissions_' + st + '.csv';
                } else if (type.startsWith('users')) {
                    var st = type.replace('users-', '');
                    url = '/reports/users/csv?status=' + st;
                    filename = 'users_' + st + '.csv';
                }
                if (url) {
                    var response = await apiRequest(url, 'GET', null, true);
                    var blob = await response.blob();
                    downloadBlob(blob, filename);
                    showToast('Report generated!', 'success');
                }
            } catch (error) {
                showToast('Report generation failed.', 'error');
            }
        });
    });

    // ============================================
    // SETTINGS
    // ============================================
    // Tabs
    $$('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            $$('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            $$('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            var target = document.getElementById(this.dataset.tab + 'Tab');
            if (target) target.classList.add('active');

            // Load settings for each tab
            if (this.dataset.tab === 'school') loadSchoolInfo();
            else if (this.dataset.tab === 'access') loadAccessControl();
            else if (this.dataset.tab === 'notifications') loadNotificationSettings();
            else if (this.dataset.tab === 'appearance') loadAppearanceSetting();
        });
    });

    async function loadSchoolInfo() {
        try {
            var response = await apiRequest('/settings/school-info', 'GET');
            if (response.success && response.data) {
                var d = response.data;
                var nameEl = document.getElementById('schoolName');
                var addrEl = document.getElementById('schoolAddress');
                var phoneEl = document.getElementById('schoolPhone');
                var emailEl = document.getElementById('schoolEmail');
                if (nameEl) nameEl.value = d.schoolName || '';
                if (addrEl) addrEl.value = d.address || '';
                if (phoneEl) phoneEl.value = d.phone || '';
                if (emailEl) emailEl.value = d.email || '';
            }
        } catch (error) {}
    }

    var schoolForm = document.getElementById('schoolForm');
    if (schoolForm) {
        schoolForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var data = {
                schoolName: document.getElementById('schoolName').value,
                address: document.getElementById('schoolAddress').value,
                phone: document.getElementById('schoolPhone').value,
                email: document.getElementById('schoolEmail').value
            };
            try {
                await apiRequest('/settings/school-info', 'PUT', data);
                showToast('School info saved!', 'success');
            } catch (error) {
                showToast('Failed to save.', 'error');
            }
        });
    }

    async function loadAccessControl() {
        try {
            var response = await apiRequest('/settings/access-control', 'GET');
            if (response.success && response.data) {
                var d = response.data;
                var accReg = document.getElementById('accessReg');
                var accAtt = document.getElementById('accessAtt');
                var accPay = document.getElementById('accessPay');
                var accPerm = document.getElementById('accessPerm');
                if (accReg) accReg.checked = d.userRegistrationEnabled;
                if (accAtt) accAtt.checked = d.attendanceModuleEnabled;
                if (accPay) accPay.checked = d.payrollAccessEnabled;
                if (accPerm) accPerm.checked = d.permissionModuleEnabled;
            }
        } catch (error) {}
    }

    ['accessReg','accessAtt','accessPay','accessPerm'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', async function() {
            var data = {
                userRegistrationEnabled: document.getElementById('accessReg') ? document.getElementById('accessReg').checked : true,
                attendanceModuleEnabled: document.getElementById('accessAtt') ? document.getElementById('accessAtt').checked : true,
                payrollAccessEnabled: document.getElementById('accessPay') ? document.getElementById('accessPay').checked : true,
                permissionModuleEnabled: document.getElementById('accessPerm') ? document.getElementById('accessPerm').checked : true
            };
            try {
                await apiRequest('/settings/access-control', 'PUT', data);
                showToast('Access settings saved!', 'success');
            } catch (error) {
                showToast('Failed to save.', 'error');
            }
        });
    });

    var adminPasswordForm = document.getElementById('adminPasswordForm');
    if (adminPasswordForm) {
        adminPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var current = document.getElementById('adminCurrentPass').value;
            var newP = document.getElementById('adminNewPass').value;
            var confirm = document.getElementById('adminConfirmPass').value;
            if (newP !== confirm) { showToast('Passwords do not match!', 'error'); return; }
            try {
                await apiRequest('/settings/security/password', 'PATCH', { currentPassword: current, newPassword: newP, confirmPassword: confirm });
                showToast('Password updated!', 'success');
                adminPasswordForm.reset();
            } catch (error) {
                showToast(error.message || 'Failed to update password.', 'error');
            }
        });
    }

    async function loadNotificationSettings() {
        try {
            var response = await apiRequest('/settings/notifications', 'GET');
            if (response.success && response.data) {
                var d = response.data;
                var notifAtt = document.getElementById('notifAtt');
                var notifPay = document.getElementById('notifPay');
                var notifPerm = document.getElementById('notifPerm');
                var notifEmail = document.getElementById('notifEmail');
                if (notifAtt) notifAtt.checked = d.attendanceNotificationsEnabled;
                if (notifPay) notifPay.checked = d.payrollNotificationsEnabled;
                if (notifPerm) notifPerm.checked = d.permissionNotificationsEnabled;
                if (notifEmail) notifEmail.checked = d.emailNotificationsEnabled;
            }
        } catch (error) {}
    }

    ['notifAtt','notifPay','notifPerm','notifEmail'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', async function() {
            var data = {
                attendanceNotificationsEnabled: document.getElementById('notifAtt') ? document.getElementById('notifAtt').checked : true,
                payrollNotificationsEnabled: document.getElementById('notifPay') ? document.getElementById('notifPay').checked : true,
                permissionNotificationsEnabled: document.getElementById('notifPerm') ? document.getElementById('notifPerm').checked : true,
                emailNotificationsEnabled: document.getElementById('notifEmail') ? document.getElementById('notifEmail').checked : true
            };
            try {
                await apiRequest('/settings/notifications', 'PUT', data);
                showToast('Preferences saved!', 'success');
            } catch (error) {
                showToast('Failed to save.', 'error');
            }
        });
    });

    async function loadAppearanceSetting() {
        try {
            var response = await apiRequest('/settings/appearance', 'GET');
            if (response.success && response.data) {
                var mode = response.data.mode || 'light';
                var themeLight = document.getElementById('themeLight');
                var themeDark = document.getElementById('themeDark');
                if (mode === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    if (themeDark) themeDark.checked = true;
                } else {
                    document.documentElement.removeAttribute('data-theme');
                    if (themeLight) themeLight.checked = true;
                }
            }
        } catch (error) {}
    }

    $$('input[name="theme"]').forEach(function(radio) {
        radio.addEventListener('change', async function() {
            var mode = this.value;
            try {
                await apiRequest('/settings/appearance', 'PUT', { mode: mode });
                if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
                else document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('admin_theme', mode);
                showToast('Theme: ' + mode, 'info');
            } catch (error) {
                showToast('Failed to save theme.', 'error');
            }
        });
    });

    // Load saved theme
    var savedTheme = localStorage.getItem('admin_theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        var dr = document.getElementById('themeDark');
        if (dr) dr.checked = true;
    }

    // ============================================
    // LOGOUT
    // ============================================
    function openLogout() { document.getElementById('logoutModal').classList.remove('hidden'); }
    function closeLogout() { document.getElementById('logoutModal').classList.add('hidden'); }

    var logoutMenu = document.getElementById('logoutMenu');
    if (logoutMenu) logoutMenu.addEventListener('click', function(e) { e.preventDefault(); openLogout(); });
    var quickLogout = document.getElementById('quickLogout');
    if (quickLogout) quickLogout.addEventListener('click', function(e) { e.preventDefault(); openLogout(); });

    $$('#logoutModal .modal-close, #logoutModal .modal-close-btn').forEach(function(b) { b.addEventListener('click', closeLogout); });
    var logoutModal = document.getElementById('logoutModal');
    if (logoutModal) logoutModal.addEventListener('click', function(e) { if (e.target === logoutModal) closeLogout(); });

    var confirmLogout = document.getElementById('confirmLogout');
    if (confirmLogout) {
        confirmLogout.addEventListener('click', async function() {
            var btn = this;
            var text = document.getElementById('logoutText');
            var spinner = document.getElementById('logoutSpinner');
            btn.disabled = true;
            if (text) text.textContent = 'Logging out...';
            if (spinner) spinner.classList.remove('hidden');
            try {
                await apiRequest('/auth/logout', 'POST');
            } catch (e) {}
            clearSession();
            window.location.href = 'index.html';
        });
    }

    // Modal close buttons
    $$('.modal-close, .modal-close-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { this.closest('.modal').classList.add('hidden'); });
    });
    $$('.modal').forEach(function(m) {
        m.addEventListener('click', function(e) { if (e.target === this) this.classList.add('hidden'); });
    });

    // Print payslip
    var printPayslipBtn = document.getElementById('printPayslipBtn');
    if (printPayslipBtn) printPayslipBtn.addEventListener('click', function() { window.print(); });

    // Download payslip
    var downloadPayslipBtn = document.getElementById('downloadPayslipBtn');
    if (downloadPayslipBtn) downloadPayslipBtn.addEventListener('click', function() { showToast('Downloading PDF...', 'info'); });

    // Mark all notifications read
    var markAllRead = document.getElementById('markAllRead');
    if (markAllRead) {
        markAllRead.addEventListener('click', async function() {
            try {
                await apiRequest('/notifications/mark-all-read', 'POST');
                showToast('All notifications marked as read', 'success');
                loadDashboard();
            } catch (error) {
                showToast('Failed to mark all as read', 'error');
            }
        });
    }

    // ============================================
    // INIT
    // ============================================
    async function init() {
        var isAuth = await checkAuth();
        if (!isAuth) return;
        loadDashboard();
        // Load first active section
        var activeSection = document.querySelector('.nav-item.active');
        if (activeSection && activeSection.dataset.section === 'dashboard') {
            loadDashboard();
        }
    }

    init();
})();