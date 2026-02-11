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
  Terminal,
  Code2,
  Cpu,
  Workflow,
  Check,
  X,
  MessageSquare,
  FileCode,
  Bot,
  CircleAlert,
} from 'lucide-react';
import { BACKEND_URL, GatewayStatus } from '../lib/api';

export default function HomePage() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/status`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStatus(data))
      .catch(() => { });
  }, []);

  return (
    <div className="min-h-screen bg-[#02040a] text-white selection:bg-blue-500/30 font-sans">
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

      <main className="pt-32">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center mb-32">
          <div className="space-y-8 animate-fade-in delay-100">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-xs font-medium text-blue-400">
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
          <div className="relative group animate-fade-in delay-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-30 transition duration-1000" />
            <div className="relative rounded-2xl border border-white/10 bg-[#0a0c10] overflow-hidden shadow-2xl">
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

        {/* Deep Dive: PR Agent */}
        <section className="py-32 border-t border-white/5 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute -inset-4 bg-purple-500/20 blur-2xl rounded-full opacity-50" />
              <div className="relative rounded-xl border border-white/10 bg-[#0d1117] shadow-xl overflow-hidden">
                {/* Mock GitHub PR UI */}
                <div className="bg-[#161b22] px-4 py-3 border-b border-white/10 flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <GitPullRequest size={14} className="text-green-400" />
                      Fix null pointer exception in auth service #42
                    </span>
                    <span className="text-xs text-gray-500">Open • opened 12m ago by dev-bot</span>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 grid place-items-center flex-shrink-0">
                      <Bot size={20} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="bg-[#161b22] border border-white/10 rounded-lg">
                        <div className="px-3 py-2 border-b border-white/10 bg-[#0d1117] flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-300">TestPilot AI</span>
                          <span className="text-xs text-gray-500">Just now</span>
                        </div>
                        <div className="p-4 text-sm text-gray-300 space-y-3">
                          <p>I've analyzed the changes. There is a potential <strong>security vulnerability</strong> in the token handling logic.</p>
                          <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Shield size={14} className="text-red-400" />
                              <span className="font-semibold text-red-400 text-xs">CRITICAL: Hardcoded Secret</span>
                            </div>
                            <p className="text-xs text-gray-400">Line 45 contains a visible API key pattern.</p>
                          </div>
                          <p>Proposed Fix:</p>
                          <div className="bg-[#0d1117] rounded border border-white/10 p-3 font-mono text-xs">
                            <div className="text-red-400">- const apiKey = "sk_live_12345";</div>
                            <div className="text-green-400">+ const apiKey = process.env.STRIPE_KEY;</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-6">
              <div className="inline-flex items-center gap-2 text-purple-400 font-semibold tracking-wide uppercase text-xs">
                <CheckCircle size={14} />
                Automated Code Review
              </div>
              <h2 className="text-4xl font-bold">Your AI-Powered <br /> Pair Programmer</h2>
              <p className="text-lg text-gray-400 leading-relaxed">
                TestPilot hooks directly into your GitHub workflow. Every PR is automatically scanned for bugs, security flaws, and performance issues before a human ever reviews it.
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 p-1 rounded bg-purple-500/10"><MessageSquare size={16} className="text-purple-400" /></div>
                  <div>
                    <h4 className="font-semibold text-sm">Context-Aware Feedback</h4>
                    <p className="text-sm text-gray-500">Understands the full repository context, not just the diff.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 p-1 rounded bg-purple-500/10"><FileCode size={16} className="text-purple-400" /></div>
                  <div>
                    <h4 className="font-semibold text-sm">Auto-Fix Generation</h4>
                    <p className="text-sm text-gray-500">One-click commit suggestions to resolve linting errors and bugs.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Deep Dive: VS Code Extension */}
        <section className="py-32 border-t border-white/5 bg-[#05070a]">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 text-blue-400 font-semibold tracking-wide uppercase text-xs">
                <Code2 size={14} />
                Local-First IDE Extension
              </div>
              <h2 className="text-4xl font-bold">Security Analysis <br /> Where You Work</h2>
              <p className="text-lg text-gray-400 leading-relaxed">
                Don't wait for CI. Catch vulnerabilities directly in VS Code with our local extension that communicates with your secure gateway.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <Zap size={20} className="text-yellow-400 mb-3" />
                  <h4 className="font-semibold">Zero Latency</h4>
                  <p className="text-sm text-gray-500">Runs against local Docker containers.</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <Lock size={20} className="text-blue-400 mb-3" />
                  <h4 className="font-semibold">Private & Secure</h4>
                  <p className="text-sm text-gray-500">Code never leaves your local network.</p>
                </div>
              </div>
              <div className="pt-6">
                <Link href="/learnings" className="inline-flex items-center gap-2 text-blue-400 font-semibold hover:text-blue-300 transition-colors">
                  View VS Code Setup Guide <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-blue-600/10 blur-3xl rounded-full opacity-50" />
              {/* Mock VS Code UI */}
              <div className="relative rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl overflow-hidden font-mono text-sm leading-6">
                <div className="flex bg-[#252526] px-3 py-2 border-b border-black/50 text-xs text-gray-400 justify-between items-center">
                  <span className="flex-1 text-center">auth_service.ts - TestPilot</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                  </div>
                </div>
                <div className="grid grid-cols-[theme(spacing.64)_1fr] h-[400px]">
                  {/* Sidebar */}
                  <div className="bg-[#252526] border-r border-black/50 p-0 hidden sm:block">
                    <div className="px-4 py-2 text-xs font-bold text-gray-300 bg-[#37373d]">EXPLORER</div>
                    <div className="p-2 space-y-1 text-gray-400 text-xs">
                      <div className="flex items-center gap-2 text-blue-400 bg-[#37373d]/50 px-2 py-1 rounded cursor-pointer">
                        <Terminal size={12} />
                        <span>TestPilot: Analysis</span>
                      </div>
                      <div className="px-4 pt-2 pb-1 text-xs font-bold text-gray-500">ISSUES FOUND (3)</div>
                      <div className="pl-4 space-y-2">
                        <div className="flex items-center gap-2 text-red-400">
                          <X size={10} />
                          <span>SQL Injection</span>
                        </div>
                        <div className="flex items-center gap-2 text-yellow-400">
                          <CircleAlert size={10} />
                          <span>Weak Encryption</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Editor */}
                  <div className="bg-[#1e1e1e] p-4 text-gray-300 overflow-hidden relative">
                    <div className="flex gap-4">
                      <div className="text-gray-600 select-none text-right">
                        1<br />2<br />3<br />4<br />5<br />6
                      </div>
                      <div>
                        <span className="text-purple-400">import</span> {'{'} verify {'}'} <span className="text-purple-400">from</span> <span className="text-orange-300">'crypto'</span>;<br />
                        <br />
                        <span className="text-blue-400">function</span> <span className="text-yellow-300">validateUser</span>(id) {'{'}<br />
                        &nbsp;&nbsp;<span className="text-green-400">// TODO: Fix security hole</span><br />
                        &nbsp;&nbsp;<span className="text-purple-400">const</span> query = <span className="text-orange-300">`SELECT * FROM users WHERE id = <span className="border-b-2 border-red-500 cursor-help">${'{'}id{'}'}</span>`</span>;<br />
                        &nbsp;&nbsp;<span className="text-blue-400">return</span> db.<span className="text-yellow-300">execute</span>(query);<br />
                        {'}'}
                      </div>
                    </div>
                    {/* Hover Widget */}
                    <div className="absolute top-24 left-32 bg-[#252526] border border-blue-500/50 rounded shadow-2xl p-3 w-64 animate-fade-in">
                      <div className="flex items-center gap-2 text-blue-400 text-xs font-bold mb-2">
                        <Sparkles size={12} />
                        TestPilot Fix
                      </div>
                      <p className="text-xs text-gray-300 mb-2">Unsanitized input detected. Use parameterized queries to prevent SQLi.</p>
                      <button className="w-full py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">
                        Apply Fix
                      </button>
                    </div>
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
            <Link href="/learnings" className="hover:text-white">Documentation</Link>
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

/* Helper Icons for Mockups */
function ArrowRight({ size, className }: { size: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
}

function Sparkles({ size, className }: { size: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>;
}
