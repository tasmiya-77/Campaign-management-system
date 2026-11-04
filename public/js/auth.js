/**
 * Campaign Management System - Client Auth Module
 * Handles Login, Registration, and Session Verification
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if session is already active; if so, redirect directly to dashboard
  checkExistingSession();

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
});

/**
 * Checks if user is already logged in. If yes, redirect to dashboard.
 */
async function checkExistingSession() {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
    });
    if (res.ok) {
      window.location.replace('/dashboard.html');
    }
  } catch (err) {
    // Network error or server offline; stay on auth page
  }
}

/**
 * Handles user login submission.
 */
async function handleLogin(e) {
  e.preventDefault();
  clearErrorBanner();

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('btn-submit');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showErrorBanner('Please enter both email and password.');
    return;
  }

  setButtonLoading(submitBtn, true, 'Signing in...');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showToast('Success', 'Welcome back! Redirecting to dashboard...', 'success');
      setTimeout(() => {
        window.location.replace('/dashboard.html');
      }, 500);
    } else {
      setButtonLoading(submitBtn, false, 'Sign In');
      const errorMessage = data.message || 'Login failed. Please check your credentials.';
      showErrorBanner(errorMessage);
      showToast('Login Failed', errorMessage, 'error');
    }
  } catch (error) {
    console.error('Login network error:', error);
    setButtonLoading(submitBtn, false, 'Sign In');
    const msg = 'Unable to connect to the server. Please verify your connection.';
    showErrorBanner(msg);
    showToast('Network Error', msg, 'error');
  }
}

/**
 * Handles user registration submission.
 */
async function handleRegister(e) {
  e.preventDefault();
  clearErrorBanner();

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const submitBtn = document.getElementById('btn-submit');

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Client-side validations
  if (name.length < 2) {
    showErrorBanner('Full Name must be at least 2 characters long.');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showErrorBanner('Please enter a valid email address.');
    return;
  }

  if (password.length < 6) {
    showErrorBanner('Password must be at least 6 characters long.');
    return;
  }

  if (password !== confirmPassword) {
    showErrorBanner('Passwords do not match. Please re-enter.');
    return;
  }

  setButtonLoading(submitBtn, true, 'Creating Account...');

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showToast('Success', 'Account created! Redirecting to dashboard...', 'success');
      setTimeout(() => {
        window.location.replace('/dashboard.html');
      }, 500);
    } else {
      setButtonLoading(submitBtn, false, 'Create Account');
      const errorMessage = data.message || 'Registration failed. Please try again.';
      showErrorBanner(errorMessage);
      showToast('Registration Error', errorMessage, 'error');
    }
  } catch (error) {
    console.error('Registration network error:', error);
    setButtonLoading(submitBtn, false, 'Create Account');
    const msg = 'Unable to connect to the server. Please verify your connection.';
    showErrorBanner(msg);
    showToast('Network Error', msg, 'error');
  }
}

/**
 * UI Helper: Displays error message in the form's error banner.
 */
function showErrorBanner(message) {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.textContent = message;
    banner.classList.add('show');
  }
}

/**
 * UI Helper: Clears the form error banner.
 */
function clearErrorBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.textContent = '';
    banner.classList.remove('show');
  }
}

/**
 * UI Helper: Toggles loading state on form submit button.
 */
function setButtonLoading(button, isLoading, text) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = text;
}

/**
 * Toast Notification Helper.
 */
function showToast(title, message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg =
    type === 'success'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--status-active)"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : type === 'error'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger)"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary)"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
