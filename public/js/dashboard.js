/**
 * Campaign Management System - Client Dashboard Module
 * Handles Authentication state, Metrics, Real-time Campaign CRUD, Filtering & Search
 */

let currentCampaigns = [];
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Enforce authentication; load user profile
  const user = await verifyAuthSession();
  if (!user) return;

  // 2. Initialize UI & Event Listeners
  initializeEventListeners();

  // 3. Initial Data Fetch
  await Promise.all([loadStats(), loadCampaigns()]);
});

/**
 * Verifies active session. Redirects to /index.html if unauthenticated.
 * @returns {Promise<object|null>} Authenticated user or null
 */
async function verifyAuthSession() {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (!res.ok) {
      window.location.replace('/index.html');
      return null;
    }

    const data = await res.json();
    const user = data.user;

    // Render user profile details
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userAvatarEl = document.getElementById('user-avatar');
    const greetingEl = document.getElementById('user-greeting');

    if (userNameEl) userNameEl.textContent = user.name;
    if (userEmailEl) userEmailEl.textContent = user.email;
    if (userAvatarEl && user.name) {
      userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
    if (greetingEl) {
      greetingEl.textContent = `Welcome back, ${user.name}!`;
    }

    return user;
  } catch (err) {
    console.error('Session verification error:', err);
    window.location.replace('/index.html');
    return null;
  }
}

/**
 * Initializes all modal controls, search inputs, and action buttons.
 */
function initializeEventListeners() {
  // Sign Out
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Open Create Campaign Modal
  const openCreateBtn = document.getElementById('btn-open-create');
  if (openCreateBtn) {
    openCreateBtn.addEventListener('click', () => openModal('modal-create'));
  }
  const emptyCreateBtn = document.getElementById('btn-empty-create');
  if (emptyCreateBtn) {
    emptyCreateBtn.addEventListener('click', () => openModal('modal-create'));
  }

  // Forms
  const createForm = document.getElementById('form-create');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateCampaign);
  }

  const editForm = document.getElementById('form-edit');
  if (editForm) {
    editForm.addEventListener('submit', handleUpdateCampaign);
  }

  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  }

  // Modal Close buttons (data-close attributes)
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const modalId = button.getAttribute('data-close');
      closeModal(modalId);
    });
  });

  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });

  // Close modals with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach((modal) => {
        closeModal(modal.id);
      });
    }
  });

  // Search input (debounced 300ms)
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        loadCampaigns();
      }, 300);
    });
  }

  // Filter dropdown
  const filterSelect = document.getElementById('filter-status');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      loadCampaigns();
    });
  }

  // Sidebar navigation switching
  const navDashboard = document.getElementById('nav-dashboard');
  const navCampaigns = document.getElementById('nav-campaigns');
  if (navDashboard && navCampaigns) {
    navDashboard.addEventListener('click', () => {
      navDashboard.classList.add('active');
      navCampaigns.classList.remove('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    navCampaigns.addEventListener('click', () => {
      navCampaigns.classList.add('active');
      navDashboard.classList.remove('active');
      const tableSection = document.querySelector('.section-card');
      if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      await Promise.all([loadStats(), loadCampaigns()]);
      refreshBtn.disabled = false;
      showToast('Refreshed', 'Dashboard data updated.', 'info');
    });
  }
}

/**
 * Handles user logout.
 */
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    showToast('Signed Out', 'You have been logged out.', 'info');
    setTimeout(() => {
      window.location.replace('/index.html');
    }, 400);
  } catch (err) {
    window.location.replace('/index.html');
  }
}

/**
 * Loads aggregated dashboard statistics from GET /api/campaigns/stats.
 */
async function loadStats() {
  try {
    const res = await fetch('/api/campaigns/stats', {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (!res.ok) return;

    const data = await res.json();
    const stats = data.data || {};

    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const pausedEl = document.getElementById('stat-paused');
    const completedEl = document.getElementById('stat-completed');

    if (totalEl) totalEl.textContent = stats.total || 0;
    if (activeEl) activeEl.textContent = stats.active || 0;
    if (pausedEl) pausedEl.textContent = stats.paused || 0;
    if (completedEl) completedEl.textContent = stats.completed || 0;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

/**
 * Loads campaigns from GET /api/campaigns with optional search and filter.
 */
async function loadCampaigns() {
  const loadingEl = document.getElementById('loading-state');
  const emptyEl = document.getElementById('empty-state');
  const tbodyEl = document.getElementById('campaign-tbody');
  const searchInput = document.getElementById('search-input');
  const filterSelect = document.getElementById('filter-status');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (emptyEl) emptyEl.style.display = 'none';
  if (tbodyEl) tbodyEl.innerHTML = '';

  const search = searchInput ? searchInput.value.trim() : '';
  const status = filterSelect ? filterSelect.value : '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);

  const url = '/api/campaigns' + (params.toString() ? `?${params.toString()}` : '');

  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (loadingEl) loadingEl.style.display = 'none';

    if (!res.ok) {
      if (res.status === 401) {
        window.location.replace('/index.html');
        return;
      }
      showToast('Error', 'Unable to retrieve campaigns.', 'error');
      return;
    }

    const data = await res.json();
    currentCampaigns = data.data || [];

    if (currentCampaigns.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    // Render table rows
    renderTableRows(currentCampaigns);
  } catch (err) {
    console.error('Campaign load error:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    showToast('Network Error', 'Failed to connect to campaigns API.', 'error');
  }
}

/**
 * Renders campaign rows into the table body.
 * @param {Array} campaigns
 */
function renderTableRows(campaigns) {
  const tbodyEl = document.getElementById('campaign-tbody');
  if (!tbodyEl) return;

  tbodyEl.innerHTML = '';

  campaigns.forEach((campaign) => {
    const tr = document.createElement('tr');

    const statusClass = (campaign.status || 'active').toLowerCase();
    const createdDate = new Date(campaign.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    tr.innerHTML = `
      <td>
        <div class="campaign-name-cell">${escapeHtml(campaign.campaign_name)}</div>
      </td>
      <td>
        <span class="badge ${statusClass}">
          <span class="badge-dot"></span>
          <span>${escapeHtml(campaign.status)}</span>
        </span>
      </td>
      <td>
        <span style="color: var(--text-muted); font-size: 0.85rem;">${createdDate}</span>
      </td>
      <td style="text-align: right;">
        <div class="actions-cell" style="justify-content: flex-end;">
          <button class="btn-icon" title="Edit Campaign" onclick="openEditModal(${campaign.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon delete" title="Delete Campaign" onclick="openDeleteModal(${campaign.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </td>
    `;

    tbodyEl.appendChild(tr);
  });
}

/**
 * Handles Create Campaign form submission.
 */
async function handleCreateCampaign(e) {
  e.preventDefault();
  const nameInput = document.getElementById('create-name');
  const statusSelect = document.getElementById('create-status');
  const submitBtn = document.getElementById('btn-submit-create');

  const campaign_name = nameInput.value.trim();
  const status = statusSelect.value;

  if (!campaign_name) {
    showToast('Validation Error', 'Campaign name is required.', 'error');
    return;
  }

  setBtnLoading(submitBtn, true, 'Creating...');

  try {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ campaign_name, status }),
    });

    const data = await res.json();
    setBtnLoading(submitBtn, false, 'Create Campaign');

    if (res.ok && data.success) {
      closeModal('modal-create');
      nameInput.value = '';
      statusSelect.value = 'Active';
      showToast('Created', `Campaign "${campaign_name}" was created successfully.`, 'success');
      await Promise.all([loadStats(), loadCampaigns()]);
    } else {
      showToast('Failed', data.message || 'Unable to create campaign.', 'error');
    }
  } catch (err) {
    setBtnLoading(submitBtn, false, 'Create Campaign');
    showToast('Network Error', 'Failed to communicate with server.', 'error');
  }
}

/**
 * Opens Edit Campaign modal for a specific ID.
 * @param {number} id
 */
function openEditModal(id) {
  const campaign = currentCampaigns.find((c) => c.id === id);
  if (!campaign) return;

  const idInput = document.getElementById('edit-id');
  const nameInput = document.getElementById('edit-name');
  const statusSelect = document.getElementById('edit-status');

  if (idInput) idInput.value = campaign.id;
  if (nameInput) nameInput.value = campaign.campaign_name;
  if (statusSelect) statusSelect.value = campaign.status;

  openModal('modal-edit');
}

/**
 * Handles Update Campaign form submission.
 */
async function handleUpdateCampaign(e) {
  e.preventDefault();
  const idInput = document.getElementById('edit-id');
  const nameInput = document.getElementById('edit-name');
  const statusSelect = document.getElementById('edit-status');
  const submitBtn = document.getElementById('btn-submit-edit');

  const id = idInput.value;
  const campaign_name = nameInput.value.trim();
  const status = statusSelect.value;

  if (!campaign_name) {
    showToast('Validation Error', 'Campaign name cannot be empty.', 'error');
    return;
  }

  setBtnLoading(submitBtn, true, 'Saving...');

  try {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ campaign_name, status }),
    });

    const data = await res.json();
    setBtnLoading(submitBtn, false, 'Save Changes');

    if (res.ok && data.success) {
      closeModal('modal-edit');
      showToast('Updated', 'Campaign updated successfully.', 'success');
      await Promise.all([loadStats(), loadCampaigns()]);
    } else {
      showToast('Update Failed', data.message || 'Could not update campaign.', 'error');
    }
  } catch (err) {
    setBtnLoading(submitBtn, false, 'Save Changes');
    showToast('Network Error', 'Failed to communicate with server.', 'error');
  }
}

/**
 * Opens Delete Confirmation modal.
 * @param {number} id
 */
function openDeleteModal(id) {
  const campaign = currentCampaigns.find((c) => c.id === id);
  if (!campaign) return;

  const idInput = document.getElementById('delete-id');
  const nameEl = document.getElementById('delete-campaign-name');

  if (idInput) idInput.value = campaign.id;
  if (nameEl) nameEl.textContent = `"${campaign.campaign_name}"`;

  openModal('modal-delete');
}

/**
 * Handles Delete confirmation.
 */
async function handleConfirmDelete() {
  const idInput = document.getElementById('delete-id');
  const confirmBtn = document.getElementById('btn-confirm-delete');
  const id = idInput ? idInput.value : null;

  if (!id) return;

  setBtnLoading(confirmBtn, true, 'Deleting...');

  try {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });

    const data = await res.json();
    setBtnLoading(confirmBtn, false, 'Yes, Delete Campaign');

    if (res.ok && data.success) {
      closeModal('modal-delete');
      showToast('Deleted', 'Campaign has been removed.', 'success');
      await Promise.all([loadStats(), loadCampaigns()]);
    } else {
      showToast('Delete Failed', data.message || 'Could not delete campaign.', 'error');
    }
  } catch (err) {
    setBtnLoading(confirmBtn, false, 'Yes, Delete Campaign');
    showToast('Network Error', 'Failed to communicate with server.', 'error');
  }
}

/**
 * Modal visibility helpers.
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    const firstInput = modal.querySelector('input:not([type="hidden"])');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 50);
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

function setBtnLoading(button, isLoading, text) {
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

// Expose openEditModal and openDeleteModal to window for inline onclick handlers
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;

