"use client";

import { useEffect, useMemo, useState } from "react";

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

type Account = {
  id: number;
  login: string;
  type: string;
  avatar_url?: string;
};

type OrgResponse = {
  account: Account;
  orgs: Account[];
  install_url: string;
};

export default function OnboardingPage() {
  const [data, setData] = useState<OrgResponse | null>(null);
  const [status, setStatus] = useState("Loading organizations...");
  const [selected, setSelected] = useState<number | null>(null);

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("tp_token") || "";
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("Missing auth token. Please login again.");
      return;
    }

    fetch(`${backend}/api/orgs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((payload: OrgResponse) => {
        setData(payload);
        setSelected(payload?.account?.id || null);
        setStatus("Ready");
      })
      .catch(() => setStatus("Failed to load organizations"));
  }, [token]);

  const installLink = () => {
    if (!data?.install_url || !selected) return "#";
    const url = new URL(data.install_url);
    url.searchParams.set("target_id", String(selected));
    return url.toString();
  };

  return (
    <main className="container">
      <div className="header">
        <div>
          <h2>Select an organization</h2>
          <p className="muted">
            Choose where to install the GitHub App. You can include all repos or
            select specific ones on the next step.
          </p>
        </div>
        <a className="button secondary" href="/dashboard">
          Skip
        </a>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <strong>Status:</strong> {status}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Available Organizations</h3>
        <div className="grid" style={{ marginTop: 16 }}>
          {data?.account && (
            <label className="repo" style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  type="radio"
                  checked={selected === data.account.id}
                  onChange={() => setSelected(data.account.id)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{data.account.login}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Personal account
                  </div>
                </div>
              </div>
            </label>
          )}
          {data?.orgs?.map((org) => (
            <label key={org.id} className="repo" style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  type="radio"
                  checked={selected === org.id}
                  onChange={() => setSelected(org.id)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{org.login}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Organization
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <a className="button" href={installLink()} target="_blank">
          Install & Authorize
        </a>
        <a className="button secondary" href="/">
          Back to Home
        </a>
      </div>
    </main>
  );
}
