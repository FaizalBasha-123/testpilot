const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

export default function HomePage() {
  return (
    <main className="container">
      <div className="hero">
        <div>
          <span className="badge">Hackathon MVP</span>
          <h1 style={{ fontSize: "48px", marginTop: 16 }}>
            TestPilot AI Agent
          </h1>
          <p className="muted" style={{ fontSize: "18px", lineHeight: 1.6 }}>
            Instantly review code, propose fixes, and open pull requests with a
            single push. This demo mocks the AI to keep the magic moment fast
            and reliable.
          </p>
          <div style={{ marginTop: 24 }}>
            <a className="button" href={`${backend}/auth/login`}>
              Login with GitHub
            </a>
          </div>
        </div>
        <div className="card">
          <h3>Live Demo Flow</h3>
          <ol className="muted" style={{ lineHeight: 1.8 }}>
            <li>Login via GitHub OAuth</li>
            <li>Select a repository to activate</li>
            <li>Push a commit to main</li>
            <li>Watch the AI open a PR within seconds</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
