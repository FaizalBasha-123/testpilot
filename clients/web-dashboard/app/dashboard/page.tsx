'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';

interface Stats {
  totalRepos: number;
  activeReviews: number;
  prsMerged: number;
  issuesFound: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalRepos: 0,
    activeReviews: 0,
    prsMerged: 0,
    issuesFound: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setStats({
        totalRepos: 3,
        activeReviews: 5,
        prsMerged: 12,
        issuesFound: 23,
      });
      setRecentActivity([
        { type: 'review', repo: 'TestPilot-MVP', message: 'AI review completed on PR #42', time: '2 hours ago', status: 'success' },
        { type: 'pr', repo: 'TestPilot-MVP', message: 'Auto-generated optimization PR created', time: '5 hours ago', status: 'pending' },
        { type: 'issue', repo: 'frontend-app', message: 'Security vulnerability detected', time: '1 day ago', status: 'warning' },
        { type: 'merge', repo: 'backend-api', message: 'PR #38 merged successfully', time: '2 days ago', status: 'success' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Welcome back! Here's what's happening with your repositories.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Repositories</span>
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-3xl font-bold text-white">{loading ? '...' : stats.totalRepos}</p>
            <p className="text-xs text-green-400 mt-1">↗ Active monitoring</p>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Active Reviews</span>
              <span className="text-2xl">🔍</span>
            </div>
            <p className="text-3xl font-bold text-white">{loading ? '...' : stats.activeReviews}</p>
            <p className="text-xs text-blue-400 mt-1">In progress</p>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">PRs Merged (30d)</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-white">{loading ? '...' : stats.prsMerged}</p>
            <p className="text-xs text-green-400 mt-1">+20% from last month</p>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Issues Found</span>
              <span className="text-2xl">🐛</span>
            </div>
            <p className="text-3xl font-bold text-white">{loading ? '...' : stats.issuesFound}</p>
            <p className="text-xs text-yellow-400 mt-1">Prevented deployment</p>
          </div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-center py-8">Loading activity...</p>
            ) : (
              recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start space-x-4 pb-4 border-b border-gray-800 last:border-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    activity.status === 'success' ? 'bg-green-500/10 text-green-400' :
                    activity.status === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {activity.type === 'review' ? '🔍' : activity.type === 'pr' ? '🔀' : activity.type === 'issue' ? '⚠️' : '✅'}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{activity.message}</p>
                    <p className="text-gray-400 text-xs mt-1">{activity.repo} • {activity.time}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    activity.status === 'success' ? 'bg-green-500/10 text-green-400' :
                    activity.status === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">🚀 Quick Start</h3>
            <p className="text-gray-400 text-sm mb-4">Set up TestPilot on your first repository</p>
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors">
              Get Started
            </button>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border border-green-500/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">📚 Documentation</h3>
            <p className="text-gray-400 text-sm mb-4">Learn how to maximize TestPilot features</p>
            <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm transition-colors">
              View Docs
            </button>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">💬 Support</h3>
            <p className="text-gray-400 text-sm mb-4">Get help from our team</p>
            <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm transition-colors">
              Contact Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
