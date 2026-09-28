import { AuthService } from '../firebase.js';
import { Icons } from '../icons.js';

export class AuthModal {
  constructor(containerEl, onAuthSuccess) {
    this.containerEl = containerEl;
    this.onAuthSuccess = onAuthSuccess;
    this.mode = 'signin'; // 'signin' or 'signup'
    this.errorMsg = '';
    this.isLoading = false;
  }

  open(initialMode = 'signin') {
    this.mode = initialMode;
    this.errorMsg = '';
    this.isLoading = false;
    this.render();
  }

  close() {
    this.containerEl.innerHTML = '';
  }

  render() {
    const isSignIn = this.mode === 'signin';

    this.containerEl.innerHTML = `
      <div class="modal-backdrop" id="auth-modal-backdrop">
        <div class="auth-modal-card" id="auth-modal-card">
          <button class="modal-close-btn" id="auth-close-btn" title="Close">
            ${Icons.close}
          </button>

          <div class="auth-header">
            <div class="auth-brand-badge">
              <span class="auth-logo-icon">${Icons.play}</span>
              <span class="auth-logo-text">Cine<span class="auth-logo-accent">Stream</span></span>
            </div>
            <h2>${isSignIn ? 'Welcome Back' : 'Create Your Account'}</h2>
            <p>${isSignIn ? 'Sign in to access your synchronized watchlist and history' : 'Join CineStream for free synced streaming across all devices'}</p>
          </div>

          <!-- Auth Mode Tabs -->
          <div class="auth-mode-tabs">
            <button class="auth-tab-btn ${isSignIn ? 'active' : ''}" id="auth-tab-signin">
              Sign In
            </button>
            <button class="auth-tab-btn ${!isSignIn ? 'active' : ''}" id="auth-tab-signup">
              Create Account
            </button>
          </div>

          <!-- Error Alert Banner -->
          ${this.errorMsg ? `
            <div class="auth-error-banner">
              <span class="error-icon">⚠️</span>
              <div class="error-text">${this.errorMsg}</div>
            </div>
          ` : ''}

          <!-- Form -->
          <form class="auth-form" id="auth-form">
            ${!isSignIn ? `
              <div class="auth-field">
                <label for="auth-name-input">Full Name</label>
                <input 
                  type="text" 
                  id="auth-name-input" 
                  class="auth-input" 
                  placeholder="e.g. Alex Morgan" 
                  autocomplete="name"
                  required
                />
              </div>
            ` : ''}

            <div class="auth-field">
              <label for="auth-email-input">Email Address</label>
              <input 
                type="email" 
                id="auth-email-input" 
                class="auth-input" 
                placeholder="name@example.com" 
                autocomplete="email"
                required
              />
            </div>

            <div class="auth-field">
              <label for="auth-password-input">Password</label>
              <input 
                type="password" 
                id="auth-password-input" 
                class="auth-input" 
                placeholder="••••••••" 
                autocomplete="${isSignIn ? 'current-password' : 'new-password'}"
                required
              />
            </div>

            <button type="submit" class="btn btn-primary btn-block auth-submit-btn" ${this.isLoading ? 'disabled' : ''}>
              ${this.isLoading ? '<div class="btn-spinner"></div> Loading...' : (isSignIn ? 'Sign In to CineStream' : 'Create Free Account')}
            </button>
          </form>

          <!-- Divider -->
          <div class="auth-divider">
            <span>or continue with</span>
          </div>

          <!-- Google Social Sign-In -->
          <button class="btn btn-secondary btn-block google-signin-btn" id="google-signin-btn" ${this.isLoading ? 'disabled' : ''}>
            ${Icons.google} <span>Sign in with Google</span>
          </button>

          <!-- Footer Switcher -->
          <div class="auth-footer-prompt">
            <span>${isSignIn ? "Don't have an account?" : "Already have an account?"}</span>
            <button class="auth-switch-link" id="auth-switch-link">
              ${isSignIn ? 'Sign up for free' : 'Sign in here'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Backdrop click
    const backdrop = this.containerEl.querySelector('#auth-modal-backdrop');
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    // Close button
    const closeBtn = this.containerEl.querySelector('#auth-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Tabs
    const signinTab = this.containerEl.querySelector('#auth-tab-signin');
    const signupTab = this.containerEl.querySelector('#auth-tab-signup');
    signinTab?.addEventListener('click', () => {
      this.mode = 'signin';
      this.errorMsg = '';
      this.render();
    });
    signupTab?.addEventListener('click', () => {
      this.mode = 'signup';
      this.errorMsg = '';
      this.render();
    });

    // Switch link
    const switchLink = this.containerEl.querySelector('#auth-switch-link');
    switchLink?.addEventListener('click', () => {
      this.mode = this.mode === 'signin' ? 'signup' : 'signin';
      this.errorMsg = '';
      this.render();
    });

    // Form submit
    const form = this.containerEl.querySelector('#auth-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.containerEl.querySelector('#auth-email-input')?.value.trim();
      const password = this.containerEl.querySelector('#auth-password-input')?.value;
      const name = this.containerEl.querySelector('#auth-name-input')?.value.trim();

      if (!email || !password) return;

      this.isLoading = true;
      this.errorMsg = '';
      this.render();

      try {
        let user;
        const isNewUser = this.mode === 'signup';
        if (this.mode === 'signin') {
          user = await AuthService.signInWithEmail(email, password);
        } else {
          user = await AuthService.signUpWithEmail(email, password, name);
        }
        this.close();
        if (this.onAuthSuccess) this.onAuthSuccess(user, isNewUser);
      } catch (err) {
        console.error('[Auth] Error:', err);
        this.errorMsg = this.formatAuthError(err);
        this.isLoading = false;
        this.render();
      }
    });

    // Google Sign-In
    const googleBtn = this.containerEl.querySelector('#google-signin-btn');
    googleBtn?.addEventListener('click', async () => {
      this.isLoading = true;
      this.errorMsg = '';
      this.render();

      try {
        const user = await AuthService.signInWithGoogle();
        this.close();
        if (this.onAuthSuccess) this.onAuthSuccess(user, false);
      } catch (err) {
        console.error('[Auth Google] Error:', err);
        this.errorMsg = this.formatAuthError(err);
        this.isLoading = false;
        this.render();
      }
    });
  }

  formatAuthError(err) {
    const code = err.code || '';
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email address or password. Please check your credentials.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed before completing authentication.';
      case 'auth/operation-not-allowed':
      case 'auth/configuration-not-found':
        return 'Authentication method is being enabled in the Firebase Console. Please make sure Email/Password is toggled ON under Authentication > Sign-in method.';
      default:
        return err.message || 'Authentication error. Please try again.';
    }
  }
}
