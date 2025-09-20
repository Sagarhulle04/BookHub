import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { store } from './store/store.js'
import './index.css'
import axios from 'axios'
import toast from 'react-hot-toast'

// Ensure cookies (JWT) are sent with API requests via Vite proxy
axios.defaults.withCredentials = true

// Debounce for auth error toast/redirect to avoid duplicates from parallel requests
let lastAuthToastAt = 0;
let isRedirectingToLogin = false;

// Global response interceptor: on auth errors, ask user to re-login and redirect
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const status = error?.response?.status;
      const rawMsg = (error?.response?.data?.message || '').toString();
      const msg = rawMsg.toLowerCase();
      const isAuthError = status === 401 || status === 403 ||
        msg.includes('invalid token') || msg.includes('jwt') || msg.includes('unauthorized') ||
        msg.includes('access denied') || msg.includes('no token provided');
      if (isAuthError) {
        const now = Date.now();
        const onLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
        if (!onLoginPage && now - lastAuthToastAt > 4000) {
          try { toast.error('Please re-login'); } catch (_) {}
          lastAuthToastAt = now;
        }
        // Suppress backend error text downstream
        if (error?.response?.data) {
          try { error.response.data.message = ''; } catch (_) {}
        }
        // Clear any stored user
        try { localStorage.removeItem('user'); } catch (_) {}
        // Preserve current path to restore after login
        try {
          const url = window.location.pathname + window.location.search + window.location.hash;
          sessionStorage.setItem('returnAfterLogin', JSON.stringify({ url, scrollY: window.scrollY }));
        } catch (_) {}
        // Redirect to login with a friendlier message via query
        if (!isRedirectingToLogin && !onLoginPage) {
          isRedirectingToLogin = true;
          const params = new URLSearchParams(window.location.search);
          params.set('auth', 'required');
          const next = '/login' + (params.size ? `?${params.toString()}` : '');
          try { window.location.replace(next); } finally {
            // allow future redirects after navigation
            setTimeout(() => { isRedirectingToLogin = false; }, 5000);
          }
        }
      }
    } catch (_) {}
    return Promise.reject(error);
  }
)

// Global error handler for unhandled promise rejections (like axios errors)
window.addEventListener('unhandledrejection', (event) => {
  try {
    const error = event.reason;
    if (error?.isAxiosError) {
      const status = error?.response?.status;
      if (status === 404) {
        toast.error('Page not found');
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      } else if (status >= 400) {
        toast.error('Something went wrong. Please try again.');
      }
      event.preventDefault(); // Prevent console error
    }
  } catch (_) {}
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={
          <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading BookHub...</p>
            </div>
          </div>
        }>
          <App />
        </Suspense>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)

