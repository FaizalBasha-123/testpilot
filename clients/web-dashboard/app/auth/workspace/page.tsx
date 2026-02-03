"use client";

import { useEffect, useMemo } from "react";

export default function WorkspaceLoadingPage() {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("tp_token", token);
      const timer = setTimeout(() => {
        window.location.href = "/onboarding";
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [token]);

  return (
    <main className="login-wrap">
      <section style={{ textAlign: "center" }}>
        <div
          className="logo"
          style={{
            fontSize: 32,
            justifyContent: "center",
            marginBottom: 48,
          }}
        >
          <span
            className="badge"
            style={{
              fontSize: 24,
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            TP
          </span>
          TestPilot
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#94a3b8",
            marginBottom: 32,
          }}
        >
          Setting up your workspace...
        </div>
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div className="spinner"></div>
        </div>
      </section>
    </main>
  );
}
