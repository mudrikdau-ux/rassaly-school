/**
 * Rasally School Staff Management System
 * Centralized API Service
 * Base URL: http://localhost:5000/api
 */

const API_BASE_URL = 'http://localhost:5000/api';

// ==================== AXIOS INSTANCE ====================

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// ==================== REQUEST INTERCEPTOR ====================

apiClient.interceptors.request.use(
    (config) => {
        // Attach JWT token from localStorage
        const token = localStorage.getItem('token') || 
                     localStorage.getItem('hrToken') || 
                     localStorage.getItem('employeeToken') ||
                     localStorage.getItem('auth_token');
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Log requests in development
        if (window.location.hostname === 'localhost') {
            console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ==================== RESPONSE INTERCEPTOR ====================

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const { response } = error;
        
        if (response) {
            const { status, data } = response;
            
            switch (status) {
                case 400:
                    console.error('Bad Request:', data?.message || 'Invalid request');
                    break;
                case 401:
                    // Token expired or invalid
                    console.error('Unauthorized:', data?.message || 'Authentication required');
                    handleSessionExpiry();
                    break;
                case 403:
                    console.error('Forbidden:', data?.message || 'Access denied');
                    break;
                case 404:
                    console.error('Not Found:', data?.message || 'Resource not found');
                    break;
                case 409:
                    console.error('Conflict:', data?.message || 'Resource conflict');
                    break;
                case 429:
                    console.error('Rate Limited:', data?.message || 'Too many requests');
                    break;
                case 500:
                    console.error('Server Error:', data?.message || 'Internal server error');
                    break;
                default:
                    console.error(`Error ${status}:`, data?.message || 'An error occurred');
            }
        } else {
            console.error('Network Error: Unable to connect to server');
        }
        
        return Promise.reject(error);
    }
);

// ==================== SESSION HANDLER ====================

function handleSessionExpiry() {
    // Clear all auth tokens
    localStorage.removeItem('token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('hrToken');
    localStorage.removeItem('employeeToken');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    
    // Redirect to login if not already there
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html?session=expired';
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get stored token based on role
 */
function getToken(role = '') {
    if (role === 'hr') return localStorage.getItem('hrToken');
    if (role === 'employee') return localStorage.getItem('employeeToken');
    return localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('hrToken') || localStorage.getItem('employeeToken');
}

/**
 * Save token to localStorage
 */
function saveToken(token, role = 'admin') {
    if (role === 'hr') {
        localStorage.setItem('hrToken', token);
    } else if (role === 'employee') {
        localStorage.setItem('employeeToken', token);
    } else {
        localStorage.setItem('token', token);
        localStorage.setItem('auth_token', token);
    }
}

/**
 * Save user data to localStorage
 */
function saveUser(user, role = 'admin') {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userRole', role);
}

/**
 * Get stored user data
 */
function getStoredUser() {
    const user = localStorage.getItem('user') || localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

/**
 * Clear all session data
 */
function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('hrToken');
    localStorage.removeItem('employeeToken');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
}

/**
 * Build query string from params object
 */
function buildQuery(params = {}) {
    const query = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    return query ? `?${query}` : '';
}

/**
 * Trigger file download from blob
 */
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Create FormData from object
 */
function createFormData(data, fileField = 'supportingDocument') {
    const formData = new FormData();
    for (const key in data) {
        if (data[key] instanceof File) {
            formData.append(fileField, data[key]);
        } else if (data[key] !== undefined && data[key] !== null) {
            formData.append(key, data[key]);
        }
    }
    return formData;
}

// ==================== AUTHENTICATION API ====================

const AuthAPI = {
    /**
     * Login - Request OTP for any role
     * @param {string} fullName - User's full name
     * @param {string} email - User's email
     * @param {string} password - User's password
     * @param {string} role - admin, hr, or employee
     */
    login: async (fullName, email, password, role = 'admin') => {
        let endpoint = '/auth/admin/request-otp';
        if (role === 'hr') endpoint = '/auth/hr/login';
        else if (role === 'employee') endpoint = '/auth/employee/login';
        
        const response = await apiClient.post(endpoint, { fullName, email, password, role });
        return response.data;
    },

    /**
     * Verify OTP for login
     * @param {string} email - User's email
     * @param {string} otp - 6-digit OTP
     * @param {string} role - admin, hr, or employee
     */
    verifyOTP: async (email, otp, role = 'admin') => {
        let endpoint = '/auth/admin/verify-otp';
        if (role === 'hr') endpoint = '/auth/hr/verify-otp';
        else if (role === 'employee') endpoint = '/auth/employee/verify-otp';
        
        const response = await apiClient.post(endpoint, { email, otp });
        
        // Save token and user data on success
        if (response.data.success && response.data.data?.token) {
            saveToken(response.data.data.token, role);
            if (response.data.data.user) {
                saveUser(response.data.data.user, role);
            }
        }
        
        return response.data;
    },

    /**
     * Resend OTP
     * @param {string} email - User's email
     * @param {string} role - admin, hr, or employee
     */
    resendOTP: async (email, role = 'admin') => {
        let endpoint = '/auth/resend-otp';
        if (role === 'hr') endpoint = '/auth/hr/resend-otp';
        else if (role === 'employee') endpoint = '/auth/resend-otp';
        
        const purpose = role === 'admin' ? 'admin_login' : role === 'hr' ? 'hr_login' : 'employee_login';
        const response = await apiClient.post(endpoint, { email, purpose });
        return response.data;
    },

    /**
     * Get current authenticated user
     */
    getCurrentUser: async () => {
        const response = await apiClient.get('/auth/me');
        return response.data;
    },

    /**
     * Logout
     */
    logout: async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            // Continue with local cleanup even if API fails
        }
        clearSession();
    },

    /**
     * Forgot Password
     * @param {string} fullName - User's full name
     * @param {string} email - User's email
     * @param {string} role - admin, hr, or employee
     */
    forgotPassword: async (fullName, email, role = 'employee') => {
        let endpoint = '/auth/forgot-password';
        if (role === 'hr') endpoint = '/auth/hr/forgot-password';
        
        const response = await apiClient.post(endpoint, { fullName, email, role });
        return response.data;
    },

    /**
     * Verify Password Reset OTP
     * @param {string} email - User's email
     * @param {string} otp - 6-digit OTP
     * @param {string} role - admin, hr, or employee
     */
    verifyResetOTP: async (email, otp, role = 'employee') => {
        let endpoint = '/auth/verify-reset-otp';
        if (role === 'hr') endpoint = '/auth/hr/verify-reset-otp';
        
        const response = await apiClient.post(endpoint, { email, otp });
        return response.data;
    },

    /**
     * Reset Password
     * @param {string} resetToken - Token from OTP verification
     * @param {string} newPassword - New password
     * @param {string} confirmPassword - Confirm new password
     * @param {string} role - admin, hr, or employee
     */
    resetPassword: async (resetToken, newPassword, confirmPassword, role = 'employee') => {
        let endpoint = '/auth/reset-password';
        if (role === 'hr') endpoint = '/auth/hr/reset-password';
        
        const response = await apiClient.post(endpoint, { resetToken, newPassword, confirmPassword });
        return response.data;
    }
};

// ==================== ADMIN DASHBOARD API ====================

const AdminDashboardAPI = {
    /** Get complete dashboard data */
    getDashboard: async () => {
        const response = await apiClient.get('/admin/dashboard');
        return response.data;
    },

    /** Get dashboard summary counts */
    getSummary: async () => {
        const response = await apiClient.get('/admin/dashboard/summary');
        return response.data;
    },

    /** Get attendance overview chart data */
    getAttendanceOverview: async (period = 'week') => {
        const response = await apiClient.get(`/admin/dashboard/attendance-overview?period=${period}`);
        return response.data;
    },

    /** Get user distribution chart data */
    getUserDistribution: async () => {
        const response = await apiClient.get('/admin/dashboard/user-distribution');
        return response.data;
    },

    /** Get payroll statistics chart data */
    getPayrollStatistics: async (year = new Date().getFullYear()) => {
        const response = await apiClient.get(`/admin/dashboard/payroll-statistics?year=${year}`);
        return response.data;
    },

    /** Get leave statistics chart data */
    getLeaveStatistics: async () => {
        const response = await apiClient.get('/admin/dashboard/leave-statistics');
        return response.data;
    },

    /** Get recent activities */
    getRecentActivities: async (limit = 10) => {
        const response = await apiClient.get(`/admin/dashboard/recent-activities?limit=${limit}`);
        return response.data;
    }
};

// ==================== ADMIN USER MANAGEMENT API ====================

const AdminUserAPI = {
    /** Register new user */
    createUser: async (userData) => {
        const response = await apiClient.post('/users', userData);
        return response.data;
    },

    /** Get all users with filters */
    getUsers: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/users${query}`);
        return response.data;
    },

    /** Get user by ID */
    getUserById: async (id) => {
        const response = await apiClient.get(`/users/${id}`);
        return response.data;
    },

    /** Update user */
    updateUser: async (id, userData) => {
        const response = await apiClient.put(`/users/${id}`, userData);
        return response.data;
    },

    /** Suspend user */
    suspendUser: async (id) => {
        const response = await apiClient.patch(`/users/${id}/suspend`);
        return response.data;
    },

    /** Unsuspend user */
    unsuspendUser: async (id) => {
        const response = await apiClient.patch(`/users/${id}/unsuspend`);
        return response.data;
    },

    /** Delete user (soft delete) */
    deleteUser: async (id) => {
        const response = await apiClient.delete(`/users/${id}`);
        return response.data;
    }
};

// ==================== ADMIN ATTENDANCE API ====================

const AdminAttendanceAPI = {
    /** Get attendance dashboard */
    getDashboard: async () => {
        const response = await apiClient.get('/attendance/dashboard');
        return response.data;
    },

    /** Get attendance records with filters */
    getRecords: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/attendance${query}`);
        return response.data;
    },

    /** Get attendance detail by ID */
    getDetail: async (id) => {
        const response = await apiClient.get(`/attendance/${id}`);
        return response.data;
    },

    /** Export attendance as CSV */
    exportCSV: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/attendance/export/csv${query}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `attendance_${new Date().toISOString().split('T')[0]}.csv`);
        return response.data;
    }
};

// ==================== ADMIN PAYROLL API ====================

const AdminPayrollAPI = {
    /** Get payroll dashboard */
    getDashboard: async () => {
        const response = await apiClient.get('/payroll/dashboard');
        return response.data;
    },

    /** Calculate salary preview */
    calculateSalary: async (salaryData) => {
        const response = await apiClient.post('/payroll/calculate', salaryData);
        return response.data;
    },

    /** Save payroll record */
    savePayroll: async (payrollData) => {
        const response = await apiClient.post('/payroll', payrollData);
        return response.data;
    },

    /** Get payroll records */
    getRecords: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/payroll${query}`);
        return response.data;
    },

    /** Get payroll detail */
    getDetail: async (id) => {
        const response = await apiClient.get(`/payroll/${id}`);
        return response.data;
    },

    /** Update payroll */
    updatePayroll: async (id, payrollData) => {
        const response = await apiClient.put(`/payroll/${id}`, payrollData);
        return response.data;
    },

    /** Update payroll status */
    updateStatus: async (id, status) => {
        const response = await apiClient.patch(`/payroll/${id}/status`, { status });
        return response.data;
    },

    /** Generate payslip PDF */
    generatePayslip: async (id) => {
        const response = await apiClient.get(`/payroll/${id}/payslip/pdf`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `payslip_${id}.pdf`);
        return response.data;
    }
};

// ==================== ADMIN PERMISSION API ====================

const AdminPermissionAPI = {
    /** Get all permission requests */
    getPermissions: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/permissions${query}`);
        return response.data;
    },

    /** Get permission detail */
    getDetail: async (id) => {
        const response = await apiClient.get(`/permissions/${id}`);
        return response.data;
    },

    /** View/download supporting document */
    getDocument: async (id) => {
        const response = await apiClient.get(`/permissions/${id}/document`, {
            responseType: 'blob'
        });
        return response.data;
    },

    /** Download supporting document */
    downloadDocument: async (id) => {
        const response = await apiClient.get(`/permissions/${id}/document/download`, {
            responseType: 'blob'
        });
        const filename = response.headers['content-disposition']?.split('filename=')[1] || 'document';
        downloadBlob(response.data, filename.replace(/"/g, ''));
        return response.data;
    },

    /** Approve permission */
    approvePermission: async (id, comment = '') => {
        const response = await apiClient.patch(`/permissions/${id}/approve`, { comment });
        return response.data;
    },

    /** Reject permission */
    rejectPermission: async (id, comment = '') => {
        const response = await apiClient.patch(`/permissions/${id}/reject`, { comment });
        return response.data;
    }
};

// ==================== ADMIN REPORTS API ====================

const AdminReportAPI = {
    /** Daily attendance report */
    dailyAttendance: async (format, date) => {
        const response = await apiClient.get(`/reports/attendance/daily/${format}?date=${date}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `attendance-daily-${date}.${format}`);
        return response.data;
    },

    /** Weekly attendance report */
    weeklyAttendance: async (format, startDate, endDate) => {
        const response = await apiClient.get(`/reports/attendance/weekly/${format}?startDate=${startDate}&endDate=${endDate}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `attendance-weekly-${startDate}-${endDate}.${format}`);
        return response.data;
    },

    /** Monthly attendance report */
    monthlyAttendance: async (format, year, month) => {
        const response = await apiClient.get(`/reports/attendance/monthly/${format}?year=${year}&month=${month}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `attendance-monthly-${year}-${month}.${format}`);
        return response.data;
    },

    /** Monthly payroll report */
    monthlyPayroll: async (format, year, month) => {
        const response = await apiClient.get(`/reports/payroll/monthly-summary/${format}?year=${year}&month=${month}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `payroll-monthly-${year}-${month}.${format}`);
        return response.data;
    },

    /** Employee payroll history report */
    employeePayroll: async (format, employeeId, params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/reports/payroll/employee/${employeeId}/${format}${query}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `payroll-history-${employeeId}.${format}`);
        return response.data;
    },

    /** Permission reports */
    permissionReport: async (format, status) => {
        const response = await apiClient.get(`/reports/permissions/${format}?status=${status}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `permissions-${status}.${format}`);
        return response.data;
    },

    /** User reports */
    userReport: async (format, status) => {
        const response = await apiClient.get(`/reports/users/${format}?status=${status}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `users-${status}.${format}`);
        return response.data;
    }
};

// ==================== ADMIN SETTINGS API ====================

const AdminSettingsAPI = {
    /** Get all settings */
    getAllSettings: async () => {
        const response = await apiClient.get('/settings');
        return response.data;
    },

    /** Get school info */
    getSchoolInfo: async () => {
        const response = await apiClient.get('/settings/school-info');
        return response.data;
    },

    /** Update school info */
    updateSchoolInfo: async (data) => {
        const response = await apiClient.put('/settings/school-info', data);
        return response.data;
    },

    /** Get access control */
    getAccessControl: async () => {
        const response = await apiClient.get('/settings/access-control');
        return response.data;
    },

    /** Update access control */
    updateAccessControl: async (data) => {
        const response = await apiClient.put('/settings/access-control', data);
        return response.data;
    },

    /** Change password */
    changePassword: async (currentPassword, newPassword, confirmPassword) => {
        const response = await apiClient.patch('/settings/security/password', {
            currentPassword, newPassword, confirmPassword
        });
        return response.data;
    },

    /** Get notification settings */
    getNotificationSettings: async () => {
        const response = await apiClient.get('/settings/notifications');
        return response.data;
    },

    /** Update notification settings */
    updateNotificationSettings: async (data) => {
        const response = await apiClient.put('/settings/notifications', data);
        return response.data;
    },

    /** Get appearance */
    getAppearance: async () => {
        const response = await apiClient.get('/settings/appearance');
        return response.data;
    },

    /** Update appearance */
    updateAppearance: async (mode) => {
        const response = await apiClient.put('/settings/appearance', { mode });
        return response.data;
    }
};

// ==================== NOTIFICATIONS API (SHARED) ====================

const NotificationAPI = {
    /** Get notifications */
    getNotifications: async (page = 1, limit = 20) => {
        const response = await apiClient.get(`/notifications?page=${page}&limit=${limit}`);
        return response.data;
    },

    /** Get unread count */
    getUnreadCount: async () => {
        const response = await apiClient.get('/notifications/unread-count');
        return response.data;
    },

    /** Mark one as read */
    markAsRead: async (id) => {
        const response = await apiClient.patch(`/notifications/${id}/read`);
        return response.data;
    },

    /** Mark all as read */
    markAllAsRead: async () => {
        const response = await apiClient.patch('/notifications/read-all');
        return response.data;
    }
};

// ==================== EMPLOYEE ATTENDANCE API ====================

const EmployeeAttendanceAPI = {
    /** Get today's attendance */
    getTodayAttendance: async () => {
        const response = await apiClient.get('/employee/attendance/today');
        return response.data;
    },

    /** Verify location */
    verifyLocation: async (latitude, longitude, accuracy) => {
        const response = await apiClient.post('/employee/attendance/verify-location', {
            latitude, longitude, accuracy
        });
        return response.data;
    },

    /** Check In */
    checkIn: async (latitude, longitude, accuracy) => {
        const response = await apiClient.post('/employee/attendance/check-in', {
            latitude, longitude, accuracy
        });
        return response.data;
    },

    /** Check Out */
    checkOut: async (latitude, longitude, accuracy) => {
        const response = await apiClient.post('/employee/attendance/check-out', {
            latitude, longitude, accuracy
        });
        return response.data;
    },

    /** Get attendance history */
    getHistory: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/employee/attendance/history${query}`);
        return response.data;
    },

    /** Get attendance detail */
    getDetail: async (id) => {
        const response = await apiClient.get(`/employee/attendance/${id}`);
        return response.data;
    },

    /** Export attendance CSV */
    exportCSV: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/employee/attendance/export${query}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `my-attendance-${new Date().toISOString().split('T')[0]}.csv`);
        return response.data;
    }
};

// ==================== EMPLOYEE PAYROLL API ====================

const EmployeePayrollAPI = {
    /** Get latest salary details */
    getLatestPayroll: async () => {
        const response = await apiClient.get('/employee/payroll/latest');
        return response.data;
    },

    /** Get payroll history */
    getHistory: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/employee/payroll${query}`);
        return response.data;
    },

    /** Get payroll detail */
    getDetail: async (id) => {
        const response = await apiClient.get(`/employee/payroll/${id}`);
        return response.data;
    },

    /** View payslip data */
    viewPayslip: async (id) => {
        const response = await apiClient.get(`/employee/payroll/${id}/payslip`);
        return response.data;
    },

    /** Download payslip PDF */
    downloadPayslip: async (id) => {
        const response = await apiClient.get(`/employee/payroll/${id}/payslip/pdf`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `payslip-${id}.pdf`);
        return response.data;
    }
};

// ==================== EMPLOYEE PERMISSION API ====================

const EmployeePermissionAPI = {
    /** Submit permission request */
    submitRequest: async (data, file = null) => {
        const formData = createFormData(data, 'supportingDocument');
        if (file) formData.set('supportingDocument', file);
        
        const response = await apiClient.post('/employee/permissions', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    /** Get permission history */
    getHistory: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/employee/permissions${query}`);
        return response.data;
    },

    /** Get permission detail */
    getDetail: async (id) => {
        const response = await apiClient.get(`/employee/permissions/${id}`);
        return response.data;
    },

    /** View supporting document */
    viewDocument: async (id) => {
        const response = await apiClient.get(`/employee/permissions/${id}/document`, {
            responseType: 'blob'
        });
        return response.data;
    },

    /** Cancel pending request */
    cancelRequest: async (id) => {
        const response = await apiClient.patch(`/employee/permissions/${id}/cancel`);
        return response.data;
    }
};

// ==================== EMPLOYEE SETTINGS API ====================

const EmployeeSettingsAPI = {
    getProfile: async () => {
        const response = await apiClient.get('/employee/settings/profile');
        return response.data;
    },

    updateProfile: async (data) => {
        const response = await apiClient.put('/employee/settings/profile', data);
        return response.data;
    },

    changePassword: async (currentPassword, newPassword, confirmPassword) => {
        const response = await apiClient.put('/employee/settings/password', {
            currentPassword, newPassword, confirmPassword
        });
        return response.data;
    },

    getNotifications: async () => {
        const response = await apiClient.get('/employee/settings/notifications');
        return response.data;
    },

    updateNotifications: async (data) => {
        const response = await apiClient.put('/employee/settings/notifications', data);
        return response.data;
    },

    getAppearance: async () => {
        const response = await apiClient.get('/employee/settings/appearance');
        return response.data;
    },

    updateAppearance: async (mode) => {
        const response = await apiClient.put('/employee/settings/appearance', { mode });
        return response.data;
    }
};

// ==================== HR DASHBOARD API ====================

const HRDashboardAPI = {
    /** Get complete HR dashboard */
    getDashboard: async () => {
        const response = await apiClient.get('/hr/dashboard');
        return response.data;
    },

    /** Get attendance overview chart */
    getAttendanceOverview: async () => {
        const response = await apiClient.get('/hr/dashboard/attendance-overview');
        return response.data;
    },

    /** Get leave distribution chart */
    getLeaveDistribution: async () => {
        const response = await apiClient.get('/hr/dashboard/leave-distribution');
        return response.data;
    },

    /** Get recent activities */
    getRecentActivities: async (limit = 10) => {
        const response = await apiClient.get(`/hr/dashboard/recent-activities?limit=${limit}`);
        return response.data;
    },

    /** Get quick actions */
    getQuickActions: async () => {
        const response = await apiClient.get('/hr/dashboard/quick-actions');
        return response.data;
    },

    /** Get HR notifications */
    getNotifications: async (page = 1, limit = 20) => {
        const response = await apiClient.get(`/hr/dashboard/notifications?page=${page}&limit=${limit}`);
        return response.data;
    },

    /** Mark all notifications read */
    markAllNotificationsRead: async () => {
        const response = await apiClient.patch('/hr/dashboard/notifications/read-all');
        return response.data;
    }
};

// ==================== HR EMPLOYEE RECORDS API ====================

const HREmployeeAPI = {
    /** Register new employee */
    registerEmployee: async (data) => {
        const response = await apiClient.post('/hr/employees', data);
        return response.data;
    },

    /** Get all employees */
    getEmployees: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/employees${query}`);
        return response.data;
    },

    /** Get employee detail */
    getEmployeeDetail: async (id) => {
        const response = await apiClient.get(`/hr/employees/${id}`);
        return response.data;
    },

    /** Update employee */
    updateEmployee: async (id, data) => {
        const response = await apiClient.put(`/hr/employees/${id}`, data);
        return response.data;
    },

    /** Get employee attendance history */
    getEmployeeAttendance: async (id, params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/employees/${id}/attendance${query}`);
        return response.data;
    },

    /** Get employee payroll history */
    getEmployeePayroll: async (id, params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/employees/${id}/payroll${query}`);
        return response.data;
    },

    /** Get employee permission history */
    getEmployeePermissions: async (id, params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/employees/${id}/permissions${query}`);
        return response.data;
    },

    /** Get departments list */
    getDepartments: async () => {
        const response = await apiClient.get('/hr/departments');
        return response.data;
    }
};

// ==================== HR ATTENDANCE API ====================

const HRAttendanceAPI = {
    /** Get my attendance */
    getMyAttendance: async () => {
        const response = await apiClient.get('/hr/attendance/my-attendance');
        return response.data;
    },

    /** Check In */
    checkIn: async (latitude, longitude, accuracy) => {
        const response = await apiClient.post('/hr/attendance/check-in', {
            latitude, longitude, accuracy
        });
        return response.data;
    },

    /** Check Out */
    checkOut: async (latitude, longitude, accuracy) => {
        const response = await apiClient.post('/hr/attendance/check-out', {
            latitude, longitude, accuracy
        });
        return response.data;
    },

    /** Get all employee attendance */
    getAllAttendance: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/attendance${query}`);
        return response.data;
    },

    /** Export attendance CSV */
    exportAttendance: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/attendance/export${query}`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `attendance-export-${new Date().toISOString().split('T')[0]}.csv`);
        return response.data;
    }
};

// ==================== HR PERMISSION API ====================

const HRPermissionAPI = {
    /** Get all permission requests */
    getPermissions: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/permissions${query}`);
        return response.data;
    },

    /** Get permission detail */
    getDetail: async (id) => {
        const response = await apiClient.get(`/hr/permissions/${id}`);
        return response.data;
    },

    /** Download supporting document */
    getDocument: async (id) => {
        const response = await apiClient.get(`/hr/permissions/${id}/document`, {
            responseType: 'blob'
        });
        const filename = `document-${id}`;
        downloadBlob(response.data, filename);
        return response.data;
    },

    /** Approve permission */
    approvePermission: async (id, comment = '') => {
        const response = await apiClient.patch(`/hr/permissions/${id}/approve`, { comment });
        return response.data;
    },

    /** Reject permission */
    rejectPermission: async (id, comment = '') => {
        const response = await apiClient.patch(`/hr/permissions/${id}/reject`, { comment });
        return response.data;
    }
};

// ==================== HR PAYROLL API ====================

const HRPayrollAPI = {
    /** Calculate salary preview */
    calculateSalary: async (data) => {
        const response = await apiClient.post('/hr/payroll/calculate', data);
        return response.data;
    },

    /** Save payroll */
    savePayroll: async (data) => {
        const response = await apiClient.post('/hr/payroll', data);
        return response.data;
    },

    /** Get payroll history */
    getHistory: async (params = {}) => {
        const query = buildQuery(params);
        const response = await apiClient.get(`/hr/payroll${query}`);
        return response.data;
    },

    /** View payslip data */
    viewPayslip: async (id) => {
        const response = await apiClient.get(`/hr/payroll/${id}/payslip`);
        return response.data;
    },

    /** Download payslip PDF */
    downloadPayslip: async (id) => {
        const response = await apiClient.get(`/hr/payroll/${id}/payslip/pdf`, {
            responseType: 'blob'
        });
        downloadBlob(response.data, `payslip-${id}.pdf`);
        return response.data;
    },

    /** Update payroll status */
    updateStatus: async (id, status) => {
        const response = await apiClient.patch(`/hr/payroll/${id}/status`, { status });
        return response.data;
    }
};

// ==================== HR SETTINGS API ====================

const HRSettingsAPI = {
    getProfile: async () => {
        const response = await apiClient.get('/hr/settings/profile');
        return response.data;
    },

    updateProfile: async (data) => {
        const response = await apiClient.put('/hr/settings/profile', data);
        return response.data;
    },

    changePassword: async (currentPassword, newPassword, confirmPassword) => {
        const response = await apiClient.put('/hr/settings/password', {
            currentPassword, newPassword, confirmPassword
        });
        return response.data;
    },

    getNotifications: async () => {
        const response = await apiClient.get('/hr/settings/notifications');
        return response.data;
    },

    updateNotifications: async (data) => {
        const response = await apiClient.put('/hr/settings/notifications', data);
        return response.data;
    },

    getAppearance: async () => {
        const response = await apiClient.get('/hr/settings/appearance');
        return response.data;
    },

    updateAppearance: async (mode) => {
        const response = await apiClient.put('/hr/settings/appearance', { mode });
        return response.data;
    }
};

// ==================== EXPORT ALL MODULES ====================

// Named exports for tree-shaking
export {
    apiClient,
    AuthAPI,
    NotificationAPI,
    AdminDashboardAPI,
    AdminUserAPI,
    AdminAttendanceAPI,
    AdminPayrollAPI,
    AdminPermissionAPI,
    AdminReportAPI,
    AdminSettingsAPI,
    EmployeeAttendanceAPI,
    EmployeePayrollAPI,
    EmployeePermissionAPI,
    EmployeeSettingsAPI,
    HRDashboardAPI,
    HREmployeeAPI,
    HRAttendanceAPI,
    HRPermissionAPI,
    HRPayrollAPI,
    HRSettingsAPI,
    getToken,
    saveToken,
    saveUser,
    getStoredUser,
    clearSession,
    buildQuery,
    downloadBlob,
    handleSessionExpiry
};

// Default export for convenience
export default {
    apiClient,
    Auth: AuthAPI,
    Notifications: NotificationAPI,
    Admin: {
        Dashboard: AdminDashboardAPI,
        Users: AdminUserAPI,
        Attendance: AdminAttendanceAPI,
        Payroll: AdminPayrollAPI,
        Permissions: AdminPermissionAPI,
        Reports: AdminReportAPI,
        Settings: AdminSettingsAPI
    },
    Employee: {
        Attendance: EmployeeAttendanceAPI,
        Payroll: EmployeePayrollAPI,
        Permissions: EmployeePermissionAPI,
        Settings: EmployeeSettingsAPI
    },
    HR: {
        Dashboard: HRDashboardAPI,
        Employees: HREmployeeAPI,
        Attendance: HRAttendanceAPI,
        Permissions: HRPermissionAPI,
        Payroll: HRPayrollAPI,
        Settings: HRSettingsAPI
    },
    utils: {
        getToken,
        saveToken,
        saveUser,
        getStoredUser,
        clearSession,
        buildQuery,
        downloadBlob
    }
};