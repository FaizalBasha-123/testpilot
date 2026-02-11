'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import {
  Activity,
  Box,
  CheckCircle,
  CircleAlert,
  Cpu,
  ExternalLink,
  Github,
  Rocket,
  Shield,
  Workflow,
} from 'lucide-react';
import {
  BACKEND_URL,
  GatewayStatus,
  MeResponse,
  Repo,
  fetchWithToken,
} from '../../lib/api';

export default function DashboardPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('tp_token');
    if (!token) {
      setError('You are not signed in. Please login with GitHub.');
      setLoading(false);
      return;
    }

    Promise.all([
      fetchWithToken<{ repos: Repo[] }>('/api/repos', token),
      fetch(`${BACKEND_URL}/api/status`, { cache: 'no-store' }).then((r) =>
        r.ok ? (r.json() as Promise<GatewayStatus>) : null
      ),
      fetchWithToken<MeResponse>('/api/me', token),
    ])
      .then(([repoResp, statusResp, meResp]) => {
        setRepos(repoResp.repos || []);
        setStatus(statusResp);
        setMe(meResp);
      })
      .catch(() => {
        setError('Failed to load dashboard data from gateway.');
      })
      .finally(() => setLoading(false));
  }, []);

  const serviceSummary = useMemo(() => {
    const services = status?.services || [];
    const configured = services.filter((s) => s.configured).length;
    const reachable = services.filter((s) => s.reachable).length;
    return { configured, reachable, total: services.length };
  }, [status]);

  const privateRepos = repos.filter((r) => r.private).length;
  const publicRepos = repos.length - privateRepos;

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />

      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Enterprise Command Center</h1>
          <p className="text-gray-400">
            Live operational view for gateway, AI-core, Sonar pipeline, and GitHub App orchestration.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Authenticated User"
            value={loading ? '...' : me?.login || 'Unavailable'}
            hint="GitHub OAuth identity"
            icon={<Github size={18} className="text-blue-400" />}
          />
          <MetricCard
            title="Repositories"
            value={loading ? '...' : String(repos.length)}
            hint={`${privateRepos} private / ${publicRepos} public`}
            icon={<Box size={18} className="text-indigo-400" />}
          />
          <MetricCard
            title="Service Reachability"
            value={
              loading
                ? '...'
                : `${serviceSummary.reachable}/${serviceSummary.configured || serviceSummary.total}`
            }
            hint="Configured services responding"
            icon={<Activity size={18} className="text-green-400" />}
          />
          <MetricCard
            title="Execution Mode"
            value={status?.gateway.mock_mode ? 'Mock Enabled' : 'Real Pipeline'}
            hint="Gateway review routing"
            icon={<Cpu size={18} className="text-orange-400" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Live Service Status</h2>
            <div className="space-y-3">
              {(status?.services || []).map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between rounded-md border border-gray-700 bg-[#0d1117] px-4 py-3"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{svc.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[420px]">
                      {svc.url || 'Not configured'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      !svc.configured
                        ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        : svc.reachable
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {!svc.configured ? 'unconfigured' : svc.reachable ? 'reachable' : 'unreachable'}
                  </span>
                </div>
              ))}
              {!loading && !status?.services?.length && (
                <p className="text-sm text-gray-400">No service status available.</p>
              )}
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Capability Matrix</h2>
            <div className="space-y-2 mb-5">
              {(status?.capabilities || []).map((cap) => (
                <div key={cap} className="flex items-center text-sm text-gray-300">
                  <CheckCircle size={14} className="text-green-400 mr-2" />
                  <span>{cap}</span>
                </div>
              ))}
              {!loading && !status?.capabilities?.length && (
                <p className="text-sm text-gray-400">Capability list unavailable from gateway.</p>
              )}
            </div>
            <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-sm text-blue-300">
                The current deployment is aligned for Render-hosted gateway with tunneled local AI services.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ActionCard
            title="Install GitHub App"
            body="Grant repository access and trigger PR event automation."
            href={`${BACKEND_URL}/auth/install`}
            external
            icon={<Rocket size={20} className="text-blue-400" />}
          />
          <ActionCard
            title="Open Repositories"
            body="Verify connected repos and installation coverage."
            href="/repositories"
            icon={<Workflow size={20} className="text-green-400" />}
          />
          <ActionCard
            title="Security Pipeline"
            body="Run VS Code security analysis with Sonar-backed checks."
            href="/learnings"
            icon={<Shield size={20} className="text-orange-400" />}
          />
        </div>

        <div className="mt-8 rounded-lg border border-gray-800 bg-[#161b22] p-4 text-xs text-gray-400">
          Backend: <span className="text-gray-300">{BACKEND_URL}</span>
          {status && (
            <span className="ml-4 inline-flex items-center">
              {status.gateway.reachable ? (
                <CheckCircle size={12} className="text-green-400 mr-1" />
              ) : (
                <CircleAlert size={12} className="text-red-400 mr-1" />
              )}
              Gateway {status.gateway.reachable ? 'reachable' : 'unreachable'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm">{title}</span>
        <div className="p-2 bg-[#0d1117] rounded-md">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white mb-1 break-all">{value}</p>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function ActionCard({
  title,
  body,
  href,
  icon,
  external = false,
}: {
  title: string;
  body: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-gray-800 bg-[#161b22] p-6 hover:border-blue-500/40 transition-colors"
      >
        <div className="mb-3">{icon}</div>
        <h3 className="text-white font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-4">{body}</p>
        <span className="inline-flex items-center text-sm text-blue-400">
          Open <ExternalLink size={14} className="ml-1" />
        </span>
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-800 bg-[#161b22] p-6 hover:border-blue-500/40 transition-colors"
    >
      <div className="mb-3">{icon}</div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{body}</p>
      <span className="inline-flex items-center text-sm text-blue-400">
        Continue
      </span>
    </Link>
  );
}

