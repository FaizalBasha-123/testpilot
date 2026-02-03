const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

export default function HomePage() {
  return (
    <main className="container">
      <nav className="nav">
        <div className="logo">
          <span className="badge">TP</span>
          TestPilot AI Agent
        </div>
        <a className="button secondary" href="/login">
          Go to Login
        </a>
      </nav>

      <section className="hero">
        <div>
          <span className="tag">Hackathon MVP</span>
          <h1 className="hero-title">
            Ship PRs in seconds with a lightning-fast AI co-pilot.
          </h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.7 }}>
            TestPilot watches for new commits, generates a mocked AI report, and
            opens a polished pull request instantly. It’s built to wow judges
            with speed, clarity, and beautiful automation.
          </p>
          <div className="pill-row">
            <span className="pill">Mocked AI for reliability</span>
            <span className="pill">GitHub App + Webhooks</span>
            <span className="pill">Go + Next.js</span>
            <span className="pill">PR in under 5s</span>
          </div>
          <div style={{ marginTop: 28, display: "flex", gap: 16 }}>
            <a className="button" href={`${backend}/auth/login`}>
              Login with GitHub
            </a>
            <a className="button secondary" href="/login">
              View Login Page
            </a>
          </div>
        </div>

        <div className="glow-panel hero-art">
          <img src="/images/hero-orb.svg" alt="AI orb" />
        </div>
      </section>

      <section style={{ marginTop: 56 }} className="grid">
        <div className="card">
          <h3>Instant PR Magic</h3>
          <p className="muted">
            Push to main, and TestPilot instantly creates a branch, adds a mock
            report, and opens a PR with a clean summary.
          </p>
        </div>
        <div className="card">
          <h3>Designed for Demo</h3>
          <p className="muted">
            Predictable latency, consistent output, and a smooth onboarding flow
            built for hackathon storytelling.
          </p>
        </div>
        <div className="card">
          <h3>GitHub Native</h3>
          <p className="muted">
            Uses GitHub Apps, OAuth, and webhooks to mirror real-world
            developer workflows.
          </p>
        </div>
      </section>
    </main>
  );
}
