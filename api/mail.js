// CineStream Mail Service powered by Mailofly API
// Handles Welcome emails on login/signup and rotating 2-day inactivity reminder sequences

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAILOFLY_API_KEY = process.env.MAILOFLY_API_KEY || 'mf_live_xZGIuU6Ahv8btXnpiK7dwAdCXrWQd7uw';
const MAILOFLY_BASE_URL = 'https://api.mailofly.com/v1';
const SENDER_EMAIL = 'CineStream <therealthakur.10@gmail.com>';

// Local schedule store path
const DATA_DIR = path.join(__dirname, 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedules.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Ignore in read-only environments
  }
}

// In-memory fallback if filesystem is read-only
let memorySchedules = {};

function readSchedules() {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const data = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    // fallback to memory
  }
  return memorySchedules;
}

function saveSchedules(schedules) {
  memorySchedules = schedules;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Mail Service] Could not write schedules file, stored in memory:', err.message);
  }
}

// Mailofly API request helper
async function mailoflyRequest(endpoint, body = null, method = 'POST') {
  const url = `${MAILOFLY_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${MAILOFLY_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'CineStream-App/1.0'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.message || data.error || res.statusText || 'Mailofly request failed';
    throw new Error(`[Mailofly ${res.status}] ${errorMsg}`);
  }

  return data;
}

// Cancel a scheduled email by ID
export async function cancelEmail(emailId) {
  if (!emailId) return false;
  try {
    await mailoflyRequest(`/emails/${encodeURIComponent(emailId)}/cancel`, null, 'POST');
    return true;
  } catch (err) {
    // If already sent or not found, ignore
    return false;
  }
}

// Email HTML Layout wrapper
function buildEmailHtml({ title, preheader, headline, bodyContent, ctaText = 'Start Watching Now', ctaUrl = 'http://localhost:5173/' }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08090d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1; -webkit-font-smoothing: antialiased;">
  <!-- Preheader preview text -->
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">
    ${preheader || headline}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #08090d; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #11141d; border-radius: 16px; border: 1px solid #1f2533; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #e50914 0%, #ff4b4b 50%, #990000 100%);"></td>
          </tr>

          <!-- Header / Brand -->
          <tr>
            <td align="center" style="padding: 36px 30px 24px 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #e50914 0%, #b80710 100%); border-radius: 10px; text-align: center; line-height: 38px;">
                      <span style="color: #ffffff; font-size: 18px; font-weight: bold; margin-left: 2px;">&#9658;</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                      Cine<span style="color: #e50914;">Stream</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 36px 32px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; line-height: 1.3; color: #ffffff; text-align: center;">
                ${headline}
              </h1>

              <div style="font-size: 15px; line-height: 1.65; color: #94a3b8;">
                ${bodyContent}
              </div>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #e50914 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; box-shadow: 0 4px 14px rgba(229, 9, 20, 0.4);">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feature Highlights Section -->
          <tr>
            <td style="background-color: #0b0d13; padding: 24px 36px; border-top: 1px solid #1a202c;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="33%" align="center" style="padding: 6px;">
                    <div style="font-size: 18px; margin-bottom: 4px;">⚡</div>
                    <div style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Fast CDN Servers</div>
                    <div style="font-size: 11px; color: #64748b;">Instant Playback</div>
                  </td>
                  <td width="33%" align="center" style="padding: 6px;">
                    <div style="font-size: 18px; margin-bottom: 4px;">🌍</div>
                    <div style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Multi-Audio & Subs</div>
                    <div style="font-size: 11px; color: #64748b;">All Languages</div>
                  </td>
                  <td width="33%" align="center" style="padding: 6px;">
                    <div style="font-size: 18px; margin-bottom: 4px;">✨</div>
                    <div style="font-size: 12px; font-weight: 700; color: #cbd5e1;">100% Free Forever</div>
                    <div style="font-size: 11px; color: #64748b;">No Subscriptions</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 30px; font-size: 12px; color: #525f7f; border-top: 1px solid #161b26;">
              <p style="margin: 0 0 8px 0;">CineStream &bull; The Cinematic Streaming Platform</p>
              <p style="margin: 0; color: #475569;">You are receiving this notification regarding your CineStream account.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// 1. Send Welcome Email (dispatched immediately on sign up or login)
export async function sendWelcomeEmail({ to, name = '', isNewUser = false }) {
  const safeName = name ? name.split(' ')[0] : 'Movie Lover';
  const headline = isNewUser
    ? `Welcome to CineStream, ${safeName}! 🍿`
    : `Welcome Back, ${safeName}! 🍿`;

  const bodyContent = `
    <p style="margin-top: 0;">
      ${isNewUser 
        ? `We are thrilled to have you join <strong>CineStream</strong>! Your VIP ticket to thousands of blockbuster movies, popular TV series, and trending anime is now active.`
        : `Great to see you again on <strong>CineStream</strong>. Your personal watchlist and streaming history are synchronized and ready for your next movie session.`}
    </p>
    <div style="background: rgba(255, 255, 255, 0.04); border-left: 3px solid #e50914; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #e2e8f0; font-size: 14px;">
        💡 <strong>Tonight's Pro Tip:</strong> Use the <em>Fast Stream Servers</em> switcher beneath any player to switch between VidSrc, SuperEmbed, and multi-language audio tracks with automated subtitles in English, Hindi, and 20+ languages!
      </p>
    </div>
    <p style="margin-bottom: 0;">
      Grab your favorite snack, kick back, and enjoy high-speed streaming without interruptions.
    </p>
  `;

  const html = buildEmailHtml({
    title: `Welcome to CineStream, ${safeName}!`,
    preheader: `Your VIP pass to unlimited cinema streaming is ready.`,
    headline,
    bodyContent,
    ctaText: 'Start Streaming Now',
    ctaUrl: 'http://localhost:5173/'
  });

  return mailoflyRequest('/emails', {
    to,
    from: SENDER_EMAIL,
    subject: `🍿 Welcome to CineStream, ${safeName}! Your VIP Cinema Pass`,
    html,
    text: `Welcome to CineStream, ${safeName}! Your account is active. Start watching your favorite movies and web series now at http://localhost:5173/`
  });
}

// 2. Schedule rotating inactivity emails (at +2 days, +4 days, +6 days, +8 days)
export async function scheduleInactivitySequence({ to, name = '' }) {
  const safeName = name ? name.split(' ')[0] : 'there';
  const now = Date.now();

  // Definitions for rotating emails every 2 days
  const sequenceConfigs = [
    {
      days: 2,
      subject: `Make your day great with tonight's movie pick 🍿 | CineStream`,
      headline: `Make your day great with a movie break, ${safeName} 🎬`,
      preheader: `You've had a busy few days — take a break with tonight's top blockbuster!`,
      bodyContent: `
        <p style="margin-top: 0;">
          Life gets busy, but you deserve a relaxing break! We noticed you haven't dropped by <strong>CineStream</strong> in a couple of days.
        </p>
        <p>
          Tonight is the perfect evening to unwind. Whether you're in the mood for an edge-of-your-seat action thriller, a heartwarming comedy, or a cozy drama, today's trending releases are waiting for you.
        </p>
        <div style="background: rgba(255, 255, 255, 0.04); border-left: 3px solid #e50914; padding: 12px 16px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0; color: #e2e8f0; font-size: 13.5px;">
            🍿 <em>"A great movie can transform an ordinary evening into an unforgettable journey."</em>
          </p>
        </div>
        <p style="margin-bottom: 0;">
          Pour yourself a drink, grab some popcorn, and treat yourself to a cinema night at home.
        </p>
      `,
      ctaText: 'Watch Tonight\'s Pick'
    },
    {
      days: 4,
      subject: `Need a relaxing break? Here is a cinematic treat for you 🎬 | CineStream`,
      headline: `Escape into an unforgettable story today, ${safeName} ✨`,
      preheader: `Looking for plot twists or laughter? Discover what's trending globally on CineStream.`,
      bodyContent: `
        <p style="margin-top: 0;">
          Need a quick escape from daily routines? The global box office never sleeps, and our movie catalog just added brand-new 4K titles and fresh web series episodes.
        </p>
        <p>
          From Hollywood blockbusters to acclaimed international cinema, CineStream brings high-speed direct streams straight to your screen without fees or subscriptions.
        </p>
        <p style="margin-bottom: 0;">
          Pick up where you left off or find a brand-new series to binge this evening!
        </p>
      `,
      ctaText: 'Explore New Releases'
    },
    {
      days: 6,
      subject: `Your watchlist is waiting! Top blockbusters you might have missed 🍿 | CineStream`,
      headline: `Your CineStream watchlist is calling your name 🍿`,
      preheader: `Top trending movies just updated with multi-language dubbed releases and subtitles.`,
      bodyContent: `
        <p style="margin-top: 0;">
          Hey ${safeName}, great stories are meant to be watched, not left on the backburner!
        </p>
        <p>
          We've updated our servers with enhanced multi-language audio tracks and subtitles across 25+ languages. Discover what millions of movie enthusiasts are watching right now.
        </p>
        <p style="margin-bottom: 0;">
          Click below to open your personalized recommendations.
        </p>
      `,
      ctaText: 'Open My Watchlist'
    },
    {
      days: 8,
      subject: `Weekend movie night calling! Grab your favorite snacks 🎥 | CineStream`,
      headline: `Prime-time cinema night is here, ${safeName}! 🎥`,
      preheader: `Turn off the lights and experience pure cinematic entertainment.`,
      bodyContent: `
        <p style="margin-top: 0;">
          Dim the lights, grab your favorite snacks, and turn your room into a luxury private theater.
        </p>
        <p>
          CineStream is 100% free with unlimited access to top trending TV shows, critically acclaimed films, and box-office hits with ultra-fast servers.
        </p>
        <p style="margin-bottom: 0;">
          We've reserved the best seat in the house for you. Let's watch!
        </p>
      `,
      ctaText: 'Start Movie Night'
    }
  ];

  const scheduledIds = [];

  for (const item of sequenceConfigs) {
    const scheduledTime = new Date(now + item.days * 24 * 60 * 60 * 1000).toISOString();
    const html = buildEmailHtml({
      title: item.subject,
      preheader: item.preheader,
      headline: item.headline,
      bodyContent: item.bodyContent,
      ctaText: item.ctaText,
      ctaUrl: 'http://localhost:5173/'
    });

    try {
      const res = await mailoflyRequest('/emails', {
        to,
        from: SENDER_EMAIL,
        subject: item.subject,
        html,
        text: `${item.headline}\n\nVisit CineStream: http://localhost:5173/`,
        scheduled_at: scheduledTime
      });

      if (res && res.id) {
        scheduledIds.push({
          id: res.id,
          days: item.days,
          scheduled_at: scheduledTime
        });
      }
    } catch (err) {
      console.warn(`[Mail Service] Failed to schedule Day ${item.days} email for ${to}:`, err.message);
    }
  }

  // Update schedule store
  const schedules = readSchedules();
  schedules[to] = {
    updatedAt: new Date().toISOString(),
    name,
    scheduledEmails: scheduledIds
  };
  saveSchedules(schedules);

  return scheduledIds;
}

// 3. Cancel any pending inactivity emails for a user
export async function cancelUserInactivityEmails(to) {
  const schedules = readSchedules();
  const userEntry = schedules[to];

  if (!userEntry || !Array.isArray(userEntry.scheduledEmails)) {
    return [];
  }

  const cancelled = [];
  for (const item of userEntry.scheduledEmails) {
    if (item.id) {
      const ok = await cancelEmail(item.id);
      if (ok) cancelled.push(item.id);
    }
  }

  delete schedules[to];
  saveSchedules(schedules);
  return cancelled;
}

// 4. Combined handler for API route /api/mail
export default async function mailHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Parse Body
  let body = {};
  if (req.method === 'POST') {
    try {
      if (typeof req.body === 'object' && req.body !== null) {
        body = req.body;
      } else {
        const raw = await new Promise((resolve, reject) => {
          let chunks = '';
          req.on('data', chunk => chunks += chunk);
          req.on('end', () => resolve(chunks));
          req.on('error', reject);
        });
        if (raw) body = JSON.parse(raw);
      }
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      return;
    }
  } else {
    // GET request query
    const urlObj = new URL(req.url, 'http://localhost');
    body = {
      action: urlObj.searchParams.get('action'),
      email: urlObj.searchParams.get('email'),
      name: urlObj.searchParams.get('name')
    };
  }

  const { action, email, name, isNewUser } = body;
  console.log(`[CineStream Mail API] Incoming action: "${action}" for ${email} (name: ${name || 'N/A'})`);

  if (!email || !action) {
    res.statusCode = 400;
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Missing required fields: email and action' 
    }));
    return;
  }

  try {
    if (action === 'welcome' || action === 'login') {
      // 1. Send Welcome Email immediately
      console.log(`[CineStream Mail API] Dispatching welcome email to ${email}...`);
      const welcomeResult = await sendWelcomeEmail({ to: email, name, isNewUser });
      console.log(`[CineStream Mail API] Welcome email sent successfully! ID: ${welcomeResult.id}`);

      // 2. Cancel any previous inactive schedules
      await cancelUserInactivityEmails(email);

      // 3. Schedule fresh sequence of inactivity emails (every 2 days)
      const scheduled = await scheduleInactivitySequence({ to: email, name });

      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        message: 'Welcome email sent and 2-day inactivity sequence scheduled',
        welcomeEmailId: welcomeResult.id,
        scheduledCount: scheduled.length,
        schedules: scheduled
      }));
      return;
    }

    if (action === 'activity' || action === 'heartbeat') {
      // User opened the website -> they are active!
      // Cancel previous inactivity emails and reset the 2-day timer
      const cancelled = await cancelUserInactivityEmails(email);
      const scheduled = await scheduleInactivitySequence({ to: email, name });

      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        message: 'User activity recorded, 2-day inactivity sequence refreshed',
        cancelledCount: cancelled.length,
        scheduledCount: scheduled.length,
        schedules: scheduled
      }));
      return;
    }

    if (action === 'cancel') {
      const cancelled = await cancelUserInactivityEmails(email);
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        message: 'Inactivity sequence cancelled',
        cancelledCount: cancelled.length
      }));
      return;
    }

    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: `Unknown action: ${action}` }));
  } catch (err) {
    console.error('[Mail Handler] Error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({
      success: false,
      error: err.message
    }));
  }
}
