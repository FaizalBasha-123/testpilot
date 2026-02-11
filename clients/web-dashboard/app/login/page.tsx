"use client";

import { useEffect, useState } from "react";
import { CheckCircle, CircleAlert, Github } from "lucide-react";
import { BACKEND_URL, GatewayStatus } from "../../lib/api";

const backend =
  BACKEND_URL;

export default function LoginPage() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    fetch(`${backend}/api/status`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStatus(data))
      .catch(() => {
        // Leave status unavailable; login can still continue.
      });
  }, []);

  const handleLogin = () => {
    window.location.href = '/auth/loading';
    setTimeout(() => {
      // Use relative path since frontend is served from same domain
      window.location.href = `${backend}/auth/login`;
    }, 100);
  };

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="login-column">
          <span className="tag">Secure OAuth</span>
          <h1 className="hero-title" style={{ marginTop: 6 }}>
            Enterprise Sign-In
          </h1>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Sign in with GitHub to activate TestPilot across repositories, route PR webhooks through the Render gateway, and execute real AI + Sonar review pipelines.
          </p>
          <div className="rounded-xl border border-gray-700 bg-[#0f172a] p-4 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Gateway Endpoint</span>
              <span className="text-gray-200 break-all">{backend}</span>
            </div>
            <div className="flex items-center">
              {status?.gateway?.reachable ? (
                <CheckCircle size={14} className="text-green-400 mr-2" />
              ) : (
                <CircleAlert size={14} className="text-yellow-400 mr-2" />
              )}
              <span className="text-gray-300">
                {status?.gateway?.reachable ? "Gateway reachable" : "Status unknown (login still available)"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button className="button" onClick={handleLogin}>
              <Github size={16} />
              Login with GitHub
            </button>
            <a className="button secondary" href="/">
              Back to Home
            </a>
          </div>
          <div className="pill-row">
            <span className="pill">No passwords</span>
            <span className="pill">GitHub App installation</span>
            <span className="pill">Render gateway control plane</span>
            <span className="pill">Real Sonar + AI reviews</span>
          </div>
        </div>
        <div className="login-illustration">
          <img src="/images/login-illustration.svg" alt="Login preview" />
        </div>
      </section>
    </main>
  );
}
