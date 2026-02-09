'use client';

import { ArrowRight, CheckCircle, Code, Shield, Zap, Terminal, Github, GitBranch, Cpu, Activity, Lock, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const backend =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://testpilot-64v5.onrender.com'
    : 'http://localhost:8001');

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-[#0d1117]/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Cpu size={20} className="text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">TestPilot</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Features</Link>
              <Link href="#security" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Security</Link>
              <Link href="/learnings" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Docs</Link>
              <Link href={`${backend}/auth/login`} className="flex items-center px-4 py-2 bg-white text-black text-sm font-bold rounded-md hover:bg-gray-200 transition-colors">
                <Github size={16} className="mr-2" />
                Sign in with GitHub
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold uppercase tracking-wide mb-6 animate-fade-in-up">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
            v1.0 is now live
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 max-w-5xl mx-auto leading-tight">
            Ship PRs in seconds with a <br className="hidden md:block" />
            <span className="text-blue-500">lightning-fast AI co-pilot</span>.
          </h1>
          <p className="mt-4 text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            TestPilot watches your repo, catches bugs, and opens polished PRs instantly.
            Stop waiting for CI. Start shipping with confidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <a href={`${backend}/auth/login`} className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 flex items-center justify-center">
              Start Free Trial
              <ArrowRight size={20} className="ml-2" />
            </a>
            <Link href="/learnings" className="w-full sm:w-auto px-8 py-4 bg-[#161b22] border border-gray-700 hover:border-gray-500 text-white rounded-lg font-bold text-lg transition-all flex items-center justify-center">
              <Terminal size={20} className="mr-2 text-gray-400" />
              Read Documentation
            </Link>
          </div>

          {/* Terminal Demo */}
          <div className="mt-20 relative max-w-4xl mx-auto perspective-1000">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent blur-3xl -z-10 rounded-[3rem]"></div>
            <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden shadow-2xl transform rotate-x-12 transition-transform duration-500 hover:rotate-x-0">
              <div className="flex items-center px-4 py-3 bg-[#0d1117] border-b border-gray-800">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1 text-center text-xs text-gray-500 font-mono">TestPilot AI — Watch Mode</div>
              </div>
              <div className="p-6 text-left font-mono text-sm leading-relaxed">
                <div className="flex">
                  <span className="text-blue-400 mr-2">➜</span>
                  <span className="text-white">git push origin feature/auth-fix</span>
                </div>
                <div className="text-gray-500 mt-2">Enumerating objects: 15, done.</div>
                <div className="text-gray-500">Writing objects: 100% (15/15), 2.45 KiB | 2.45 MiB/s, done.</div>
                <div className="text-gray-500 mb-4">Total 15 (delta 4), reused 0 (delta 0), pack-reused 0</div>

                <div className="flex items-center mt-4 text-green-400">
                  <Zap size={14} className="mr-2" />
                  <span>TestPilot detected new push... analyzing 3 files</span>
                </div>
                <div className="ml-6 mt-1 text-gray-400">
                  <div>✓ layout.tsx (Security Scan Passed)</div>
                  <div>✓ auth.ts (1 suggestion found)</div>
                  <div>⚠ api/route.ts (Potential race condition detected)</div>
                </div>

                <div className="flex items-center mt-4 text-purple-400">
                  <GitBranch size={14} className="mr-2" />
                  <span>Opening Pull Request #42: "fix: resolve auth race condition"</span>
                </div>
                <div className="ml-6 mt-1 text-gray-400">
                  <a href="#" className="underline decoration-gray-600 underline-offset-4 hover:text-white">https://github.com/acme/app/pull/42</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-gray-800 bg-[#161b22]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">Trusted by engineering teams at</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {['Acme Corp', 'Globex', 'Soylent', 'Umbrella', 'Cyberdyne'].map((company) => (
              <div key={company} className="flex items-center justify-center">
                <span className="text-xl font-bold text-white">{company}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Built for speed. Engineered for quality.</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              TestPilot isn't just a linter. It's an intelligent agent that understands your codebase and fixes issues before they reach production.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#161b22] rounded-2xl p-8 border border-gray-800 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                <Zap size={24} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Instant Analysis</h3>
              <p className="text-gray-400 leading-relaxed">
                Get feedback in seconds, not minutes. TestPilot analyzes your code as soon as you push, without waiting for slow CI pipelines.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#161b22] rounded-2xl p-8 border border-gray-800 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                <Code size={24} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Auto-Fix Logic</h3>
              <p className="text-gray-400 leading-relaxed">
                Why just flag errors when you can fix them? TestPilot suggests and applies fixes for common patterns, lints, and type errors automatically.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#161b22] rounded-2xl p-8 border border-gray-800 hover:border-green-500/50 transition-all group">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition-colors">
                <Shield size={24} className="text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Security First</h3>
              <p className="text-gray-400 leading-relaxed">
                Catch vulnerabilities early. TestPilot scans for secrets, injection flaws, and dependent package risks on every commit.
              </p>
            </div>
          </div>

          {/* Large Feature Block */}
          <div className="mt-8 bg-[#161b22] rounded-2xl p-8 md:p-12 border border-gray-800 flex flex-col md:flex-row items-center">
            <div className="flex-1 mb-8 md:mb-0 md:mr-12">
              <div className="inline-flex items-center px-3 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-semibold uppercase tracking-wide mb-6">
                <Terminal size={12} className="mr-2" />
                CLI Integration
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">Works where you work</h3>
              <p className="text-gray-400 text-lg mb-6">
                Whether you prefer the command line, VS Code, or the GitHub UI, TestPilot integrates seamlessly into your existing workflow.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center text-gray-300">
                  <CheckCircle size={18} className="text-green-400 mr-2" />
                  VS Code Extension
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle size={18} className="text-green-400 mr-2" />
                  GitHub Actions Runner
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle size={18} className="text-green-400 mr-2" />
                  CLI for local hooks
                </li>
              </ul>
            </div>
            <div className="flex-1 w-full relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl rounded-full"></div>
              <div className="relative bg-[#0d1117] border border-gray-700 rounded-lg p-4 shadow-2xl">
                <div className="flex items-center space-x-2 mb-4 border-b border-gray-800 pb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="font-mono text-sm text-gray-300">
                  <p className="text-blue-400">$ testpilot init</p>
                  <p className="mt-2 text-green-400">✓ Detected Next.js project</p>
                  <p className="text-green-400">✓ Installed git hooks</p>
                  <p className="text-green-400">✓ Connected to GitHub App</p>
                  <p className="mt-2">TestPilot is ready to fly! ✈️</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats/Metrics */}
      <section className="py-20 border-t border-gray-800 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-gray-800">
            <div className="p-4">
              <div className="text-4xl font-bold text-white mb-2">500ms</div>
              <div className="text-sm text-gray-400 uppercase tracking-wide">Avg. Analysis Time</div>
            </div>
            <div className="p-4">
              <div className="text-4xl font-bold text-white mb-2">99.9%</div>
              <div className="text-sm text-gray-400 uppercase tracking-wide">Uptime SLA</div>
            </div>
            <div className="p-4">
              <div className="text-4xl font-bold text-white mb-2">10k+</div>
              <div className="text-sm text-gray-400 uppercase tracking-wide">PRs Reviewed</div>
            </div>
            <div className="p-4">
              <div className="text-4xl font-bold text-white mb-2">0</div>
              <div className="text-sm text-gray-400 uppercase tracking-wide">Config Required</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to accelerate your workflow?</h2>
          <p className="text-xl text-gray-400 mb-10">
            Join thousands of developers who are shipping faster and cleaner code with TestPilot.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <a href={`${backend}/auth/login`} className="w-full sm:w-auto px-8 py-4 bg-white text-black hover:bg-gray-100 rounded-lg font-bold text-lg transition-colors shadow-lg flex items-center justify-center">
              <Github size={20} className="mr-2" />
              Install on GitHub
            </a>
            <Link href="/contact" className="w-full sm:w-auto px-8 py-4 bg-transparent border border-gray-600 hover:border-white text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-800 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Enterprise</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">API Reference</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Community</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Legal</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                  <Cpu size={14} className="text-white" />
                </div>
                <span className="font-bold text-white">TestPilot</span>
              </div>
              <p className="text-sm text-gray-400">
                AI-powered code reviews for modern engineering teams.
              </p>
              <div className="flex space-x-4 mt-4">
                <Github className="text-gray-400 hover:text-white cursor-pointer" size={20} />
                <Users className="text-gray-400 hover:text-white cursor-pointer" size={20} />
                <Activity className="text-gray-400 hover:text-white cursor-pointer" size={20} />
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-gray-500">© 2026 TestPilot Inc. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="text-sm text-gray-500 hover:text-white">Privacy Policy</Link>
              <Link href="#" className="text-sm text-gray-500 hover:text-white">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
