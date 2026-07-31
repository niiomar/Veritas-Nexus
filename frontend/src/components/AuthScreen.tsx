import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AuthAPI, TokenStorage } from '../services/auth';
import type { AuthUser } from '../types';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verifying' | 'verify-success' | 'verify-error';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#050505',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-main)',
  padding: '10px',
  borderRadius: '4px',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: 'var(--text-faint)',
  marginBottom: '8px',
  letterSpacing: '0.05em',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  background: 'var(--text-main)',
  border: 'none',
  color: '#000',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.1em',
};

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--c-system)',
  cursor: 'pointer',
  fontSize: '11px',
  padding: 0,
  textAlign: 'left',
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification and password-reset links land here as ?verify_token=... /
  // ?reset_token=... (see api/routers/auth.py's FRONTEND_URL links).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token');
    const resetTokenParam = params.get('reset_token');

    if (verifyToken) {
      setMode('verifying');
      AuthAPI.verifyEmail(verifyToken)
        .then(() => setMode('verify-success'))
        .catch((err: any) => { setError(err.message); setMode('verify-error'); })
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    } else if (resetTokenParam) {
      setResetToken(resetTokenParam);
      setMode('reset');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { access_token, user } = await AuthAPI.login(email, password);
      TokenStorage.set(access_token);
      onAuthenticated(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    try {
      const result = await AuthAPI.register(email, password);
      setPassword('');
      setConfirmPassword('');
      setInfo(result.message);
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await AuthAPI.forgotPassword(email);
      setInfo(result.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    try {
      await AuthAPI.resetPassword(resetToken, password);
      setPassword('');
      setConfirmPassword('');
      setInfo('Password reset. You can now log in.');
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#050505' }}>
      <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '380px', maxWidth: '90%', padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <ShieldCheck size={18} color="var(--c-system)" />
          <span className="mono" style={{ fontSize: '12px', letterSpacing: '0.1em', color: 'var(--text-main)' }}>VERITAS NEXUS</span>
        </div>

        {error && (
          <div className="mono" style={{ fontSize: '11px', color: 'var(--c-crit)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '4px', padding: '10px 12px', marginBottom: '16px' }}>
            {error}
          </div>
        )}
        {info && (
          <div className="mono" style={{ fontSize: '11px', color: 'var(--c-trust, #10b981)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '10px 12px', marginBottom: '16px' }}>
            {info}
          </div>
        )}

        {mode === 'verifying' && (
          <div className="mono animate-pulse" style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
            VERIFYING EMAIL...
          </div>
        )}

        {mode === 'verify-success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="mono" style={{ fontSize: '12px', color: 'var(--c-trust, #10b981)', textAlign: 'center', padding: '8px 0' }}>
              EMAIL VERIFIED. YOU CAN NOW LOG IN.
            </div>
            <button className="mono hover-bright" style={primaryButtonStyle} onClick={() => switchMode('login')}>
              CONTINUE TO LOGIN
            </button>
          </div>
        )}

        {mode === 'verify-error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button className="mono hover-bright" style={primaryButtonStyle} onClick={() => switchMode('login')}>
              BACK TO LOGIN
            </button>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>PASSWORD</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </div>
            <button type="submit" disabled={isSubmitting} className="mono hover-bright" style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'LOGGING IN...' : 'LOG IN'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="mono hover-bright" style={linkButtonStyle} onClick={() => switchMode('register')}>
                CREATE ACCOUNT
              </button>
              <button type="button" className="mono hover-bright" style={linkButtonStyle} onClick={() => switchMode('forgot')}>
                FORGOT PASSWORD?
              </button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>PASSWORD (MIN. 8 CHARACTERS)</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CONFIRM PASSWORD</label>
              <input type="password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
            </div>
            <button type="submit" disabled={isSubmitting} className="mono hover-bright" style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </button>
            <button type="button" className="mono hover-bright" style={linkButtonStyle} onClick={() => switchMode('login')}>
              ALREADY HAVE AN ACCOUNT? LOG IN
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <button type="submit" disabled={isSubmitting} className="mono hover-bright" style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
            </button>
            <button type="button" className="mono hover-bright" style={linkButtonStyle} onClick={() => switchMode('login')}>
              BACK TO LOGIN
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>NEW PASSWORD (MIN. 8 CHARACTERS)</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CONFIRM NEW PASSWORD</label>
              <input type="password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
            </div>
            <button type="submit" disabled={isSubmitting} className="mono hover-bright" style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'RESETTING...' : 'RESET PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
