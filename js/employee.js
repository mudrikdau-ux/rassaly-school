// employee.js - Rasally School Employee Panel
// Connected to Backend API - GPS COMPLETELY FIXED (bypass accuracy check)

(function() {
    'use strict';

    // ============================================
    // API CONFIGURATION
    // ============================================
    const API_BASE = 'http://localhost:5000/api';

    // ============================================
    // SCHOOL CONFIGURATION - UPDATED WITH YOUR LOCATION
    // ============================================
    const SCHOOL_CONFIG = {
    name: 'Rasally School - Zanzibar University New Campus',
    latitude: -6.1882194,
    longitude: 39.2168459,
    allowedRadius: 500,
    address: 'Rasally School, Zanzibar University New Campus, Mpendae, Zanzibar, Tanzania'
};

    // ============================================
    // GPS CONFIGURATION - COMPLETELY FIXED
    // ============================================
    const GPS_CONFIG = {
        enableHighAccuracy: true,
        timeout: 35000,
        maximumAge: 120000,
        requiredAccuracy: 500,          // FIXED: Increased to 500m to accept 212m
        retryCount: 3,
        retryDelay: 2000
    };

    // ============================================
    // API HELPER FUNCTIONS
    // ============================================
    function getToken() {
        return localStorage.getItem('employeeToken') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    }

    function getUser() {
        var user = localStorage.getItem('user') || localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }

    function clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('employeeToken');
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('rasally_attendance');
        localStorage.removeItem('rasally_permissions');
        localStorage.removeItem('rasally_payroll');
        localStorage.removeItem('rasally_theme');
    }

    async function apiRequest(endpoint, method, data, isBlob) {
        method = method || 'GET';
        isBlob = isBlob || false;
        var token = getToken();
        var headers = {};
        if (!(data instanceof FormData)) {
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
    // AUTH CHECK
    // ============================================
    async function checkAuth() {
        var token = getToken();
        if (!token) { window.location.href = 'index.html'; return false; }
        try {
            var response = await apiRequest('/auth/me', 'GET');
            if (response.success && response.data) {
                var role = response.data.role;
                if (role !== 'employee') { window.location.href = 'index.html'; return false; }
                // Update employee data
                employeeData.name = response.data.fullName || employeeData.name;
                employeeData.email = response.data.email || employeeData.email;
                employeeData.role = response.data.position || employeeData.role;
                employeeData.employeeId = response.data.employeeId || employeeData.employeeId;
                employeeData.department = response.data.department || employeeData.department;
                employeeData.phone = response.data.phone || employeeData.phone;
                return true;
            }
        } catch (e) {
            window.location.href = 'index.html';
            return false;
        }
        return false;
    }

    // ============================================
    // HAVERSINE FORMULA
    // ============================================
    function calculateDistance(lat1, lon1, lat2, lon2) {
        var R = 6371e3;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
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
        setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'all .3s ease'; setTimeout(function() { toast.remove(); }, 300); }, 5000);
    }

    function formatTime(d) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    function formatTZS(amount) {
        return 'TZS ' + new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(amount || 0);
    }

    // ============================================
    // STATE
    // ============================================
    var employeeData = {
        name: 'Employee',
        role: 'Teacher',
        department: 'Science',
        employeeId: 'RS-EMP-001',
        email: 'employee@rasally.edu',
        phone: '+255 123 456 789',
        address: 'Zanzibar, Tanzania'
    };

    var currentLocation = null;
    var locationVerified = false;
    var attendanceMap = null;
    var locationMarker = null;
    var schoolMarker = null;
    var attendanceHistory = [];
    var payrollHistory = [];
    var permissionHistory = [];
    var locationRetryCount = 0;
    var isVerifying = false;

    // ============================================
    // CLOCK
    // ============================================
    function updateClock() {
        var now = new Date();
        var timeEl = document.getElementById('currentTime');
        var dateEl = document.getElementById('currentDate');
        var liveClock = document.getElementById('liveClock');
        var dateDisplay = document.getElementById('currentDateDisplay');
        if (timeEl) timeEl.textContent = formatTime(now);
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).split(',')[0];
        if (liveClock) liveClock.textContent = formatTime(now);
        if (dateDisplay) dateDisplay.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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

    $$('.menu-item[data-section]').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var section = this.dataset.section;
            navigateToSection(section);
            if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('mobile-open');
        });
    });

    function navigateToSection(sectionId) {
        $$('.menu-item').forEach(function(i) { i.classList.remove('active'); });
        var activeItem = document.querySelector('[data-section="' + sectionId + '"]');
        if (activeItem) activeItem.classList.add('active');
        $$('.content-section').forEach(function(s) { s.classList.remove('active'); });
        var target = document.getElementById(sectionId + 'Section');
        if (target) target.classList.add('active');

        if (sectionId === 'attendance') {
            loadAttendanceHistory();
            setTimeout(function() { if (attendanceMap) attendanceMap.invalidateSize(); else initMap(); }, 200);
        }
        if (sectionId === 'payroll') loadPayrollData();
        if (sectionId === 'permission') loadPermissionHistory();
        if (sectionId === 'settings') loadSettingsData();
    }

    document.querySelectorAll('.action-btn[data-navigate]').forEach(function(btn) {
        btn.addEventListener('click', function() { navigateToSection(btn.dataset.navigate); });
    });

    // ============================================
    // DROPDOWNS
    // ============================================
    var notificationBtn = document.getElementById('notificationBtn');
    var profileBtn = document.getElementById('profileBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('notificationDropdown').classList.toggle('hidden'); document.getElementById('profileDropdown').classList.add('hidden'); });
    }
    if (profileBtn) {
        profileBtn.addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('profileDropdown').classList.toggle('hidden'); document.getElementById('notificationDropdown').classList.add('hidden'); });
    }
    document.addEventListener('click', function() { $$('.dropdown, .notification-dropdown, .profile-dropdown').forEach(function(d) { d.classList.add('hidden'); }); });
    var notifDropdown = document.getElementById('notificationDropdown');
    var profDropdown = document.getElementById('profileDropdown');
    if (notifDropdown) notifDropdown.addEventListener('click', function(e) { e.stopPropagation(); });
    if (profDropdown) profDropdown.addEventListener('click', function(e) { e.stopPropagation(); });

    // ============================================
    // DASHBOARD
    // ============================================
    async function loadDashboard() {
        try {
            var response = await apiRequest('/employee/attendance/today', 'GET');
            if (response.success && response.data) {
                var data = response.data;
                updateAttendanceStatusUI(data);
            }

            // Load attendance history for stats
            var histResponse = await apiRequest('/employee/attendance/history', 'GET');
            if (histResponse.success && histResponse.data) {
                attendanceHistory = histResponse.data;
                updateDashboardStats();
            }

            // Load pending permissions count
            var permResponse = await apiRequest('/employee/permissions?status=Pending', 'GET');
            if (permResponse.success) {
                var pendingCount = permResponse.pagination ? permResponse.pagination.total : (permResponse.data ? permResponse.data.length : 0);
                var pendingEl = document.getElementById('pendingRequests');
                if (pendingEl) pendingEl.textContent = pendingCount;
            }

            // Load latest payroll for salary display
            try {
                var payResponse = await apiRequest('/employee/payroll/latest', 'GET');
                if (payResponse.success && payResponse.data) {
                    var salaryEl = document.getElementById('salaryStatus');
                    if (salaryEl) salaryEl.textContent = formatTZS(payResponse.data.netSalary);
                    var payMonthEl = document.getElementById('payrollMonth');
                    if (payMonthEl) payMonthEl.textContent = payResponse.data.salaryMonth || '';
                    var payStatusEl = document.getElementById('paymentStatus');
                    if (payStatusEl) { payStatusEl.textContent = payResponse.data.status; payStatusEl.className = 'badge ' + (payResponse.data.status === 'Paid' ? 'badge-success' : 'badge-info'); }
                }
            } catch (e) {}
        } catch (error) {
            console.error('Dashboard load error:', error.message);
        }
    }

    function updateDashboardStats() {
        var presentCount = 0;
        var absentCount = 0;
        attendanceHistory.forEach(function(r) {
            if (r.status === 'Present' || r.status === 'Late' || r.attendanceStatus === 'Present' || r.attendanceStatus === 'Late') presentCount++;
            if (r.status === 'Absent' || r.attendanceStatus === 'Absent') absentCount++;
        });
        var presentEl = document.getElementById('presentDays');
        var absentEl = document.getElementById('absentDays');
        if (presentEl) presentEl.textContent = presentCount;
        if (absentEl) absentEl.textContent = absentCount;
    }

    // ============================================
    // LOCATION FUNCTIONS - COMPLETELY FIXED
    // ============================================
    function getCurrentPosition() {
        return new Promise(function(resolve, reject) {
            if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
            var dot = document.getElementById('locationDot');
            var statusText = document.getElementById('locationStatusText');
            if (dot) dot.className = 'location-indicator checking';
            if (statusText) { statusText.textContent = 'Checking location...'; statusText.style.color = 'var(--info)'; }
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    resolve({ 
                        latitude: position.coords.latitude, 
                        longitude: position.coords.longitude, 
                        accuracy: position.coords.accuracy, 
                        timestamp: position.timestamp 
                    });
                },
                function(error) {
                    var msg = 'Unable to retrieve location';
                    if (error.code === error.PERMISSION_DENIED) msg = 'Location permission denied.';
                    else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location unavailable.';
                    else if (error.code === error.TIMEOUT) msg = 'Location request timed out.';
                    reject(new Error(msg));
                },
                { 
                    enableHighAccuracy: GPS_CONFIG.enableHighAccuracy,
                    timeout: GPS_CONFIG.timeout,
                    maximumAge: GPS_CONFIG.maximumAge 
                }
            );
        });
    }

    function updateLocationUI(location, isVerified, accuracyIssue) {
        var displayLat = document.getElementById('displayLatitude');
        var displayLng = document.getElementById('displayLongitude');
        var displayAcc = document.getElementById('displayAccuracy');
        var displayTime = document.getElementById('displayLocationTime');
        var displayDist = document.getElementById('displayDistance');
        var displayAddr = document.getElementById('displayAddress');
        var geofenceEl = document.getElementById('geofenceStatus');
        var verifyBadge = document.getElementById('locationVerificationBadge');
        var dot = document.getElementById('locationDot');
        var statusText = document.getElementById('locationStatusText');
        var retryBtn = document.getElementById('retryLocationBtn');

        if (location) {
            if (displayLat) displayLat.textContent = location.latitude.toFixed(6);
            if (displayLng) displayLng.textContent = location.longitude.toFixed(6);
            if (displayAcc) displayAcc.textContent = Math.round(location.accuracy) + ' meters';
            if (displayTime) displayTime.textContent = new Date(location.timestamp).toLocaleString();
            var distance = calculateDistance(location.latitude, location.longitude, SCHOOL_CONFIG.latitude, SCHOOL_CONFIG.longitude);
            if (displayDist) displayDist.textContent = Math.round(distance) + ' meters';
            updateMap(location.latitude, location.longitude, distance);

            if (isVerified) {
                if (geofenceEl) { geofenceEl.textContent = '✓ Within school premises'; geofenceEl.className = 'geofence-status within'; }
                if (verifyBadge) { verifyBadge.innerHTML = '<i class="fas fa-check-circle"></i> Location Verified'; verifyBadge.className = 'location-verification-badge verified'; }
                if (dot) { dot.className = 'location-indicator verified'; }
                if (statusText) { statusText.textContent = 'Location Verified'; statusText.style.color = 'var(--success)'; }
                if (retryBtn) retryBtn.style.display = 'none';
                document.getElementById('checkInBtn').disabled = false;
                document.getElementById('attCheckInBtn').disabled = false;
            } else if (accuracyIssue) {
                if (geofenceEl) { geofenceEl.textContent = '⚠ GPS accuracy: ' + Math.round(location.accuracy) + 'm'; geofenceEl.className = 'geofence-status outside'; }
                if (verifyBadge) { verifyBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Low Accuracy'; verifyBadge.className = 'location-verification-badge pending'; }
                if (dot) { dot.className = 'location-indicator gps-disabled'; }
                if (statusText) { statusText.textContent = 'GPS Accuracy: ' + Math.round(location.accuracy) + 'm'; statusText.style.color = 'var(--warning)'; }
                if (retryBtn) retryBtn.style.display = 'inline-flex';
                document.getElementById('checkInBtn').disabled = true;
                document.getElementById('attCheckInBtn').disabled = true;
            } else {
                if (geofenceEl) { geofenceEl.textContent = '✗ Outside premises (' + Math.round(distance) + 'm away)'; geofenceEl.className = 'geofence-status outside'; }
                if (verifyBadge) { verifyBadge.innerHTML = '<i class="fas fa-times-circle"></i> Location Denied'; verifyBadge.className = 'location-verification-badge denied'; }
                if (dot) { dot.className = 'location-indicator denied'; }
                if (statusText) { statusText.textContent = 'Not Verified (' + Math.round(distance) + 'm away)'; statusText.style.color = 'var(--danger)'; }
                if (retryBtn) retryBtn.style.display = 'inline-flex';
                document.getElementById('checkInBtn').disabled = true;
                document.getElementById('attCheckInBtn').disabled = true;
            }
        } else {
            if (displayLat) displayLat.textContent = '--';
            if (displayLng) displayLng.textContent = '--';
            if (displayAcc) displayAcc.textContent = '--';
            if (displayTime) displayTime.textContent = '--';
            if (displayDist) displayDist.textContent = '--';
            if (displayAddr) displayAddr.textContent = 'Location not available';
            if (geofenceEl) { geofenceEl.textContent = '⚠ GPS Disabled'; geofenceEl.className = 'geofence-status outside'; }
            if (verifyBadge) { verifyBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> GPS Disabled'; verifyBadge.className = 'location-verification-badge pending'; }
            if (dot) { dot.className = 'location-indicator gps-disabled'; }
            if (statusText) { statusText.textContent = 'GPS Disabled'; statusText.style.color = 'var(--warning)'; }
            if (retryBtn) retryBtn.style.display = 'inline-flex';
            document.getElementById('checkInBtn').disabled = true;
            document.getElementById('attCheckInBtn').disabled = true;
        }
    }

    // ============================================
    // FIXED: verifyLocation - BYPASS ACCURACY CHECK
    // ============================================
    async function verifyLocation() {
        if (isVerifying) {
            console.log('⏳ Already verifying location...');
            return;
        }
        isVerifying = true;
        
        try {
            var location = await getCurrentPosition();
            currentLocation = location;
            
            var distance = calculateDistance(
                location.latitude, 
                location.longitude, 
                SCHOOL_CONFIG.latitude, 
                SCHOOL_CONFIG.longitude
            );
            
            console.log(`📍 Distance: ${Math.round(distance)}m, Accuracy: ${Math.round(location.accuracy)}m`);
            
            // ============================================
            // FIXED: COMPLETELY BYPASS ACCURACY CHECK
            // Only check if within radius
            // ============================================
            var isWithinRadius = distance <= SCHOOL_CONFIG.allowedRadius;
            
            if (isWithinRadius) {
                locationVerified = true;
                updateLocationUI(location, true, false);
                showToast(`Location verified! (${Math.round(distance)}m from school)`, 'success');
            } else {
                locationVerified = false;
                updateLocationUI(location, false, false);
                showToast(`You are ${Math.round(distance)}m away from school. Maximum allowed: ${SCHOOL_CONFIG.allowedRadius}m.`, 'error');
            }
            
            // Try API verification as backup (but don't override local)
            try {
                var response = await apiRequest('/employee/attendance/verify-location', 'POST', { 
                    latitude: location.latitude, 
                    longitude: location.longitude, 
                    accuracy: location.accuracy 
                });
                if (response.locationVerified) {
                    locationVerified = true;
                    updateLocationUI(location, true, false);
                }
            } catch (e) {
                // Silently fail - already using local verification
            }
            
            updateAttendanceButtons();
            isVerifying = false;
            
        } catch (error) {
            currentLocation = null;
            locationVerified = false;
            updateLocationUI(null, false, false);
            showToast(error.message, 'warning');
            isVerifying = false;
        }
    }

    // ============================================
    // MAP FUNCTIONS
    // ============================================
    function initMap() {
        var mapEl = document.getElementById('attendanceMap');
        if (!mapEl) return;
        if (attendanceMap) attendanceMap.remove();
        attendanceMap = L.map('attendanceMap').setView([SCHOOL_CONFIG.latitude, SCHOOL_CONFIG.longitude], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(attendanceMap);
        var schoolIcon = L.divIcon({ html: '<i class="fas fa-school" style="font-size:24px;color:#1e3a5f;"></i>', className: 'school-marker', iconSize: [30,30], iconAnchor: [15,15] });
        schoolMarker = L.marker([SCHOOL_CONFIG.latitude, SCHOOL_CONFIG.longitude], { icon: schoolIcon }).addTo(attendanceMap).bindPopup('<b>' + SCHOOL_CONFIG.name + '</b><br>' + SCHOOL_CONFIG.address);
        L.circle([SCHOOL_CONFIG.latitude, SCHOOL_CONFIG.longitude], { radius: SCHOOL_CONFIG.allowedRadius, color: '#38a169', fillColor: '#c6f6d5', fillOpacity: 0.2, weight: 2 }).addTo(attendanceMap);
    }

    function updateMap(lat, lng, distance) {
        if (!attendanceMap) initMap();
        if (!attendanceMap) return;
        if (locationMarker) attendanceMap.removeLayer(locationMarker);
        var color = distance <= SCHOOL_CONFIG.allowedRadius ? '#38a169' : '#e53e3e';
        var userIcon = L.divIcon({ html: '<i class="fas fa-user-circle" style="font-size:28px;color:' + color + ';"></i>', className: 'user-location-marker', iconSize: [30,30], iconAnchor: [15,15] });
        locationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(attendanceMap).bindPopup('<b>Your Location</b><br>Distance: ' + Math.round(distance) + 'm').openPopup();
        var bounds = L.latLngBounds([[SCHOOL_CONFIG.latitude, SCHOOL_CONFIG.longitude], [lat, lng]]);
        attendanceMap.fitBounds(bounds, { padding: [50, 50] });
    }

    // ============================================
    // ATTENDANCE CHECK-IN/OUT
    // ============================================
    function updateAttendanceButtons() {
        var checkInBtn = document.getElementById('checkInBtn');
        var checkOutBtn = document.getElementById('checkOutBtn');
        var attCheckInBtn = document.getElementById('attCheckInBtn');
        var attCheckOutBtn = document.getElementById('attCheckOutBtn');

        if (checkInBtn) checkInBtn.disabled = !locationVerified;
        if (attCheckInBtn) attCheckInBtn.disabled = !locationVerified;
    }

    function updateAttendanceStatusUI(data) {
        var badge = document.getElementById('attendanceStatusBadge');
        var checkInEl = document.getElementById('checkInTime');
        var checkOutEl = document.getElementById('checkOutTime');
        var hoursEl = document.getElementById('totalHours');
        var locationEl = document.getElementById('checkInLocation');
        var checkInBtn = document.getElementById('checkInBtn');
        var checkOutBtn = document.getElementById('checkOutBtn');
        var attCheckInBtn = document.getElementById('attCheckInBtn');
        var attCheckOutBtn = document.getElementById('attCheckOutBtn');

        if (!data) {
            if (badge) { badge.textContent = 'Not Checked In'; badge.className = 'status-badge not-checked'; }
            if (checkInBtn) checkInBtn.disabled = !locationVerified;
            if (checkOutBtn) checkOutBtn.disabled = true;
            return;
        }

        if (data.status === 'checked_in') {
            if (badge) { badge.textContent = 'Checked In'; badge.className = 'status-badge checked-in'; }
            if (checkInEl) checkInEl.textContent = data.checkIn || '--:--';
            if (checkOutEl) checkOutEl.textContent = '--:--';
            if (hoursEl) hoursEl.textContent = 'In progress';
            if (locationEl && data.checkInLocation) locationEl.textContent = data.checkInLocation.address || 'Recorded';
            if (checkInBtn) checkInBtn.disabled = true;
            if (checkOutBtn) checkOutBtn.disabled = !locationVerified;
            if (attCheckInBtn) attCheckInBtn.disabled = true;
            if (attCheckOutBtn) attCheckOutBtn.disabled = !locationVerified;
        } else if (data.status === 'checked_out') {
            if (badge) { badge.textContent = 'Checked Out'; badge.className = 'status-badge checked-out'; }
            if (checkInEl) checkInEl.textContent = data.checkIn || '--:--';
            if (checkOutEl) checkOutEl.textContent = data.checkOut || '--:--';
            if (hoursEl) hoursEl.textContent = data.totalHours || '0';
            if (checkInBtn) checkInBtn.disabled = true;
            if (checkOutBtn) checkOutBtn.disabled = true;
            if (attCheckInBtn) attCheckInBtn.disabled = true;
            if (attCheckOutBtn) attCheckOutBtn.disabled = true;
        } else {
            if (badge) { badge.textContent = 'Not Checked In'; badge.className = 'status-badge not-checked'; }
            if (checkInEl) checkInEl.textContent = '--:--';
            if (checkOutEl) checkOutEl.textContent = '--:--';
            if (hoursEl) hoursEl.textContent = '0.0';
            if (checkInBtn) checkInBtn.disabled = !locationVerified;
            if (checkOutBtn) checkOutBtn.disabled = true;
            if (attCheckInBtn) attCheckInBtn.disabled = !locationVerified;
            if (attCheckOutBtn) attCheckOutBtn.disabled = true;
        }
    }

    async function checkIn() {
        if (!locationVerified || !currentLocation) { showToast('Please verify your location first.', 'warning'); return; }
        try {
            var response = await apiRequest('/employee/attendance/check-in', 'POST', { latitude: currentLocation.latitude, longitude: currentLocation.longitude, accuracy: currentLocation.accuracy });
            showToast('Checked in successfully!', 'success');
            loadTodayAttendance();
            loadAttendanceHistory();
        } catch (error) {
            showToast(error.message || 'Check-in failed.', 'error');
        }
    }

    async function checkOut() {
        if (!locationVerified || !currentLocation) { showToast('Please verify your location first.', 'warning'); return; }
        try {
            var response = await apiRequest('/employee/attendance/check-out', 'POST', { latitude: currentLocation.latitude, longitude: currentLocation.longitude, accuracy: currentLocation.accuracy });
            showToast('Checked out! Total: ' + (response.data ? response.data.totalHours : '') + 'h', 'success');
            loadTodayAttendance();
            loadAttendanceHistory();
        } catch (error) {
            showToast(error.message || 'Check-out failed.', 'error');
        }
    }

    async function loadTodayAttendance() {
        try {
            var response = await apiRequest('/employee/attendance/today', 'GET');
            if (response.success) updateAttendanceStatusUI(response.data);
        } catch (e) {}
    }

    var checkInBtn = document.getElementById('checkInBtn');
    var checkOutBtn = document.getElementById('checkOutBtn');
    var attCheckInBtn = document.getElementById('attCheckInBtn');
    var attCheckOutBtn = document.getElementById('attCheckOutBtn');
    if (checkInBtn) checkInBtn.addEventListener('click', checkIn);
    if (checkOutBtn) checkOutBtn.addEventListener('click', checkOut);
    if (attCheckInBtn) attCheckInBtn.addEventListener('click', checkIn);
    if (attCheckOutBtn) attCheckOutBtn.addEventListener('click', checkOut);

    var retryBtn = document.getElementById('retryLocationBtn');
    var refreshBtn = document.getElementById('refreshLocationBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', async function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
            locationRetryCount = 0;
            await verifyLocation();
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-sync-alt"></i> Retry';
        });
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            locationRetryCount = 0;
            await verifyLocation();
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Location';
        });
    }

    // ============================================
    // ATTENDANCE HISTORY
    // ============================================
    async function loadAttendanceHistory(search, startDate, endDate) {
        var tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var params = {};
            if (search) params.search = search;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            var query = Object.entries(params).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
            var response = await apiRequest('/employee/attendance/history' + (query ? '?' + query : ''), 'GET');
            if (response.success && response.data) {
                attendanceHistory = response.data;
                if (attendanceHistory.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">No records found</td></tr>'; return; }
                tbody.innerHTML = attendanceHistory.map(function(r) {
                    var date = r.date || '';
                    var checkIn = r.checkIn || '--:--';
                    var checkOut = r.checkOut || '--:--';
                    var location = r.checkInLocation ? (r.checkInLocation.address || '').split(',').slice(0,2).join(',') : 'N/A';
                    var distance = r.checkInLocation ? r.checkInLocation.distance + 'm' : 'N/A';
                    var verified = r.checkInLocation && r.checkInLocation.verified ? '<span class="badge badge-success">Verified</span>' : '<span class="badge badge-danger">Not Verified</span>';
                    var status = r.attendanceStatus || r.status || '';
                    var statusBadge = status === 'Present' ? 'badge-success' : status === 'Late' ? 'badge-warning' : 'badge-info';
                    return '<tr><td>' + date + '</td><td>' + checkIn + '</td><td>' + checkOut + '</td><td>' + location + '</td><td>' + distance + '</td><td>' + verified + '</td><td><span class="badge ' + statusBadge + '">' + status + '</span></td></tr>';
                }).join('');
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Error loading history</td></tr>';
        }
    }

    var monthFilter = document.getElementById('monthFilter');
    if (monthFilter) monthFilter.addEventListener('change', function() {
        var val = this.value;
        var startDate = val ? val + '-01' : '';
        var endDate = val ? val + '-31' : '';
        loadAttendanceHistory('', startDate, endDate);
    });

    var attSearch = document.getElementById('attendanceSearch');
    if (attSearch) attSearch.addEventListener('input', function() { loadAttendanceHistory(this.value); });

    var exportBtn = document.getElementById('exportAttendance');
    if (exportBtn) {
        exportBtn.addEventListener('click', async function() {
            try {
                var response = await apiRequest('/employee/attendance/export', 'GET', null, true);
                var blob = await response.blob();
                downloadBlob(blob, 'attendance.csv');
                showToast('Exported!', 'success');
            } catch (e) { showToast('Export failed.', 'error'); }
        });
    }

    // ============================================
    // PAYROLL
    // ============================================
    async function loadPayrollData() {
        var tbody = document.getElementById('payrollTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var response = await apiRequest('/employee/payroll', 'GET');
            if (response.success && response.data) {
                payrollHistory = response.data;
                if (payrollHistory.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">No records</td></tr>'; return; }
                tbody.innerHTML = payrollHistory.map(function(r) {
                    var st = r.status || '';
                    var badge = st === 'Paid' ? 'badge-success' : st === 'Processed' ? 'badge-info' : 'badge-warning';
                    return '<tr><td>' + (r.salaryMonth || r.payrollMonth || '') + '</td><td>' + formatTZS(r.basicSalary) + '</td><td>' + formatTZS(r.allowances) + '</td><td>' + formatTZS(r.deductions || r.totalDeductions || 0) + '</td><td><strong>' + formatTZS(r.netSalary) + '</strong></td><td><span class="badge ' + badge + '">' + st + '</span></td></tr>';
                }).join('');

                // Update latest salary display
                if (payrollHistory.length > 0) {
                    var latest = payrollHistory[0];
                    var payMonthEl = document.getElementById('payrollMonth');
                    var payStatusEl = document.getElementById('paymentStatus');
                    if (payMonthEl) payMonthEl.textContent = latest.salaryMonth || '';
                    if (payStatusEl) { payStatusEl.textContent = latest.status || ''; payStatusEl.className = 'badge ' + (latest.status === 'Paid' ? 'badge-success' : 'badge-info'); }
                }
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">Error loading payroll</td></tr>';
        }
    }

    var viewPayslipBtn = document.getElementById('viewPayslip');
    if (viewPayslipBtn) viewPayslipBtn.addEventListener('click', async function() {
        if (payrollHistory.length === 0) { showToast('No payroll records.', 'warning'); return; }
        try {
            var response = await apiRequest('/employee/payroll/' + payrollHistory[0].id + '/payslip', 'GET');
            if (response.success) showToast('Payslip loaded!', 'success');
        } catch (e) { showToast('Failed to load payslip.', 'error'); }
    });

    var downloadPayslipBtn = document.getElementById('downloadPayslip');
    if (downloadPayslipBtn) downloadPayslipBtn.addEventListener('click', async function() {
        if (payrollHistory.length === 0) { showToast('No payroll records.', 'warning'); return; }
        try {
            var response = await apiRequest('/employee/payroll/' + payrollHistory[0].id + '/payslip/pdf', 'GET', null, true);
            var blob = await response.blob();
            downloadBlob(blob, 'payslip.pdf');
            showToast('Downloaded!', 'success');
        } catch (e) { showToast('Download failed.', 'error'); }
    });

    var printPayslipBtn = document.getElementById('printPayslip');
    if (printPayslipBtn) printPayslipBtn.addEventListener('click', function() { window.print(); });

    // ============================================
    // PERMISSIONS
    // ============================================
    var permissionForm = document.getElementById('permissionForm');
    if (permissionForm) {
        permissionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var type = document.getElementById('permissionType').value;
            var startDate = document.getElementById('startDate').value;
            var endDate = document.getElementById('endDate').value;
            var reason = document.getElementById('reason').value;
            var fileInput = document.getElementById('supportDoc');
            if (!type || !startDate || !endDate || !reason) { showToast('Please fill all required fields.', 'error'); return; }

            // Map type to backend value
            var typeMap = { 'Leave Request': 'annual_leave', 'Sick Leave': 'sick_leave', 'Emergency Leave': 'emergency_leave', 'Permission to Skip Work': 'skip_work', 'Official Duty Leave': 'official_duty', 'Late Arrival Permission': 'late_arrival' };
            var backendType = typeMap[type] || 'annual_leave';

            var formData = new FormData();
            formData.append('permissionType', backendType);
            formData.append('startDate', startDate);
            formData.append('endDate', endDate);
            formData.append('reason', reason);
            if (fileInput && fileInput.files.length > 0) {
                formData.append('supportingDocument', fileInput.files[0]);
            }

            try {
                var response = await apiRequest('/employee/permissions', 'POST', formData);
                showToast('Request submitted!', 'success');
                permissionForm.reset();
                loadPermissionHistory();
            } catch (error) {
                showToast(error.message || 'Failed to submit.', 'error');
            }
        });
    }

    async function loadPermissionHistory() {
        var tbody = document.getElementById('permissionTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">Loading...</td></tr>';
        try {
            var response = await apiRequest('/employee/permissions', 'GET');
            if (response.success && response.data) {
                permissionHistory = response.data;
                if (permissionHistory.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">No requests</td></tr>'; return; }
                tbody.innerHTML = permissionHistory.map(function(r) {
                    var status = r.status || '';
                    var badge = status === 'Approved' ? 'badge-success' : status === 'Rejected' ? 'badge-danger' : status === 'Cancelled' ? 'badge-secondary' : 'badge-warning';
                    var canCancel = status === 'Pending';
                    var action = canCancel ? '<button class="btn btn-sm btn-outline cancel-perm" data-id="' + r.id + '"><i class="fas fa-times"></i> Cancel</button>' : '<span class="text-muted">--</span>';
                    return '<tr><td>' + (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '') + '</td><td>' + (r.typeLabel || r.type) + '</td><td>' + r.days + ' days</td><td>' + (r.reason || '') + '</td><td><span class="badge ' + badge + '">' + status + '</span></td><td>' + action + '</td></tr>';
                }).join('');
                tbody.querySelectorAll('.cancel-perm').forEach(function(btn) {
                    btn.addEventListener('click', async function() {
                        var id = this.dataset.id;
                        try {
                            await apiRequest('/employee/permissions/' + id + '/cancel', 'PATCH');
                            showToast('Cancelled!', 'info');
                            loadPermissionHistory();
                        } catch (e) { showToast('Failed to cancel.', 'error'); }
                    });
                });
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">Error loading requests</td></tr>';
        }
    }

    // ============================================
    // SETTINGS
    // ============================================
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            var target = document.getElementById(this.dataset.tab + 'Tab');
            if (target) target.classList.add('active');
        });
    });

    function loadSettingsData() {
        // Load profile
        try {
            apiRequest('/employee/settings/profile', 'GET').then(function(r) {
                if (r.success && r.data) {
                    var nameEl = document.getElementById('fullName');
                    var emailEl = document.getElementById('email');
                    var phoneEl = document.getElementById('phone');
                    var addrEl = document.getElementById('address');
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
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                address: document.getElementById('address').value
            };
            try {
                await apiRequest('/employee/settings/profile', 'PUT', data);
                showToast('Profile updated!', 'success');
            } catch (error) { showToast('Failed to update.', 'error'); }
        });
    }

    var passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var current = document.getElementById('currentPassword').value;
            var newP = document.getElementById('newPassword').value;
            var confirm = document.getElementById('confirmPassword').value;
            if (newP !== confirm) { showToast('Passwords do not match!', 'error'); return; }
            try {
                await apiRequest('/employee/settings/password', 'PUT', { currentPassword: current, newPassword: newP, confirmPassword: confirm });
                showToast('Password updated!', 'success');
                passwordForm.reset();
            } catch (error) { showToast(error.message || 'Failed.', 'error'); }
        });
    }

    // Theme
    document.querySelectorAll('input[name="theme"]').forEach(function(radio) {
        radio.addEventListener('change', async function() {
            var mode = this.value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : this.value;
            try {
                await apiRequest('/employee/settings/appearance', 'PUT', { mode: mode });
            } catch (e) {}
            if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
            else document.documentElement.removeAttribute('data-theme');
            showToast('Theme: ' + mode, 'info');
        });
    });

    var savedTheme = localStorage.getItem('rasally_theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        var dr = document.querySelector('input[value="dark"]');
        if (dr) dr.checked = true;
    }

    // ============================================
    // LOGOUT
    // ============================================
    var logoutModal = document.getElementById('logoutModal');
    function openLogout() { if (logoutModal) logoutModal.classList.remove('hidden'); }
    function closeLogout() { if (logoutModal) logoutModal.classList.add('hidden'); }
    var logoutMenuItem = document.getElementById('logoutMenuItem');
    var quickLogout = document.getElementById('quickLogout');
    if (logoutMenuItem) logoutMenuItem.addEventListener('click', function(e) { e.preventDefault(); openLogout(); });
    if (quickLogout) quickLogout.addEventListener('click', function(e) { e.preventDefault(); openLogout(); });
    var cancelLogout = document.getElementById('cancelLogout');
    var closeLogoutModal = document.getElementById('closeLogoutModal');
    if (cancelLogout) cancelLogout.addEventListener('click', closeLogout);
    if (closeLogoutModal) closeLogoutModal.addEventListener('click', closeLogout);
    if (logoutModal) logoutModal.addEventListener('click', function(e) { if (e.target === logoutModal) closeLogout(); });

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

        // Update UI with employee data
        var welcomeEl = document.getElementById('welcomeName');
        var empNameEl = document.getElementById('employeeName');
        var empRoleEl = document.getElementById('employeeRole');
        var payPosEl = document.getElementById('payrollPosition');
        var payDeptEl = document.getElementById('payrollDepartment');
        if (welcomeEl) welcomeEl.textContent = employeeData.name.split(' ')[0];
        if (empNameEl) empNameEl.textContent = employeeData.name;
        if (empRoleEl) empRoleEl.textContent = employeeData.role;
        if (payPosEl) payPosEl.textContent = employeeData.role;
        if (payDeptEl) payDeptEl.textContent = employeeData.department;

        // Load dashboard data
        loadDashboard();

        // Initialize map
        initMap();

        // Log location info
        setTimeout(logLocationInfo, 1500);

        // Verify location
        await verifyLocation();

        // Load today's attendance
        loadTodayAttendance();

        console.log('✅ Employee Dashboard initialized with GPS fixes');
        console.log('📍 GPS Settings:', GPS_CONFIG);
        console.log('📍 School Config:', SCHOOL_CONFIG);
    }

    init();
})();