// Campaign Management System Frontend Client (Vanilla JS)

document.addEventListener('DOMContentLoaded', () => {
  fetchHealthStatus();

  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchHealthStatus();
    });
  }
});

async function fetchHealthStatus() {
  const serverStatusBadge = document.getElementById('server-status-badge');
  const dbStatusBadge = document.getElementById('db-status-badge');
  const uptimeVal = document.getElementById('uptime-val');
  const timestampVal = document.getElementById('timestamp-val');
  const rawResponse = document.getElementById('raw-response');

  if (serverStatusBadge) {
    serverStatusBadge.className = 'status-badge checking';
    serverStatusBadge.innerHTML = '<span class="status-dot"></span> Checking...';
  }
  if (dbStatusBadge) {
    dbStatusBadge.className = 'status-badge checking';
    dbStatusBadge.innerHTML = '<span class="status-dot"></span> Checking...';
  }

  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    if (rawResponse) {
      rawResponse.textContent = JSON.stringify(data, null, 2);
    }

    // Update server status
    if (serverStatusBadge) {
      serverStatusBadge.className = 'status-badge success';
      serverStatusBadge.innerHTML = '<span class="status-dot"></span> Running';
    }

    // Update DB status
    if (dbStatusBadge) {
      if (data.services && data.services.database === 'connected') {
        dbStatusBadge.className = 'status-badge success';
        dbStatusBadge.innerHTML = '<span class="status-dot"></span> Connected';
      } else {
        dbStatusBadge.className = 'status-badge danger';
        dbStatusBadge.innerHTML = '<span class="status-dot"></span> Disconnected';
      }
    }

    // Update metrics
    if (uptimeVal) {
      const seconds = data.uptimeSeconds || 0;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      uptimeVal.textContent = `${mins}m ${secs}s (${seconds}s)`;
    }
    if (timestampVal) {
      timestampVal.textContent = new Date(data.timestamp).toLocaleTimeString();
    }
  } catch (error) {
    console.error('Failed to query health endpoint:', error);
    if (serverStatusBadge) {
      serverStatusBadge.className = 'status-badge danger';
      serverStatusBadge.innerHTML = '<span class="status-dot"></span> Offline';
    }
    if (dbStatusBadge) {
      dbStatusBadge.className = 'status-badge danger';
      dbStatusBadge.innerHTML = '<span class="status-dot"></span> Offline';
    }
    if (rawResponse) {
      rawResponse.textContent = `Error connecting to API: ${error.message}`;
    }
  }
}
