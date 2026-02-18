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
  Server,
  Terminal,
  Shield,
  Workflow,
  Zap,
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
    <div className="flex min-h-screen bg-[#02040a]">
      <Sidebar />

      <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Command Center</h1>
            <p className="text-gray-400">Real-time telemetry and orchestration for your AI review fleet.</p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-full px-4 py-2">
            <div className={`h-2.5 w-2.5 rounded-full ${status?.gateway?.reachable ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-mono text-gray-300">{status?.gateway?.reachable ? 'GATEWAY ONLINE' : 'OFFLINE'}</span>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm flex items-center gap-2">
            <CircleAlert size={16} />
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <MetricCard
            title="Active Identity"
            value={loading ? '...' : me?.login || 'Unavailable'}
            hint="GitHub OAuth"
            icon={<Github size={20} className="text-blue-400" />}
          />
          <MetricCard
            title="Repositories"
            value={loading ? '...' : String(repos.length)}
            hint={`${privateRepos} Pvt / ${publicRepos} Pub`}
            icon={<Box size={20} className="text-indigo-400" />}
          />
          <MetricCard
            title="Tunnel Health"
            value={
              loading
                ? '...'
                : `${serviceSummary.reachable}/${serviceSummary.configured || serviceSummary.total}`
            }
            hint="Services Reachable"
            icon={<Zap size={20} className="text-yellow-400" />}
          />
          <MetricCard
            title="Pipeline Mode"
            value={status?.gateway.mock_mode ? 'MOCK' : 'HYBRID'}
            hint="Gateway Routing"
            icon={<Cpu size={20} className="text-orange-400" />}
          />
          <MetricCard
            title="Git Runtime"
            value={
              loading
                ? '...'
                : status?.runtime?.git?.installed
                  ? 'INSTALLED'
                  : 'MISSING'
            }
            hint={status?.runtime?.git?.version || 'Gateway host runtime'}
            icon={<Terminal size={20} className="text-emerald-400" />}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
          {/* Main Status Panel */}
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-[#0a0c10] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Service Fleet Status</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Activity size={12} />
                  Live Polling
                </div>
              </div>

              <div className="space-y-3">
                {(status?.services || []).map((svc) => (
                  <div
                    key={svc.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-blue-500/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${svc.reachable ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <Server size={18} className={svc.reachable ? 'text-green-400' : 'text-red-400'} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{svc.name}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5 max-w-[300px] truncate">
                          {svc.url || 'Pending Configuration'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider ${!svc.configured
                            ? 'bg-gray-800 text-gray-400'
                            : svc.reachable
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}
                      >
                        {!svc.configured ? 'MISSING' : svc.reachable ? 'OPERATIONAL' : 'DOWN'}
                      </span>
                    </div>
                  </div>
                ))}
                {!loading && !status?.services?.length && (
                  <p className="text-sm text-gray-400 text-center py-8">No services registered in the fleet.</p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ActionCard
                title="Install GitHub App"
                body="Grant access to repos."
                href={`${BACKEND_URL}/auth/install`}
                external
                icon={<Rocket size={20} className="text-blue-400" />}
              />
              <ActionCard
                title="Repo Settings"
                body="Configure AI rules."
                href="/repositories"
                icon={<Workflow size={20} className="text-green-400" />}
              />
              <ActionCard
                title="View Reports"
                body="Security insights."
                href="/reports"
                icon={<Shield size={20} className="text-purple-400" />}
              />
            </div>
          </div>

          {/* Sidebar / Info Panel */}
          <div className="space-y-8">
            <div className="bg-[#0a0c10] border border-white/5 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Capability Matrix</h2>
              <div className="space-y-3">
                {(status?.capabilities || []).map((cap) => (
                  <div key={cap} className="flex items-center text-sm text-gray-400">
                    <CheckCircle size={16} className="text-green-400 mr-3 flex-shrink-0" />
                    <span>{cap}</span>
                  </div>
                ))}
                {!loading && !status?.capabilities?.length && (
                  <p className="text-sm text-gray-500 italic">No capabilities broadcasted.</p>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Deployment Info</p>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Backend</span>
                    <span className="text-gray-200">Render</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Compute</span>
                    <span className="text-gray-200">Local (Tunnel)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="text-gray-200">v1.2.0-ent</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Git Binary</span>
                    <span className="text-gray-200 truncate max-w-[220px] text-right">
                      {status?.runtime?.git?.path || (loading ? '...' : 'Not detected')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    <div className="bg-[#0a0c10] border border-white/5 rounded-2xl p-6 hover:border-blue-500/20 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-white mb-1 break-all">{value}</p>
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
  const alignClass = "flex flex-col h-full bg-[#0a0c10] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.02] hover:border-blue-500/30 transition-all cursor-pointer group";

  const content = (
    <>
      <div className="mb-4">
        <div className="inline-flex p-3 rounded-xl bg-white/5 group-hover:bg-blue-500/10 transition-colors">{icon}</div>
      </div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 flex-1">{body}</p>
      <span className="text-xs font-semibold text-blue-400 flex items-center group-hover:underline">
        {external ? 'Open External' : 'View Details'} <ExternalLink size={12} className="ml-1 opacity-50" />
      </span>
    </>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={alignClass}>{content}</a>;
  }
  return <Link href={href} className={alignClass}>{content}</Link>;
}
