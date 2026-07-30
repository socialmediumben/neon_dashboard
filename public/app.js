// Application State
let activities = [];
let filteredActivities = [];
let currentPage = 1;
const pageSize = 10;
let sortField = 'Activity Date';
let sortAsc = false;

// Chart Instances
let eventsChartInstance = null;
let checkinsChartInstance = null;
let checkinsDowChartInstance = null;
let staffChartInstance = null;
let clubCheckinsChartInstance = null;

let disabledStaffSet = new Set();
let disabledClubsSet = new Set();

function loadDisabledClubs() {
  const saved = localStorage.getItem('neon_disabled_clubs');
  if (saved) {
    try {
      disabledClubsSet = new Set(JSON.parse(saved));
    } catch (e) {
      disabledClubsSet = new Set();
    }
  }
}

function saveDisabledClubs() {
  localStorage.setItem('neon_disabled_clubs', JSON.stringify(Array.from(disabledClubsSet)));
}

// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const infoBtn = document.getElementById('infoBtn');
const connectionStatus = document.getElementById('connectionStatus');

const tableSearch = document.getElementById('tableSearch');
const tableExclude = document.getElementById('tableExclude');
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
  console.log('🚀 [Neon CRM Dashboard v1.6.0] App initializing...');
  loadDisabledStaff();
  loadDisabledClubs();
  setupTheme();
  setupInfoModal();
  setupSectionHelpModals();
  setupTabs();
  setupEventListeners();
  setupChartFilters();
  setupGlobalDateFilters();
  setupHeaderActions();
  setupConfigSharing();
  checkAppStatus().then(() => {
    loadData();
    loadCharts();
  });
});

// Theme Setup (Light / Dark Mode)
function setupTheme() {
  const savedTheme = localStorage.getItem('neon_theme');
  console.log('🎨 [Theme] Saved theme preference:', savedTheme || 'dark (default)');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.checked = true;
  }

  themeToggle.addEventListener('change', () => {
    const isLight = themeToggle.checked;
    console.log(`🎨 [Theme] User toggled theme to: ${isLight ? 'Light Mode' : 'Dark Mode'}`);
    if (isLight) {
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
  console.log('ℹ️ [Info Modal] Setting up info modal event listeners');
  infoBtn.addEventListener('click', () => {
    console.log('ℹ️ [Info Modal] Opening v1.0.0 info & changelog modal');
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

// ─── Section Documentation Content & Pop-up Modal ───────────────────────────
const SECTION_DOCS = {
  events: {
    title: '🎟️ Event Attendance Report Details',
    content: `
      <h5>Data Source & Processing</h5>
      <p>This report queries Neon CRM's <code>events/search</code> API endpoint (via <code>/api/events</code>).</p>
      <ul>
        <li><strong>Included Data:</strong> All registered CRM events with start dates falling within the selected date range.</li>
        <li><strong>Metrics Shown:</strong> Event Name, Event Start Date, and Total Registered Attendees.</li>
        <li><strong>Filtering:</strong> Filterable by custom date pickers or quick relative time presets (Today, Week, Month, Quarter, Year).</li>
      </ul>
    `
  },
  checkins: {
    title: '📍 Check-Ins Over Time Report Details',
    content: `
      <h5>Data Source & Processing</h5>
      <p>This line graph analyzes logged activities in Neon CRM whose subject or type contains the word <strong>"Check-In"</strong>.</p>
      <ul>
        <li><strong>Pink Line (Daily Count):</strong> Shows the exact number of check-in activities logged on each individual calendar date.</li>
        <li><strong>Dashed Cyan Line (Daily Average):</strong> Displays the mean average check-ins per day across the selected date range.</li>
        <li><strong>📅 Day of Week Breakdown:</strong> Sub-panel bar graph summarizing check-in totals grouped by day of the week (Mon-Sun).</li>
        <li><strong>Filtering:</strong> Filterable by custom date range or relative time presets.</li>
      </ul>
    `
  },
  staff: {
    title: '👥 Activities by Staff Member Report Details',
    content: `
      <h5>Data Source & Processing</h5>
      <p>This multi-line progress graph tracks activities attributed to system staff members over time.</p>
      <ul>
        <li><strong>Multi-Staff Attribution:</strong> Activities with multiple staff members in <em>Created By</em> (e.g. "John Doe, Jane Smith") are attributed to each staff member individually.</li>
        <li><strong>Cumulative Sum:</strong> The Y-axis tracks running cumulative total activities. Lines plateau or rise over time, smoothing out data to visualize staff progress.</li>
        <li><strong>Interactive Staff Checkboxes:</strong> Check or uncheck staff members above the chart to toggle individual lines. Selections persist in browser storage.</li>
      </ul>
    `
  },
  clubCheckins: {
    title: '♣️ Club Check-Ins by Club Report Details',
    content: `
      <h5>Data Source & Processing</h5>
      <p>This weekly trend graph focuses on activities containing the phrase <strong>"Club Check-In"</strong> (e.g. <em>Cosplay Club Check-In</em>, <em>Teen Club Check-In</em>).</p>
      <ul>
        <li><strong>Weekly Buckets:</strong> The X-axis truncates date intervals into weekly units starting on Mondays (e.g. <code>Week of 7/6</code>).</li>
        <li><strong>Per-Club Lines & Averages:</strong> Each club gets a solid weekly trend line and a matching dashed average line in its assigned color.</li>
        <li><strong>Overall Average Line:</strong> A bold Black/White line representing the combined mean average weekly check-ins across all active clubs.</li>
        <li><strong>Interactive Club Checkboxes:</strong> Toggle individual clubs on or off using the checkboxes above the chart (preferences saved in browser storage).</li>
      </ul>
    `
  },
  ledger: {
    title: '📋 Activity Ledger Report Details',
    content: `
      <h5>Data Source & Processing</h5>
      <p>The Activity Ledger displays raw CRM activity records for granular exploration.</p>
      <ul>
        <li><strong>Exclusion Filter:</strong> By default, check-in activities are excluded using the typed exclusion box (<code>🚫 Exclude phrase...</code>) so the ledger focuses on core task notes.</li>
        <li><strong>Real-time Features:</strong> Instant subject/notes search, status filter, priority filter, table column sorting, pagination, and CSV data export.</li>
      </ul>
    `
  }
};

function setupSectionHelpModals() {
  const sectionHelpBtns = document.querySelectorAll('.section-help-btn');
  const helpModal = document.getElementById('sectionHelpModal');
  const closeHelpBtn = document.getElementById('closeSectionHelpBtn');
  const helpTitle = document.getElementById('helpModalTitle');
  const helpContent = document.getElementById('helpModalContent');

  if (!helpModal) return;

  sectionHelpBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const section = btn.dataset.section;
      const doc = SECTION_DOCS[section];

      if (doc) {
        helpTitle.textContent = doc.title;
        helpContent.innerHTML = doc.content;
        helpModal.classList.add('open');
        helpModal.setAttribute('aria-hidden', 'false');
      }
    });
  });

  if (closeHelpBtn) {
    closeHelpBtn.addEventListener('click', () => {
      helpModal.classList.remove('open');
      helpModal.setAttribute('aria-hidden', 'true');
    });
  }

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.classList.remove('open');
      helpModal.setAttribute('aria-hidden', 'true');
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
  // Table Filters & Search (Instant Client-Side Filtering)
  if (tableSearch) tableSearch.addEventListener('input', () => { currentPage = 1; filterAndRenderTable(); });
  if (filterStatus) filterStatus.addEventListener('change', () => { currentPage = 1; filterAndRenderTable(); });
  if (filterPriority) filterPriority.addEventListener('change', () => { currentPage = 1; filterAndRenderTable(); });
  
  // CSV Export
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);

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
  console.log('📡 [API Status] Checking Neon CRM backend server status...');
  try {
    const res = await fetch('/api/status');
    const status = await res.json();
    console.log('📡 [API Status] Server status response:', status);
    
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
    const emailReportTypeEl = document.getElementById('emailReportType');
    if (emailReportTypeEl) emailReportTypeEl.value = status.config.emailReportType || 'all';

    // Update connection indicator
    connectionStatus.className = 'connection-status';
    if (status.neonConfigured) {
      if (status.apiConnectionValid) {
        connectionStatus.classList.add('status-connected');
        connectionStatus.querySelector('.status-text').textContent = 'API Connected';
        console.log('✅ [API Status] Neon CRM API credentials valid and connected.');
      } else {
        connectionStatus.classList.add('status-disconnected');
        connectionStatus.querySelector('.status-text').textContent = 'API Error';
        console.warn('⚠️ [API Status] Neon CRM API connection error:', status.apiErrorMessage);
      }
    } else {
      connectionStatus.classList.add('status-disconnected');
      connectionStatus.querySelector('.status-text').textContent = 'API Unconfigured';
      console.warn('⚠️ [API Status] Neon CRM credentials not yet configured.');
    }
  } catch (err) {
    console.error('❌ [API Status] Failed to reach server status endpoint:', err);
    connectionStatus.className = 'connection-status status-disconnected';
    connectionStatus.querySelector('.status-text').textContent = 'Server Offline';
    showToast('Failed to contact server backend.', 'error');
  }
}

// Load Activities Data from API/Proxy
async function loadData() {
  // Clear table state
  tableBody.innerHTML = '<tr><td colspan="8" class="empty-table-state">Loading activities ledger...</td></tr>';
  
  const url = '/api/activities';
  console.log(`📊 [Data] Requesting activities from ${url}...`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Error fetching activities.');
    }

    const data = await res.json();
    activities = data.searchResults || [];
    console.log(`📊 [Data] Received ${activities.length} activities from server.`);
    
    // Sort default descending by date
    activities.sort((a, b) => new Date(b['Activity Date']) - new Date(a['Activity Date']));
    
    // Render Ledger Table
    currentPage = 1;
    filterAndRenderTable();

    // Render client-side charts (checkins + staff + club checkins) from activities data
    renderCheckinsChart();
    renderStaffChart();
    renderClubCheckinsChart();
  } catch (err) {
    console.error('❌ [Data] Failed to load activities:', err);
    showToast(`Failed to load activities: ${err.message}`, 'error');
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-table-state" style="color:var(--danger)">Error: ${err.message}</td></tr>`;
  }
}

// ─── Relative Date Calculation Helper ──────────────────────────────────────
function getRelativeDateRange(preset) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const date = now.getDate();

  const formatDate = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  let startDate, endDate;

  switch (preset) {
    case 'today':
      startDate = new Date(year, month, date);
      endDate = new Date(year, month, date);
      break;

    case 'yesterday':
      startDate = new Date(year, month, date - 1);
      endDate = new Date(year, month, date - 1);
      break;

    case 'tomorrow':
      startDate = new Date(year, month, date + 1);
      endDate = new Date(year, month, date + 1);
      break;

    case 'this_week': {
      const day = now.getDay();
      const diffToMon = date - day + (day === 0 ? -6 : 1);
      startDate = new Date(year, month, diffToMon);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      break;
    }

    case 'last_week': {
      const day = now.getDay();
      const diffToMon = date - day + (day === 0 ? -6 : 1) - 7;
      startDate = new Date(year, month, diffToMon);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      break;
    }

    case 'next_week': {
      const day = now.getDay();
      const diffToMon = date - day + (day === 0 ? -6 : 1) + 7;
      startDate = new Date(year, month, diffToMon);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      break;
    }

    case 'this_month':
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
      break;

    case 'last_month':
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
      break;

    case 'next_month':
      startDate = new Date(year, month + 1, 1);
      endDate = new Date(year, month + 2, 0);
      break;

    case 'this_quarter': {
      const q = Math.floor(month / 3);
      startDate = new Date(year, q * 3, 1);
      endDate = new Date(year, q * 3 + 3, 0);
      break;
    }

    case 'last_quarter': {
      const q = Math.floor(month / 3);
      startDate = new Date(year, (q - 1) * 3, 1);
      endDate = new Date(year, (q - 1) * 3 + 3, 0);
      break;
    }

    case 'next_quarter': {
      const q = Math.floor(month / 3);
      startDate = new Date(year, (q + 1) * 3, 1);
      endDate = new Date(year, (q + 1) * 3 + 3, 0);
      break;
    }

    case 'this_year':
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      break;

    case 'last_year':
      startDate = new Date(year - 1, 0, 1);
      endDate = new Date(year - 1, 11, 31);
      break;

    case 'next_year':
      startDate = new Date(year + 1, 0, 1);
      endDate = new Date(year + 1, 11, 31);
      break;

    default:
      return { after: '', before: '' };
  }

  return {
    after: formatDate(startDate),
    before: formatDate(endDate)
  };
}

function bindPresetAndInputs(presetId, afterId, beforeId, onApply) {
  const presetEl = document.getElementById(presetId);
  const afterEl = document.getElementById(afterId);
  const beforeEl = document.getElementById(beforeId);

  if (presetEl) {
    presetEl.addEventListener('change', () => {
      const val = presetEl.value;
      if (val !== 'custom') {
        const { after, before } = getRelativeDateRange(val);
        if (afterEl) afterEl.value = after;
        if (beforeEl) beforeEl.value = before;
      }
      onApply();
    });
  }

  const setCustom = () => {
    if (presetEl) presetEl.value = 'custom';
  };

  if (afterEl) afterEl.addEventListener('change', setCustom);
  if (beforeEl) beforeEl.addEventListener('change', setCustom);
}

// ─── Chart Filter Controls Setup ───────────────────────────────────────────
function setupChartFilters() {
  bindPresetAndInputs('eventsPreset', 'eventsAfter', 'eventsBefore', () => loadEventsChart());
  bindPresetAndInputs('checkinsPreset', 'checkinsAfter', 'checkinsBefore', () => renderCheckinsChart());
  bindPresetAndInputs('staffPreset', 'staffAfter', 'staffBefore', () => renderStaffChart());
  bindPresetAndInputs('clubCheckinsPreset', 'clubCheckinsAfter', 'clubCheckinsBefore', () => renderClubCheckinsChart());

  // Events Attendance chart filters
  document.getElementById('applyEventsFilter').addEventListener('click', () => loadEventsChart());
  document.getElementById('clearEventsFilter').addEventListener('click', () => {
    document.getElementById('eventsAfter').value = '';
    document.getElementById('eventsBefore').value = '';
    const preset = document.getElementById('eventsPreset');
    if (preset) preset.value = 'custom';
    loadEventsChart();
  });

  // Check-Ins over time filters (client-side from activities array)
  document.getElementById('applyCheckinsFilter').addEventListener('click', () => renderCheckinsChart());
  document.getElementById('clearCheckinsFilter').addEventListener('click', () => {
    document.getElementById('checkinsAfter').value = '';
    document.getElementById('checkinsBefore').value = '';
    const preset = document.getElementById('checkinsPreset');
    if (preset) preset.value = 'custom';
    renderCheckinsChart();
  });

  // Staff bar chart filters (client-side from activities array)
  document.getElementById('applyStaffFilter').addEventListener('click', () => renderStaffChart());
  document.getElementById('clearStaffFilter').addEventListener('click', () => {
    document.getElementById('staffAfter').value = '';
    document.getElementById('staffBefore').value = '';
    const preset = document.getElementById('staffPreset');
    if (preset) preset.value = 'custom';
    renderStaffChart();
  });

  // Club Check-Ins bar chart filters (client-side from activities array)
  document.getElementById('applyClubCheckinsFilter').addEventListener('click', () => renderClubCheckinsChart());
  document.getElementById('clearClubCheckinsFilter').addEventListener('click', () => {
    document.getElementById('clubCheckinsAfter').value = '';
    document.getElementById('clubCheckinsBefore').value = '';
    const preset = document.getElementById('clubCheckinsPreset');
    if (preset) preset.value = 'custom';
    renderClubCheckinsChart();
  });
}

// ─── Global Date Range Filter Setup ─────────────────────────────────────────
function setupGlobalDateFilters() {
  bindPresetAndInputs('globalPreset', 'globalAfter', 'globalBefore', () => applyGlobalDatesToAllCharts());

  const applyGlobalBtn = document.getElementById('applyGlobalFilter');
  if (applyGlobalBtn) {
    applyGlobalBtn.addEventListener('click', () => applyGlobalDatesToAllCharts());
  }

  const clearGlobalBtn = document.getElementById('clearGlobalFilter');
  if (clearGlobalBtn) {
    clearGlobalBtn.addEventListener('click', () => resetGlobalDatesAllCharts());
  }
}

function applyGlobalDatesToAllCharts() {
  const gAfter = document.getElementById('globalAfter').value;
  const gBefore = document.getElementById('globalBefore').value;
  const gPreset = document.getElementById('globalPreset').value;

  const chartPrefixes = ['events', 'checkins', 'staff', 'clubCheckins'];

  chartPrefixes.forEach(prefix => {
    const afterEl = document.getElementById(`${prefix}After`);
    const beforeEl = document.getElementById(`${prefix}Before`);
    const presetEl = document.getElementById(`${prefix}Preset`);

    if (afterEl) afterEl.value = gAfter;
    if (beforeEl) beforeEl.value = gBefore;
    if (presetEl) presetEl.value = gPreset;
  });

  loadEventsChart();
  renderCheckinsChart();
  renderStaffChart();
  renderClubCheckinsChart();
  showToast('Applied global date range to all charts', 'success');
}

function resetGlobalDatesAllCharts() {
  document.getElementById('globalAfter').value = '';
  document.getElementById('globalBefore').value = '';
  document.getElementById('globalPreset').value = 'custom';

  const chartPrefixes = ['events', 'checkins', 'staff', 'clubCheckins'];

  chartPrefixes.forEach(prefix => {
    const afterEl = document.getElementById(`${prefix}After`);
    const beforeEl = document.getElementById(`${prefix}Before`);
    const presetEl = document.getElementById(`${prefix}Preset`);

    if (afterEl) afterEl.value = '';
    if (beforeEl) beforeEl.value = '';
    if (presetEl) presetEl.value = 'custom';
  });

  loadEventsChart();
  renderCheckinsChart();
  renderStaffChart();
  renderClubCheckinsChart();
  showToast('Reset date range to All Time', 'info');
}

// ─── Header Action Handlers (Print, Save Config, Load Config, Refresh) ───────
function setupHeaderActions() {
  const printBtn = document.getElementById('printReportBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  const refreshBtn = document.getElementById('refreshDataBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      showToast('Refreshing live data from Neon CRM API...', 'info');
      refreshBtn.disabled = true;
      try {
        await loadData();
        await loadCharts();
        showToast('Data refreshed successfully!', 'success');
      } catch (err) {
        showToast(`Refresh failed: ${err.message}`, 'error');
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }
}

// ─── Config Sharing (App Browser Storage & JSON File Export/Import) ─────────
function setupConfigSharing() {
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const loadConfigBtn = document.getElementById('loadConfigBtn');
  const configFileInput = document.getElementById('configFileInput');
  const modal = document.getElementById('configChoiceModal');
  const closeBtn = document.getElementById('closeConfigChoiceBtn');
  const saveOptions = document.getElementById('saveOptions');
  const loadOptions = document.getElementById('loadOptions');
  const title = document.getElementById('configChoiceTitle');

  const saveToAppBtn = document.getElementById('saveToAppBtn');
  const saveToJsonBtn = document.getElementById('saveToJsonBtn');
  const loadFromAppBtn = document.getElementById('loadFromAppBtn');
  const loadFromJsonBtn = document.getElementById('loadFromJsonBtn');

  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      title.textContent = '💾 Save Report Configuration';
      saveOptions.classList.remove('hidden');
      loadOptions.classList.add('hidden');
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  if (loadConfigBtn) {
    loadConfigBtn.addEventListener('click', () => {
      title.textContent = '📂 Load Report Configuration';
      loadOptions.classList.remove('hidden');
      saveOptions.classList.add('hidden');
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  if (saveToAppBtn) {
    saveToAppBtn.addEventListener('click', () => {
      saveConfigToApp();
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  if (saveToJsonBtn) {
    saveToJsonBtn.addEventListener('click', () => {
      exportReportConfigJson();
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  if (loadFromAppBtn) {
    loadFromAppBtn.addEventListener('click', () => {
      loadConfigFromApp();
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  if (loadFromJsonBtn && configFileInput) {
    loadFromJsonBtn.addEventListener('click', () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      configFileInput.click();
    });
    configFileInput.addEventListener('change', importReportConfigJson);
  }
}

function getReportConfigData() {
  return {
    version: '1.6.0',
    exportedAt: new Date().toISOString(),
    globalDate: {
      preset: document.getElementById('globalPreset')?.value || 'custom',
      after: document.getElementById('globalAfter')?.value || '',
      before: document.getElementById('globalBefore')?.value || ''
    },
    charts: {
      events: {
        preset: document.getElementById('eventsPreset')?.value || 'custom',
        after: document.getElementById('eventsAfter')?.value || '',
        before: document.getElementById('eventsBefore')?.value || ''
      },
      checkins: {
        preset: document.getElementById('checkinsPreset')?.value || 'custom',
        after: document.getElementById('checkinsAfter')?.value || '',
        before: document.getElementById('checkinsBefore')?.value || ''
      },
      staff: {
        preset: document.getElementById('staffPreset')?.value || 'custom',
        after: document.getElementById('staffAfter')?.value || '',
        before: document.getElementById('staffBefore')?.value || ''
      },
      clubCheckins: {
        preset: document.getElementById('clubCheckinsPreset')?.value || 'custom',
        after: document.getElementById('clubCheckinsAfter')?.value || '',
        before: document.getElementById('clubCheckinsBefore')?.value || ''
      }
    },
    disabledStaff: Array.from(disabledStaffSet),
    disabledClubs: Array.from(disabledClubsSet),
    tableFilters: {
      search: document.getElementById('tableSearch')?.value || '',
      exclude: document.getElementById('tableExclude')?.value || 'Check-In',
      status: document.getElementById('filterStatus')?.value || '',
      priority: document.getElementById('filterPriority')?.value || ''
    }
  };
}

function applyReportConfigData(config) {
  if (config.globalDate) {
    if (document.getElementById('globalPreset')) document.getElementById('globalPreset').value = config.globalDate.preset || 'custom';
    if (document.getElementById('globalAfter')) document.getElementById('globalAfter').value = config.globalDate.after || '';
    if (document.getElementById('globalBefore')) document.getElementById('globalBefore').value = config.globalDate.before || '';
  }

  if (config.charts) {
    Object.keys(config.charts).forEach(prefix => {
      const item = config.charts[prefix];
      if (document.getElementById(`${prefix}Preset`)) document.getElementById(`${prefix}Preset`).value = item.preset || 'custom';
      if (document.getElementById(`${prefix}After`)) document.getElementById(`${prefix}After`).value = item.after || '';
      if (document.getElementById(`${prefix}Before`)) document.getElementById(`${prefix}Before`).value = item.before || '';
    });
  }

  if (Array.isArray(config.disabledStaff)) {
    disabledStaffSet = new Set(config.disabledStaff);
    saveDisabledStaff();
  }

  if (Array.isArray(config.disabledClubs)) {
    disabledClubsSet = new Set(config.disabledClubs);
    saveDisabledClubs();
  }

  if (config.tableFilters) {
    if (document.getElementById('tableSearch')) document.getElementById('tableSearch').value = config.tableFilters.search || '';
    if (document.getElementById('tableExclude')) document.getElementById('tableExclude').value = config.tableFilters.exclude || '';
    if (document.getElementById('filterStatus')) document.getElementById('filterStatus').value = config.tableFilters.status || '';
    if (document.getElementById('filterPriority')) document.getElementById('filterPriority').value = config.tableFilters.priority || '';
  }

  loadEventsChart();
  renderCheckinsChart();
  renderStaffChart();
  renderClubCheckinsChart();
  filterAndRenderTable();
}

function saveConfigToApp() {
  const configData = getReportConfigData();
  localStorage.setItem('neon_app_config', JSON.stringify(configData));
  showToast('Saved report configuration to App (Browser Storage)!', 'success');
}

function loadConfigFromApp() {
  const saved = localStorage.getItem('neon_app_config');
  if (!saved) {
    showToast('No saved configuration found in App storage. Save a configuration first!', 'error');
    return;
  }
  try {
    const config = JSON.parse(saved);
    applyReportConfigData(config);
    showToast('Successfully loaded configuration from App storage!', 'success');
  } catch (err) {
    console.error('Failed to parse saved app config:', err);
    showToast(`Error loading saved config: ${err.message}`, 'error');
  }
}

function exportReportConfigJson() {
  const configData = getReportConfigData();
  const jsonStr = JSON.stringify(configData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `neon_report_config_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Exported report configuration JSON file!', 'success');
}

function importReportConfigJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const config = JSON.parse(event.target.result);
      applyReportConfigData(config);
      showToast('Successfully loaded report configuration!', 'success');
    } catch (err) {
      console.error('Failed to parse config JSON:', err);
      showToast(`Invalid config JSON file: ${err.message}`, 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ─── Load All Charts ────────────────────────────────────────────────────────
function loadCharts() {
  loadEventsChart();
  // Check-ins and staff charts render from activities data once loaded
}

// ─── Chart 1: Event Attendance Bar Chart ────────────────────────────────────
async function loadEventsChart() {
  const after = document.getElementById('eventsAfter').value;
  const before = document.getElementById('eventsBefore').value;

  const container = document.getElementById('eventsChart').parentElement;
  container.innerHTML = '<div class="chart-loading">⏳ Loading event data...</div>';

  let url = '/api/events';
  const params = new URLSearchParams();
  if (after) params.set('after', after);
  if (before) params.set('before', before);
  if (params.toString()) url += '?' + params.toString();

  console.log(`🎟️ [Events Chart] Fetching: ${url}`);

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load events.');

    const events = (data.events || []).sort((a, b) => new Date(a['Event Date']) - new Date(b['Event Date']));
    console.log(`🎟️ [Events Chart] Rendering ${events.length} events.`);

    // Rebuild canvas (destroyed charts leave ghost state)
    container.innerHTML = '<canvas id="eventsChart"></canvas>';
    const ctx = document.getElementById('eventsChart').getContext('2d');

    if (eventsChartInstance) eventsChartInstance.destroy();

    const isDark = !document.body.classList.contains('light-theme');
    const textColor = isDark ? '#a0aec0' : '#334155';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

    eventsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: events.map(e => {
          const name = e['Event Name'];
          return name.length > 28 ? name.substring(0, 26) + '…' : name;
        }),
        datasets: [{
          label: 'Registrants',
          data: events.map(e => e['Registrants']),
          backgroundColor: 'rgba(0, 242, 254, 0.7)',
          borderColor: 'rgba(0, 242, 254, 1)',
          borderWidth: 1,
          borderRadius: 6,
          hoverBackgroundColor: 'rgba(0, 242, 254, 0.9)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return events[idx]['Event Name'];
              },
              label: (item) => {
                const ev = events[item.dataIndex];
                return [
                  `Registrants: ${ev['Registrants']}`,
                  `Date: ${ev['Event Date']}`,
                  ev['Category'] ? `Category: ${ev['Category']}` : ''
                ].filter(Boolean);
              }
            },
            backgroundColor: 'rgba(12,9,25,0.95)',
            titleColor: '#00f2fe',
            bodyColor: '#a0aec0',
            borderColor: 'rgba(0,242,254,0.2)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { family: 'Inter', size: 10 }, maxRotation: 45 },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor, font: { family: 'Inter', size: 11 }, stepSize: 1 },
            grid: { color: gridColor }
          }
        }
      }
    });
  } catch (err) {
    console.error('❌ [Events Chart] Error:', err);
    container.innerHTML = `<div class="chart-loading" style="color:var(--danger)">⚠️ ${err.message}</div>`;
  }
}

// ─── Chart 2: Check-Ins Over Time Line Chart ─────────────────────────────────
function renderCheckinsChart() {
  const after = document.getElementById('checkinsAfter').value;
  const before = document.getElementById('checkinsBefore').value;

  // Filter activities to only Check-In subject
  let checkins = activities.filter(a =>
    (a['Activity Subject'] || '').toLowerCase().includes('check-in') ||
    (a['Activity Type'] || '').toLowerCase().includes('check-in')
  );

  if (after) checkins = checkins.filter(a => a['Activity Date'] >= after);
  if (before) checkins = checkins.filter(a => a['Activity Date'] <= before);

  console.log(`📍 [Check-Ins Chart] Rendering ${checkins.length} check-in activities.`);

  // Group by date
  const counts = {};
  checkins.forEach(a => {
    const date = a['Activity Date'];
    if (date) counts[date] = (counts[date] || 0) + 1;
  });

  const sortedDates = Object.keys(counts).sort();
  const totalCount = sortedDates.reduce((sum, d) => sum + counts[d], 0);
  const avg = sortedDates.length > 0 ? (totalCount / sortedDates.length) : 0;

  const container = document.getElementById('checkinsChart').parentElement;
  container.innerHTML = '<canvas id="checkinsChart"></canvas>';
  const ctx = document.getElementById('checkinsChart').getContext('2d');

  if (checkinsChartInstance) checkinsChartInstance.destroy();

  const isDark = !document.body.classList.contains('light-theme');
  const textColor = isDark ? '#a0aec0' : '#334155';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  checkinsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [
        {
          label: 'Check-Ins',
          data: sortedDates.map(d => counts[d]),
          borderColor: '#ff007f',
          backgroundColor: 'rgba(255, 0, 127, 0.12)',
          pointBackgroundColor: '#ff007f',
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4,
          borderWidth: 2
        },
        {
          label: `Daily Average (${avg.toFixed(1)}/day)`,
          data: sortedDates.map(() => avg),
          borderColor: '#00f2fe',
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 11, weight: '600' },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(12,9,25,0.95)',
          titleColor: '#ff007f',
          bodyColor: '#a0aec0',
          borderColor: 'rgba(255,0,127,0.2)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Inter', size: 10 }, maxRotation: 45 },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor, font: { family: 'Inter', size: 11 }, stepSize: 1 },
          grid: { color: gridColor }
        }
      }
    }
  });

  // Render Day of Week Breakdown Sub-chart
  renderCheckinsDowChart(checkins);
}

// ─── Check-Ins Day of Week Breakdown Chart ──────────────────────────────────
function renderCheckinsDowChart(checkins) {
  const dowCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const dowKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  checkins.forEach(a => {
    if (!a['Activity Date']) return;
    const d = new Date(a['Activity Date'] + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const dayName = dowKeys[d.getDay()];
    if (dowCounts[dayName] !== undefined) {
      dowCounts[dayName]++;
    }
  });

  const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dowData = dowLabels.map(l => dowCounts[l]);

  const container = document.getElementById('checkinsDowChart').parentElement;
  container.innerHTML = '<canvas id="checkinsDowChart"></canvas>';
  const ctx = document.getElementById('checkinsDowChart').getContext('2d');

  if (checkinsDowChartInstance) checkinsDowChartInstance.destroy();

  const isDark = !document.body.classList.contains('light-theme');
  const textColor = isDark ? '#a0aec0' : '#334155';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  checkinsDowChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dowLabels,
      datasets: [{
        label: 'Check-Ins',
        data: dowData,
        backgroundColor: 'rgba(255, 0, 127, 0.75)',
        borderColor: '#ff007f',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: 'rgba(255, 0, 127, 0.95)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(12,9,25,0.95)',
          titleColor: '#ff007f',
          bodyColor: '#a0aec0',
          borderColor: 'rgba(255,0,127,0.2)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor, font: { family: 'Inter', size: 10 }, stepSize: 1 },
          grid: { color: gridColor }
        }
      }
    }
  });
}

// ─── Staff Filter & Multi-Staff Attribution Helpers ─────────────────────────
let disabledStaffSet = new Set(JSON.parse(localStorage.getItem('neon_disabled_staff') || '[]'));

function saveDisabledStaff() {
  localStorage.setItem('neon_disabled_staff', JSON.stringify([...disabledStaffSet]));
}

function extractStaffNames(createdByStr) {
  if (!createdByStr || !createdByStr.trim()) return ['Unassigned'];
  const parts = createdByStr.split(/[,;&]+/).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['Unassigned'];
}

function updateStaffFilterUI(allStaffMap) {
  const container = document.getElementById('staffFilterBar');
  if (!container) return;

  const staffNames = Object.keys(allStaffMap).sort();
  if (staffNames.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <span class="staff-filter-label">Filter Staff:</span>
    <div class="staff-filter-actions">
      <button type="button" class="btn-staff-action" id="selectAllStaff">Select All</button>
      <button type="button" class="btn-staff-action" id="deselectAllStaff">Deselect All</button>
    </div>
    <div class="staff-checkbox-list">
  `;

  staffNames.forEach(name => {
    const isChecked = !disabledStaffSet.has(name);
    const count = allStaffMap[name];
    html += `
      <label class="staff-checkbox-item">
        <input type="checkbox" data-staff="${encodeURIComponent(name)}" ${isChecked ? 'checked' : ''}>
        <span>${name} (${count})</span>
      </label>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Event Listeners for checkboxes
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const staffName = decodeURIComponent(e.target.dataset.staff);
      if (e.target.checked) {
        disabledStaffSet.delete(staffName);
      } else {
        disabledStaffSet.add(staffName);
      }
      saveDisabledStaff();
      renderStaffChart();
    });
  });

  const selectAllBtn = document.getElementById('selectAllStaff');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      disabledStaffSet.clear();
      saveDisabledStaff();
      updateStaffFilterUI(allStaffMap);
      renderStaffChart();
    });
  }

  const deselectAllBtn = document.getElementById('deselectAllStaff');
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      staffNames.forEach(name => disabledStaffSet.add(name));
      saveDisabledStaff();
      updateStaffFilterUI(allStaffMap);
      renderStaffChart();
    });
  }
}

// ─── Chart 3: Activities by Staff Member (Cumulative Multi-Line Chart) ──────
function renderStaffChart() {
  const after = document.getElementById('staffAfter').value;
  const before = document.getElementById('staffBefore').value;

  let data = [...activities];
  if (after) data = data.filter(a => a['Activity Date'] >= after);
  if (before) data = data.filter(a => a['Activity Date'] <= before);

  // Extract all unique staff and build activity count map per staff for checkbox filter
  const allStaffMap = {};
  data.forEach(a => {
    const staffList = extractStaffNames(a['Created By']);
    staffList.forEach(user => {
      allStaffMap[user] = (allStaffMap[user] || 0) + 1;
    });
  });

  // Render/Update the staff filter checkboxes
  updateStaffFilterUI(allStaffMap);

  // Active staff (checked checkboxes) sorted by total count
  const activeStaff = Object.keys(allStaffMap)
    .filter(name => !disabledStaffSet.has(name))
    .sort((a, b) => allStaffMap[b] - allStaffMap[a]);

  // Extract all unique dates in ascending order
  const uniqueDatesSet = new Set();
  data.forEach(a => {
    if (a['Activity Date']) uniqueDatesSet.add(a['Activity Date']);
  });

  let sortedDates = Array.from(uniqueDatesSet).sort();

  if (sortedDates.length === 0) {
    if (after && before) {
      sortedDates = [after, before];
    } else {
      sortedDates = [new Date().toISOString().split('T')[0]];
    }
  }

  // Create continuous daily timeline array from minDate to maxDate
  const minDateStr = after || sortedDates[0];
  const maxDateStr = before || sortedDates[sortedDates.length - 1];

  const timelineDates = [];
  try {
    let curr = new Date(minDateStr + 'T00:00:00');
    const end = new Date(maxDateStr + 'T00:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      timelineDates.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }
  } catch (err) {
    timelineDates.push(...sortedDates);
  }

  // Per staff daily activity count: staffDailyMap[staff][date] = count
  const staffDailyMap = {};
  activeStaff.forEach(staff => { staffDailyMap[staff] = {}; });

  data.forEach(a => {
    const date = a['Activity Date'];
    if (!date) return;
    const staffList = extractStaffNames(a['Created By']);
    staffList.forEach(staff => {
      if (staffDailyMap[staff]) {
        staffDailyMap[staff][date] = (staffDailyMap[staff][date] || 0) + 1;
      }
    });
  });

  const palette = [
    '#00f2fe',
    '#9d4edd',
    '#ff007f',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#6366f1'
  ];

  // Build cumulative datasets for each active staff
  const datasets = activeStaff.map((staff, i) => {
    let cumSum = 0;
    const cumData = timelineDates.map(date => {
      const dailyCount = staffDailyMap[staff][date] || 0;
      cumSum += dailyCount;
      return cumSum;
    });

    const color = palette[i % palette.length];
    return {
      label: staff,
      data: cumData,
      borderColor: color,
      backgroundColor: color + '22',
      pointBackgroundColor: color,
      pointRadius: timelineDates.length > 30 ? 2 : 4,
      pointHoverRadius: 7,
      fill: false,
      tension: 0.35,
      borderWidth: 2
    };
  });

  console.log(`👥 [Staff Chart] Rendering cumulative timeline graph for ${activeStaff.length} staff members across ${timelineDates.length} days.`);

  const container = document.getElementById('staffChart').parentElement;
  container.innerHTML = '<canvas id="staffChart"></canvas>';
  const ctx = document.getElementById('staffChart').getContext('2d');

  if (staffChartInstance) staffChartInstance.destroy();

  const isDark = !document.body.classList.contains('light-theme');
  const textColor = isDark ? '#a0aec0' : '#334155';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  staffChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timelineDates,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 11, weight: '600' },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(12,9,25,0.95)',
          titleColor: '#00f2fe',
          bodyColor: '#a0aec0',
          borderColor: 'rgba(0,242,254,0.2)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Inter', size: 10 }, maxRotation: 45 },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor, font: { family: 'Inter', size: 11 }, stepSize: 1 },
          grid: { color: gridColor }
        }
      }
    }
  });
}

// Helper to get week start date (Monday) in YYYY-MM-DD
function getWeekStartDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, '0');
  const dy = String(mon.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
// ─── Interactive Club Filter UI Checkboxes ────────────────────────────────────
function updateClubFilterUI(allClubs) {
  const container = document.getElementById('clubFilterBar');
  if (!container) return;

  if (allClubs.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<span class="filter-bar-title">Clubs:</span>';

  allClubs.forEach(club => {
    const isChecked = !disabledClubsSet.has(club);
    const label = document.createElement('label');
    label.className = 'staff-checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        disabledClubsSet.delete(club);
      } else {
        disabledClubsSet.add(club);
      }
      saveDisabledClubs();
      renderClubCheckinsChart();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${club}`));
    container.appendChild(label);
  });
}

// ─── Chart 4: Club Check-Ins Weekly Multi-Line Chart ─────────────────────────
function renderClubCheckinsChart() {
  const after = document.getElementById('clubCheckinsAfter').value;
  const before = document.getElementById('clubCheckinsBefore').value;

  // Filter activities to subject or type containing "club check-in"
  let clubCheckins = activities.filter(a => {
    const subject = (a['Activity Subject'] || '').toLowerCase();
    const type = (a['Activity Type'] || '').toLowerCase();
    return subject.includes('club check-in') || type.includes('club check-in');
  });

  if (after) clubCheckins = clubCheckins.filter(a => a['Activity Date'] >= after);
  if (before) clubCheckins = clubCheckins.filter(a => a['Activity Date'] <= before);

  // Group by Club Name and Week Start Date
  const clubNamesSet = new Set();
  const weekStartDatesSet = new Set();
  const clubWeeklyCounts = {}; // clubWeeklyCounts[clubName][weekStartDate] = count

  clubCheckins.forEach(a => {
    const clubName = (a['Activity Subject'] || 'Other Club Check-In').trim();
    const weekStart = getWeekStartDate(a['Activity Date']);
    if (!weekStart) return;

    clubNamesSet.add(clubName);
    weekStartDatesSet.add(weekStart);

    if (!clubWeeklyCounts[clubName]) clubWeeklyCounts[clubName] = {};
    clubWeeklyCounts[clubName][weekStart] = (clubWeeklyCounts[clubName][weekStart] || 0) + 1;
  });

  const sortedWeekStarts = Array.from(weekStartDatesSet).sort();
  const sortedClubNames = Array.from(clubNamesSet).sort();

  // Render per-club filter checkboxes
  updateClubFilterUI(sortedClubNames);

  const activeClubNames = sortedClubNames.filter(name => !disabledClubsSet.has(name));

  // Format week labels as "Week of M/D"
  const weekLabels = sortedWeekStarts.map(wStr => {
    const parts = wStr.split('-');
    if (parts.length === 3) {
      return `Week of ${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    }
    return wStr;
  });

  const palette = [
    '#10b981',
    '#00f2fe',
    '#ff007f',
    '#9d4edd',
    '#f59e0b',
    '#3b82f6',
    '#ef4444',
    '#6366f1'
  ];

  const datasets = [];
  let totalActiveWeeklyCheckins = 0;
  const numWeeks = sortedWeekStarts.length || 1;

  activeClubNames.forEach((clubName, i) => {
    const data = sortedWeekStarts.map(wStart => clubWeeklyCounts[clubName][wStart] || 0);
    const clubTotal = data.reduce((sum, v) => sum + v, 0);
    const clubAvg = clubTotal / numWeeks;
    totalActiveWeeklyCheckins += clubTotal;
    const color = palette[i % palette.length];

    // 1) Main weekly trend line
    datasets.push({
      label: clubName,
      data,
      borderColor: color,
      backgroundColor: color + '22',
      pointBackgroundColor: color,
      pointRadius: 5,
      pointHoverRadius: 8,
      fill: false,
      tension: 0.3,
      borderWidth: 2
    });

    // 2) Per-Club Average Line (dashed, matching club color)
    datasets.push({
      label: `${clubName} Avg (${clubAvg.toFixed(1)}/wk)`,
      data: sortedWeekStarts.map(() => clubAvg),
      borderColor: color,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      borderWidth: 1.5
    });
  });

  const isDark = !document.body.classList.contains('light-theme');
  const overallColor = isDark ? '#ffffff' : '#0f172a';
  const overallWeeklyAvg = activeClubNames.length > 0 ? (totalActiveWeeklyCheckins / numWeeks) : 0;

  // 3) Overall Average Line across all active clubs (Black in light mode, White in dark mode)
  if (activeClubNames.length > 0) {
    datasets.push({
      label: `Overall Average (${overallWeeklyAvg.toFixed(1)}/wk)`,
      data: sortedWeekStarts.map(() => overallWeeklyAvg),
      borderColor: overallColor,
      borderWidth: 2.5,
      borderDash: [8, 4],
      pointRadius: 0,
      fill: false
    });
  }

  console.log(`♣️ [Club Check-Ins Chart] Rendering ${datasets.length} datasets for ${activeClubNames.length} active clubs across ${sortedWeekStarts.length} weeks.`);

  const container = document.getElementById('clubCheckinsChart').parentElement;
  container.innerHTML = '<canvas id="clubCheckinsChart"></canvas>';
  const ctx = document.getElementById('clubCheckinsChart').getContext('2d');

  if (clubCheckinsChartInstance) clubCheckinsChartInstance.destroy();

  const isDark = !document.body.classList.contains('light-theme');
  const textColor = isDark ? '#a0aec0' : '#334155';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  clubCheckinsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weekLabels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 11, weight: '600' },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(12,9,25,0.95)',
          titleColor: '#10b981',
          bodyColor: '#a0aec0',
          borderColor: 'rgba(16,185,129,0.2)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor, font: { family: 'Inter', size: 11 }, stepSize: 1 },
          grid: { color: gridColor }
        }
      }
    }
  });
}

// Filter, sort, and paginate the local dataset
function filterAndRenderTable() {
  const searchVal = tableSearch ? tableSearch.value.toLowerCase().trim() : '';
  const excludeVal = tableExclude ? tableExclude.value.toLowerCase().trim() : 'check-in';
  const statusVal = filterStatus ? filterStatus.value : '';
  const priorityVal = filterPriority ? filterPriority.value : '';

  filteredActivities = activities.filter(a => {
    const subjectLower = (a['Activity Subject'] || '').toLowerCase();
    const typeLower = (a['Activity Type'] || '').toLowerCase();

    // Typed exclusion phrase check (e.g. "check-in")
    if (excludeVal && (subjectLower.includes(excludeVal) || typeLower.includes(excludeVal))) {
      return false;
    }

    // Search match (subject or notes)
    const subjectMatch = subjectLower.includes(searchVal);
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

  const typeHeader = document.querySelector('#activitiesTable th:nth-child(3)');
  const memberHeader = document.querySelector('#activitiesTable th:nth-child(4)');
  const assignedHeader = document.querySelector('#activitiesTable th:nth-child(5)');
  
  if (typeHeader) typeHeader.textContent = 'Type';
  if (memberHeader) memberHeader.textContent = 'Member ID';
  if (assignedHeader) assignedHeader.textContent = 'Assigned To';

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

  // Only send API key if filled in
  const apikey = formData.get('neonApiKey');
  if (apikey) payload.neonApiKey = apikey;

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
    loadCharts();
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
    }
  });
}

