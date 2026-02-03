"use client";

import { useEffect, useMemo, useState } from "react";

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  url: string;
};

export default function DashboardPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [installUrl, setInstallUrl] = useState<string>("#");
  const [status, setStatus] = useState<string>("Loading...");

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      localStorage.setItem("tp_token", urlToken);
      window.history.replaceState({}, "", "/dashboard");
      return urlToken;
    }
    return localStorage.getItem("tp_token") || "";
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("Missing auth token. Please login again.");
      return;
    }

    fetch(`${backend}/api/repos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setRepos(data.repos || []);
        setInstallUrl(data.install_url || "#");
        setStatus("Ready");
      })
      .catch(() => setStatus("Failed to load repos"));
  }, [token]);

  return (
    <main className="container">
      <div className="header">
        <div>
          <h2>Repository Activation</h2>
          <p className="muted">
            Install the TestPilot GitHub App once, then select repos on GitHub.
          </p>
        </div>
        <a className="button secondary" href="/">
          Back
        </a>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <strong>Status:</strong> {status}
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              This opens GitHub’s official install screen.
            </div>
          </div>
          <a className="button" href={installUrl} target="_blank">
            Install GitHub App
          </a>
        </div>
      </div>

      <div className="grid">
        {repos.map((repo) => (
          <div key={repo.id} className="repo">
            <div>
              <div style={{ fontWeight: 600 }}>{repo.full_name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {repo.private ? "Private" : "Public"}
              </div>
            </div>
            <span className="badge">Install in GitHub</span>
          </div>
        ))}
      </div>
    </main>
  );
}
