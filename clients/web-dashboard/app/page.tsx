'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle,
  Github,
  GitPullRequest,
  Laptop,
  Radar,
  Server,
  Shield,
  Workflow,
} from 'lucide-react';
import { BACKEND_URL, GatewayStatus } from '../lib/api';

export default function HomePage() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/status`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStatus(data))
      .catch(() => {
        // Landing page should still render without status.
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <header className="border-b border-gray-800 bg-[#0d1117]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 grid place-items-center">
              <Radar size={18} />
            </div>
            <div>
              <p className="font-semibold tracking-wide">TestPilot</p>
              <p className="text-xs text-gray-400">AI Review Control Plane</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm rounded-md border border-gray-700 hover:border-gray-500">
              Enterprise Login
            </Link>
            <a
              href={`${BACKEND_URL}/auth/login`}
              className="px-4 py-2 text-sm rounded-md bg-white text-black font-semibold hover:bg-gray-200 inline-flex items-center"
            >
              <Github size={15} className="mr-2" />
              GitHub OAuth
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-flex items-center text-xs px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 mb-5">
              Render gateway + local tunnel services
            </p>
            <h1 className="text-5xl leading-tight font-semibold mb-5">
              Enterprise-grade AI Review
              <span className="block text-blue-400">for PR and VS Code workflows</span>
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              TestPilot orchestrates GitHub App webhooks, Sonar-backed static analysis, and AI-driven code review/fix suggestions through a single gateway.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`${BACKEND_URL}/auth/install`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-md font-semibold inline-flex items-center"
              >
                Install GitHub App
              </a>
              <Link href="/dashboard" className="px-5 py-3 border border-gray-700 hover:border-gray-500 rounded-md">
                Open Dashboard
              </Link>
              <Link href="/learnings" className="px-5 py-3 border border-gray-700 hover:border-gray-500 rounded-md">
                VS Code Setup
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#161b22] p-6">
            <h2 className="text-lg font-semibold mb-4">Live Platform State</h2>
            <div className="space-y-3 text-sm">
              <Row label="Gateway URL" value={BACKEND_URL} />
              <Row
                label="Gateway Reachability"
                value={status?.gateway?.reachable ? 'reachable' : 'unknown'}
                ok={status?.gateway?.reachable}
              />
              <Row
                label="Execution Mode"
                value={status?.gateway?.mock_mode ? 'mock-enabled' : 'real-pipeline'}
                ok={!status?.gateway?.mock_mode}
              />
              <div className="pt-2">
                <p className="text-gray-400 mb-2">Connected Services</p>
                <div className="space-y-2">
                  {(status?.services || []).map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between rounded border border-gray-700 bg-[#0d1117] px-3 py-2">
                      <span>{svc.name}</span>
                      <span className={svc.reachable ? 'text-green-400' : 'text-gray-400'}>
                        {svc.configured ? (svc.reachable ? 'reachable' : 'unreachable') : 'unconfigured'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-800 bg-[#121826]">
          <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FeatureCard
              icon={<GitPullRequest size={18} className="text-blue-300" />}
              title="PR Webhook Automation"
              body="Processes pull_request events and runs review/improve flows through AI-core."
            />
            <FeatureCard
              icon={<Shield size={18} className="text-green-300" />}
              title="Sonar + AI Hybrid"
              body="Combines deterministic Sonar findings with contextual AI fix guidance."
            />
            <FeatureCard
              icon={<Laptop size={18} className="text-purple-300" />}
              title="VS Code Async Jobs"
              body="Supports async analysis, status polling, and cancellation from extension UI."
            />
            <FeatureCard
              icon={<Workflow size={18} className="text-orange-300" />}
              title="Tunneled Service Routing"
              body="Render gateway can route to your local AI services through managed tunnel URLs."
            />
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-gray-800 bg-[#161b22] p-6">
            <h3 className="text-lg font-semibold mb-3">Current Codebase Capabilities</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              {(status?.capabilities || []).map((cap) => (
                <li key={cap} className="flex items-center">
                  <CheckCircle size={14} className="text-green-400 mr-2" />
                  {cap}
                </li>
              ))}
              {!status?.capabilities?.length && (
                <li className="text-gray-400">Capability feed unavailable. Open dashboard for authenticated diagnostics.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#161b22] p-6">
            <h3 className="text-lg font-semibold mb-3">Deployment Flow</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <p className="flex items-center"><Server size={14} className="mr-2 text-blue-400" /> Gateway hosted on Render (`testpilot-64v5.onrender.com`)</p>
              <p className="flex items-center"><Activity size={14} className="mr-2 text-green-400" /> AI-core/Sonar services can remain local and exposed via tunnel URLs</p>
              <p className="flex items-center"><Github size={14} className="mr-2 text-gray-300" /> GitHub App events are forwarded through gateway to AI-core webhook runtime</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border border-gray-700 bg-[#0d1117] px-3 py-2">
      <span className="text-gray-400">{label}</span>
      <span className={ok === undefined ? 'text-gray-200' : ok ? 'text-green-400' : 'text-yellow-400'}>
        {value}
      </span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-5">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{body}</p>
    </div>
  );
}

