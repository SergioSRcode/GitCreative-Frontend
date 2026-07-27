import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/auth";

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [website, setWebsite] = useState('');  // honeypot — should always stay empty

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = mode === 'login'
        ? await login(email, password)
        : await register(email, password, displayName, website);

      localStorage.setItem('authToken', res.token);
      navigate('/gallery');
    } catch {
      setError(mode === 'login'
        ? 'Invalid email or password'
        : 'Registration failed - email may already be in use'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f5f3',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 32,
        width: 340, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          🎨 GitCreative
        </h1>

        <div style={{ display: 'flex', gap: 8 }}>
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null) }}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6,
                border: '1px solid #ddd',
                background: mode === m ? '#f0f0f0' : 'white',
                fontWeight: mode === m ? 600 : 400,
                cursor: 'pointer', fontSize: 13,
              }}
            >
              {m === 'login' ? 'Log in' : 'Register'}
            </button>
          ))}
        </div>

        {mode === 'register' && (
        <>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Display name"
            aria-label="Display name"
            style={{
              border: '1px solid #ddd', borderRadius: 6,
              padding: '8px 10px', fontSize: 13, outline: 'none',
            }}
          />

          {/* HP */}
          <input
            value={website}
            onChange={e => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-9999px',
              width: 1,
              height: 1,
              opacity: 0,
            }}
          />
        </>
        )}

        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
          type="email"
          style={{
            border: '1px solid #ddd', borderRadius: 6,
            padding: '8px 10px', fontSize: 13, outline: 'none',
          }}
        />

        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          type="password"
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          style={{
            border: '1px solid #ddd', borderRadius: 6,
            padding: '8px 10px', fontSize: 13, outline: 'none',
          }}
        />

        {error && (
          <span style={{ fontSize: 12, color: '#d33' }}>{error}</span>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '8px 0', borderRadius: 6,
            border: 'none',
            background: loading ? '#ccc' : '#222',
            color: 'white',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </div>
    </div>
  );
}