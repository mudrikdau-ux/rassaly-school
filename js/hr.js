// hr.js - Rasally School HR Panel
// Connected to Backend API - GPS FIXED with increased radius

(function() {
    'use strict';

    // ============================================
    // API CONFIGURATION
    // ============================================
    const API_BASE = 'http://localhost:5000/api';

// ============================================
// GPS CONFIGURATION
// ============================================
const GPS_CONFIG = {
    enableHighAccuracy: true,      // Try high accuracy
    timeout: 35000,
    maximumAge: 120000,
    requiredAccuracy: 300,         // Now accepts 212m and above
    retryCount: 3,
    retryDelay: 2000
};

const SCHOOL_CONFIG = {
    name: 'Rasally School - Zanzibar University New Campus',
    latitude: -6.1882194,
    longitude: 39.2168459,
    allowedRadius: 500,
    address: 'Rasally School, Zanzibar University New Campus, Mpendae, Zanzibar, Tanzania'
};

    // ============================================
    // API HELPER FUNCTIONS
    // ============================================
    function getToken() {
        return localStorage.getItem('hrToken') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    }

    function getUser() {
        var user = localStorage.getItem('user') || localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }

    function clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('hrToken');
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('hr_employees');
        localStorage.removeItem('hr_attendance');
        localStorage.removeItem('hr_permissions');
        localStorage.removeItem('hr_payroll');
        localStorage.removeItem('hr_theme');
    }

    async function apiRequest(endpoint, method, data, isBlob) {
        method = method || 'GET';
        isBlob = isBlob || false;
        var token = getToken();
        var headers = {};
        
        // Fix: Ensure payrollMonth is in YYYY-MM-DD format
        if (data && typeof data === 'object' && !(data instanceof FormData)) {
            if (data.payrollMonth) {
                var monthVal = data.payrollMonth;
                if (/^\d{4}-\d{2}$/.test(monthVal)) {
                    data.payrollMonth = monthVal + '-01';
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
    // GPS FUNCTIONS - FIXED
    // ============================================
    function getCurrentPosition() {
        return new Promise(function(resolve, reject) {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            console.log('📍 Getting location with options:', {
                enableHighAccuracy: GPS_CONFIG.enableHighAccuracy,
                timeout: GPS_CONFIG.timeout,
                maximumAge: GPS_CONFIG.maximumAge
            });

            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    var location = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        timestamp: pos.timestamp
                    };
                    console.log('📍 Location received:', location);
                    resolve(location);
                },
                function(err) {
                    var errorMessage = 'Unable to retrieve location';
                    switch(err.code) {
                        case err.PERMISSION_DENIED: 
                            errorMessage = 'Location permission denied. Please enable GPS in your browser settings.';
                            break;
                        case err.POSITION_UNAVAILABLE: 
                            errorMessage = 'Location information is unavailable. Try going outside for better GPS signal.';
                            break;
                        case err.TIMEOUT: 
                            errorMessage = 'Location request timed out. Please try again.';
                            break;
                    }
                    console.error('GPS Error:', err);
                    reject(new Error(errorMessage));
                },
                { 
                    enableHighAccuracy: GPS_CONFIG.enableHighAccuracy,
                    timeout: GPS_CONFIG.timeout,
                    maximumAge: GPS_CONFIG.maximumAge
                }
            );
        });
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + 
                  Math.cos(φ1) * Math.cos(φ2) * 
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    async function verifyLocation() {
        try {
            var location = await getCurrentPosition();
            var distance = calculateDistance(
                location.latitude,
                location.longitude,
                SCHOOL_CONFIG.latitude,
                SCHOOL_CONFIG.longitude
            );
            
            var isAccurate = location.accuracy <= GPS_CONFIG.requiredAccuracy;
            var isWithinRadius = distance <= SCHOOL_CONFIG.allowedRadius;
            
            console.log(`📍 Distance: ${Math.round(distance)}m, Accuracy: ${Math.round(location.accuracy)}m`);
            console.log(`📍 Within radius: ${isWithinRadius} (${Math.round(distance)}m <= ${SCHOOL_CONFIG.allowedRadius}m)`);
            
            if (!isAccurate) {
                showToast(`GPS accuracy is ${Math.round(location.accuracy)}m. Please move to an area with better GPS signal.`, 'warning');
                return { location: location, verified: false, accuracyIssue: true };
            }
            
            if (!isWithinRadius) {
                showToast(`You are ${Math.round(distance)}m away from school. Maximum allowed: ${SCHOOL_CONFIG.allowedRadius}m.`, 'error');
                return { location: location, verified: false, accuracyIssue: false };
            }
            
            showToast(`Location verified! (${Math.round(distance)}m from school, accuracy: ${Math.round(location.accuracy)}m)`, 'success');
            return { location: location, verified: true, accuracyIssue: false };
            
        } catch (error) {
            console.error('Location verification error:', error);
            showToast(error.message, 'warning');
            return { location: null, verified: false, accuracyIssue: false };
        }
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
                if (role !== 'hr') { window.location.href = 'index.html'; return false; }
                // Update profile display
                var profileName = document.querySelector('.profile-name');
                var profileRole = document.querySelector('.profile-role');
                if (profileName) profileName.textContent = response.data.fullName || 'HR Officer';
                if (profileRole) profileRole.textContent = response.data.position || 'HR Manager';
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
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    // ============================================
    // STATE
    // ============================================
    var employees = [];
    var attendanceData = [];
    var permissionData = [];
    var payrollData = [];
    var currentEditEmpId = null;
    var currentApprovalId = null;
    var currentApprovalAction = null;
    var locationRetryCount = 0;
    var isVerifying = false;

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

            if (section === 'dashboard') loadDashboard();
            else if (section === 'employees') loadEmployees();
            else if (section === 'attendance') loadAttendanceSection();
            else if (section === 'permissions') loadPermissions();
            else if (section === 'payroll') loadPayrollSection();
            else if (section === 'settings') loadSettingsData();
        });
    });

    $$('.action-btn[data-navigate]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var nav = document.querySelector('.nav-item[data-section="' + btn.dataset.navigate + '"]');
            if (nav) nav.click();
        });
    });

    // ============================================
    // DROPDOWNS
    // ============================================
    var notifBtn = document.getElementById('notificationBtn');
    var profileBtnEl = document.getElementById('profileBtn');
    if (notifBtn) notifBtn.addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('notificationDropdown').classList.toggle('hidden'); document.getElementById('profileDropdown').classList.add('hidden'); });
    if (profileBtnEl) profileBtnEl.addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('profileDropdown').classList.toggle('hidden'); document.getElementById('notificationDropdown').classList.add('hidden'); });
    document.addEventListener('click', function() { $$('.dropdown').forEach(function(d) { d.classList.add('hidden'); }); });

    // ============================================
    // DASHBOARD
    // ============================================
    var charts = {};
    async function loadDashboard() {
        try {
            var response = await apiRequest('/hr/dashboard', 'GET');
            if (response.success && response.data) {
                var data = response.data;
                // Update summary cards
                if (data.summary) {
                    var totalEl = document.getElementById('totalEmployees');
                    var presentEl = document.getElementById('presentToday');
                    var leaveEl = document.getElementById('onLeave');
                    var pendingEl = document.getElementById('pendingPermissions');
                    if (totalEl) totalEl.textContent = data.summary.totalEmployees || 0;
                    if (presentEl) presentEl.textContent = data.summary.presentToday || 0;
                    if (leaveEl) leaveEl.textContent = data.summary.onLeave || 0;
                    if (pendingEl) pendingEl.textContent = data.summary.pendingRequests || 0;
                }
                // Update welcome
                var user = data.user;
                if (user) {
                    var welcomeBanner = document.querySelector('.welcome-banner p');
                    if (welcomeBanner && user.greeting) welcomeBanner.textContent = user.greeting;
                }
            }

            // Load attendance overview chart
            var attResponse = await apiRequest('/hr/dashboard/attendance-overview', 'GET');
            if (attResponse.success && attResponse.data) {
                renderAttendanceChart(attResponse.data);
            }

            // Load leave distribution chart
            var leaveResponse = await apiRequest('/hr/dashboard/leave-distribution', 'GET');
            if (leaveResponse.success && leaveResponse.data) {
                renderLeaveChart(leaveResponse.data);
            }

            // Load recent activities
            var actResponse = await apiRequest('/hr/dashboard/recent-activities?limit=5', 'GET');
            if (actResponse.success && actResponse.data) {
                renderRecentActivities(actResponse.data);
            }
        } catch (error) {
            console.error('Dashboard load error:', error.message);
        }
    }

    function renderAttendanceChart(data) {
        if (charts.attendanceChart) charts.attendanceChart.destroy();
        var ctx = document.getElementById('attendanceChart');
        if (!ctx || !data) return;
        charts.attendanceChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderLeaveChart(data) {
        if (charts.leaveChart) charts.leaveChart.destroy();
        var ctx = document.getElementById('leaveChart');
        if (!ctx || !data) return;
        charts.leaveChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: data.labels || [], datasets: [{ data: data.data || [], backgroundColor: ['#3182ce','#38a169','#d69e2e','#e53e3e'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderRecentActivities(activities) {
        var container = document.querySelector('.activity-list');
        if (!container) return;
        if (!activities || activities.length === 0) {
            container.innerHTML = '<div class="activity-item"><p>No recent activities</p></div>';
            return;
        }
        container.innerHTML = activities.map(function(a) {
            var icon = 'fa-info-circle';
            if (a.action && a.action.includes('USER')) icon = 'fa-user-plus';
            else if (a.action && a.action.includes('APPROVED')) icon = 'fa-check-circle';
            else if (a.action && a.action.includes('PAYROLL')) icon = 'fa-money-bill';
            return '<div class="activity-item"><i class="fas ' + icon + ' text-info"></i><div><p>' + (a.description || a.action) + '</p><small>' + (a.timeAgo || '') + '</small></div></div>';
        }).join('');
    }

    // ============================================
    // EMPLOYEE RECORDS
    // ============================================
    async function loadEmployees(search, dept, status) {
        var tbody = document.getElementById('employeeTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var params = {};
            if (search) params.search = search;
            if (dept) params.department = dept;
            if (status) params.status = status;
            var query = Object.entries(params).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
            var response = await apiRequest('/hr/employees' + (query ? '?' + query : ''), 'GET');
            if (response.success && response.data) {
                employees = response.data;
                if (employees.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">No employees found</td></tr>'; return; }
                tbody.innerHTML = employees.map(function(e) {
                    return '<tr>' +
                        '<td>' + (e.employee_id || e.id) + '</td>' +
                        '<td>' + e.full_name + '</td>' +
                        '<td>' + (e.department || '—') + '</td>' +
                        '<td>' + (e.position || '—') + '</td>' +
                        '<td>' + e.email + '</td>' +
                        '<td>' + (e.phone || '—') + '</td>' +
                        '<td><span class="badge ' + (e.status === 'active' ? 'badge-success' : 'badge-danger') + '">' + e.status + '</span></td>' +
                        '<td>' +
                            '<button class="btn btn-sm btn-outline view-emp" data-id="' + e.id + '"><i class="fas fa-eye"></i></button> ' +
                            '<button class="btn btn-sm btn-outline edit-emp" data-id="' + e.id + '"><i class="fas fa-edit"></i></button> ' +
                            '<button class="btn btn-sm btn-outline att-emp" data-id="' + e.id + '"><i class="fas fa-calendar-check"></i></button> ' +
                            '<button class="btn btn-sm btn-outline pay-emp" data-id="' + e.id + '"><i class="fas fa-money-bill"></i></button> ' +
                            '<button class="btn btn-sm btn-outline perm-emp" data-id="' + e.id + '"><i class="fas fa-file-alt"></i></button>' +
                        '</td></tr>';
                }).join('');
                tbody.querySelectorAll('.view-emp').forEach(function(b) { b.addEventListener('click', function() { viewEmployee(this.dataset.id); }); });
                tbody.querySelectorAll('.edit-emp').forEach(function(b) { b.addEventListener('click', function() { editEmployee(this.dataset.id); }); });
                tbody.querySelectorAll('.att-emp').forEach(function(b) { b.addEventListener('click', function() { viewEmpAttendance(this.dataset.id); }); });
                tbody.querySelectorAll('.pay-emp').forEach(function(b) { b.addEventListener('click', function() { viewEmpPayroll(this.dataset.id); }); });
                tbody.querySelectorAll('.perm-emp').forEach(function(b) { b.addEventListener('click', function() { viewEmpPermissions(this.dataset.id); }); });
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Error loading employees</td></tr>';
        }
    }

    async function viewEmployee(id) {
        try {
            var response = await apiRequest('/hr/employees/' + id, 'GET');
            if (response.success && response.data) {
                var e = response.data;
                var body = document.getElementById('employeeModalBody');
                body.innerHTML =
                    '<div class="form-row"><div class="form-group"><label>Name</label><p>' + e.full_name + '</p></div><div class="form-group"><label>ID</label><p>' + (e.employee_id || e.id) + '</p></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>Department</label><p>' + (e.department || '—') + '</p></div><div class="form-group"><label>Position</label><p>' + (e.position || '—') + '</p></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>Email</label><p>' + e.email + '</p></div><div class="form-group"><label>Phone</label><p>' + (e.phone || '—') + '</p></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>Address</label><p>' + (e.address || 'N/A') + '</p></div><div class="form-group"><label>Date Joined</label><p>' + (e.date_joined || 'N/A') + '</p></div></div>' +
                    '<p><strong>Status:</strong> <span class="badge ' + (e.status === 'active' ? 'badge-success' : 'badge-danger') + '">' + e.status + '</span></p>' +
                    '<p><strong>Working Status:</strong> ' + (e.workingStatus || 'N/A') + '</p>';
                document.getElementById('employeeModal').classList.remove('hidden');
            }
        } catch (error) { showToast('Failed to load employee.', 'error'); }
    }

    async function editEmployee(id) {
        try {
            var response = await apiRequest('/hr/employees/' + id, 'GET');
            if (response.success && response.data) {
                var e = response.data;
                currentEditEmpId = id;
                var form = document.getElementById('editEmployeeForm');
                form.innerHTML =
                    '<div class="form-row"><div class="form-group"><label>Name</label><input type="text" class="form-control" id="editName" value="' + e.full_name + '"></div><div class="form-group"><label>Department</label><input type="text" class="form-control" id="editDept" value="' + (e.department || '') + '"></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>Position</label><input type="text" class="form-control" id="editPosition" value="' + (e.position || '') + '"></div><div class="form-group"><label>Email</label><input type="email" class="form-control" id="editEmail" value="' + e.email + '"></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="editPhone" value="' + (e.phone || '') + '"></div><div class="form-group"><label>Status</label><select class="form-control" id="editStatus"><option value="active"' + (e.status === 'active' ? ' selected' : '') + '>Active</option><option value="suspended"' + (e.status === 'suspended' ? ' selected' : '') + '>Suspended</option></select></div></div>';
                document.getElementById('editEmployeeModal').classList.remove('hidden');
            }
        } catch (error) { showToast('Failed to load employee.', 'error'); }
    }

    var saveEmpBtn = document.getElementById('saveEmployeeBtn');
    if (saveEmpBtn) {
        saveEmpBtn.addEventListener('click', async function() {
            if (!currentEditEmpId) return;
            var data = {
                fullName: document.getElementById('editName').value,
                department: document.getElementById('editDept').value,
                position: document.getElementById('editPosition').value,
                email: document.getElementById('editEmail').value,
                phone: document.getElementById('editPhone').value,
                status: document.getElementById('editStatus').value
            };
            try {
                await apiRequest('/hr/employees/' + currentEditEmpId, 'PUT', data);
                document.getElementById('editEmployeeModal').classList.add('hidden');
                loadEmployees();
                showToast('Employee updated!', 'success');
            } catch (error) { showToast(error.message || 'Failed to update.', 'error'); }
        });
    }

    var addEmpBtn = document.getElementById('addEmployeeBtn');
    if (addEmpBtn) {
        addEmpBtn.addEventListener('click', function() {
            var name = prompt('Enter employee name:');
            if (!name) return;
            var dept = prompt('Department:') || '';
            var position = prompt('Position:') || '';
            var email = prompt('Email:') || '';
            var phone = prompt('Phone:') || '';
            apiRequest('/hr/employees', 'POST', { fullName: name, email: email, phone: phone, department: dept, position: position }).then(function() {
                loadEmployees();
                showToast('Employee added!', 'success');
            }).catch(function(e) { showToast(e.message || 'Failed to add.', 'error'); });
        });
    }

    async function viewEmpAttendance(id) {
        try {
            var response = await apiRequest('/hr/employees/' + id + '/attendance', 'GET');
            var body = document.getElementById('attendanceHistoryBody');
            if (response.success && response.data) {
                var records = response.data;
                if (records.length === 0) { body.innerHTML = '<p>No attendance records</p>'; }
                else {
                    body.innerHTML = '<table class="data-table"><thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>' +
                        records.map(function(a) { return '<tr><td>' + (a.attendance_date || a.date || '') + '</td><td>' + (a.check_in || a.checkIn || '—') + '</td><td>' + (a.check_out || a.checkOut || '—') + '</td><td>' + (a.hours_worked || a.hours || '—') + '</td><td>' + (a.status || '—') + '</td></tr>'; }).join('') + '</tbody></table>';
                }
            }
            document.getElementById('attendanceHistoryModal').classList.remove('hidden');
        } catch (e) { showToast('Failed to load attendance.', 'error'); }
    }

    async function viewEmpPayroll(id) {
        try {
            var response = await apiRequest('/hr/employees/' + id + '/payroll', 'GET');
            var body = document.getElementById('payrollDetailBody');
            if (response.success && response.data) {
                var records = response.data;
                if (records.length === 0) { body.innerHTML = '<p>No payroll records</p>'; }
                else {
                    body.innerHTML = '<table class="data-table"><thead><tr><th>Month</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead><tbody>' +
                        records.map(function(p) { return '<tr><td>' + (p.payroll_month || p.month || '') + '</td><td>' + formatTZS(p.basic_salary || p.basic) + '</td><td>' + formatTZS(p.allowances) + '</td><td>' + formatTZS(p.total_deductions || p.deductions) + '</td><td><strong>' + formatTZS(p.net_salary || p.net) + '</strong></td><td>' + (p.status || '') + '</td></tr>'; }).join('') + '</tbody></table>';
                }
            }
            document.getElementById('payrollDetailModal').classList.remove('hidden');
        } catch (e) { showToast('Failed to load payroll.', 'error'); }
    }

    async function viewEmpPermissions(id) {
        try {
            var response = await apiRequest('/hr/employees/' + id + '/permissions', 'GET');
            var body = document.getElementById('permissionDetailBody');
            if (response.success && response.data) {
                var records = response.data;
                if (records.length === 0) { body.innerHTML = '<p>No permission requests</p>'; }
                else {
                    body.innerHTML = '<table class="data-table"><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead><tbody>' +
                        records.map(function(p) { return '<tr><td>' + (p.type || '') + '</td><td>' + (p.start_date || '') + ' to ' + (p.end_date || '') + '</td><td>' + (p.days || '') + '</td><td>' + (p.reason || '') + '</td><td>' + (p.status || '') + '</td></tr>'; }).join('') + '</tbody></table>';
                }
            }
            document.getElementById('permissionDetailModal').classList.remove('hidden');
        } catch (e) { showToast('Failed to load permissions.', 'error'); }
    }

    // Search and filters
    var empSearch = document.getElementById('employeeSearch');
    if (empSearch) empSearch.addEventListener('input', function() { loadEmployees(this.value, document.getElementById('departmentFilter').value, document.getElementById('statusFilter').value); });
    var deptFilter = document.getElementById('departmentFilter');
    if (deptFilter) deptFilter.addEventListener('change', function() { loadEmployees(document.getElementById('employeeSearch').value, this.value, document.getElementById('statusFilter').value); });
    var statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', function() { loadEmployees(document.getElementById('employeeSearch').value, document.getElementById('departmentFilter').value, this.value); });

    // ============================================
    // HR ATTENDANCE - FIXED GPS
    // ============================================
    async function loadAttendanceSection() {
        // Load HR personal attendance
        try {
            var response = await apiRequest('/hr/attendance/my-attendance', 'GET');
            if (response.success && response.data) {
                updateHRAttendanceUI(response.data);
            }
        } catch (e) {}
        // Load all attendance
        loadAllAttendance();
    }

    function updateHRAttendanceUI(data) {
        var badge = document.getElementById('hrAttendanceBadge');
        var checkInBtn = document.getElementById('hrCheckInBtn');
        var checkOutBtn = document.getElementById('hrCheckOutBtn');
        var checkInTimeEl = document.getElementById('hrCheckInTime');
        var checkOutTimeEl = document.getElementById('hrCheckOutTime');

        if (!data || data.status === 'Not Checked In') {
            if (badge) { badge.textContent = 'Not Checked In'; badge.className = 'status-badge not-checked'; }
            if (checkInBtn) checkInBtn.disabled = false;
            if (checkOutBtn) checkOutBtn.disabled = true;
            if (checkInTimeEl) checkInTimeEl.textContent = '--:--';
            if (checkOutTimeEl) checkOutTimeEl.textContent = '--:--';
        } else if (data.checkedIn && !data.checkedOut) {
            if (badge) { badge.textContent = 'Checked In'; badge.className = 'status-badge checked-in'; }
            if (checkInBtn) checkInBtn.disabled = true;
            if (checkOutBtn) checkOutBtn.disabled = false;
            if (checkInTimeEl) checkInTimeEl.textContent = data.checkInTime || '--:--';
            if (checkOutTimeEl) checkOutTimeEl.textContent = '--:--';
        } else if (data.checkedOut) {
            if (badge) { badge.textContent = 'Checked Out'; badge.className = 'status-badge checked-out'; }
            if (checkInBtn) checkInBtn.disabled = true;
            if (checkOutBtn) checkOutBtn.disabled = true;
            if (checkInTimeEl) checkInTimeEl.textContent = data.checkInTime || '--:--';
            if (checkOutTimeEl) checkOutTimeEl.textContent = data.checkOutTime || '--:--';
        }
    }

    // FIXED: HR Check In with location verification
    var hrCheckInBtn = document.getElementById('hrCheckInBtn');
    if (hrCheckInBtn) {
        hrCheckInBtn.addEventListener('click', async function() {
            try {
                this.disabled = true;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking location...';
                
                // Verify location first
                var result = await verifyLocation();
                if (!result.verified) {
                    if (result.accuracyIssue) {
                        showToast('GPS accuracy too low. Please move to an area with better signal.', 'warning');
                    } else if (!result.location) {
                        showToast('Could not get location. Please check your GPS.', 'error');
                    } else {
                        showToast('Location verification failed. Please try again.', 'error');
                    }
                    this.disabled = false;
                    this.innerHTML = '<i class="fas fa-sign-in-alt"></i> Check In';
                    return;
                }
                
                // Proceed with check-in
                var response = await apiRequest('/hr/attendance/check-in', 'POST', { 
                    latitude: result.location.latitude, 
                    longitude: result.location.longitude, 
                    accuracy: result.location.accuracy 
                });
                
                if (response.success) {
                    showToast('✅ Checked in successfully!', 'success');
                } else {
                    showToast(response.message || 'Check-in failed.', 'error');
                }
                loadAttendanceSection();
                loadDashboard();
                
            } catch (error) {
                showToast(error.message || 'Check-in failed.', 'error');
            } finally {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-sign-in-alt"></i> Check In';
            }
        });
    }

    // FIXED: HR Check Out with location verification
    var hrCheckOutBtn = document.getElementById('hrCheckOutBtn');
    if (hrCheckOutBtn) {
        hrCheckOutBtn.addEventListener('click', async function() {
            try {
                this.disabled = true;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking location...';
                
                // Verify location first
                var result = await verifyLocation();
                if (!result.verified) {
                    if (result.accuracyIssue) {
                        showToast('GPS accuracy too low. Please move to an area with better signal.', 'warning');
                    } else if (!result.location) {
                        showToast('Could not get location. Please check your GPS.', 'error');
                    } else {
                        showToast('Location verification failed. Please try again.', 'error');
                    }
                    this.disabled = false;
                    this.innerHTML = '<i class="fas fa-sign-out-alt"></i> Check Out';
                    return;
                }
                
                // Proceed with check-out
                var response = await apiRequest('/hr/attendance/check-out', 'POST', { 
                    latitude: result.location.latitude, 
                    longitude: result.location.longitude, 
                    accuracy: result.location.accuracy 
                });
                
                if (response.success) {
                    showToast('✅ Checked out successfully!', 'success');
                } else {
                    showToast(response.message || 'Check-out failed.', 'error');
                }
                loadAttendanceSection();
                loadDashboard();
                
            } catch (error) {
                showToast(error.message || 'Check-out failed.', 'error');
            } finally {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-sign-out-alt"></i> Check Out';
            }
        });
    }

    // Legacy function for backward compatibility
    function getLocationForAttendance() {
        return getCurrentPosition();
    }

    async function loadAllAttendance(search, date) {
        var tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var params = {};
            if (search) params.search = search;
            if (date) params.date = date;
            var query = Object.entries(params).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
            var response = await apiRequest('/hr/attendance' + (query ? '?' + query : ''), 'GET');
            if (response.success && response.data) {
                attendanceData = response.data;
                if (attendanceData.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">No records</td></tr>'; return; }
                tbody.innerHTML = attendanceData.map(function(a) {
                    var emp = a.employee || {};
                    return '<tr><td>' + (emp.fullName || '—') + '</td><td>' + (a.date || '—') + '</td><td>' + (a.checkIn || '—') + '</td><td>' + (a.checkOut || '—') + '</td><td>' + (a.hoursWorked || '—') + '</td><td><span class="badge ' + (a.status === 'Present' ? 'badge-success' : 'badge-warning') + '">' + (a.status || '—') + '</span></td><td>' + (a.location && a.location.address ? a.location.address : '—') + '</td></tr>';
                }).join('');
            }
        } catch (error) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Error loading attendance</td></tr>'; }
    }

    var attSearch = document.getElementById('attendanceSearch');
    if (attSearch) attSearch.addEventListener('input', function() { loadAllAttendance(this.value, document.getElementById('attendanceDateFilter').value); });
    var attDateFilter = document.getElementById('attendanceDateFilter');
    if (attDateFilter) attDateFilter.addEventListener('change', function() { loadAllAttendance(document.getElementById('attendanceSearch').value, this.value); });

    var exportAttBtn = document.getElementById('exportAttendanceBtn');
    if (exportAttBtn) {
        exportAttBtn.addEventListener('click', async function() {
            try {
                var response = await apiRequest('/hr/attendance/export', 'GET', null, true);
                var blob = await response.blob();
                downloadBlob(blob, 'attendance.csv');
                showToast('Exported!', 'success');
            } catch (e) { showToast('Export failed.', 'error'); }
        });
    }

    // ============================================
    // PERMISSIONS
    // ============================================
    async function loadPermissions(statusFilter) {
        statusFilter = statusFilter || '';
        var tbody = document.getElementById('permissionTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var params = {};
            if (statusFilter) params.status = statusFilter;
            var query = Object.entries(params).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
            var response = await apiRequest('/hr/permissions' + (query ? '?' + query : ''), 'GET');
            if (response.success && response.data) {
                permissionData = response.data;
                if (permissionData.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">No requests</td></tr>'; return; }
                tbody.innerHTML = permissionData.map(function(p) {
                    var emp = p.employee || {};
                    var actions = '<button class="btn btn-sm btn-outline info-perm" data-id="' + p.id + '"><i class="fas fa-info-circle"></i></button> ';
                    if (p.hasDocument) actions += '<button class="btn btn-sm btn-outline doc-perm" data-id="' + p.id + '"><i class="fas fa-paperclip"></i></button> ';
                    if (p.status === 'Pending') actions += '<button class="btn btn-sm btn-success app-perm" data-id="' + p.id + '"><i class="fas fa-check"></i></button> <button class="btn btn-sm btn-danger rej-perm" data-id="' + p.id + '"><i class="fas fa-times"></i></button>';
                    return '<tr><td>' + (emp.fullName || '—') + '</td><td>' + (p.typeLabel || p.type) + '</td><td>' + p.startDate + ' - ' + p.endDate + '</td><td>' + p.days + '</td><td>' + (p.reason || '') + '</td><td><span class="badge ' + (p.status === 'Approved' ? 'badge-success' : p.status === 'Rejected' ? 'badge-danger' : 'badge-warning') + '">' + p.status + '</span></td><td>' + actions + '</td></tr>';
                }).join('');
                tbody.querySelectorAll('.info-perm').forEach(function(b) { b.addEventListener('click', function() { viewPermDetail(this.dataset.id); }); });
                tbody.querySelectorAll('.doc-perm').forEach(function(b) { b.addEventListener('click', function() { downloadPermDoc(this.dataset.id); }); });
                tbody.querySelectorAll('.app-perm').forEach(function(b) { b.addEventListener('click', function() { approvePermission(this.dataset.id); }); });
                tbody.querySelectorAll('.rej-perm').forEach(function(b) { b.addEventListener('click', function() { rejectPermission(this.dataset.id); }); });
            }
        } catch (error) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Error loading requests</td></tr>'; }
    }

    async function viewPermDetail(id) {
        try {
            var response = await apiRequest('/hr/permissions/' + id, 'GET');
            if (response.success && response.data) {
                var p = response.data;
                var emp = p.employee || {};
                var body = document.getElementById('permissionDetailBody');
                body.innerHTML = '<p><strong>Employee:</strong> ' + (emp.fullName || '') + ' (' + (emp.employeeId || '') + ')</p>' +
                    '<p><strong>Type:</strong> ' + (p.typeLabel || p.type) + '</p><p><strong>Dates:</strong> ' + p.startDate + ' to ' + p.endDate + '</p>' +
                    '<p><strong>Days:</strong> ' + p.days + '</p><p><strong>Reason:</strong> ' + (p.reason || '') + '</p>' +
                    '<p><strong>Status:</strong> ' + p.status + '</p>';
                document.getElementById('permissionDetailModal').classList.remove('hidden');
            }
        } catch (e) { showToast('Failed to load details.', 'error'); }
    }

    async function downloadPermDoc(id) {
        try {
            var response = await apiRequest('/hr/permissions/' + id + '/document', 'GET', null, true);
            var blob = await response.blob();
            downloadBlob(blob, 'document_' + id);
            showToast('Downloaded!', 'success');
        } catch (e) { showToast('No document.', 'error'); }
    }

    async function approvePermission(id) {
        try {
            await apiRequest('/hr/permissions/' + id + '/approve', 'PATCH', {});
            loadPermissions(document.getElementById('permissionStatusFilter').value);
            showToast('Approved!', 'success');
        } catch (e) { showToast('Failed to approve.', 'error'); }
    }

    async function rejectPermission(id) {
        var reason = prompt('Rejection reason:');
        if (!reason) return;
        try {
            await apiRequest('/hr/permissions/' + id + '/reject', 'PATCH', { comment: reason });
            loadPermissions(document.getElementById('permissionStatusFilter').value);
            showToast('Rejected.', 'warning');
        } catch (e) { showToast('Failed to reject.', 'error'); }
    }

    var permStatusFilter = document.getElementById('permissionStatusFilter');
    if (permStatusFilter) permStatusFilter.addEventListener('change', function() { loadPermissions(this.value); });

    // ============================================
    // PAYROLL - FIXED MONTH FORMAT
    // ============================================
    function getPayrollDate() {
        var monthInput = document.getElementById('payrollMonth');
        if (!monthInput || !monthInput.value) {
            var now = new Date();
            return now.getFullYear() + '-' + 
                   String(now.getMonth() + 1).padStart(2, '0') + '-01';
        }
        var value = monthInput.value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        if (/^\d{4}-\d{2}$/.test(value)) {
            return value + '-01';
        }
        var now = new Date();
        return now.getFullYear() + '-' + 
               String(now.getMonth() + 1).padStart(2, '0') + '-01';
    }

    function loadPayrollSection() {
        // Set default month
        var monthInput = document.getElementById('payrollMonth');
        if (monthInput) {
            var now = new Date();
            var defaultMonth = now.getFullYear() + '-' + 
                              String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = defaultMonth;
        }
        
        loadPayrollHistory();
        // Load employees into select
        apiRequest('/hr/employees', 'GET').then(function(r) {
            if (r.success && r.data) {
                var sel = document.getElementById('payrollEmployee');
                if (sel) sel.innerHTML = '<option value="">Select Employee</option>' + 
                    r.data.map(function(e) { return '<option value="' + e.id + '">' + e.full_name + '</option>'; }).join('');
            }
        }).catch(function() {});
    }

    function calcSalary() {
        var basic = parseFloat(document.getElementById('basicSalary').value) || 0;
        var housing = parseFloat(document.getElementById('housingAllowance').value) || 0;
        var transport = parseFloat(document.getElementById('transportAllowance').value) || 0;
        var overtime = parseFloat(document.getElementById('overtimePay').value) || 0;
        var tax = parseFloat(document.getElementById('taxDeduction').value) || 0;
        var other = parseFloat(document.getElementById('otherDeductions').value) || 0;
        var net = basic + housing + transport + overtime - tax - other;
        var resultEl = document.getElementById('netSalaryResult');
        if (resultEl) resultEl.textContent = formatTZS(net);
        return { basic: basic, housing: housing, transport: transport, overtime: overtime, tax: tax, other: other, net: net };
    }

    var calcBtn = document.getElementById('calculateSalaryBtn');
    if (calcBtn) {
        calcBtn.addEventListener('click', function() {
            var payrollDate = getPayrollDate();
            var data = {
                employeeId: parseInt(document.getElementById('payrollEmployee').value) || 0,
                payrollMonth: payrollDate,
                basicSalary: parseFloat(document.getElementById('basicSalary').value) || 0,
                housingAllowance: parseFloat(document.getElementById('housingAllowance').value) || 0,
                transportAllowance: parseFloat(document.getElementById('transportAllowance').value) || 0,
                overtime: parseFloat(document.getElementById('overtimePay').value) || 0,
                taxDeduction: parseFloat(document.getElementById('taxDeduction').value) || 0,
                otherDeductions: parseFloat(document.getElementById('otherDeductions').value) || 0
            };
            apiRequest('/hr/payroll/calculate', 'POST', data).then(function(r) {
                if (r.success && r.data) {
                    document.getElementById('netSalaryResult').textContent = formatTZS(r.data.netSalary);
                }
            }).catch(function() { calcSalary(); });
        });
    }

    ['basicSalary','housingAllowance','transportAllowance','overtimePay','taxDeduction','otherDeductions'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', calcSalary);
    });

    var savePayBtn = document.getElementById('savePayrollBtn');
    if (savePayBtn) {
        savePayBtn.addEventListener('click', async function() {
            var empId = document.getElementById('payrollEmployee').value;
            if (!empId) { showToast('Please select an employee.', 'error'); return; }
            
            var payrollDate = getPayrollDate();
            var data = {
                employeeId: parseInt(empId),
                payrollMonth: payrollDate,
                basicSalary: parseFloat(document.getElementById('basicSalary').value) || 0,
                housingAllowance: parseFloat(document.getElementById('housingAllowance').value) || 0,
                transportAllowance: parseFloat(document.getElementById('transportAllowance').value) || 0,
                overtime: parseFloat(document.getElementById('overtimePay').value) || 0,
                taxDeduction: parseFloat(document.getElementById('taxDeduction').value) || 0,
                otherDeductions: parseFloat(document.getElementById('otherDeductions').value) || 0
            };
            try {
                await apiRequest('/hr/payroll', 'POST', data);
                showToast('Payroll saved!', 'success');
                loadPayrollHistory();
            } catch (e) { showToast(e.message || 'Failed to save.', 'error'); }
        });
    }

    var genPayslipBtn = document.getElementById('generatePayslipBtn');
    if (genPayslipBtn) genPayslipBtn.addEventListener('click', function() {
        var s = calcSalary();
        var body = document.getElementById('payslipBody');
        body.innerHTML = '<div class="payslip-content"><h3>RASALLY SCHOOL - PAYSLIP</h3>' +
            '<p><strong>Basic Salary:</strong> ' + formatTZS(s.basic) + '</p>' +
            '<p><strong>Allowances:</strong> ' + formatTZS(s.housing + s.transport + s.overtime) + '</p>' +
            '<p><strong>Deductions:</strong> ' + formatTZS(s.tax + s.other) + '</p>' +
            '<p><strong>Net Salary:</strong> ' + formatTZS(s.net) + '</p></div>';
        document.getElementById('payslipModal').classList.remove('hidden');
    });

    async function loadPayrollHistory() {
        var tbody = document.getElementById('payrollTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var response = await apiRequest('/hr/payroll', 'GET');
            if (response.success && response.data) {
                payrollData = response.data;
                if (payrollData.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">No records</td></tr>'; return; }
                tbody.innerHTML = payrollData.map(function(p) {
                    var emp = p.employee || {};
                    // Format month for display
                    var displayMonth = p.payrollMonth || p.month || '';
                    try {
                        var parts = displayMonth.split('-');
                        if (parts.length >= 2) {
                            var d = new Date(parts[0], parts[1] - 1, parts[2] || 1);
                            displayMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                        }
                    } catch (e) {}
                    return '<tr><td>' + (emp.fullName || '—') + '</td><td>' + displayMonth + '</td><td>' + formatTZS(p.basicSalary) + '</td><td>' + formatTZS(p.allowances) + '</td><td>' + formatTZS(p.totalDeductions || p.deductions) + '</td><td><strong>' + formatTZS(p.netSalary) + '</strong></td><td><span class="badge ' + (p.status === 'Paid' ? 'badge-success' : 'badge-info') + '">' + p.status + '</span></td></tr>';
                }).join('');
            }
        } catch (error) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Error loading payroll</td></tr>'; }
    }

    // ============================================
    // SETTINGS
    // ============================================
    $$('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            $$('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            $$('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            var target = document.getElementById(this.dataset.tab + 'Tab');
            if (target) target.classList.add('active');
            if (this.dataset.tab === 'notifications') loadNotificationSettings();
        });
    });

    function loadSettingsData() {
        try {
            apiRequest('/hr/settings/profile', 'GET').then(function(r) {
                if (r.success && r.data) {
                    var nameEl = document.getElementById('profileName');
                    var emailEl = document.getElementById('profileEmail');
                    var phoneEl = document.getElementById('profilePhone');
                    var addrEl = document.getElementById('profileAddress');
                    if (nameEl) nameEl.value = r.data.fullName || '';
                    if (emailEl) emailEl.value = r.data.email || '';
                    if (phoneEl) phoneEl.value = r.data.phone || '';
                    if (addrEl) addrEl.value = r.data.address || '';
                }
            }).catch(function() {});
        } catch (e) {}
    }

    var profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var data = {
                fullName: document.getElementById('profileName').value,
                email: document.getElementById('profileEmail').value,
                phone: document.getElementById('profilePhone').value,
                address: document.getElementById('profileAddress').value
            };
            try {
                await apiRequest('/hr/settings/profile', 'PUT', data);
                showToast('Profile updated!', 'success');
            } catch (error) { showToast('Failed to update.', 'error'); }
        });
    }

    var passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var current = document.getElementById('currentPass').value;
            var newP = document.getElementById('newPass').value;
            var confirm = document.getElementById('confirmPass').value;
            if (newP !== confirm) { showToast('Passwords do not match!', 'error'); return; }
            try {
                await apiRequest('/hr/settings/password', 'PUT', { currentPassword: current, newPassword: newP, confirmPassword: confirm });
                showToast('Password updated!', 'success');
                passwordForm.reset();
            } catch (error) { showToast(error.message || 'Failed.', 'error'); }
        });
    }

    function loadNotificationSettings() {
        try {
            apiRequest('/hr/settings/notifications', 'GET').then(function(r) {
                if (r.success && r.data) {
                    var d = r.data;
                    var attEl = document.getElementById('notifAttendance');
                    var leaveEl = document.getElementById('notifLeave');
                    var payEl = document.getElementById('notifPayroll');
                    var emailEl = document.getElementById('notifEmail');
                    if (attEl) attEl.checked = d.attendanceNotifications !== false;
                    if (leaveEl) leaveEl.checked = d.leaveNotifications !== false;
                    if (payEl) payEl.checked = d.payrollNotifications !== false;
                    if (emailEl) emailEl.checked = d.emailNotifications === true;
                }
            }).catch(function() {});
        } catch (e) {}
    }

    ['notifAttendance','notifLeave','notifPayroll','notifEmail'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', async function() {
            var data = {
                attendanceNotifications: document.getElementById('notifAttendance').checked,
                leaveNotifications: document.getElementById('notifLeave').checked,
                payrollNotifications: document.getElementById('notifPayroll').checked,
                emailNotifications: document.getElementById('notifEmail').checked
            };
            try {
                await apiRequest('/hr/settings/notifications', 'PUT', data);
                showToast('Preferences saved!', 'success');
            } catch (e) { showToast('Failed to save.', 'error'); }
        });
    });

    // Theme
    $$('input[name="theme"]').forEach(function(radio) {
        radio.addEventListener('change', async function() {
            var mode = this.value;
            try { await apiRequest('/hr/settings/appearance', 'PUT', { mode: mode }); } catch (e) {}
            if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
            else document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('hr_theme', mode);
            showToast('Theme: ' + mode, 'info');
        });
    });

    var savedTheme = localStorage.getItem('hr_theme');
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
    var quickLogout = document.getElementById('quickLogout');
    if (logoutMenu) logoutMenu.addEventListener('click', function(e) { e.preventDefault(); openLogout(); });
    if (quickLogout) quickLogout.addEventListener('click', function(e) { e.preventDefault(); openLogout(); });
    var logoutModal = document.getElementById('logoutModal');
    if (logoutModal) {
        logoutModal.querySelectorAll('.modal-close, .modal-close-btn').forEach(function(b) { b.addEventListener('click', closeLogout); });
        logoutModal.addEventListener('click', function(e) { if (e.target === logoutModal) closeLogout(); });
    }
    var confirmLogout = document.getElementById('confirmLogout');
    if (confirmLogout) {
        confirmLogout.addEventListener('click', async function() {
            this.disabled = true;
            var spinner = document.getElementById('logoutSpinner');
            if (spinner) spinner.classList.remove('hidden');
            try { await apiRequest('/auth/logout', 'POST'); } catch (e) {}
            clearSession();
            window.location.href = 'index.html';
        });
    }

    // Modal close
    $$('.modal-close, .modal-close-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { this.closest('.modal').classList.add('hidden'); });
    });
    $$('.modal').forEach(function(m) {
        m.addEventListener('click', function(e) { if (e.target === this) this.classList.add('hidden'); });
    });

    // Print payslip
    var printPayslipBtn = document.getElementById('printPayslipBtn');
    if (printPayslipBtn) printPayslipBtn.addEventListener('click', function() { window.print(); });

    var downloadPayslipBtn = document.getElementById('downloadPayslipBtn');
    if (downloadPayslipBtn) downloadPayslipBtn.addEventListener('click', function() { showToast('Downloading PDF...', 'info'); });

    // ============================================
    // DEBUG - Log location info on load
    // ============================================
    function logLocationInfo() {
        console.log('========================================');
        console.log('📍 SCHOOL LOCATION DEBUG');
        console.log('School Latitude:', SCHOOL_CONFIG.latitude);
        console.log('School Longitude:', SCHOOL_CONFIG.longitude);
        console.log('Allowed Radius:', SCHOOL_CONFIG.allowedRadius, 'meters');
        console.log('========================================');
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    var distance = calculateDistance(
                        pos.coords.latitude,
                        pos.coords.longitude,
                        SCHOOL_CONFIG.latitude,
                        SCHOOL_CONFIG.longitude
                    );
                    console.log('📍 YOUR CURRENT LOCATION:');
                    console.log('Latitude:', pos.coords.latitude);
                    console.log('Longitude:', pos.coords.longitude);
                    console.log('Accuracy:', pos.coords.accuracy, 'meters');
                    console.log('Distance from school:', Math.round(distance), 'meters');
                    console.log('Within radius:', distance <= SCHOOL_CONFIG.allowedRadius ? '✅ YES' : '❌ NO');
                    console.log('========================================');
                    
                    if (distance > SCHOOL_CONFIG.allowedRadius) {
                        console.log('⚠️ You are outside the allowed radius!');
                        console.log('💡 Update SCHOOL_CONFIG.latitude and .longitude with your actual school coordinates.');
                        console.log('💡 Or increase SCHOOL_CONFIG.allowedRadius to', Math.round(distance * 1.2), 'meters');
                    } else {
                        console.log('✅ You are within the allowed radius!');
                    }
                },
                function(err) {
                    console.error('GPS Error:', err);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }

    // ============================================
    // INIT
    // ============================================
    async function init() {
        var isAuth = await checkAuth();
        if (!isAuth) return;
        loadDashboard();
        console.log('✅ HR Dashboard initialized with GPS fixes');
        console.log('📍 GPS Settings:', GPS_CONFIG);
        console.log('📍 School Config:', SCHOOL_CONFIG);
        
        // Log location info for debugging
        setTimeout(logLocationInfo, 2000);
    }

    init();

})();