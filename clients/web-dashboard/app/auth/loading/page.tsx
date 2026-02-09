export default function AuthLoadingPage() {
  return (
    <main className="login-wrap">
      <section style={{ textAlign: 'center' }}>
        <div className="logo" style={{ fontSize: 32, justifyContent: 'center', marginBottom: 32 }}>
          <span className="badge" style={{ fontSize: 24, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>TP</span>
          TestPilot
        </div>
        <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 24 }}>
          Signing you in...
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner"></div>
        </div>
      </section>
    </main>
  );
}
