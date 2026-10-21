import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

// Google's script is loaded once, on demand, only on the pages that show the button.
let scriptPromise;
function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = undefined; // allow a retry after a network failure
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * "Continue with Google". Renders nothing when the server has no Google client id configured, so the
 * app works fine without it. `onCredential(idToken)` runs after the user picks an account.
 */
export default function GoogleButton({ onCredential, onError, bare = false }) {
  const holder = useRef(null);
  const [clientId, setClientId] = useState(null);
  // the latest callbacks, without re-initialising Google's button every render
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  useEffect(() => {
    api.get('/auth/config').then((c) => setClientId(c.googleClientId)).catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !holder.current) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => handlers.current.onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          width: Math.min(400, Math.max(200, holder.current.offsetWidth)),
        });
      })
      .catch((err) => handlers.current.onError?.(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;
  // `bare`: for placing inside a form, below the fields: an "OR" divider, then the button.
  // (Rendered here, not in the page, so the divider disappears too when Google is not configured.)
  if (bare) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3 text-xs font-semibold tracking-widest text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
        </div>
        <div ref={holder} className="flex min-h-11 w-full justify-center" aria-label="Continue with Google" />
      </div>
    );
  }
  // otherwise the button brings its own spacing and an "or use email" divider below it
  return (
    <div className="mt-6">
      <div ref={holder} className="flex min-h-11 w-full justify-center" aria-label="Continue with Google" />
      <div className="mt-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
