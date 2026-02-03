const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

export default function LoginPage() {
  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="login-column">
          <span className="tag">Secure OAuth</span>
          <h1 className="hero-title" style={{ marginTop: 6 }}>
            Welcome back, builder.
          </h1>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Sign in with GitHub to install the TestPilot App, connect your
            repositories, and watch the AI agent open pull requests in seconds.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a className="button" href={`${backend}/auth/login`}>
              Login with GitHub
            </a>
            <a className="button secondary" href="/">
              Back to Home
            </a>
          </div>
          <div className="pill-row">
            <span className="pill">No passwords</span>
            <span className="pill">One-click install</span>
            <span className="pill">Instant PRs</span>
          </div>
        </div>
        <div className="login-illustration">
          <img src="/images/login-illustration.svg" alt="Login preview" />
        </div>
      </section>
    </main>
  );
}
