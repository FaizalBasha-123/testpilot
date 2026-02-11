'use client';

import { ArrowRight, CheckCircle, Code, Shield, Zap, Terminal, Github, GitBranch, Cpu, Activity, Lock, Users, Database, Server, Cloud, Laptop, Box } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const backend =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  // Canonical gateway endpoint for this codebase state.
  'https://testpilot-64v5.onrender.com';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white selection:bg-blue-500/30 font-sans">
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-[#0d1117]/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Cpu size={20} className="text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">TestPilot</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Platform</Link>
              <Link href="#architecture" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Architecture</Link>
              <Link href="#vscode" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">VS Code</Link>
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
        {/* Abstract Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl opacity-20 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-[100px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold uppercase tracking-wide mb-6 animate-fade-in-up">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
            v2.0: API-Only & Hybrid Cloud
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-gray-200 to-gray-500 max-w-5xl mx-auto leading-tight">
            Autonomous Code Review <br />
            <span className="text-blue-500">Powered by Sonar & Groq</span>
          </h1>
          <p className="mt-4 text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Combine the precision of <strong>SonarQube</strong> static analysis with the speed of <strong>Llama-3</strong> via Groq.
            Catch bugs, security flaws, and style issues directly in VS Code before you merge.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 flex items-center justify-center">
              Install Extension
              <Laptop size={20} className="ml-2" />
            </button>
            <Link href="#architecture" className="w-full sm:w-auto px-8 py-4 bg-[#161b22] border border-gray-700 hover:border-gray-500 text-white rounded-lg font-bold text-lg transition-all flex items-center justify-center">
              <Server size={20} className="mr-2 text-gray-400" />
              View Architecture
            </Link>
          </div>

          {/* Interactive Demo Block */}
          <div className="mt-20 relative max-w-5xl mx-auto">
            <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-2xl border border-gray-800">
              <div className="flex items-center px-4 py-2 bg-[#252526] border-b border-gray-800">
                <div className="flex space-x-2 mr-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400 font-sans">extension.ts — VS Code</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Code Editor */}
                <div className="p-4 font-mono text-sm bg-[#1e1e1e] text-gray-300 border-r border-gray-800">
                  <div className="flex">
                    <span className="text-gray-600 w-6 select-none">1</span>
                    <span className="text-purple-400">const</span> <span className="text-blue-400 ml-2">apiKey</span> = <span className="text-orange-400">"sk-1234567890abcdef"</span>;
                  </div>
                  <div className="flex bg-red-500/10">
                    <span className="text-gray-600 w-6 select-none">2</span>
                    <span className="text-gray-400 ml-4">// TODO: Fix hardcoded secret</span>
                  </div>
                  <div className="flex mt-2">
                    <span className="text-gray-600 w-6 select-none">3</span>
                    <span className="text-purple-400">function</span> <span className="text-yellow-400 ml-2">connect</span>() {'{'}
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-6 select-none">4</span>
                    <span className="text-gray-400 ml-4">db.query(</span><span className="text-orange-400">"SELECT * FROM users WHERE id="</span> + input<span className="text-gray-400">);</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-6 select-none">5</span>
                    {'}'}
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 rounded border border-blue-500/20 text-xs">
                    <div className="flex items-center text-blue-400 font-bold mb-1">
                      <Zap size={14} className="mr-1" /> TestPilot Analysis
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span>Processing with Groq/Llama-3...</span>
                      <span className="text-green-400">50ms</span>
                    </div>
                  </div>
                </div>

                {/* Sidebar / Analysis Panel */}
                <div className="p-4 bg-[#252526] text-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">TestPilot Security Report</div>

                  {/* Issue 1 */}
                  <div className="mb-4 bg-[#1e1e1e] p-3 rounded border border-red-500/30">
                    <div className="flex items-center text-red-400 font-bold mb-1">
                      <Shield size={14} className="mr-2" /> Critical: Hardcoded Secret
                    </div>
                    <p className="text-gray-400 text-xs mb-2">Line 1 contains a potential API key. This violates security policy.</p>
                    <button className="w-full py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition-colors">
                      Fix: Move to .env
                    </button>
                  </div>

                  {/* Issue 2 */}
                  <div className="bg-[#1e1e1e] p-3 rounded border border-yellow-500/30">
                    <div className="flex items-center text-yellow-400 font-bold mb-1">
                      <Database size={14} className="mr-2" /> High: SQL Injection
                    </div>
                    <p className="text-gray-400 text-xs mb-2">Line 4 uses string concatenation for queries. Use parameterized queries instead.</p>
                    <button className="w-full py-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded text-xs transition-colors">
                      Fix: Use params
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-24 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The Universal Quality Engine</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              We combined the industry standard for static analysis with the fastest LLM inference engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#161b22] rounded-2xl p-8 border border-gray-800 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <Database size={24} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">SonarQube Integrated</h3>
              <p className="text-gray-400">
                Built on top of the SonarScanner engine. Detects complex bugs, security hotspots, and code smells with zero hallucinations.
              </p>
            </div>

            <div className="bg-[#161b22] rounded-2xl p-8 border border-gray-800 hover:border-orange-500/50 transition-all group">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
                <Zap size={24} className="text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Powered by Groq</h3>
              <p className="text-gray-400">
                Utilizes Llama-3-70b functionality via Groq's LPU™. Experience near-instant PR summaries and fix suggestions.
              </p>
            </div>

            <div className="bg-[#161b22] rounded-2xl p-8 border border-gray-800 hover:border-green-500/50 transition-all group">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-6">
                <Box size={24} className="text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Lightweight & API-Only</h3>
              <p className="text-gray-400">
                No more 5GB Docker images. Our new architecture delegates heavy lifting to APIs, keeping your local dev environment fast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture / How it Works */}
      <section id="architecture" className="py-20 border-y border-gray-800 bg-[#161b22]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-6">Hybrid Cloud Architecture</h2>
              <p className="text-gray-400 mb-8 text-lg">
                TestPilot fits your security posture. Run the analysis engine locally or in your private cloud, while leveraging public LLM APIs for intelligence.
              </p>

              <ul className="space-y-6">
                <li className="flex items-start">
                  <div className="mt-1 mr-4 bg-purple-500/10 p-2 rounded-lg">
                    <Laptop className="text-purple-400" size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">VS Code Extension</h4>
                    <p className="text-gray-400 text-sm">Orchestrates the workflow. Zips workspace securely and talks to the Gateway.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="mt-1 mr-4 bg-blue-500/10 p-2 rounded-lg">
                    <Server className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">AI Core Gateway</h4>
                    <p className="text-gray-400 text-sm">Routes requests. Generates embeddings on Groq. Contextualizes code for the LLM.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="mt-1 mr-4 bg-green-500/10 p-2 rounded-lg">
                    <Shield className="text-green-400" size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Sonar Scanner Service</h4>
                    <p className="text-gray-400 text-sm">Performs deep AST analysis to catch vulnerabilities that LLMs miss.</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Architecture Diagram Visualization */}
            <div className="flex-1 w-full flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                <div className="relative bg-[#0d1117] border border-gray-700 rounded-xl p-6 shadow-2xl space-y-4">
                  <div className="flex justify-center">
                    <div className="px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded text-purple-300 text-sm font-bold flex items-center">
                      <Laptop size={14} className="mr-2" /> Developer (VS Code)
                    </div>
                  </div>
                  <div className="h-8 w-0.5 bg-gray-700 mx-auto"></div>
                  <div className="flex justify-center">
                    <div className="px-4 py-2 bg-blue-900/30 border border-blue-500/30 rounded text-blue-300 text-sm font-bold flex items-center w-full justify-center">
                      <Server size={14} className="mr-2" /> TestPilot Gateway
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-4 relative">
                    <div className="h-8 w-0.5 bg-gray-700 absolute left-1/4"></div>
                    <div className="h-8 w-0.5 bg-gray-700 absolute right-1/4"></div>
                  </div>
                  <div className="flex justify-between gap-4 mt-2">
                    <div className="flex-1 px-2 py-3 bg-orange-900/20 border border-orange-500/30 rounded text-orange-300 text-xs font-bold text-center">
                      Groq / LLM
                    </div>
                    <div className="flex-1 px-2 py-3 bg-green-900/20 border border-green-500/30 rounded text-green-300 text-xs font-bold text-center">
                      SonarQube
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready for the future of code review?</h2>
          <p className="text-xl text-gray-400 mb-10">
            Stop manually checking for null pointers. Let TestPilot handle the bore, so you can focus on the core.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <a href={`${backend}/auth/login`} className="w-full sm:w-auto px-8 py-4 bg-white text-black hover:bg-gray-100 rounded-lg font-bold text-lg transition-colors shadow-lg flex items-center justify-center">
              <Github size={20} className="mr-2" />
              Sign in with GitHub
            </a>
            <Link href="#contact" className="w-full sm:w-auto px-8 py-4 bg-transparent border border-gray-600 hover:border-white text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center">
              Deploy Locally
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-800 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                <Cpu size={14} className="text-white" />
              </div>
              <span className="font-bold text-white">TestPilot</span>
              <span className="text-gray-500 text-sm ml-2">© 2026</span>
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <span className="text-gray-500 text-sm">Powered by <strong>Render</strong> & <strong>Groq</strong></span>
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="text-sm text-gray-500 hover:text-white">Privacy</Link>
              <Link href="#" className="text-sm text-gray-500 hover:text-white">Terms</Link>
              <Link href="#" className="text-sm text-gray-500 hover:text-white">GitHub</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
