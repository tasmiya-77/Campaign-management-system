/**
 * CampaignHub — Client Dashboard Module
 * Handles Auth state, Metrics, Campaign CRUD, Filtering, Search, Views,
 * Sidebar, Detail Drawer, Sorting, Pagination, Status Chart
 */

let currentCampaigns = [];
let searchDebounceTimer = null;
let currentView = 'dashboard'; // 'dashboard' | 'campaigns'
let sortOrder = 'desc'; // 'desc' = newest first, 'asc' = oldest first
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Enforce authentication; load user profile
  const user = await verifyAuthSession();
  if (!user) return;

  currentUser = user;

  // 2. Initialize UI & Event Listeners
  initializeEventListeners();
  initializeDateDisplay();
  initializeSidebar();

  // 3. Initial Data Fetch
  await Promise.all([loadStats(), loadCampaigns()]);
});

// ═══════════════════════════════════════════════
//  AUTHENTICATION
// ═══════════════════════════════════════════════

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
    const ddNameEl = document.getElementById('dd-name');
    const ddEmailEl = document.getElementById('dd-email');

    if (userNameEl) userNameEl.textContent = user.name;
    if (userEmailEl) userEmailEl.textContent = user.email;
    if (userAvatarEl && user.name) {
      userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
    if (greetingEl) {
      greetingEl.textContent = `Welcome back, ${user.name}!`;
    }
    if (ddNameEl) ddNameEl.textContent = user.name;
    if (ddEmailEl) ddEmailEl.textContent = user.email;

    return user;
  } catch (err) {
    console.error('Session verification error:', err);
    window.location.replace('/index.html');
    return null;
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

// ═══════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════

function initializeEventListeners() {
  // Sign Out
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Account dropdown toggle
  const profileTrigger = document.getElementById('user-profile-trigger');
  const dropdown = document.getElementById('account-dropdown');
  if (profileTrigger && dropdown) {
    profileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !profileTrigger.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
  }

  // Profile view (scrolls to profile info — currently just shows a toast)
  const profileViewBtn = document.getElementById('btn-profile-view');
  if (profileViewBtn) {
    profileViewBtn.addEventListener('click', () => {
      if (dropdown) dropdown.classList.remove('show');
      if (currentUser) {
        showToast('Profile', `Signed in as ${currentUser.name} (${currentUser.email})`, 'info');
      }
    });
  }

  // Open Create Campaign Modal — multiple triggers
  const createButtons = [
    'btn-open-create', 'btn-hero-create', 'btn-empty-create', 'btn-campaigns-create'
  ];
  createButtons.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => openModal('modal-create'));
  });

  // Forms
  const createForm = document.getElementById('form-create');
  if (createForm) createForm.addEventListener('submit', handleCreateCampaign);

  const editForm = document.getElementById('form-edit');
  if (editForm) editForm.addEventListener('submit', handleUpdateCampaign);

  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

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

  // Close modals/drawers with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach((modal) => {
        closeModal(modal.id);
      });
      closeDrawer();
    }
  });

  // Search input (debounced 300ms)
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentPage = 1;
        loadCampaigns();
      }, 300);
    });
  }

  // Filter dropdown
  const filterSelect = document.getElementById('filter-status');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      currentPage = 1;
      loadCampaigns();
    });
  }

  // Sort button
  const sortBtn = document.getElementById('btn-sort');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      const sortLabel = sortBtn.querySelector('span');
      const sortIcon = sortBtn.querySelector('svg');
      if (sortLabel) sortLabel.textContent = sortOrder === 'desc' ? 'Newest' : 'Oldest';
      if (sortIcon) sortIcon.style.transform = sortOrder === 'asc' ? 'rotate(180deg)' : 'none';
      renderTableRows(currentCampaigns);
    });
  }

  // Sidebar navigation
  const navDashboard = document.getElementById('nav-dashboard');
  const navCampaigns = document.getElementById('nav-campaigns');
  if (navDashboard) navDashboard.addEventListener('click', () => switchView('dashboard'));
  if (navCampaigns) navCampaigns.addEventListener('click', () => switchView('campaigns'));

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

  // Quick actions
  const qaCreate = document.getElementById('qa-create');
  if (qaCreate) qaCreate.addEventListener('click', () => openModal('modal-create'));

  const qaManage = document.getElementById('qa-manage');
  if (qaManage) qaManage.addEventListener('click', () => switchView('campaigns'));

  const qaRefresh = document.getElementById('qa-refresh');
  if (qaRefresh) {
    qaRefresh.addEventListener('click', async () => {
      await Promise.all([loadStats(), loadCampaigns()]);
      showToast('Refreshed', 'Dashboard data updated.', 'info');
    });
  }

  // View All button in recent campaigns
  const viewAllBtn = document.getElementById('btn-view-all');
  if (viewAllBtn) viewAllBtn.addEventListener('click', () => switchView('campaigns'));

  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      if (sidebarOverlay) sidebarOverlay.classList.add('active');
    });
  }
  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      sidebarOverlay.classList.remove('active');
    });
  }

  // Detail drawer
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerClose = document.getElementById('drawer-close');
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);

  const drawerEdit = document.getElementById('drawer-edit');
  if (drawerEdit) {
    drawerEdit.addEventListener('click', () => {
      const id = parseInt(document.getElementById('drawer-id')?.textContent);
      if (id) {
        closeDrawer();
        openEditModal(id);
      }
    });
  }
  const drawerDelete = document.getElementById('drawer-delete');
  if (drawerDelete) {
    drawerDelete.addEventListener('click', () => {
      const id = parseInt(document.getElementById('drawer-id')?.textContent);
      if (id) {
        closeDrawer();
        openDeleteModal(id);
      }
    });
  }
}

// ═══════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════

function initializeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');

  if (toggleBtn && sidebar) {
    // Restore collapsed state
    const isCollapsed = localStorage.getItem('ch-sidebar-collapsed') === 'true';
    if (isCollapsed) sidebar.classList.add('collapsed');

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('ch-sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
  }
}

// ═══════════════════════════════════════════════
//  VIEW SWITCHING
// ═══════════════════════════════════════════════

function switchView(view) {
  currentView = view;
  const dashboardView = document.getElementById('view-dashboard');
  const campaignsView = document.getElementById('view-campaigns');
  const navDashboard = document.getElementById('nav-dashboard');
  const navCampaigns = document.getElementById('nav-campaigns');
  const breadcrumb = document.getElementById('breadcrumb-current');

  if (view === 'dashboard') {
    if (dashboardView) dashboardView.style.display = '';
    if (campaignsView) campaignsView.style.display = 'none';
    if (navDashboard) navDashboard.classList.add('active');
    if (navCampaigns) navCampaigns.classList.remove('active');
    if (breadcrumb) breadcrumb.textContent = 'Dashboard';
  } else {
    if (dashboardView) dashboardView.style.display = 'none';
    if (campaignsView) campaignsView.style.display = '';
    if (navDashboard) navDashboard.classList.remove('active');
    if (navCampaigns) navCampaigns.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Campaigns';
  }

  // Close mobile sidebar on nav
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════
//  DATE DISPLAY
// ═══════════════════════════════════════════════

function initializeDateDisplay() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formatted = now.toLocaleDateString('en-US', options);

  const topbarDate = document.getElementById('topbar-date');
  const dashboardDate = document.getElementById('dashboard-date');

  if (topbarDate) topbarDate.textContent = formatted;
  if (dashboardDate) dashboardDate.textContent = formatted;
}

// ═══════════════════════════════════════════════
//  DATA LOADING
// ═══════════════════════════════════════════════

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

    const total = Number(stats.total) || 0;
    const active = Number(stats.active) || 0;
    const paused = Number(stats.paused) || 0;
    const completed = Number(stats.completed) || 0;

    // Update KPI cards
    animateNumber('stat-total', total);
    animateNumber('stat-active', active);
    animateNumber('stat-paused', paused);
    animateNumber('stat-completed', completed);

    // Update status distribution chart
    updateStatusChart(total, active, paused, completed);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function animateNumber(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) {
    el.textContent = target;
    return;
  }

  const duration = 400;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    el.textContent = Math.round(current + (target - current) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function updateStatusChart(total, active, paused, completed) {
  const barActive = document.getElementById('bar-active');
  const barPaused = document.getElementById('bar-paused');
  const barCompleted = document.getElementById('bar-completed');
  const legendActive = document.getElementById('legend-active');
  const legendPaused = document.getElementById('legend-paused');
  const legendCompleted = document.getElementById('legend-completed');

  if (total === 0) {
    if (barActive) barActive.style.width = '0%';
    if (barPaused) barPaused.style.width = '0%';
    if (barCompleted) barCompleted.style.width = '0%';
  } else {
    const aPct = (active / total * 100).toFixed(1);
    const pPct = (paused / total * 100).toFixed(1);
    const cPct = (completed / total * 100).toFixed(1);
    if (barActive) barActive.style.width = aPct + '%';
    if (barPaused) barPaused.style.width = pPct + '%';
    if (barCompleted) barCompleted.style.width = cPct + '%';
  }

  if (legendActive) legendActive.textContent = active;
  if (legendPaused) legendPaused.textContent = paused;
  if (legendCompleted) legendCompleted.textContent = completed;
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
  const tableFooter = document.getElementById('table-footer');

  if (loadingEl) loadingEl.style.display = '';
  if (emptyEl) emptyEl.style.display = 'none';
  if (tbodyEl) tbodyEl.innerHTML = '';
  if (tableFooter) tableFooter.style.display = 'none';

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
      updateRecentCampaigns([]);
      return;
    }

    // Render table rows with current sort and page
    renderTableRows(currentCampaigns);

    // Update recent campaigns on dashboard
    updateRecentCampaigns(currentCampaigns);
  } catch (err) {
    console.error('Campaign load error:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    showToast('Network Error', 'Failed to connect to campaigns API.', 'error');
  }
}

// ═══════════════════════════════════════════════
//  TABLE RENDERING
// ═══════════════════════════════════════════════

/**
 * Renders campaign rows into the table body with sorting and pagination.
 * @param {Array} campaigns
 */
function renderTableRows(campaigns) {
  const tbodyEl = document.getElementById('campaign-tbody');
  const tableFooter = document.getElementById('table-footer');
  const emptyEl = document.getElementById('empty-state');
  if (!tbodyEl) return;

  // Sort
  const sorted = [...campaigns].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // Pagination
  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = sorted.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  if (pageItems.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (tableFooter) tableFooter.style.display = 'none';
    tbodyEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbodyEl.innerHTML = '';

  pageItems.forEach((campaign) => {
    const tr = document.createElement('tr');
    const statusClass = (campaign.status || 'active').toLowerCase();
    const createdDate = new Date(campaign.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    tr.innerHTML = `
      <td>
        <div class="campaign-name-cell" data-id="${campaign.id}" title="Click to view details">${escapeHtml(campaign.campaign_name)}</div>
      </td>
      <td>
        <span class="badge ${statusClass}">
          <span class="badge-dot"></span>
          <span>${escapeHtml(campaign.status)}</span>
        </span>
      </td>
      <td>
        <span class="date-cell">${createdDate}</span>
      </td>
      <td style="text-align: right;">
        <div class="actions-cell" style="justify-content: flex-end;">
          <button class="btn-icon" title="Edit Campaign" data-action="edit" data-id="${campaign.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon delete" title="Delete Campaign" data-action="delete" data-id="${campaign.id}">
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

  // Attach event delegation for action buttons and name clicks
  tbodyEl.onclick = function (e) {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const id = parseInt(actionBtn.dataset.id);
      if (actionBtn.dataset.action === 'edit') openEditModal(id);
      else if (actionBtn.dataset.action === 'delete') openDeleteModal(id);
      return;
    }
    const nameCell = e.target.closest('.campaign-name-cell');
    if (nameCell) {
      const id = parseInt(nameCell.dataset.id);
      openDetailDrawer(id);
    }
  };

  // Update footer / pagination
  if (tableFooter) {
    tableFooter.style.display = totalItems > 0 ? 'flex' : 'none';
    const tableInfo = document.getElementById('table-info');
    if (tableInfo) {
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalItems);
      tableInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalItems} campaign${totalItems !== 1 ? 's' : ''}`;
    }
    renderPagination(totalPages);
  }
}

function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;
  container.innerHTML = '';

  if (totalPages <= 1) return;

  // Prev button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.disabled = currentPage === 1;
  prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
  prevBtn.addEventListener('click', () => { currentPage--; renderTableRows(currentCampaigns); });
  container.appendChild(prevBtn);

  // Page buttons
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 3 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
      if (i === 4 || i === totalPages - 2) {
        const dots = document.createElement('span');
        dots.textContent = '…';
        dots.style.cssText = 'padding: 0 4px; color: var(--text-muted); font-size: 0.75rem;';
        container.appendChild(dots);
      }
      continue;
    }
    const btn = document.createElement('button');
    btn.className = `page-btn${i === currentPage ? ' active' : ''}`;
    btn.textContent = i;
    btn.addEventListener('click', () => { currentPage = i; renderTableRows(currentCampaigns); });
    container.appendChild(btn);
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  nextBtn.addEventListener('click', () => { currentPage++; renderTableRows(currentCampaigns); });
  container.appendChild(nextBtn);
}

// ═══════════════════════════════════════════════
//  RECENT CAMPAIGNS (DASHBOARD)
// ═══════════════════════════════════════════════

function updateRecentCampaigns(campaigns) {
  const container = document.getElementById('recent-campaigns');
  if (!container) return;

  if (!campaigns || campaigns.length === 0) {
    container.innerHTML = '<div class="recent-empty">No campaigns yet. Create your first one!</div>';
    return;
  }

  const recent = [...campaigns]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  container.innerHTML = '';
  recent.forEach((c) => {
    const statusClass = (c.status || 'active').toLowerCase();
    const dateStr = new Date(c.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.innerHTML = `
      <div class="recent-item-info">
        <div class="recent-item-name">${escapeHtml(c.campaign_name)}</div>
        <div class="recent-item-date">${dateStr}</div>
      </div>
      <span class="badge ${statusClass}">
        <span class="badge-dot"></span>
        <span>${escapeHtml(c.status)}</span>
      </span>
    `;
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => openDetailDrawer(c.id));
    container.appendChild(item);
  });
}

// ═══════════════════════════════════════════════
//  DETAIL DRAWER
// ═══════════════════════════════════════════════

function openDetailDrawer(id) {
  const campaign = currentCampaigns.find((c) => c.id === id);
  if (!campaign) return;

  const drawer = document.getElementById('detail-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const drawerName = document.getElementById('drawer-name');
  const drawerStatus = document.getElementById('drawer-status');
  const drawerDate = document.getElementById('drawer-date');
  const drawerId = document.getElementById('drawer-id');

  if (drawerName) drawerName.textContent = campaign.campaign_name;
  if (drawerStatus) {
    const statusClass = (campaign.status || 'active').toLowerCase();
    drawerStatus.innerHTML = `<span class="badge ${statusClass}"><span class="badge-dot"></span><span>${escapeHtml(campaign.status)}</span></span>`;
  }
  if (drawerDate) {
    drawerDate.textContent = new Date(campaign.created_at).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
  if (drawerId) drawerId.textContent = campaign.id;

  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('active');
}

function closeDrawer() {
  const drawer = document.getElementById('detail-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

// ═══════════════════════════════════════════════
//  CAMPAIGN CRUD
// ═══════════════════════════════════════════════

/**
 * Handles Create Campaign form submission.
 */
async function handleCreateCampaign(e) {
  e.preventDefault();
  const nameInput = document.getElementById('create-name');
  const statusSelect = document.getElementById('create-status');
  const submitBtn = document.getElementById('btn-submit-create');
  const nameError = document.getElementById('create-name-error');

  const campaign_name = nameInput.value.trim();
  const status = statusSelect.value;

  if (!campaign_name) {
    if (nameError) { nameError.textContent = 'Campaign name is required.'; nameError.classList.add('show'); }
    nameInput.classList.add('error');
    showToast('Validation Error', 'Campaign name is required.', 'error');
    return;
  }

  nameInput.classList.remove('error');
  if (nameError) nameError.classList.remove('show');

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
  const nameError = document.getElementById('edit-name-error');

  const id = idInput.value;
  const campaign_name = nameInput.value.trim();
  const status = statusSelect.value;

  if (!campaign_name) {
    if (nameError) { nameError.textContent = 'Campaign name cannot be empty.'; nameError.classList.add('show'); }
    nameInput.classList.add('error');
    showToast('Validation Error', 'Campaign name cannot be empty.', 'error');
    return;
  }

  nameInput.classList.remove('error');
  if (nameError) nameError.classList.remove('show');

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

// ═══════════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════════

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
    // Clear inline validation errors
    modal.querySelectorAll('.form-error').forEach((el) => {
      el.textContent = '';
      el.classList.remove('show');
    });
    modal.querySelectorAll('.form-input.error').forEach((el) => {
      el.classList.remove('error');
    });
  }
}

// ═══════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════

function setBtnLoading(button, isLoading, text) {
  if (!button) return;
  button.disabled = isLoading;
  const btnText = button.querySelector('.btn-text');
  const btnSpinner = button.querySelector('.btn-spinner');
  if (btnText) btnText.textContent = text;
  if (btnSpinner) btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
}

// ═══════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════

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
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success)"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : type === 'error'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger)"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent)"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

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

// Expose functions for potential inline usage / backward compatibility
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
