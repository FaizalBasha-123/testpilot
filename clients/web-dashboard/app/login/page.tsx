"use client";

import { useEffect, useState } from "react";
import { CheckCircle, CircleAlert, Github, LayoutGrid, ShieldCheck, Zap } from "lucide-react";
import { BACKEND_URL, GatewayStatus } from "../../lib/api";

const backend = BACKEND_URL;

export default function LoginPage() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    fetch(`${backend}/api/status`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStatus(data))
      .catch(() => { });
  }, []);

  const handleLogin = () => {
    window.location.href = '/auth/loading';
    setTimeout(() => {
      window.location.href = `${backend}/auth/login`;
    }, 100);
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[#02040a] text-white">
      {/* Left Column: Form */}
      <div className="flex flex-col justify-center px-12 lg:px-24 py-12">
        <div className="mb-12">
          <span className="text-blue-500 font-bold tracking-tight text-xl">TestPilot</span>
        </div>

        <div className="max-w-md w-full mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-4 tracking-tight">Enterprise Sign In</h1>
            <p className="text-gray-400">Authenticate with GitHub to access your secure gateway and orchestrate local AI services.</p>
          </div>

          <div className="space-y-6">
            <button
              onClick={handleLogin}
              className="w-full h-12 bg-white text-black font-semibold rounded-lg flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors"
            >
              <Github size={20} />
              Continue with GitHub
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#02040a] px-4 text-xs text-gray-500">GATEWAY STATUS</span>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Endpoint</span>
                <span className="font-mono text-gray-300 text-xs bg-black/20 px-2 py-1 rounded">{backend}</span>
              </div>
              <div className="flex items-center gap-2">
                {status?.gateway?.reachable ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : (
                  <CircleAlert size={14} className="text-yellow-400" />
                )}
                <span className={status?.gateway?.reachable ? "text-green-400" : "text-yellow-400"}>
                  {status?.gateway?.reachable ? "Systems Operational" : "Gateway Unreachable"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-white/5 border border-white/5">
              <ShieldCheck size={20} className="mx-auto text-blue-400 mb-2" />
              <p className="text-xs text-gray-400">SOC2 Type II<br />Ready</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/5">
              <Zap size={20} className="mx-auto text-yellow-400 mb-2" />
              <p className="text-xs text-gray-400">Zero Latency<br />Feedback</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/5">
              <LayoutGrid size={20} className="mx-auto text-purple-400 mb-2" />
              <p className="text-xs text-gray-400">Centralized<br />Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Visual */}
      <div className="hidden lg:flex relative bg-[#0a0c10] border-l border-white/5 flex-col justify-center items-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 blur-[100px] rounded-full pointr-events-none" />

        <div className="relative z-10 p-12 max-w-lg text-center">
          <img src="/images/login-illustration.svg" alt="Platform Preview" className="mb-0 drop-shadow-2xl" />
          <h2 className="text-2xl font-bold mb-4">Command Your Fleet</h2>
          <p className="text-gray-400">Monitor and manage your distributed AI review agents from a single pane of glass.</p>
        </div>
      </div>
    </main>
  );
}
