'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Auth form state
  const [authEmail, setAuthEmail] = useState('bookkeeper@local')
  const [authPassword, setAuthPassword] = useState('change-me-now')
  const [authFullName, setAuthFullName] = useState('Local Bookkeeper')
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    checkMe()
  }, [])

  async function runInit() {
    setMessage('Initializing...')
    const res = await fetch('/api/db/init')
    const data = await res.json()
    setMessage(JSON.stringify(data, null, 2))
  }

  async function runAnalyze() {
    setLoading(true)
    setAnalysis(null)
    try {
      const res = await fetch('/api/intelligence/analyze', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setAnalysis(data)
    } catch (e: any) {
      setAnalysis({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    setAuthLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword, full_name: authFullName })
      })
      const text = await res.text()
      let data: any = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { error: 'invalid json body', raw: text }
      }
      if (res.ok) {
        setMessage('Registered successfully. Now log in.')
      } else {
        setMessage('Register error: ' + JSON.stringify(data) + ' (status ' + res.status + ')')
      }
    } catch (e: any) {
      setMessage('Error: ' + e.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleLogin() {
    setAuthLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      })
      const text = await res.text()
      let data: any = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { error: 'invalid json body', raw: text }
      }
      if (res.ok) {
        await checkMe()
        setMessage('Logged in successfully!')
      } else {
        setMessage('Login error: ' + JSON.stringify(data) + ' (status ' + res.status + ')')
      }
    } catch (e: any) {
      setMessage('Error: ' + e.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function checkMe() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      const text = await res.text()
      let data: any = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { error: 'invalid json body', raw: text, status: res.status }
      }
      if (res.ok) {
        setCurrentUser(data.user)
      } else {
        setCurrentUser(null)
        setMessage('Not logged in: ' + JSON.stringify(data) + ' (status ' + res.status + ')')
      }
    } catch (e: any) {
      setCurrentUser(null)
      setMessage('Error checking login: ' + e.message)
    }
  }

  async function handleLogout() {
    setAuthLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setCurrentUser(null)
      setMessage('Logged out.')
    } catch (e: any) {
      setMessage('Logout error: ' + e.message)
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <main style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 800 }}>
      <h1>books-made-easy-local</h1>
      <p>Local smart database backend (BME-001)</p>

      {/* Auth Section */}
      <section style={{ margin: '20px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>Get In (Login / Register)</h3>

        <div style={{ marginBottom: 12 }}>
          <label>Email: </label>
          <input 
            type="email" 
            value={authEmail} 
            onChange={e => setAuthEmail(e.target.value)} 
            style={{ width: '100%', padding: 6, marginBottom: 6 }} 
          />
          <label>Password: </label>
          <input 
            type="password" 
            value={authPassword} 
            onChange={e => setAuthPassword(e.target.value)} 
            style={{ width: '100%', padding: 6, marginBottom: 6 }} 
          />
          <label>Full Name (for register): </label>
          <input 
            type="text" 
            value={authFullName} 
            onChange={e => setAuthFullName(e.target.value)} 
            style={{ width: '100%', padding: 6 }} 
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <button onClick={handleRegister} disabled={authLoading} style={{ marginRight: 8 }}>
            {authLoading ? 'Registering...' : 'Register'}
          </button>
          <button onClick={handleLogin} disabled={authLoading} style={{ marginRight: 8 }}>
            {authLoading ? 'Logging in...' : 'Login'}
          </button>
          <button onClick={handleLogout} disabled={authLoading || !currentUser}>
            Logout
          </button>
          <button onClick={checkMe} disabled={authLoading} style={{ marginLeft: 8 }}>
            Check Me
          </button>
        </div>

        <div style={{ fontSize: '0.85em', color: '#555' }}>
          (After clicking Login, watch the box below for status. It should say "Logged in successfully!" or an error.)
        </div>

        {currentUser && (
          <div style={{ background: '#e6f7e6', padding: 8, marginBottom: 8 }}>
            ✅ Logged in as: <strong>{currentUser.full_name}</strong> ({currentUser.email}) — role: {currentUser.role}
          </div>
        )}

        {!currentUser && <div style={{ color: '#666' }}>Not logged in. Use the form above.</div>}
      </section>

      {message && <pre style={{ background: '#f5f5f5', padding: 10, whiteSpace: 'pre-wrap' }}>{message}</pre>}

      <section style={{ margin: '20px 0' }}>
        <button onClick={runInit}>Run /api/db/init (seed)</button>
        <button onClick={runAnalyze} disabled={loading} style={{ marginLeft: 10 }}>
          {loading ? 'Analyzing...' : 'Run Intelligence Analyze'}
        </button>
      </section>

      {analysis && (
        <div>
          <h3>Analysis Result</h3>
          <pre style={{ background: '#f0f0f0', padding: 10, overflow: 'auto' }}>
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </div>
      )}

      <hr />

      <p><strong>Quick links:</strong></p>
      <ul>
        <li><a href="/api/health">/api/health</a></li>
        <li><a href="/api/db/init">/api/db/init</a></li>
        <li>POST /api/intelligence/analyze</li>
        <li><a href="/api/auth/me">/api/auth/me</a></li>
        <li>POST /api/auth/login</li>
        <li>POST /api/auth/register</li>
      </ul>

      <p>Run with: <code>npm run run:local</code> or <code>npm run dev</code></p>
      <p>Models dir set via MODELS_PATH in .env.local (or default)</p>
      <p style={{fontSize: '0.8em'}}>DB file: ./data/local.db (placed in subdir + ignored by watcher to prevent HMR spam on writes)</p>

      <p style={{ marginTop: 40, fontSize: '0.9em', color: '#666' }}>
        Backend modeled on ops-sense. Pure local. No Supabase/Vercel.
      </p>

      <div style={{ marginTop: 20, padding: 12, background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 4 }}>
        <strong>First time setup:</strong><br />
        1. In terminal: <code>npx drizzle-kit push</code> (creates tables)<br />
        2. Click "Run /api/db/init (seed)" button above<br />
        3. Default login: <code>bookkeeper@local</code> / <code>change-me-now</code><br />
        (Set ADMIN_PASSWORD and JWT_SECRET in .env.local)<br />
        DB lives at <code>data/local.db</code>
      </div>
    </main>
  )
}