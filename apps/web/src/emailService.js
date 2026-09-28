// Client-side Email Integration Service for CineStream
// Communicates with /api/mail to trigger welcome emails and manage 2-day inactivity sequences

export const EmailService = {
  // Triggered on user login or registration
  async notifyUserLogin(user, isNewUser = false) {
    if (!user || !user.email) return;

    try {
      const response = await fetch('/api/mail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'welcome',
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          isNewUser
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        console.log('[EmailService] Welcome email dispatched successfully:', data);
        sessionStorage.setItem('cs_last_activity_ping', Date.now().toString());
        return data;
      } else {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn('[EmailService] Could not send welcome notification:', err.message);
      return null;
    }
  },

  // Triggered when a logged-in user is browsing the website
  // Throttled using sessionStorage so it resets the 2-day timer without unnecessary pings
  async recordUserActivity(user) {
    if (!user || !user.email) return;

    const lastPing = parseInt(sessionStorage.getItem('cs_last_activity_ping') || '0', 10);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Ping at most once every hour per session to reset the 2-day inactivity window
    if (now - lastPing < oneHour) {
      return;
    }

    try {
      const response = await fetch('/api/mail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'activity',
          email: user.email,
          name: user.displayName || user.email.split('@')[0]
        })
      });

      const data = await response.json();
      console.log('[EmailService] 2-day inactivity sequence reset for active user:', data);
      sessionStorage.setItem('cs_last_activity_ping', now.toString());
      return data;
    } catch (err) {
      console.warn('[EmailService] Could not ping user activity:', err);
    }
  }
};
