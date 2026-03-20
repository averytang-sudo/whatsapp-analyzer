import { useSession, signIn, signOut } from "next-auth/react"
import { useState } from "react"

export default function Home() {
  const { data: session } = useSession()
  const [staffNumber, setStaffNumber] = useState("");
  const [restrictedTime, setRestrictedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!session) {
    return (
      <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
        <h2>WhatsApp Analysis Tool</h2>
        <p>You must be authorized to use this tool.</p>
        <button onClick={() => signIn('google')} style={{ padding: '10px 20px', fontSize: '16px' }}>Sign in with Google</button>
      </div>
    )
  }

  const runAnalysis = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffNumber, restrictedTimeStr: restrictedTime })
    });

    const data = await res.json();
    if (res.ok) {
      setResult(data);
    } else {
      setError(data.error);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <h2>WhatsApp Analysis</h2>
        <div>
          Signed in as {session.user.email} <br />
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      </div>

      <form onSubmit={runAnalysis} style={{ marginBottom: '30px', display: 'flex', gap: '10px', flexDirection: 'column', maxWidth: '400px' }}>
        <label>Staff WhatsApp Number:</label>
        <input required value={staffNumber} onChange={e => setStaffNumber(e.target.value)} placeholder="e.g. 6580136725" style={{ padding: '8px' }} />
        
        <label>Restricted Time (dd/mm/yyyy hh:mm:ss AM/PM):</label>
        <input required value={restrictedTime} onChange={e => setRestrictedTime(e.target.value)} placeholder="07/01/2026 10:30:00 AM" style={{ padding: '8px' }} />
        
        <button type="submit" disabled={loading} style={{ padding: '10px', marginTop: '10px', background: 'blue', color: 'white', border: 'none' }}>
          {loading ? "Analyzing..." : "Run Analysis"}
        </button>
      </form>

      {error && <div style={{ color: 'red' }}><strong>Error:</strong> {error}</div>}

      {result && (
        <table border="1" cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th>Type</th>
              {result.intervals.map(i => <th key={i}>{i}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>"Customer Phone Number" has replied</td>
              {result.repliedCustomers.map((val, idx) => <td key={idx}>{val}</td>)}
            </tr>
            <tr>
              <td>"Customer Phone Number" has reached out</td>
              {result.reachedOutCustomers.map((val, idx) => <td key={idx}>{val}</td>)}
            </tr>
            <tr>
              <td>Messages has replied</td>
              {result.repliedMessages.map((val, idx) => <td key={idx}>{val}</td>)}
            </tr>
            <tr>
              <td>Messages has reached out</td>
              {result.reachedOutMessages.map((val, idx) => <td key={idx}>{val}</td>)}
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}