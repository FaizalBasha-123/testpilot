'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle,
  Github,
  GitPullRequest,
  Globe,
  Laptop,
  Lock,
  Radar,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import { BACKEND_URL, GatewayStatus } from '../lib/api';

export default function HomePage() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/status`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStatus(data))
      .catch(() => {
        // Landing page resilient to gateway downtime
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#02040a] text-white selection:bg-blue-500/30">
      {/* Navbar */}
      <header className="fixed top-0 w-full border-b border-white/5 bg-[#02040a]/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
              <div className="relative h-9 w-9 bg-[#0a0a0a] rounded-lg border border-white/10 grid place-items-center">
                <Radar size={20} className="text-blue-500" />
              </div>
            </div>
            <div>
              <p className="font-bold tracking-tight text-lg leading-none">TestPilot</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mt-0.5">Enterprise</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden md:flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <a
              href={`${BACKEND_URL}/auth/login`}
              className="h-9 px-4 text-sm font-medium bg-white text-black rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <Github size={16} />
              <span>Connect GitHub</span>
            </a>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center mb-32">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-xs font-medium text-blue-400 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Hybrid Cloud Architecture Live
            </div>

            <h1 className="text-6xl font-bold tracking-tight leading-[1.1]">
              Secure AI Review <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400">
                Behind Your Firewall
              </span>
            </h1>

            <p className="text-xl text-gray-400 leading-relaxed max-w-lg">
              Orchestrate secure code reviews with a hybrid gateway. Keep your AI models and SonarQube instances local, while seamlessly integrating with GitHub Enterprise.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center transition-all hover:scale-105 active:scale-95"
              >
                Access Console
              </Link>
              <a
                href={`${BACKEND_URL}/auth/install`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-8 rounded-full border border-gray-700 hover:border-gray-500 bg-white/5 hover:bg-white/10 font-semibold flex items-center transition-all"
              >
                Install App
              </a>
            </div>

            <div className="flex items-center gap-8 pt-8 border-t border-white/5">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-[#02040a] bg-gray-800" />
                ))}
              </div>
              <div className="text-sm text-gray-500">
                Trusted by engineering teams at <span className="text-gray-300">innovative companies</span>
              </div>
            </div>
          </div>

          {/* Architecture Visualization */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-30 transition duration-1000" />
            <div className="relative rounded-2xl border border-white/10 bg-[#0a0c10] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="text-xs text-gray-500 font-mono">system_status.json</div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Gateway Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${status?.gateway?.reachable ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                      <span className="font-mono text-sm">{status?.gateway?.reachable ? 'OPERATIONAL' : 'UNREACHABLE'}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-gray-400">Mode</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {status?.gateway?.mock_mode ? 'MOCK' : 'HYBRID_TUNNEL'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Tunnels</p>
                  {(status?.services || []).map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 group/item hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Activity size={16} className={svc.reachable ? 'text-green-400' : 'text-gray-500'} />
                        <span className="text-sm font-medium">{svc.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-mono max-w-[120px] truncate">{svc.url || 'pending'}</span>
                        <div className={`h-1.5 w-1.5 rounded-full ${svc.reachable ? 'bg-green-500' : 'bg-gray-600'}`} />
                      </div>
                    </div>
                  ))}
                  {(!status?.services?.length) && (
                    <div className="p-4 text-center text-sm text-gray-500 italic">No services detected in this fleet.</div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Backend URL</p>
                    <p className="text-xs font-mono text-gray-300 truncate">{BACKEND_URL}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Latency</p>
                    <p className="text-xs font-mono text-green-400">~24ms</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="border-y border-white/5 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 py-24">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold mb-4">Engineered for Security & Speed</h2>
              <p className="text-gray-400">
                A complete review pipeline that respects your data sovereignty while leveraging the power of modern LLMs.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Feature
                icon={<Shield className="text-green-400" />}
                title="Zero-Egress Analysis"
                desc="Run SonarQube and custom linters on your local infrastructure. Only metadata traverses the gateway."
              />
              <Feature
                icon={<Zap className="text-yellow-400" />}
                title="Tunnel-Optimized"
                desc="Securely expose local AI services to GitHub's cloud via encrypted Cloudflare tunnels without opening firewall ports."
              />
              <Feature
                icon={<GitPullRequest className="text-purple-400" />}
                title="Context-Aware Reviews"
                desc="AI agents analyze complete file context across the repository to suggest accurate, compilable fixes."
              />
              <Feature
                icon={<Lock className="text-red-400" />}
                title="Secret Sanitization"
                desc="Automatic detection and scrubbing of API keys and credentials before any analysis occurs."
              />
              <Feature
                icon={<Globe className="text-blue-400" />}
                title="Universal Gateway"
                desc="One endpoint to rule them all. Route traffic from VS Code, GitHub, and CI/CD through a single validated control plane."
              />
              <Feature
                icon={<Laptop className="text-orange-400" />}
                title="Local-First IDE"
                desc="VS Code extensions connect directly to your local Docker containers for zero-latency feedback loops."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-6 py-32 text-center">
          <div className="relative p-12 rounded-3xl overflow-hidden bg-gradient-to-b from-blue-900/20 to-transparent border border-white/10">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
            <h2 className="relative text-4xl font-bold mb-6">Ready to upgrade your workflow?</h2>
            <p className="relative text-lg text-gray-400 mb-10 max-w-xl mx-auto">
              Join the new standard of secure, AI-assisted code review. Deploy your gateway today.
            </p>
            <div className="relative flex justify-center gap-4">
              <Link
                href="/login"
                className="h-14 px-8 rounded-full bg-white text-black font-bold flex items-center hover:bg-gray-200 transition-colors"
              >
                Get Started Now
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-12 bg-[#02040a]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>&copy; 2026 TestPilot Inc. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white">Documentation</a>
            <a href="#" className="hover:text-white">API Reference</a>
            <a href="#" className="hover:text-white">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="group p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
      <div className="mb-6 inline-flex p-3 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}
