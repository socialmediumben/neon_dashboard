// Application State
let activities = [];
let filteredActivities = [];
let currentPage = 1;
const pageSize = 10;
let sortField = 'Activity Date';
let sortAsc = false;

// Chart Instances
let timelineChart = null;
let priorityChart = null;
let statusChart = null;

// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const infoBtn = document.getElementById('infoBtn');
const reportSelector = document.getElementById('reportSelector');
const connectionStatus = document.getElementById('connectionStatus');
const valTotal = document.getElementById('val-total');
const valCompleted = document.getElementById('val-completed');
const pctCompleted = document.getElementById('pct-completed');
const valPending = document.getElementById('val-pending');
const valOverdue = document.getElementById('val-overdue');

const tableSearch = document.getElementById('tableSearch');
const filterStatus = document.getElementById('filterStatus');
const filterPriority = document.getElementById('filterPriority');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const tableBody = document.getElementById('tableBody');
const paginationInfo = document.getElementById('paginationInfo');
const currentPageNum = document.getElementById('currentPageNum');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

const neonConfigForm = document.getElementById('neonConfigForm');
const emailConfigForm = document.getElementById('emailConfigForm');
const sendTestEmailBtn = document.getElementById('sendTestEmailBtn');

// Modal Elements
const infoModal = document.getElementById('infoModal');
const closeInfoModalBtn = document.getElementById('closeInfoModalBtn');
const activityModal = document.getElementById('activityModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalSubject = document.getElementById('modalSubject');
const modalDate = document.getElementById('modalDate');
const modalId = document.getElementById('modalId');
const modalType = document.getElementById('modalType');
const modalMemberId = document.getElementById('modalMemberId');
const modalStaff = document.getElementById('modalStaff');
const modalPriority = document.getElementById('modalPriority');
const modalStatus = document.getElementById('modalStatus');
const modalNotes = document.getElementById('modalNotes');

// Toast Notification Container
const toastContainer = document.getElementById('toastContainer');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupInfoModal();
  setupTabs();
  setupEventListeners();
  checkAppStatus().then(() => {
    loadData();
  });
});

// Theme Setup (Light / Dark Mode)
function setupTheme() {
  const savedTheme = localStorage.getItem('neon_theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.checked = true;
  }

  themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
      document.body.classList.add('light-theme');
      localStorage.setItem('neon_theme', 'light');
      showToast('Switched to Light Mode', 'info');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('neon_theme', 'dark');
      showToast('Switched to Dark Mode', 'info');
    }
  });
}

// Info & Changelog Modal Setup
function setupInfoModal() {
  infoBtn.addEventListener('click', () => {
    infoModal.classList.add('open');
    infoModal.setAttribute('aria-hidden', 'false');
  });

  closeInfoModalBtn.addEventListener('click', () => {
    infoModal.classList.remove('open');
    infoModal.setAttribute('aria-hidden', 'true');
  });

  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) {
      infoModal.classList.remove('open');
      infoModal.setAttribute('aria-hidden', 'true');
    }
  });
}

// Tab Setup
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Report Selector Toggle
  reportSelector.addEventListener('change', () => {
    showToast(`Loading Report: ${reportSelector.options[reportSelector.selectedIndex].text}`, 'success');
    loadData();
  });

  // Table Filters & Search (Instant Client-Side Filtering)
  tableSearch.addEventListener('input', () => { currentPage = 1; filterAndRenderTable(); });
  filterStatus.addEventListener('change', () => { currentPage = 1; filterAndRenderTable(); });
  filterPriority.addEventListener('change', () => { currentPage = 1; filterAndRenderTable(); });
  
  // CSV Export
  exportCsvBtn.addEventListener('click', exportToCsv);

  // Sorting
  document.querySelectorAll('.interactive-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortAsc = !sortAsc;
      } else {
        sortField = field;
        sortAsc = true;
      }
      filterAndRenderTable();
    });
  });

  // Pagination
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTableOnly();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredActivities.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      renderTableOnly();
    }
  });

  // Modal Close
  closeModalBtn.addEventListener('click', closeModal);
  activityModal.addEventListener('click', (e) => {
    if (e.target === activityModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activityModal.classList.contains('open')) closeModal();
  });

  // Config Form Submissions
  neonConfigForm.addEventListener('submit', handleNeonConfigSubmit);
  emailConfigForm.addEventListener('submit', handleEmailConfigSubmit);
  sendTestEmailBtn.addEventListener('click', handleSendTestEmail);


}

// Toast Notifications Helper
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'info') icon = '⚡';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  
  // Trigger entry animation
  setTimeout(() => toast.classList.add('show'), 50);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Fetch App Configurations and Status
async function checkAppStatus() {
  try {
    const res = await fetch('/api/status');
    const status = await res.json();
    
    // Update credentials forms with existing server config values
    document.getElementById('neonOrgId').value = status.config.neonOrgId || '';
    document.getElementById('neonApiUrl').value = status.config.neonApiUrl || 'https://api.neoncrm.com/v2';
    
    document.getElementById('smtpHost').value = status.config.smtpHost || '';
    document.getElementById('smtpPort').value = status.config.smtpPort || '587';
    document.getElementById('smtpSecure').checked = status.config.smtpSecure;
    document.getElementById('smtpUser').value = status.config.smtpUser || '';
    document.getElementById('emailFrom').value = status.config.emailFrom || '"Neon CRM Dashboard" <noreply@yourdomain.com>';
    document.getElementById('emailRecipient').value = status.config.emailRecipient || '';
    document.getElementById('emailSchedule').value = status.config.emailSchedule || '0 8 * * *';
    document.getElementById('emailEnabled').checked = status.config.emailEnabled;
    document.getElementById('emailReportType').value = status.config.emailReportType || 'all';

    // Update connection indicator
    connectionStatus.className = 'connection-status';
    if (status.neonConfigured) {
      if (status.apiConnectionValid) {
        connectionStatus.classList.add('status-connected');
        connectionStatus.querySelector('.status-text').textContent = 'API Connected';
      } else {
        connectionStatus.classList.add('status-disconnected');
        connectionStatus.querySelector('.status-text').textContent = 'API Error';
        console.warn('API connection validation error:', status.apiErrorMessage);
      }
    } else {
      connectionStatus.classList.add('status-disconnected');
      connectionStatus.querySelector('.status-text').textContent = 'API Unconfigured';
    }
  } catch (err) {
    console.error('Failed to retrieve server status:', err);
    connectionStatus.className = 'connection-status status-disconnected';
    connectionStatus.querySelector('.status-text').textContent = 'Server Offline';
    showToast('Failed to contact server backend. Operating in local-only demo mode.', 'error');
  }
}

// Load Activities Data from API/Proxy
async function loadData() {
  // Clear table state
  tableBody.innerHTML = '<tr><td colspan="8" class="empty-table-state">Loading activities ledger...</td></tr>';
  
  const reportType = reportSelector.value;
  const url = `/api/activities?report=${reportType}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Error fetching activities.');
    }

    const data = await res.json();
    activities = data.searchResults || [];
    
    // Sort default descending by date
    activities.sort((a, b) => new Date(b['Activity Date']) - new Date(a['Activity Date']));
    
    // Process counters, statistics, and charts
    processMetricsAndCharts();
    
    // Render Table
    currentPage = 1;
    filterAndRenderTable();
  } catch (err) {
    console.error('Failed to load activities:', err);
    showToast(`Failed to load activities: ${err.message}`, 'error');
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-table-state" style="color:var(--danger)">Error: ${err.message}</td></tr>`;
  }
}

// Process KPI Statistics & Render Chart.js
function processMetricsAndCharts() {
  const totalCount = activities.length;
  const completedCount = activities.filter(a => a.Status.toLowerCase() === 'completed').length;
  const pendingCount = activities.filter(a => a.Status.toLowerCase() === 'pending' || a.Status.toLowerCase() === 'in progress').length;
  
  // Calculate Overdue
  const now = new Date();
  now.setHours(0,0,0,0);
  const overdueCount = activities.filter(a => {
    const isPending = a.Status.toLowerCase() === 'pending' || a.Status.toLowerCase() === 'in progress';
    const isPast = new Date(a['Activity Date']) < now;
    return isPending && isPast;
  }).length;

  const compRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Animate counters
  animateCountValue(valTotal, totalCount);
  animateCountValue(valCompleted, completedCount);
  animateCountValue(valPending, pendingCount);
  animateCountValue(valOverdue, overdueCount);
  pctCompleted.textContent = `${compRate}% completion rate`;

  // Process data for charts
  renderTimelineChart();
  renderDistributionCharts();
}

// Counter animation
function animateCountValue(element, target) {
  let start = 0;
  const duration = 800; // ms
  if (target === 0) {
    element.textContent = '0';
    return;
  }
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out quad
    const easeProgress = progress * (2 - progress);
    const current = Math.floor(easeProgress * target);
    
    element.textContent = current.toString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target.toString();
    }
  }
  
  requestAnimationFrame(update);
}

// Filter, sort, and paginate the local dataset
function filterAndRenderTable() {
  const searchVal = tableSearch.value.toLowerCase().trim();
  const statusVal = filterStatus.value;
  const priorityVal = filterPriority.value;

  filteredActivities = activities.filter(a => {
    // Search match (subject or notes)
    const subjectMatch = a['Activity Subject'] ? a['Activity Subject'].toLowerCase().includes(searchVal) : false;
    const notesMatch = a['Activity Note'] ? a['Activity Note'].toLowerCase().includes(searchVal) : false;
    const searchMatch = !searchVal || subjectMatch || notesMatch;

    // Status match
    const statusMatch = !statusVal || a.Status.toLowerCase() === statusVal.toLowerCase();

    // Priority match
    const priorityMatch = !priorityVal || a.Priority.toLowerCase() === priorityVal.toLowerCase();

    return searchMatch && statusMatch && priorityMatch;
  });

  // Sort
  filteredActivities.sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    // Handle dates
    if (sortField === 'Activity Date') {
      const dateA = new Date(valA);
      const dateB = new Date(valB);
      return sortAsc ? dateA - dateB : dateB - dateA;
    }

    // Alphabetic sort
    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  renderTableOnly();
}

// Render Table Rows Only (for fast pagination updates)
function renderTableOnly() {
  const totalResults = filteredActivities.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  
  // Fix boundary conditions
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  const startIdx = totalResults === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalResults);

  // Update pagination texts
  paginationInfo.textContent = `Showing ${totalResults === 0 ? 0 : startIdx + 1}-${endIdx} of ${totalResults} entries`;
  currentPageNum.textContent = currentPage.toString();
  
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;

  if (totalResults === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="empty-table-state">No matching activities found.</td></tr>';
    return;
  }

  const now = new Date();
  now.setHours(0,0,0,0);

  // Update headers dynamically for Staff Activity Report
  const typeHeader = document.querySelector('#activitiesTable th:nth-child(3)');
  const memberHeader = document.querySelector('#activitiesTable th:nth-child(4)');
  const assignedHeader = document.querySelector('#activitiesTable th:nth-child(5)');
  
  const isStaffReport = reportSelector.value === 'staff-activity';

  if (isStaffReport) {
    if (typeHeader) typeHeader.textContent = 'Solicitation Method';
    if (memberHeader) memberHeader.textContent = 'Account Name';
    if (assignedHeader) assignedHeader.textContent = 'Owner ID';
  } else {
    if (typeHeader) typeHeader.textContent = 'Type';
    if (memberHeader) memberHeader.textContent = 'Member ID';
    if (assignedHeader) assignedHeader.textContent = 'Assigned To';
  }

  tableBody.innerHTML = '';
  const pageData = filteredActivities.slice(startIdx, endIdx);

  pageData.forEach(a => {
    const tr = document.createElement('tr');
    
    // Status Badge
    let statusClass = 'pending';
    const statusLower = a.Status.toLowerCase();
    if (statusLower === 'completed') statusClass = 'completed';
    else if (statusLower === 'in progress') statusClass = 'progress';
    else if (statusLower === 'deferred') statusClass = 'deferred';
    else if (statusLower === 'cancelled') statusClass = 'cancelled';
    const statusBadge = `<span class="badge badge-status-${statusClass}">${a.Status}</span>`;

    // Priority Badge
    let priorityClass = 'normal';
    const priorityLower = a.Priority.toLowerCase();
    if (priorityLower === 'high') priorityClass = 'high';
    else if (priorityLower === 'low') priorityClass = 'low';
    const priorityBadge = `<span class="badge badge-priority-${priorityClass}">${a.Priority}</span>`;

    // Check if overdue (Pending/Progress and date is in past)
    const isPending = statusLower === 'pending' || statusLower === 'in progress';
    const isOverdue = isPending && new Date(a['Activity Date']) < now;
    const dateClass = isOverdue ? 'date-cell date-overdue' : 'date-cell';
    const dateGlow = isOverdue ? ' 🚨 Overdue' : '';

    const memberVal = a['Client Name'] ? `${a['Client Name']} (#${a['Client ID']})` : `Member #${a['Client ID']}`;

    tr.innerHTML = `
      <td class="${dateClass}">${a['Activity Date']}${dateGlow}</td>
      <td class="subject-cell" title="${a['Activity Subject']}">${a['Activity Subject']}</td>
      <td>${a['Activity Type']}</td>
      <td>${memberVal}</td>
      <td>${a['Created By'] || '-'}</td>
      <td>${statusBadge}</td>
      <td>${priorityBadge}</td>
      <td>
        <button class="btn btn-secondary btn-row-action" onclick="viewActivityDetails('${a['Activity ID']}')">
          Details
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Global hook for details click
window.viewActivityDetails = function(activityId) {
  const activity = activities.find(a => a['Activity ID'] === activityId);
  if (!activity) return;

  modalSubject.textContent = activity['Activity Subject'] || 'Activity Details';
  modalDate.textContent = activity['Activity Date'] || '-';
  modalId.textContent = activity['Activity ID'] || '-';
  modalType.textContent = activity['Activity Type'] || '-';
  modalMemberId.textContent = `Member #${activity['Client ID']}` || '-';
  modalStaff.textContent = activity['Created By'] || 'Unassigned';
  modalPriority.textContent = activity['Priority'] || 'Normal';
  modalStatus.textContent = activity['Status'] || 'Pending';
  modalNotes.textContent = activity['Activity Note'] || 'No notes available.';

  activityModal.classList.add('open');
  activityModal.setAttribute('aria-hidden', 'false');
};

function closeModal() {
  activityModal.classList.remove('open');
  activityModal.setAttribute('aria-hidden', 'true');
}

// Export Filtered List to CSV
function exportToCsv() {
  if (filteredActivities.length === 0) {
    showToast('No activities to export.', 'error');
    return;
  }

  const headers = ['Activity ID', 'Activity Date', 'Subject', 'Type', 'Member ID', 'Assigned To', 'Status', 'Priority', 'Notes'];
  
  const csvRows = [];
  csvRows.push(headers.join(','));

  filteredActivities.forEach(a => {
    const row = [
      `"${a['Activity ID']}"`,
      `"${a['Activity Date']}"`,
      `"${(a['Activity Subject'] || '').replace(/"/g, '""')}"`,
      `"${a['Activity Type']}"`,
      `"${a['Client ID']}"`,
      `"${(a['Created By'] || '').replace(/"/g, '""')}"`,
      `"${a.Status}"`,
      `"${a.Priority}"`,
      `"${(a['Activity Note'] || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `neon_crm_activities_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Successfully exported ${filteredActivities.length} rows to CSV.`, 'success');
}

// Save Neon API Configuration
async function handleNeonConfigSubmit(e) {
  e.preventDefault();
  const formData = new FormData(neonConfigForm);
  const payload = {
    neonOrgId: formData.get('neonOrgId'),
    neonApiUrl: formData.get('neonApiUrl')
  };

  // Only send password/API keys if updated
  const apikey = formData.get('neonApiKey');
  if (apikey) {
    payload.neonApiKey = apikey;
  }
  const geminiKey = formData.get('geminiApiKey');
  if (geminiKey) {
    payload.geminiApiKey = geminiKey;
  }

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Failed to update config on server.');
    
    showToast('Neon CRM settings updated. Testing connection...', 'info');
    await checkAppStatus();
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Save Email Report Configuration
async function handleEmailConfigSubmit(e) {
  e.preventDefault();
  const formData = new FormData(emailConfigForm);
  const payload = {
    smtpHost: formData.get('smtpHost'),
    smtpPort: parseInt(formData.get('smtpPort')),
    smtpSecure: formData.get('smtpSecure') === 'on',
    smtpUser: formData.get('smtpUser'),
    emailFrom: formData.get('emailFrom'),
    emailRecipient: formData.get('emailRecipient'),
    emailSchedule: formData.get('emailSchedule'),
    emailEnabled: formData.get('emailEnabled') === 'on',
    emailReportType: formData.get('emailReportType')
  };

  // Only submit password if filled in
  const smtpPass = formData.get('smtpPass');
  if (smtpPass) {
    payload.smtpPass = smtpPass;
  }

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Failed to update email config on server.');
    
    showToast('Email settings and schedule updated successfully.', 'success');
    await checkAppStatus();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Send Test Email Immediately
async function handleSendTestEmail() {
  sendTestEmailBtn.disabled = true;
  sendTestEmailBtn.textContent = '⏱ Sending...';

  try {
    const res = await fetch('/api/send-report', {
      method: 'POST'
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to dispatch test email.');

    showToast(data.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    sendTestEmailBtn.disabled = false;
    sendTestEmailBtn.textContent = '⚡ Send Test Email Now';
  }
}

// --- Chart.js Draw Functions ---

function renderTimelineChart() {
  if (timelineChart) {
    timelineChart.destroy();
  }

  // Count activities grouped by date
  const dateCounts = {};
  activities.forEach(a => {
    const date = a['Activity Date'];
    if (date) {
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
  });

  // Sort dates
  const sortedDates = Object.keys(dateCounts).sort((a, b) => new Date(a) - new Date(b));
  const dataset = sortedDates.map(date => dateCounts[date]);

  const ctx = document.getElementById('timelineChart').getContext('2d');
  
  // Custom neon gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
  gradient.addColorStop(1, 'rgba(157, 78, 221, 0.02)');

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{
        label: 'Activities Logged',
        data: dataset,
        borderColor: '#00f2fe',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ff007f',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        shadowColor: 'rgba(0, 242, 254, 0.5)',
        shadowBlur: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c0919',
          titleFont: { family: 'Outfit', weight: 'bold' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(0, 242, 254, 0.3)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)', drawTicks: false },
          ticks: { color: '#a0aec0', font: { family: 'Inter', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#a0aec0', font: { family: 'Inter' }, precision: 0 }
        }
      }
    }
  });
}

function renderDistributionCharts() {
  if (priorityChart) priorityChart.destroy();
  if (statusChart) statusChart.destroy();

  // Group Priorities
  const priorityCounts = { High: 0, Normal: 0, Low: 0 };
  activities.forEach(a => {
    const pri = a.Priority;
    if (pri && priorityCounts.hasOwnProperty(pri)) {
      priorityCounts[pri]++;
    } else if (pri) {
      // Handle fallback capitalization
      const normalized = pri.charAt(0).toUpperCase() + pri.slice(1).toLowerCase();
      if (priorityCounts.hasOwnProperty(normalized)) {
        priorityCounts[normalized]++;
      }
    }
  });

  // Group Statuses
  const statusCounts = { Completed: 0, Pending: 0, 'In Progress': 0, Deferred: 0, Cancelled: 0 };
  activities.forEach(a => {
    let stat = a.Status;
    if (stat) {
      const normalized = stat.toLowerCase() === 'in progress' ? 'In Progress' : (stat.charAt(0).toUpperCase() + stat.slice(1).toLowerCase());
      if (statusCounts.hasOwnProperty(normalized)) {
        statusCounts[normalized]++;
      }
    }
  });

  // Priority Chart
  const ctxPri = document.getElementById('priorityChart').getContext('2d');
  priorityChart = new Chart(ctxPri, {
    type: 'doughnut',
    data: {
      labels: Object.keys(priorityCounts),
      datasets: [{
        data: Object.values(priorityCounts),
        backgroundColor: ['#ff007f', '#3b82f6', '#64748b'],
        borderColor: '#0c0919',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#a0aec0', font: { family: 'Inter', size: 10 }, boxWidth: 10 }
        },
        title: {
          display: true,
          text: 'By Priority',
          color: '#ffffff',
          font: { family: 'Outfit', size: 12, weight: 'bold' }
        }
      }
    }
  });

  // Status Chart
  const ctxStat = document.getElementById('statusChart').getContext('2d');
  statusChart = new Chart(ctxStat, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#10b981', '#f59e0b', '#00f2fe', '#9d4edd', '#ef4444'],
        borderColor: '#0c0919',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#a0aec0', font: { family: 'Inter', size: 10 }, boxWidth: 10 }
        },
        title: {
          display: true,
          text: 'By Status',
          color: '#ffffff',
          font: { family: 'Outfit', size: 12, weight: 'bold' }
      }
    }
  });
}
