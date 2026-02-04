'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Box,
  Search,
  CheckCircle,
  Bug,
  GitPullRequest,
  AlertTriangle,
  Rocket,
  Book,
  MessageCircle,
  TrendingUp,
  Activity
} from 'lucide-react';

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
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Total Repositories</span>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Box size={20} className="text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{loading ? '...' : stats.totalRepos}</p>
            <div className="flex items-center text-xs text-green-400">
              <Activity size={12} className="mr-1" />
              <span>Active monitoring</span>
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Active Reviews</span>
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Search size={20} className="text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{loading ? '...' : stats.activeReviews}</p>
            <div className="flex items-center text-xs text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5 animate-pulse"></span>
              <span>In progress</span>
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">PRs Merged (30d)</span>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle size={20} className="text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{loading ? '...' : stats.prsMerged}</p>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp size={12} className="mr-1" />
              <span>+20% from last month</span>
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Issues Found</span>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Bug size={20} className="text-yellow-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{loading ? '...' : stats.issuesFound}</p>
            <div className="flex items-center text-xs text-yellow-400">
              <AlertTriangle size={12} className="mr-1" />
              <span>Prevented deployment</span>
            </div>
          </div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-center py-8">Loading activity...</p>
            ) : (
              recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start space-x-4 pb-4 border-b border-gray-800 last:border-0 hover:bg-[#0d1117]/50 p-2 rounded transition-colors -mx-2 px-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.status === 'success' ? 'bg-green-500/10 text-green-400' :
                      activity.status === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-blue-500/10 text-blue-400'
                    }`}>
                    {activity.type === 'review' ? <Search size={18} /> :
                      activity.type === 'pr' ? <GitPullRequest size={18} /> :
                        activity.type === 'issue' ? <AlertTriangle size={18} /> :
                          <CheckCircle size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{activity.message}</p>
                    <p className="text-gray-400 text-xs mt-1">{activity.repo} • {activity.time}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${activity.status === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      activity.status === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                    {activity.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-lg p-6 hover:border-blue-500/40 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <Rocket size={24} className="text-blue-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Quick Start</h3>
            <p className="text-gray-400 text-sm mb-4">Set up TestPilot on your first repository</p>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors w-full font-medium">
              Get Started
            </button>
          </div>

          <div className="bg-gradient-to-br from-green-500/5 to-teal-500/5 border border-green-500/20 rounded-lg p-6 hover:border-green-500/40 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <Book size={24} className="text-green-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Documentation</h3>
            <p className="text-gray-400 text-sm mb-4">Learn how to maximize TestPilot features</p>
            <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm transition-colors w-full font-medium">
              View Docs
            </button>
          </div>

          <div className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border border-orange-500/20 rounded-lg p-6 hover:border-orange-500/40 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <MessageCircle size={24} className="text-orange-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Support</h3>
            <p className="text-gray-400 text-sm mb-4">Get help from our team</p>
            <button className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-md text-sm transition-colors w-full font-medium">
              Contact Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
