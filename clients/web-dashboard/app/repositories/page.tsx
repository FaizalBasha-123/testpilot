'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Box, ExternalLink, Lock, Globe, CheckCircle } from 'lucide-react';

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';

type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  url: string;
};

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [installUrl, setInstallUrl] = useState<string>(`${backend}/auth/install`);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('tp_token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${backend}/api/repos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setRepos(data.repos || []);
        setInstallUrl(`${backend}/auth/install`);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />

      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Repositories</h1>
          <p className="text-gray-400">Manage your GitHub repositories and configure TestPilot settings.</p>
        </div>

        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">GitHub App Installation</h3>
              <p className="text-sm text-gray-400">Install TestPilot on your repositories to enable automatic code reviews and PR optimization.</p>
            </div>
            <a
              href={installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#1f6feb] hover:bg-[#1a5cd7] text-white rounded-md font-medium transition-colors flex items-center"
            >
              Install GitHub App
              <ExternalLink size={16} className="ml-2" />
            </a>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-gray-400 mt-4">Loading repositories...</p>
          </div>
        ) : repos.length === 0 ? (
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-12 text-center">
            <div className="flex justify-center mb-4">
              <Box size={64} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No repositories found</h3>
            <p className="text-gray-400 mb-6">Install the TestPilot GitHub App to get started</p>
            <a
              href={installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-[#1f6feb] hover:bg-[#1a5cd7] text-white rounded-md font-medium transition-colors"
            >
              Install on GitHub
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repos.map((repo) => (
              <div key={repo.id} className="bg-[#161b22] border border-gray-800 rounded-lg p-6 hover:border-blue-500/50 transition-colors group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">{repo.name}</h3>
                    <p className="text-gray-400 text-sm truncate">{repo.full_name}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded flex items-center ${repo.private
                      ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      : 'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}>
                    {repo.private ? <Lock size={12} className="mr-1" /> : <Globe size={12} className="mr-1" />}
                    {repo.private ? 'Private' : 'Public'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                  <span className="text-xs text-gray-500">TestPilot Active</span>
                  <div className="flex items-center text-green-400 text-sm">
                    <CheckCircle size={14} className="mr-1" />
                    Enabled
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
