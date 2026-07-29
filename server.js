const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
let activeCronJob = null;

// Mock Data Generator
const generateMockActivities = () => {
  const subjects = [
    'Membership Renewal Welcome Call',
    'Follow up on Annual Gala Ticket Purchase',
    'Major Donor Coffee Meeting',
    'Volunteer Orientation Follow-up',
    'Corporate Sponsorship Outreach',
    'Inquiry about Monthly Giving Circle',
    'Stewardship Call - 5 Year Donor Anniversary',
    'Legacy Gift Inquiry Response',
    'Website Feedback Intake Call',
    'Newsletter Unsubscribe Retention Call',
    'Thank You Call - First Time Donation',
    'Board Meeting Agenda Review',
    'Fall Festival Volunteer Recruitment',
    'End of Year Campaign Prep Meeting'
  ];

  const types = ['Phone Call', 'Email', 'Meeting', 'Task', 'Letter', 'Event'];
  const statuses = ['Pending', 'Completed', 'In Progress', 'Deferred', 'Cancelled'];
  const priorities = ['High', 'Normal', 'Low'];
  const members = [
    { id: '10982', name: 'Alice Henderson' },
    { id: '10432', name: 'Robert Chen' },
    { id: '10283', name: 'Samantha Carter' },
    { id: '10741', name: 'James Peterson' },
    { id: '10512', name: 'Marcus Aurelius' },
    { id: '10884', name: 'Elena Rostova' },
    { id: '11023', name: 'David Beckham' }
  ];
  const staff = ['Sarah Jenkins', 'Michael Chang', 'Emily Rodriguez', 'David Kim'];
  const notes = [
    'Spoke on phone, very excited to renew membership next month.',
    'Sent follow up email with Gala details and parking directions.',
    'Discussed corporate giving pathways and sponsor benefits.',
    'Completed orientation registration, scheduled first shift.',
    'Voicemail left. Will call back in 3 business days.',
    'Constituent expressed interest in legacy giving, requested brochure.',
    'Verified updated address and email details during conversation.',
    'Meeting rescheduled to next Friday at 10:00 AM.'
  ];

  const mockList = [];
  const now = new Date();

  // Create 45 mock activities spread over the past 30 days and next 7 days
  for (let i = 0; i < 45; i++) {
    const activityDate = new Date();
    // Spread dates: some past, some today, some future
    const offsetDays = Math.floor(Math.random() * 37) - 30; // -30 to +7 days
    activityDate.setDate(now.getDate() + offsetDays);

    const isPast = activityDate < now;
    
    // Choose status based on date to make it realistic
    let status = 'Pending';
    if (isPast) {
      status = Math.random() > 0.3 ? 'Completed' : (Math.random() > 0.5 ? 'Deferred' : 'Pending');
    } else {
      status = Math.random() > 0.8 ? 'Completed' : 'Pending';
    }

    const member = members[Math.floor(Math.random() * members.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];

    mockList.push({
      'Activity ID': (20450 + i).toString(),
      'Activity Subject': subjects[Math.floor(Math.random() * subjects.length)],
      'Activity Date': activityDate.toISOString().split('T')[0],
      'Status': status,
      'Priority': priority,
      'Activity Type': types[Math.floor(Math.random() * types.length)],
      'Client ID': member.id,
      'Client Name': member.name, // Extended for convenience
      'Created By': staff[Math.floor(Math.random() * staff.length)],
      'Activity Note': notes[Math.floor(Math.random() * notes.length)]
    });
  }

  // Sort by date descending
  return mockList.sort((a, b) => new Date(b['Activity Date']) - new Date(a['Activity Date']));
};

// Update .env file helper
const updateEnvFile = (config) => {
  const envPath = path.join(__dirname, '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const lines = envContent.split('\n');
  const updatedKeys = new Set();

  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const parts = trimmed.split('=');
    const key = parts[0].trim();

    if (config.hasOwnProperty(key)) {
      updatedKeys.add(key);
      return `${key}=${config[key]}`;
    }
    return line;
  });

  // Append new keys that were not in the file
  Object.keys(config).forEach(key => {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${config[key]}`);
    }
  });

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');

  // Update in memory
  Object.keys(config).forEach(key => {
    process.env[key] = config[key];
  });
};

// API: Get App Status and Config (secure)
app.get('/api/status', async (req, res) => {
  const isNeonConfigured = !!(process.env.NEON_ORG_ID && process.env.NEON_API_KEY);
  const isSMTPConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  let apiConnectionValid = false;
  let apiErrorMessage = '';

  if (isNeonConfigured) {
    try {
      // Try to ping the Neon CRM API search fields endpoint to verify credentials
      const auth = Buffer.from(`${process.env.NEON_ORG_ID}:${process.env.NEON_API_KEY}`).toString('base64');
      const response = await fetch(`${process.env.NEON_API_URL || 'https://api.neoncrm.com/v2'}/activities/search/searchFields`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'NEON-API-VERSION': '2.11',
          'Content-Type': 'application/json'
        },
        // Timeout 5 seconds
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        apiConnectionValid = true;
      } else {
        apiErrorMessage = `API returned HTTP ${response.status} (${response.statusText})`;
      }
    } catch (err) {
      apiErrorMessage = `Connection failed: ${err.message}`;
    }
  }

  res.json({
    neonConfigured: isNeonConfigured,
    smtpConfigured: isSMTPConfigured,
    apiConnectionValid,
    apiErrorMessage,
    config: {
      neonOrgId: process.env.NEON_ORG_ID || '',
      neonApiUrl: process.env.NEON_API_URL || 'https://api.neoncrm.com/v2',
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: process.env.SMTP_PORT || '587',
      smtpSecure: process.env.SMTP_SECURE === 'true',
      smtpUser: process.env.SMTP_USER || '',
      emailFrom: process.env.EMAIL_FROM || 'Neon CRM Dashboard <noreply@yourdomain.com>',
      emailRecipient: process.env.EMAIL_RECIPIENT || '',
      emailSchedule: process.env.EMAIL_SCHEDULE || '0 8 * * *',
      emailEnabled: process.env.EMAIL_ENABLED === 'true',
      emailReportType: process.env.EMAIL_REPORT_TYPE || 'all'
    }
  });
});

// API: Update Config
app.post('/api/config', (req, res) => {
  try {
    const {
      neonOrgId,
      neonApiKey,
      neonApiUrl,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      emailFrom,
      emailRecipient,
      emailSchedule,
      emailEnabled,
      emailReportType
    } = req.body;

    const newConfig = {};
    if (neonOrgId !== undefined) newConfig.NEON_ORG_ID = neonOrgId.trim();
    if (neonApiKey !== undefined) newConfig.NEON_API_KEY = neonApiKey.trim();
    if (neonApiUrl !== undefined) newConfig.NEON_API_URL = neonApiUrl.trim();
    if (smtpHost !== undefined) newConfig.SMTP_HOST = smtpHost.trim();
    if (smtpPort !== undefined) newConfig.SMTP_PORT = smtpPort.toString();
    if (smtpSecure !== undefined) newConfig.SMTP_SECURE = smtpSecure.toString();
    if (smtpUser !== undefined) newConfig.SMTP_USER = smtpUser.trim();
    if (smtpPass !== undefined) newConfig.SMTP_PASS = smtpPass.trim();
    if (emailFrom !== undefined) newConfig.EMAIL_FROM = emailFrom.trim();
    if (emailRecipient !== undefined) newConfig.EMAIL_RECIPIENT = emailRecipient.trim();
    if (emailSchedule !== undefined) newConfig.EMAIL_SCHEDULE = emailSchedule.trim();
    if (emailEnabled !== undefined) newConfig.EMAIL_ENABLED = emailEnabled.toString();
    if (emailReportType !== undefined) newConfig.EMAIL_REPORT_TYPE = emailReportType.trim();

    updateEnvFile(newConfig);
    
    // Reload scheduler
    initializeScheduler();

    res.json({ success: true, message: 'Configuration updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to update configuration: ${err.message}` });
  }
});

// API: Fetch Events with Attendee Counts
app.get('/api/events', async (req, res) => {
  if (!process.env.NEON_ORG_ID || !process.env.NEON_API_KEY) {
    return res.status(503).json({ success: false, message: 'Neon CRM API not configured.' });
  }

  try {
    const auth = Buffer.from(`${process.env.NEON_ORG_ID}:${process.env.NEON_API_KEY}`).toString('base64');
    const apiBase = process.env.NEON_API_URL || 'https://api.neoncrm.com/v2';

    const searchFields = [];
    if (req.query.after) {
      searchFields.push({ field: 'Event Start Date', operator: 'GREATER_AND_EQUAL', value: req.query.after });
    }
    if (req.query.before) {
      searchFields.push({ field: 'Event Start Date', operator: 'LESS_AND_EQUAL', value: req.query.before });
    }
    if (searchFields.length === 0) {
      searchFields.push({ field: 'Event Start Date', operator: 'GREATER_THAN', value: '1970-01-01' });
    }

    let currentPage = 0;
    let totalPages = 1;
    let rawResults = [];

    while (currentPage < totalPages) {
      const response = await fetch(`${apiBase}/events/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'NEON-API-VERSION': '2.11',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          searchFields,
          outputFields: [
            'Event ID',
            'Event Name',
            'Event Start Date',
            'Event End Date',
            'Event Capacity',
            'Event Category Name',
            'Event Registration Attendee Count',
            'Registrants',
            'Marked Attended'
          ],
          pagination: {
            currentPage,
            pageSize: 200,
            sortColumn: 'Event Start Date',
            sortDirection: 'DESC'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Neon API Error: HTTP ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      rawResults = rawResults.concat(data.searchResults || []);
      totalPages = data.pagination ? data.pagination.totalPages : 1;
      currentPage++;
      if (currentPage >= 10) break;
    }

    const events = rawResults.map(item => ({
      'Event ID': item['Event ID'] || '',
      'Event Name': item['Event Name'] || 'Untitled Event',
      'Event Date': item['Event Start Date'] || '',
      'Event End Date': item['Event End Date'] || '',
      'Category': item['Event Category Name'] || '',
      'Capacity': item['Event Capacity'] ? parseInt(item['Event Capacity']) : null,
      'Registrants': parseInt(item['Registrants'] || item['Event Registration Attendee Count'] || '0', 10),
      'Attended': parseInt(item['Marked Attended'] || '0', 10)
    }));

    console.log(`✅ [Events API] Fetched ${events.length} events.`);
    res.json({ success: true, events });
  } catch (err) {
    console.error('❌ [Events API] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Fetch Activities (Real or Mock)
app.get('/api/activities', async (req, res) => {
  const isMock = req.query.mock === 'true' || !process.env.NEON_ORG_ID || !process.env.NEON_API_KEY;
  const reportType = req.query.report || 'all';

  if (isMock) {
    // Generate and return mock activities
    const activities = generateMockActivities();
    
    // Simple filter emulation for status and priority
    let filtered = [...activities];
    if (req.query.status) {
      filtered = filtered.filter(a => a.Status.toLowerCase() === req.query.status.toLowerCase());
    }
    if (req.query.priority) {
      filtered = filtered.filter(a => a.Priority.toLowerCase() === req.query.priority.toLowerCase());
    }

    // Emulate "Staff Activity Report" filter (no "Check-In" in subject or type)
    if (reportType === 'staff-activity') {
      filtered = filtered.filter(a => {
        const subject = a['Activity Subject'] || '';
        const type = a['Activity Type'] || '';
        return !subject.toLowerCase().includes('check-in') && type.toLowerCase() !== 'check-in';
      });
    }
    
    return res.json({
      searchResults: filtered,
      pagination: {
        currentPage: 0,
        pageSize: 100,
        totalResults: filtered.length,
        totalPages: 1
      },
      mock: true
    });
  }

  // Real API Fetch
  try {
    const auth = Buffer.from(`${process.env.NEON_ORG_ID}:${process.env.NEON_API_KEY}`).toString('base64');
    
    // Construct search query
    const searchFields = [];
    if (req.query.status) {
      searchFields.push({
        field: 'Activity Status',
        operator: 'EQUAL',
        value: req.query.status
      });
    }
    if (req.query.priority) {
      searchFields.push({
        field: 'Activity Priority',
        operator: 'EQUAL',
        value: req.query.priority
      });
    }
    
    if (reportType === 'staff-activity') {
      // Exclude "Check-In" solicitation method directly in API
      searchFields.push({
        field: 'Activity Solicitation Method',
        operator: 'NOT_EQUAL',
        value: 'Check-In'
      });
    } else {
      // Default filter if none provided (since searchFields cannot be empty in Neon v2)
      if (searchFields.length === 0) {
        searchFields.push({
          field: 'Activity Start Date',
          operator: 'GREATER_THAN',
          value: '1970-01-01'
        });
      }
    }

    let currentPage = 0;
    let totalPages = 1;
    let rawResults = [];

    while (currentPage < totalPages) {
      const body = {
        searchFields,
        outputFields: [
          'Activity ID',
          'Activity Subject',
          'Activity Start Date',
          'Activity Status',
          'Activity Priority',
          'Activity System User',
          'Activity Contact Account ID',
          'Account Name',
          'Activity Solicitation Method',
          'Activity Note'
        ],
        pagination: {
          currentPage,
          pageSize: 200,
          sortColumn: 'Activity Start Date',
          sortDirection: 'DESC'
        }
      };

      const response = await fetch(`${process.env.NEON_API_URL || 'https://api.neoncrm.com/v2'}/activities/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'NEON-API-VERSION': '2.11',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Neon API Error: HTTP ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      rawResults = rawResults.concat(data.searchResults || []);
      totalPages = data.pagination ? data.pagination.totalPages : 1;
      currentPage++;

      // Guard to prevent runaway queries (max 15 pages = 3000 records)
      if (currentPage >= 15) break;
    }
    
    // Translate Neon v2 fields to Dashboard Unified Schema
    let searchResults = rawResults.map(item => ({
      'Activity ID': item['Activity ID'] || '',
      'Activity Subject': item['Activity Subject'] || 'Untitled Activity',
      'Activity Date': item['Activity Start Date'] || '',
      'Status': item['Activity Status'] || 'Pending',
      'Priority': item['Activity Priority'] || 'Normal',
      'Activity Type': item['Activity Solicitation Method'] || 'Activity',
      'Client ID': item['Activity Contact Account ID'] || '',
      'Client Name': item['Account Name'] || '',
      'Created By': item['Activity System User'] || '',
      'Activity Note': item['Activity Note'] || ''
    }));

    // Post-filter: Exclude "Check-In" in subject on the server side
    if (reportType === 'staff-activity') {
      searchResults = searchResults.filter(item => {
        const subject = item['Activity Subject'] || '';
        return !subject.toLowerCase().includes('check-in');
      });
    }

    res.json({
      searchResults,
      pagination: {
        currentPage: 0,
        pageSize: 100,
        totalResults: searchResults.length, // updated count after post-filter
        totalPages: 1
      },
      mock: false
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Compile HTML email report helper
const compileEmailHTML = (activities) => {
  const total = activities.length;
  const completed = activities.filter(a => a.Status.toLowerCase() === 'completed').length;
  const pending = activities.filter(a => a.Status.toLowerCase() === 'pending' || a.Status.toLowerCase() === 'in progress').length;
  
  // Calculate Overdue
  const now = new Date();
  now.setHours(0,0,0,0);
  const overdue = activities.filter(a => {
    const isPending = a.Status.toLowerCase() === 'pending' || a.Status.toLowerCase() === 'in progress';
    const isPast = new Date(a['Activity Date']) < now;
    return isPending && isPast;
  }).length;

  // Compile table rows for top 12 pending/critical activities
  const criticalActivities = activities
    .filter(a => a.Status.toLowerCase() !== 'completed' && a.Status.toLowerCase() !== 'cancelled')
    .slice(0, 12);

  let tableRows = '';
  if (criticalActivities.length === 0) {
    tableRows = '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #888;">No pending or critical activities found.</td></tr>';
  } else {
    criticalActivities.forEach(a => {
      const isOverdue = new Date(a['Activity Date']) < now;
      const dateColor = isOverdue ? '#ff3b30' : '#333';
      const dateWeight = isOverdue ? 'bold' : 'normal';
      
      let priorityBadge = '';
      if (a.Priority.toLowerCase() === 'high') {
        priorityBadge = `<span style="background-color: #ffebeb; color: #ff3b30; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #ffd1d1;">High</span>`;
      } else if (a.Priority.toLowerCase() === 'low') {
        priorityBadge = `<span style="background-color: #f2f2f7; color: #8e8e93; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">Low</span>`;
      } else {
        priorityBadge = `<span style="background-color: #e5f6ff; color: #007aff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">Normal</span>`;
      }

      tableRows += `
        <tr style="border-bottom: 1px solid #e5e5ea;">
          <td style="padding: 10px; font-size: 13px; color: ${dateColor}; font-weight: ${dateWeight};">${a['Activity Date']}</td>
          <td style="padding: 10px; font-size: 13px; color: #1c1c1e; font-weight: bold;">${a['Activity Subject']}</td>
          <td style="padding: 10px; font-size: 13px; color: #48484a;">${a['Activity Type']}</td>
          <td style="padding: 10px; font-size: 13px; color: #48484a;">Member #${a['Client ID']}</td>
          <td style="padding: 10px; text-align: center;">${priorityBadge}</td>
        </tr>
      `;
    });
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Neon CRM Activities Digest</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f6f6; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e5e5ea;">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0b0914 0%, #1e133d 100%); padding: 30px; text-align: center;">
            <h1 style="color: #00f2fe; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(0,242,254,0.3);">Neon CRM Dashboard</h1>
            <p style="color: #ff007f; margin: 5px 0 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Daily Activities Digest</p>
          </td>
        </tr>
        
        <!-- Summary Cards -->
        <tr>
          <td style="padding: 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td width="31%" style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #e5e5ea;">
                  <div style="font-size: 11px; text-transform: uppercase; color: #8e8e93; font-weight: bold; letter-spacing: 0.5px;">Total Logged</div>
                  <div style="font-size: 24px; font-weight: bold; color: #1c1c1e; margin-top: 5px;">${total}</div>
                </td>
                <td width="3%">&nbsp;</td>
                <td width="31%" style="background-color: #fff9e6; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #ffeeba;">
                  <div style="font-size: 11px; text-transform: uppercase; color: #b78103; font-weight: bold; letter-spacing: 0.5px;">Pending</div>
                  <div style="font-size: 24px; font-weight: bold; color: #b78103; margin-top: 5px;">${pending}</div>
                </td>
                <td width="3%">&nbsp;</td>
                <td width="31%" style="background-color: #ffebeb; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #ffd1d1;">
                  <div style="font-size: 11px; text-transform: uppercase; color: #ff3b30; font-weight: bold; letter-spacing: 0.5px;">Overdue</div>
                  <div style="font-size: 24px; font-weight: bold; color: #ff3b30; margin-top: 5px;">${overdue}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Table Title -->
        <tr>
          <td style="padding: 0 20px 10px 20px;">
            <h2 style="font-size: 16px; color: #1c1c1e; margin: 0; border-bottom: 2px solid #e5e5ea; padding-bottom: 8px;">Critical / Pending Activities</h2>
          </td>
        </tr>

        <!-- Table -->
        <tr>
          <td style="padding: 0 20px 20px 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #e5e5ea; text-align: left;">
                  <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Date</th>
                  <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Subject</th>
                  <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Type</th>
                  <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Member ID</th>
                  <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93; text-align: center;">Priority</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Action Button -->
        <tr>
          <td style="padding: 10px 20px 30px 20px; text-align: center;">
            <a href="http://localhost:${PORT}" target="_blank" style="background-color: #5856d6; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(88,86,214,0.25);">Open Interactive Dashboard</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #8e8e93; border-top: 1px solid #e5e5ea;">
            <p style="margin: 0;">This report was automatically compiled by your Neon CRM Dashboard Server.</p>
            <p style="margin: 5px 0 0 0;">Date generated: ${new Date().toLocaleString()}</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// API: Send Report Manually
app.post('/api/send-report', async (req, res) => {
  try {
    const isMock = !process.env.NEON_ORG_ID || !process.env.NEON_API_KEY;
    const recipient = process.env.EMAIL_RECIPIENT;
    
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Recipient email is not configured in settings.' });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({ success: false, message: 'SMTP credentials are not configured in settings.' });
    }

    const reportType = process.env.EMAIL_REPORT_TYPE || 'all';

    // Fetch activities for compiling report
    let activities = [];
    if (isMock) {
      activities = generateMockActivities();
      if (reportType === 'staff-activity') {
        activities = activities.filter(a => {
          const subject = a['Activity Subject'] || '';
          const type = a['Activity Type'] || '';
          return !subject.toLowerCase().includes('check-in') && type.toLowerCase() !== 'check-in';
        });
      }
    } else {
      const auth = Buffer.from(`${process.env.NEON_ORG_ID}:${process.env.NEON_API_KEY}`).toString('base64');
      
      const searchFields = [];
      if (reportType === 'staff-activity') {
        searchFields.push({
          field: 'Activity Solicitation Method',
          operator: 'NOT_EQUAL',
          value: 'Check-In'
        });
      } else {
        searchFields.push({
          field: 'Activity Start Date',
          operator: 'GREATER_THAN',
          value: '1970-01-01'
        });
      }

      let currentPage = 0;
      let totalPages = 1;
      let rawResults = [];

      while (currentPage < totalPages) {
        const response = await fetch(`${process.env.NEON_API_URL || 'https://api.neoncrm.com/v2'}/activities/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'NEON-API-VERSION': '2.11',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            searchFields,
            outputFields: [
              'Activity ID',
              'Activity Subject',
              'Activity Start Date',
              'Activity Status',
              'Activity Priority',
              'Activity System User',
              'Activity Contact Account ID',
              'Account Name',
              'Activity Solicitation Method',
              'Activity Note'
            ],
            pagination: {
              currentPage,
              pageSize: 200,
              sortColumn: 'Activity Start Date',
              sortDirection: 'DESC'
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to retrieve live activities for email report: HTTP ${response.status}`);
        }

        const data = await response.json();
        rawResults = rawResults.concat(data.searchResults || []);
        totalPages = data.pagination ? data.pagination.totalPages : 1;
        currentPage++;

        if (currentPage >= 15) break;
      }

      // Translate to Dashboard Unified Schema
      activities = rawResults.map(item => ({
        'Activity ID': item['Activity ID'] || '',
        'Activity Subject': item['Activity Subject'] || 'Untitled Activity',
        'Activity Date': item['Activity Start Date'] || '',
        'Status': item['Activity Status'] || 'Pending',
        'Priority': item['Activity Priority'] || 'Normal',
        'Activity Type': item['Activity Solicitation Method'] || 'Activity',
        'Client ID': item['Activity Contact Account ID'] || '',
        'Client Name': item['Account Name'] || '',
        'Created By': item['Activity System User'] || '',
        'Activity Note': item['Activity Note'] || ''
      }));

      if (reportType === 'staff-activity') {
        activities = activities.filter(item => {
          const subject = item['Activity Subject'] || '';
          return !subject.toLowerCase().includes('check-in');
        });
      }
    }

    // Configure SMTP Transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const htmlContent = compileEmailHTML(activities);
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Neon CRM Dashboard" <noreply@yourdomain.com>',
      to: recipient,
      subject: `Neon CRM Activities Summary - ${new Date().toLocaleDateString()}`,
      html: htmlContent
    });

    res.json({ success: true, message: `Report successfully emailed to ${recipient}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Email failed to send: ${err.message}` });
  }
});

// Initialize Background Scheduler
const initializeScheduler = () => {
  if (activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
    console.log('Stopped existing background report cron job.');
  }

  const enabled = process.env.EMAIL_ENABLED === 'true';
  const schedule = process.env.EMAIL_SCHEDULE || '0 8 * * *';
  const recipient = process.env.EMAIL_RECIPIENT;

  if (enabled && recipient) {
    if (cron.validate(schedule)) {
      activeCronJob = cron.schedule(schedule, async () => {
        const reportType = process.env.EMAIL_REPORT_TYPE || 'all';
        console.log(`[Scheduler] Running scheduled email dispatch (${reportType}) to ${recipient}...`);
        try {
          const isMock = !process.env.NEON_ORG_ID || !process.env.NEON_API_KEY;
          let activities = [];
          
          if (isMock) {
            activities = generateMockActivities();
            if (reportType === 'staff-activity') {
              activities = activities.filter(a => {
                const subject = a['Activity Subject'] || '';
                const type = a['Activity Type'] || '';
                return !subject.toLowerCase().includes('check-in') && type.toLowerCase() !== 'check-in';
              });
            }
          } else {
            const auth = Buffer.from(`${process.env.NEON_ORG_ID}:${process.env.NEON_API_KEY}`).toString('base64');
            
            const searchFields = [];
            if (reportType === 'staff-activity') {
              searchFields.push({
                field: 'Activity Solicitation Method',
                operator: 'NOT_EQUAL',
                value: 'Check-In'
              });
            } else {
              searchFields.push({
                field: 'Activity Start Date',
                operator: 'GREATER_THAN',
                value: '1970-01-01'
              });
            }

            let currentPage = 0;
            let totalPages = 1;
            let rawResults = [];

            while (currentPage < totalPages) {
              const response = await fetch(`${process.env.NEON_API_URL || 'https://api.neoncrm.com/v2'}/activities/search`, {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'NEON-API-VERSION': '2.11',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  searchFields,
                  outputFields: [
                    'Activity ID',
                    'Activity Subject',
                    'Activity Start Date',
                    'Activity Status',
                    'Activity Priority',
                    'Activity System User',
                    'Activity Contact Account ID',
                    'Account Name',
                    'Activity Solicitation Method',
                    'Activity Note'
                  ],
                  pagination: {
                    currentPage,
                    pageSize: 200,
                    sortColumn: 'Activity Start Date',
                    sortDirection: 'DESC'
                  }
                })
              });

              if (response.ok) {
                const data = await response.json();
                rawResults = rawResults.concat(data.searchResults || []);
                totalPages = data.pagination ? data.pagination.totalPages : 1;
                currentPage++;
              } else {
                break;
              }

              if (currentPage >= 15) break;
            }

            // Translate to Dashboard Unified Schema
            activities = rawResults.map(item => ({
              'Activity ID': item['Activity ID'] || '',
              'Activity Subject': item['Activity Subject'] || 'Untitled Activity',
              'Activity Date': item['Activity Start Date'] || '',
              'Status': item['Activity Status'] || 'Pending',
              'Priority': item['Activity Priority'] || 'Normal',
              'Activity Type': item['Activity Solicitation Method'] || 'Activity',
              'Client ID': item['Activity Contact Account ID'] || '',
              'Client Name': item['Account Name'] || '',
              'Created By': item['Activity System User'] || '',
              'Activity Note': item['Activity Note'] || ''
            }));

            if (reportType === 'staff-activity') {
              activities = activities.filter(item => {
                const subject = item['Activity Subject'] || '';
                return !subject.toLowerCase().includes('check-in');
              });
            }
          }

          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          });

          const htmlContent = compileEmailHTML(activities);
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Neon CRM Dashboard" <noreply@yourdomain.com>',
            to: recipient,
            subject: `Neon CRM Activities Summary (Scheduled) - ${new Date().toLocaleDateString()}`,
            html: htmlContent
          });
          console.log(`[Scheduler] Successfully sent scheduled digest email to ${recipient}`);
        } catch (err) {
          console.error('[Scheduler] Failed to dispatch scheduled email:', err.message);
        }
      });
      console.log(`[Scheduler] Active and scheduled with cron expression: "${schedule}" to recipient: "${recipient}"`);
    } else {
      console.error(`[Scheduler] Invalid cron expression: "${schedule}". Scheduler disabled.`);
    }
  } else {
    console.log('[Scheduler] Background email scheduler is disabled (or recipient not configured).');
  }
};

// Start Server
app.listen(PORT, () => {
  console.log(`Neon CRM Dashboard Server is running on http://localhost:${PORT}`);
  initializeScheduler();
});
