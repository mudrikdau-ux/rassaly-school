// index.js - Rasally School Staff Management System
// Connected to Backend API (http://localhost:5000/api)

(function() {
    'use strict';

    // ============================================
    // API CONFIGURATION
    // ============================================
    const API_BASE_URL = 'http://localhost:5000/api';

    // ============================================
    // API HELPER FUNCTIONS
    // ============================================
    function getToken() {
        return localStorage.getItem('token') || localStorage.getItem('auth_token') || 
               localStorage.getItem('hrToken') || localStorage.getItem('employeeToken');
    }

    function saveToken(token, role) {
        if (role === 'hr') {
            localStorage.setItem('hrToken', token);
        } else if (role === 'employee') {
            localStorage.setItem('employeeToken', token);
        } else {
            localStorage.setItem('token', token);
            localStorage.setItem('auth_token', token);
        }
    }

    function saveUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('hrToken');
        localStorage.removeItem('employeeToken');
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
    }

    async function apiRequest(endpoint, method = 'POST', data = null, isBlob = false) {
        const token = getToken();
        const headers = {};
        
        if (!(data instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            method: method,
            headers: headers
        };

        if (data) {
            options.body = data instanceof FormData ? data : JSON.stringify(data);
        }

        const fullUrl = `${API_BASE_URL}${endpoint}`;
        console.log(`📡 ${method} ${fullUrl}`, data);

        try {
            const response = await fetch(fullUrl, options);
            
            if (isBlob) {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Download failed');
                }
                return response;
            }

            const result = await response.json();
            console.log(`📥 Response:`, result);
            
            if (!response.ok) {
                if (response.status === 401) {
                    clearSession();
                }
                throw new Error(result.message || `Request failed with status ${response.status}`);
            }
            return result;
        } catch (error) {
            console.error(`❌ API Error [${endpoint}]:`, error.message);
            if (error.message === 'Failed to fetch') {
                throw new Error('Unable to connect to server. Please check that the backend is running on port 5000.');
            }
            throw error;
        }
    }

    // ============================================
    // AUTH API FUNCTIONS
    // ============================================
    const AuthAPI = {
        login: async (fullName, email, password, role) => {
            let endpoint;
            if (role === 'hr') {
                endpoint = '/auth/hr/login';
            } else if (role === 'employee') {
                endpoint = '/auth/employee/login';
            } else {
                endpoint = '/auth/admin/request-otp';
            }
            console.log('🔑 Login attempt - Role:', role, 'Endpoint:', endpoint);
            return await apiRequest(endpoint, 'POST', { fullName, email, password, role });
        },

        verifyOTP: async (email, otp, role) => {
            let endpoint;
            if (role === 'hr') {
                endpoint = '/auth/hr/verify-otp';
            } else if (role === 'employee') {
                endpoint = '/auth/employee/verify-otp';
            } else {
                endpoint = '/auth/admin/verify-otp';
            }
            console.log('🔐 Verify OTP - Role:', role, 'Endpoint:', endpoint);
            const result = await apiRequest(endpoint, 'POST', { email, otp });
            if (result.success && result.data?.token) {
                saveToken(result.data.token, role);
                if (result.data.user) saveUser(result.data.user);
            }
            return result;
        },

        resendOTP: async (email, role) => {
            let endpoint = '/auth/resend-otp';
            if (role === 'hr') endpoint = '/auth/hr/resend-otp';
            const purpose = role === 'admin' ? 'admin_login' : role === 'hr' ? 'hr_login' : 'employee_login';
            return await apiRequest(endpoint, 'POST', { email, purpose });
        },

        forgotPassword: async (fullName, email, role) => {
            let endpoint = '/auth/forgot-password';
            if (role === 'hr') endpoint = '/auth/hr/forgot-password';
            return await apiRequest(endpoint, 'POST', { fullName, email, role });
        },

        verifyResetOTP: async (email, otp, role) => {
            let endpoint = '/auth/verify-reset-otp';
            if (role === 'hr') endpoint = '/auth/hr/verify-reset-otp';
            return await apiRequest(endpoint, 'POST', { email, otp });
        },

        resetPassword: async (resetToken, newPassword, confirmPassword, role) => {
            let endpoint = '/auth/reset-password';
            if (role === 'hr') endpoint = '/auth/hr/reset-password';
            return await apiRequest(endpoint, 'POST', { resetToken, newPassword, confirmPassword });
        },

        getCurrentUser: async () => {
            return await apiRequest('/auth/me', 'GET');
        }
    };

    // ============================================
    // DOM ELEMENTS - Login Form
    // ============================================
    const form = document.getElementById('staffLoginForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const roleSelect = document.getElementById('userRole');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const eyeIcon = document.getElementById('eyeIcon');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const loginBtn = document.getElementById('loginBtn');
    const otpField = document.getElementById('otpField');
    const otpInputContainer = document.getElementById('otpInputContainer');
    const otpNotification = document.getElementById('otpNotification');
    const otpSuccessMsg = document.getElementById('otpSuccess');
    const countdownSpan = document.getElementById('countdownTimer');
    const nameError = document.getElementById('nameError');
    const emailError = document.getElementById('emailError');
    const roleError = document.getElementById('roleError');
    const passwordError = document.getElementById('passwordError');
    const otpError = document.getElementById('otpError');
    const formGeneralMessage = document.getElementById('formGeneralMessage');
    const otpSpinner = document.getElementById('otpSpinner');
    const loginSpinner = document.getElementById('loginSpinner');

    // Forgot Password Modal
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeForgotPasswordModal = document.getElementById('closeForgotPasswordModal');
    const recoveryStep1 = document.getElementById('recoveryStep1');
    const recoveryAdminStep = document.getElementById('recoveryAdminStep');
    const recoveryStep3 = document.getElementById('recoveryStep3');
    const recoveryStep4 = document.getElementById('recoveryStep4');
    const recoveryStep5 = document.getElementById('recoveryStep5');
    const recoveryIdentityForm = document.getElementById('recoveryIdentityForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const recoveryFullName = document.getElementById('recoveryFullName');
    const recoveryEmail = document.getElementById('recoveryEmail');
    const recoveryRole = document.getElementById('recoveryRole');
    const recoveryOtpField = document.getElementById('recoveryOtpField');
    const recoveryNewPassword = document.getElementById('recoveryNewPassword');
    const recoveryConfirmPassword = document.getElementById('recoveryConfirmPassword');
    const verifyIdentityBtn = document.getElementById('verifyIdentityBtn');
    const verifyRecoveryOtpBtn = document.getElementById('verifyRecoveryOtpBtn');
    const resendRecoveryOtpBtn = document.getElementById('resendRecoveryOtpBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const backToLoginFromAdmin = document.getElementById('backToLoginFromAdmin');
    const backToLoginFromSuccess = document.getElementById('backToLoginFromSuccess');
    const toggleRecoveryPasswordBtn = document.getElementById('toggleRecoveryPasswordBtn');
    const toggleRecoveryConfirmPasswordBtn = document.getElementById('toggleRecoveryConfirmPasswordBtn');
    const recoveryOtpEmail = document.getElementById('recoveryOtpEmail');
    const recoveryCountdownTimer = document.getElementById('recoveryCountdownTimer');
    const recoveryIdentityMessage = document.getElementById('recoveryIdentityMessage');
    const recoveryOtpMessage = document.getElementById('recoveryOtpMessage');
    const resetPasswordMessage = document.getElementById('resetPasswordMessage');
    const recoveryNameError = document.getElementById('recoveryNameError');
    const recoveryEmailError = document.getElementById('recoveryEmailError');
    const recoveryRoleError = document.getElementById('recoveryRoleError');
    const recoveryOtpError = document.getElementById('recoveryOtpError');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const identitySpinner = document.getElementById('identitySpinner');
    const resetSpinner = document.getElementById('resetSpinner');

    // ============================================
    // STATE
    // ============================================
    const ROLE_MAP = { 'Admin': 'admin', 'HR Officer': 'hr', 'Employee': 'employee' };
    let otpVerified = false;
    let isOtpSent = false;
    let currentLoginRole = null;
    let currentLoginEmail = null;
    let countdownInterval = null;
    let countdownValue = 0;
    let isPasswordVisible = false;
    let isRecoveryPasswordVisible = false;
    let isRecoveryConfirmPasswordVisible = false;
    let recoveryData = { resetToken: null, role: null, email: null };
    let recoveryCountdownInterval = null;
    let recoveryCountdownValue = 0;

    // ============================================
    // HELPERS
    // ============================================
    function showToast(message, type) {
        type = type || 'info';
        var existingToasts = document.querySelectorAll('.custom-toast');
        existingToasts.forEach(function(t) { t.remove(); });
        var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        var colors = { success: '#2f855a', error: '#c53030', warning: '#d69e2e', info: '#2b6cb0' };
        var toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerHTML = '<div class="toast-content"><span class="toast-icon">' + (icons[type] || icons.info) + '</span><span class="toast-message">' + message + '</span></div><button class="toast-close">&times;</button>';
        toast.style.cssText = 'position:fixed;top:20px;right:20px;padding:16px 24px;background:' + (colors[type] || colors.info) + ';color:white;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);z-index:10000;font-family:Inter,sans-serif;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:320px;max-width:500px;animation:slideInRight 0.4s ease;border:none;';
        document.body.appendChild(toast);
        toast.querySelector('.toast-close').onclick = function() { toast.style.animation = 'slideOutRight 0.3s ease'; setTimeout(function() { toast.remove(); }, 300); };
        setTimeout(function() { if (toast.parentNode) { toast.style.animation = 'slideOutRight 0.3s ease'; setTimeout(function() { toast.remove(); }, 300); } }, 5000);
    }

    function clearErrors() {
        [nameError, emailError, roleError, passwordError, otpError, formGeneralMessage].forEach(function(el) { if (el) el.textContent = ''; });
    }

    function showError(el, msg) { if (el) el.textContent = msg; }

    function validateName() {
        if (!fullNameInput) return false;
        var v = fullNameInput.value.trim();
        if (!v) { showError(nameError, 'Full name is required.'); return false; }
        if (v.length < 3) { showError(nameError, 'Name must be at least 3 characters.'); return false; }
        showError(nameError, ''); return true;
    }

    function validateEmail() {
        if (!emailInput) return false;
        var v = emailInput.value.trim();
        if (!v) { showError(emailError, 'Email is required.'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { showError(emailError, 'Please enter a valid email.'); return false; }
        showError(emailError, ''); return true;
    }

    function validateRole() {
        if (!roleSelect) return false;
        if (!roleSelect.value) { showError(roleError, 'Please select a role.'); return false; }
        showError(roleError, ''); return true;
    }

    function validatePassword() {
        if (!passwordInput) return false;
        var v = passwordInput.value;
        if (!v) { showError(passwordError, 'Password is required.'); return false; }
        if (v.length < 6) { showError(passwordError, 'Password must be at least 6 characters.'); return false; }
        showError(passwordError, ''); return true;
    }

    function validatePreOtp() { return validateName() && validateEmail() && validateRole() && validatePassword(); }

    function resetOtpState() {
        otpVerified = false; isOtpSent = false; currentLoginRole = null; currentLoginEmail = null;
        if (otpField) otpField.value = '';
        if (otpInputContainer) otpInputContainer.classList.add('hidden');
        if (otpSuccessMsg) otpSuccessMsg.classList.add('hidden');
        if (otpNotification) otpNotification.innerHTML = '';
        if (verifyOtpBtn) verifyOtpBtn.disabled = false;
        if (loginBtn) loginBtn.disabled = true;
        stopCountdown();
        if (resendOtpBtn) resendOtpBtn.classList.add('hidden');
        if (sendOtpBtn) { sendOtpBtn.classList.remove('hidden'); sendOtpBtn.disabled = false; }
        if (otpError) otpError.textContent = '';
        if (otpField) { otpField.style.borderColor = ''; otpField.style.backgroundColor = ''; }
    }

    function stopCountdown() {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        countdownValue = 0;
        if (countdownSpan) countdownSpan.textContent = '';
    }

    function startCountdown(seconds) {
        seconds = seconds || 60;
        stopCountdown();
        countdownValue = seconds;
        if (resendOtpBtn) { resendOtpBtn.classList.remove('hidden'); resendOtpBtn.disabled = true; }
        if (countdownSpan) countdownSpan.textContent = '(' + countdownValue + 's)';
        countdownInterval = setInterval(function() {
            countdownValue--;
            if (countdownValue <= 0) { stopCountdown(); if (resendOtpBtn) resendOtpBtn.disabled = false; if (countdownSpan) countdownSpan.textContent = ''; return; }
            if (countdownSpan) countdownSpan.textContent = '(' + countdownValue + 's)';
        }, 1000);
    }

    function redirectBasedOnRole(role) {
        var r = typeof role === 'string' ? role.toLowerCase() : role;
        if (r === 'admin') window.location.href = 'admin.html';
        else if (r === 'hr') window.location.href = 'hr.html';
        else window.location.href = 'employee.html';
    }

    // ============================================
    // SEND OTP
    // ============================================
    async function sendOtpHandler(e) {
        if (e) e.preventDefault();
        clearErrors();
        if (!validatePreOtp()) { if (formGeneralMessage) formGeneralMessage.textContent = 'Please fill all required fields correctly.'; return; }

        var fullName = fullNameInput.value.trim();
        var email = emailInput.value.trim();
        var password = passwordInput.value;
        var backendRole = ROLE_MAP[roleSelect.value] || 'employee';

        console.log('📤 Sending OTP request...');
        console.log('   Role:', roleSelect.value, '→ Backend:', backendRole);
        console.log('   Email:', email);
        console.log('   Endpoint will be:', backendRole === 'admin' ? '/auth/admin/request-otp' : backendRole === 'hr' ? '/auth/hr/login' : '/auth/employee/login');

        try {
            if (sendOtpBtn) { sendOtpBtn.disabled = true; }
            if (otpSpinner) otpSpinner.classList.remove('hidden');
            if (sendOtpBtn) sendOtpBtn.querySelector('.btn-text').textContent = 'Sending...';

            var response = await AuthAPI.login(fullName, email, password, backendRole);

            console.log('✅ OTP Response:', response);

            if (response.success) {
                isOtpSent = true;
                currentLoginRole = backendRole;
                currentLoginEmail = email;
                otpVerified = false;
                if (otpInputContainer) otpInputContainer.classList.remove('hidden');
                if (otpSuccessMsg) otpSuccessMsg.classList.add('hidden');
                if (loginBtn) loginBtn.disabled = true;
                if (otpField) { otpField.value = ''; otpField.focus(); }
                if (otpError) otpError.textContent = '';
                if (sendOtpBtn) sendOtpBtn.classList.add('hidden');
                if (resendOtpBtn) resendOtpBtn.classList.remove('hidden');
                if (formGeneralMessage) formGeneralMessage.textContent = '';
                if (otpNotification) {
                    otpNotification.innerHTML = '<div style="background:#fef3e0;padding:12px;border-radius:8px;border-left:4px solid #f0b84d;"><p style="margin:0;font-weight:600;color:#0a2540;">✅ Verification code sent to <strong>' + email + '</strong></p><p style="margin:8px 0 0 0;font-size:12px;color:#4a5568;">Please check your email. Code expires in 10 minutes.</p></div>';
                }
                startCountdown(60);
                showToast('Verification code sent!', 'success');
            }
        } catch (error) {
            console.error('❌ Send OTP Error:', error.message);
            var msg = error.message || 'Failed to send verification code.';
            if (formGeneralMessage) formGeneralMessage.textContent = msg;
            showToast(msg, 'error');
        } finally {
            if (sendOtpBtn) { sendOtpBtn.disabled = false; }
            if (otpSpinner) otpSpinner.classList.add('hidden');
            if (sendOtpBtn) sendOtpBtn.querySelector('.btn-text').textContent = 'Send Verification Code';
        }
    }

    // ============================================
    // RESEND OTP
    // ============================================
    async function resendOtpHandler(e) {
        if (e) e.preventDefault();
        if (countdownValue > 0 || !currentLoginEmail) return;
        if (!validatePreOtp()) return;
        if (resendOtpBtn) resendOtpBtn.disabled = true;
        try {
            var response = await AuthAPI.resendOTP(currentLoginEmail, currentLoginRole);
            if (response.success) {
                if (otpField) { otpField.value = ''; otpField.focus(); }
                otpVerified = false;
                if (otpSuccessMsg) otpSuccessMsg.classList.add('hidden');
                if (loginBtn) loginBtn.disabled = true;
                if (otpError) otpError.textContent = '';
                startCountdown(60);
                showToast('New code sent!', 'success');
            }
        } catch (error) {
            showToast(error.message || 'Failed to resend code.', 'error');
        } finally {
            if (resendOtpBtn && countdownValue <= 0) resendOtpBtn.disabled = false;
        }
    }

    // ============================================
    // VERIFY OTP
    // ============================================
    async function verifyOtpHandler(e) {
        if (e) e.preventDefault();
        if (!otpField) return;
        var enteredOtp = otpField.value.trim();
        if (!enteredOtp || enteredOtp.length !== 6 || !/^\d{6}$/.test(enteredOtp)) {
            showError(otpError, 'Please enter a valid 6-digit code.');
            otpField.style.borderColor = '#e53e3e';
            otpField.style.backgroundColor = '#fff5f5';
            return;
        }
        try {
            if (verifyOtpBtn) verifyOtpBtn.disabled = true;
            var response = await AuthAPI.verifyOTP(currentLoginEmail, enteredOtp, currentLoginRole);
            if (response.success) {
                otpVerified = true;
                if (otpSuccessMsg) otpSuccessMsg.classList.remove('hidden');
                showError(otpError, '');
                if (loginBtn) loginBtn.disabled = false;
                if (verifyOtpBtn) verifyOtpBtn.disabled = true;
                if (formGeneralMessage) formGeneralMessage.textContent = '';
                otpField.style.borderColor = '#38a169';
                otpField.style.backgroundColor = '#f0fff4';
                stopCountdown();
                showToast('Email verified!', 'success');
            }
        } catch (error) {
            otpVerified = false;
            if (otpSuccessMsg) otpSuccessMsg.classList.add('hidden');
            if (loginBtn) loginBtn.disabled = true;
            showError(otpError, error.message || 'Invalid verification code.');
            otpField.style.borderColor = '#e53e3e';
            otpField.style.backgroundColor = '#fff5f5';
            otpField.style.animation = 'shake 0.5s ease';
            setTimeout(function() { otpField.style.animation = ''; }, 500);
            otpField.value = '';
            otpField.focus();
        } finally {
            if (verifyOtpBtn) verifyOtpBtn.disabled = false;
        }
    }

    // ============================================
    // LOGIN
    // ============================================
    async function handleLogin(e) {
        e.preventDefault();
        clearErrors();
        if (!validateName() || !validateEmail() || !validateRole() || !validatePassword()) {
            if (formGeneralMessage) formGeneralMessage.textContent = 'Please complete all fields correctly.';
            return;
        }
        if (!otpVerified) {
            if (formGeneralMessage) formGeneralMessage.textContent = 'You must verify your email with OTP before login.';
            return;
        }
        if (loginBtn) { loginBtn.disabled = true; }
        if (loginSpinner) loginSpinner.classList.remove('hidden');
        if (loginBtn) loginBtn.querySelector('.btn-text').textContent = 'Authenticating...';
        try {
            showToast('Login successful! Redirecting...', 'success');
            setTimeout(function() { redirectBasedOnRole(currentLoginRole || 'employee'); }, 800);
        } catch (error) {
            showToast(error.message || 'Login failed.', 'error');
        } finally {
            if (loginBtn) { loginBtn.disabled = false; }
            if (loginSpinner) loginSpinner.classList.add('hidden');
            if (loginBtn) loginBtn.querySelector('.btn-text').textContent = 'Login to System';
        }
    }

    // ============================================
    // FORGOT PASSWORD
    // ============================================
    function openForgotPasswordModal() {
        if (!forgotPasswordModal) return;
        forgotPasswordModal.classList.remove('hidden');
        resetRecoveryUI();
        showRecoveryStep('step1');
        document.body.style.overflow = 'hidden';
    }

    function closeForgotPasswordModalHandler() {
        if (forgotPasswordModal) forgotPasswordModal.classList.add('hidden');
        document.body.style.overflow = '';
        resetRecoveryUI();
    }

    function resetRecoveryUI() {
        recoveryData = { resetToken: null, role: null, email: null };
        [recoveryFullName, recoveryEmail, recoveryRole, recoveryOtpField, recoveryNewPassword, recoveryConfirmPassword].forEach(function(el) { if (el) el.value = ''; });
        if (recoveryNewPassword) recoveryNewPassword.type = 'password';
        if (recoveryConfirmPassword) recoveryConfirmPassword.type = 'password';
        [recoveryNameError, recoveryEmailError, recoveryRoleError, recoveryOtpError, newPasswordError, confirmPasswordError].forEach(function(el) { if (el) el.textContent = ''; });
        [recoveryIdentityMessage, recoveryOtpMessage, resetPasswordMessage].forEach(function(el) { if (el) { el.textContent = ''; el.style.color = ''; } });
        stopRecoveryCountdown();
        if (resendRecoveryOtpBtn) resendRecoveryOtpBtn.disabled = false;
        if (recoveryCountdownTimer) recoveryCountdownTimer.textContent = '';
    }

    function showRecoveryStep(step) {
        [recoveryStep1, recoveryAdminStep, recoveryStep3, recoveryStep4, recoveryStep5].forEach(function(s) { if (s) s.classList.add('hidden'); });
        if (step === 'step1' && recoveryStep1) recoveryStep1.classList.remove('hidden');
        if (step === 'admin' && recoveryAdminStep) recoveryAdminStep.classList.remove('hidden');
        if (step === 'step3' && recoveryStep3) recoveryStep3.classList.remove('hidden');
        if (step === 'step4' && recoveryStep4) recoveryStep4.classList.remove('hidden');
        if (step === 'step5' && recoveryStep5) recoveryStep5.classList.remove('hidden');
    }

    function stopRecoveryCountdown() {
        if (recoveryCountdownInterval) { clearInterval(recoveryCountdownInterval); recoveryCountdownInterval = null; }
        recoveryCountdownValue = 0;
        if (recoveryCountdownTimer) recoveryCountdownTimer.textContent = '';
    }

    function startRecoveryCountdown(seconds) {
        seconds = seconds || 60;
        stopRecoveryCountdown();
        recoveryCountdownValue = seconds;
        if (resendRecoveryOtpBtn) resendRecoveryOtpBtn.disabled = true;
        if (recoveryCountdownTimer) recoveryCountdownTimer.textContent = '(' + recoveryCountdownValue + 's)';
        recoveryCountdownInterval = setInterval(function() {
            recoveryCountdownValue--;
            if (recoveryCountdownTimer) recoveryCountdownTimer.textContent = '(' + recoveryCountdownValue + 's)';
            if (recoveryCountdownValue <= 0) { stopRecoveryCountdown(); if (resendRecoveryOtpBtn) resendRecoveryOtpBtn.disabled = false; if (recoveryCountdownTimer) recoveryCountdownTimer.textContent = ''; }
        }, 1000);
    }

    function validateRecoveryIdentity() {
        var valid = true;
        var name = recoveryFullName ? recoveryFullName.value.trim() : '';
        var email = recoveryEmail ? recoveryEmail.value.trim() : '';
        var role = recoveryRole ? recoveryRole.value : '';
        if (!name || name.length < 3) { if (recoveryNameError) recoveryNameError.textContent = 'Full name is required (min 3 chars).'; valid = false; } else { if (recoveryNameError) recoveryNameError.textContent = ''; }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (recoveryEmailError) recoveryEmailError.textContent = 'Valid email is required.'; valid = false; } else { if (recoveryEmailError) recoveryEmailError.textContent = ''; }
        if (!role) { if (recoveryRoleError) recoveryRoleError.textContent = 'Please select a role.'; valid = false; } else { if (recoveryRoleError) recoveryRoleError.textContent = ''; }
        return valid;
    }

    async function handleVerifyIdentity(e) {
        e.preventDefault();
        if (!validateRecoveryIdentity()) return;
        var displayRole = recoveryRole.value;
        if (displayRole === 'Admin') { showRecoveryStep('admin'); return; }
        var backendRole = ROLE_MAP[displayRole];
        var fullName = recoveryFullName.value.trim();
        var email = recoveryEmail.value.trim();
        if (!backendRole || (backendRole !== 'employee' && backendRole !== 'hr')) {
            if (recoveryIdentityMessage) { recoveryIdentityMessage.textContent = 'Invalid role.'; recoveryIdentityMessage.style.color = '#c53030'; }
            return;
        }
        try {
            if (verifyIdentityBtn) { verifyIdentityBtn.disabled = true; }
            if (identitySpinner) identitySpinner.classList.remove('hidden');
            if (verifyIdentityBtn) verifyIdentityBtn.querySelector('.btn-text').textContent = 'Sending...';
            if (recoveryIdentityMessage) { recoveryIdentityMessage.textContent = ''; recoveryIdentityMessage.style.color = ''; }
            var response = await AuthAPI.forgotPassword(fullName, email, backendRole);
            if (response.success) {
                recoveryData.role = backendRole;
                recoveryData.email = email;
                if (recoveryOtpEmail) recoveryOtpEmail.textContent = email;
                showRecoveryStep('step3');
                if (recoveryOtpField) { recoveryOtpField.value = ''; recoveryOtpField.focus(); }
                startRecoveryCountdown(60);
                showToast('Reset code sent!', 'success');
            }
        } catch (error) {
            if (recoveryIdentityMessage) { recoveryIdentityMessage.textContent = error.message || 'Failed to send code.'; recoveryIdentityMessage.style.color = '#c53030'; }
        } finally {
            if (verifyIdentityBtn) { verifyIdentityBtn.disabled = false; }
            if (identitySpinner) identitySpinner.classList.add('hidden');
            if (verifyIdentityBtn) verifyIdentityBtn.querySelector('.btn-text').textContent = 'Send Reset Code';
        }
    }

    async function handleVerifyRecoveryOtp(e) {
        if (e) e.preventDefault();
        if (!recoveryOtpField) return;
        var otp = recoveryOtpField.value.trim();
        if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            if (recoveryOtpError) recoveryOtpError.textContent = 'Enter a valid 6-digit code.';
            return;
        }
        try {
            if (verifyRecoveryOtpBtn) verifyRecoveryOtpBtn.disabled = true;
            var response = await AuthAPI.verifyResetOTP(recoveryData.email, otp, recoveryData.role);
            if (response.success && response.data && response.data.resetToken) {
                recoveryData.resetToken = response.data.resetToken;
                if (recoveryOtpError) recoveryOtpError.textContent = '';
                if (recoveryOtpMessage) { recoveryOtpMessage.textContent = '✅ Code verified.'; recoveryOtpMessage.style.color = '#2f855a'; }
                stopRecoveryCountdown();
                setTimeout(function() { showRecoveryStep('step4'); }, 800);
            }
        } catch (error) {
            if (recoveryOtpError) recoveryOtpError.textContent = error.message || 'Invalid code.';
            recoveryOtpField.value = '';
            recoveryOtpField.focus();
        } finally {
            if (verifyRecoveryOtpBtn) verifyRecoveryOtpBtn.disabled = false;
        }
    }

    async function handleResendRecoveryOtp(e) {
        if (e) e.preventDefault();
        if (recoveryCountdownValue > 0 || !recoveryData.email) return;
        try {
            if (resendRecoveryOtpBtn) resendRecoveryOtpBtn.disabled = true;
            await AuthAPI.forgotPassword((recoveryFullName && recoveryFullName.value) ? recoveryFullName.value.trim() : '', recoveryData.email, recoveryData.role);
            if (recoveryOtpField) { recoveryOtpField.value = ''; recoveryOtpField.focus(); }
            if (recoveryOtpError) recoveryOtpError.textContent = '';
            startRecoveryCountdown(60);
            showToast('New code sent!', 'success');
        } catch (error) {
            showToast(error.message || 'Failed.', 'error');
        } finally {
            if (resendRecoveryOtpBtn && recoveryCountdownValue <= 0) resendRecoveryOtpBtn.disabled = false;
        }
    }

    function validateNewPasswords() {
        var valid = true;
        var pwd = recoveryNewPassword ? recoveryNewPassword.value : '';
        var confirm = recoveryConfirmPassword ? recoveryConfirmPassword.value : '';
        if (!pwd) { if (newPasswordError) newPasswordError.textContent = 'Required.'; valid = false; }
        else if (pwd.length < 8) { if (newPasswordError) newPasswordError.textContent = 'Min 8 characters.'; valid = false; }
        else if (!/[A-Z]/.test(pwd)) { if (newPasswordError) newPasswordError.textContent = 'Need uppercase letter.'; valid = false; }
        else if (!/[a-z]/.test(pwd)) { if (newPasswordError) newPasswordError.textContent = 'Need lowercase letter.'; valid = false; }
        else if (!/[0-9]/.test(pwd)) { if (newPasswordError) newPasswordError.textContent = 'Need a number.'; valid = false; }
        else { if (newPasswordError) newPasswordError.textContent = ''; }
        if (!confirm) { if (confirmPasswordError) confirmPasswordError.textContent = 'Required.'; valid = false; }
        else if (pwd !== confirm) { if (confirmPasswordError) confirmPasswordError.textContent = 'Passwords do not match.'; valid = false; }
        else { if (confirmPasswordError) confirmPasswordError.textContent = ''; }
        return valid;
    }

    async function handleResetPassword(e) {
        e.preventDefault();
        if (!validateNewPasswords()) return;
        try {
            if (resetPasswordBtn) { resetPasswordBtn.disabled = true; }
            if (resetSpinner) resetSpinner.classList.remove('hidden');
            if (resetPasswordBtn) resetPasswordBtn.querySelector('.btn-text').textContent = 'Saving...';
            var response = await AuthAPI.resetPassword(recoveryData.resetToken, recoveryNewPassword.value, recoveryConfirmPassword.value, recoveryData.role);
            if (response.success) {
                recoveryData = { resetToken: null, role: null, email: null };
                showRecoveryStep('step5');
                showToast('Password reset successful!', 'success');
            }
        } catch (error) {
            if (resetPasswordMessage) { resetPasswordMessage.textContent = error.message || 'Failed.'; resetPasswordMessage.style.color = '#c53030'; }
        } finally {
            if (resetPasswordBtn) { resetPasswordBtn.disabled = false; }
            if (resetSpinner) resetSpinner.classList.add('hidden');
            if (resetPasswordBtn) resetPasswordBtn.querySelector('.btn-text').textContent = 'Save New Password';
        }
    }

    function handleBackToLogin() {
        closeForgotPasswordModalHandler();
        if (fullNameInput) fullNameInput.focus();
    }

    function toggleLoginPassword() {
        if (!passwordInput || !eyeIcon) return;
        isPasswordVisible = !isPasswordVisible;
        passwordInput.type = isPasswordVisible ? 'text' : 'password';
        eyeIcon.textContent = isPasswordVisible ? '🙈' : '👁️';
    }

    function toggleRecoveryPassword() {
        if (!recoveryNewPassword) return;
        isRecoveryPasswordVisible = !isRecoveryPasswordVisible;
        recoveryNewPassword.type = isRecoveryPasswordVisible ? 'text' : 'password';
    }

    function toggleRecoveryConfirmPassword() {
        if (!recoveryConfirmPassword) return;
        isRecoveryConfirmPasswordVisible = !isRecoveryConfirmPasswordVisible;
        recoveryConfirmPassword.type = isRecoveryConfirmPasswordVisible ? 'text' : 'password';
    }

    // ============================================
    // SESSION CHECK
    // ============================================
    async function checkSession() {
        var token = getToken();
        if (!token) return;
        try {
            var response = await AuthAPI.getCurrentUser();
            if (response.success && response.data && response.data.role) {
                redirectBasedOnRole(response.data.role);
            }
        } catch (e) {
            clearSession();
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    if (form) form.addEventListener('submit', handleLogin);
    if (togglePasswordBtn) togglePasswordBtn.addEventListener('click', function(e) { e.preventDefault(); toggleLoginPassword(); });
    if (sendOtpBtn) sendOtpBtn.addEventListener('click', sendOtpHandler);
    if (resendOtpBtn) resendOtpBtn.addEventListener('click', resendOtpHandler);
    if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', verifyOtpHandler);
    if (otpField) otpField.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); verifyOtpHandler(); } });

    [fullNameInput, emailInput, passwordInput].forEach(function(input) {
        if (input) input.addEventListener('input', function() { if (otpVerified || isOtpSent) resetOtpState(); });
    });
    if (roleSelect) roleSelect.addEventListener('change', function() { if (otpVerified || isOtpSent) resetOtpState(); });

    if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', function(e) { e.preventDefault(); openForgotPasswordModal(); });
    if (closeForgotPasswordModal) closeForgotPasswordModal.addEventListener('click', closeForgotPasswordModalHandler);
    if (forgotPasswordModal) forgotPasswordModal.addEventListener('click', function(e) { if (e.target === forgotPasswordModal) closeForgotPasswordModalHandler(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && forgotPasswordModal && !forgotPasswordModal.classList.contains('hidden')) closeForgotPasswordModalHandler(); });

    if (recoveryIdentityForm) recoveryIdentityForm.addEventListener('submit', handleVerifyIdentity);
    if (verifyRecoveryOtpBtn) verifyRecoveryOtpBtn.addEventListener('click', handleVerifyRecoveryOtp);
    if (resendRecoveryOtpBtn) resendRecoveryOtpBtn.addEventListener('click', handleResendRecoveryOtp);
    if (recoveryOtpField) recoveryOtpField.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); handleVerifyRecoveryOtp(); } });
    if (resetPasswordForm) resetPasswordForm.addEventListener('submit', handleResetPassword);
    if (toggleRecoveryPasswordBtn) toggleRecoveryPasswordBtn.addEventListener('click', function(e) { e.preventDefault(); toggleRecoveryPassword(); });
    if (toggleRecoveryConfirmPasswordBtn) toggleRecoveryConfirmPasswordBtn.addEventListener('click', function(e) { e.preventDefault(); toggleRecoveryConfirmPassword(); });
    if (backToLoginFromAdmin) backToLoginFromAdmin.addEventListener('click', handleBackToLogin);
    if (backToLoginFromSuccess) backToLoginFromSuccess.addEventListener('click', handleBackToLogin);

    // ============================================
    // INIT
    // ============================================
    function init() {
        if (loginBtn) loginBtn.disabled = true;
        if (otpInputContainer) otpInputContainer.classList.add('hidden');
        if (resendOtpBtn) resendOtpBtn.classList.add('hidden');
        
        if (!document.getElementById('loginStyles')) {
            var style = document.createElement('style');
            style.id = 'loginStyles';
            style.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}50%{transform:translateX(10px)}75%{transform:translateX(-10px)}}@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOutRight{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}.input-field:focus{border-color:#f0b84d;box-shadow:0 0 0 3px rgba(240,184,77,0.25)}.otp-field{letter-spacing:8px;font-size:1.4rem;font-weight:700;text-align:center}.custom-toast .toast-content{display:flex;align-items:center;gap:10px}.custom-toast .toast-close{background:none;border:none;color:white;font-size:20px;cursor:pointer;opacity:0.7;padding:0 4px}.custom-toast .toast-close:hover{opacity:1}';
            document.head.appendChild(style);
        }

        checkSession();

        console.log('========================================');
        console.log('🏫 Rasally School SMS');
        console.log('🔗 API:', API_BASE_URL);
        console.log('📡 Backend Status: Testing connection...');
        
        // Quick connection test
        fetch(API_BASE_URL.replace('/api', ''))
            .then(function(r) { return r.json(); })
            .then(function(d) { console.log('✅ Backend connected:', d.message || d.status); })
            .catch(function(e) { console.error('❌ Backend unreachable:', e.message); });
        
        console.log('========================================');
    }

    init();
})();