'use client';

import { useState } from 'react';
import Sidebar from '../components/Sidebar';

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState('7d');

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Reports & Analytics</h1>
            <p className="text-gray-400">Track your code quality metrics and team performance.</p>
          </div>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-[#161b22] border border-gray-700 text-white rounded-md focus:outline-none focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Code Reviews</span>
              <span className="text-2xl">🔍</span>
            </div>
            <p className="text-4xl font-bold text-white mb-1">47</p>
            <p className="text-xs text-green-400">+12% from last period</p>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Issues Detected</span>
              <span className="text-2xl">🐛</span>
            </div>
            <p className="text-4xl font-bold text-white mb-1">23</p>
            <p className="text-xs text-yellow-400">3 critical, 20 minor</p>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Time Saved</span>
              <span className="text-2xl">⏱️</span>
            </div>
            <p className="text-4xl font-bold text-white mb-1">18.5h</p>
            <p className="text-xs text-green-400">Developer hours</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Top Issues Found</h2>
            <div className="space-y-4">
              {[
                { type: 'Security Vulnerability', count: 8, severity: 'critical' },
                { type: 'Code Complexity', count: 12, severity: 'warning' },
                { type: 'Performance Issue', count: 5, severity: 'warning' },
                { type: 'Best Practice Violation', count: 15, severity: 'info' },
                { type: 'Code Duplication', count: 7, severity: 'info' },
              ].map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
                  <div className="flex items-center space-x-3">
                    <span className={`w-2 h-2 rounded-full ${
                      issue.severity === 'critical' ? 'bg-red-500' :
                      issue.severity === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></span>
                    <span className="text-white text-sm">{issue.type}</span>
                  </div>
                  <span className="text-gray-400 text-sm font-medium">{issue.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Repository Performance</h2>
            <div className="space-y-4">
              {[
                { repo: 'TestPilot-MVP', score: 92, reviews: 28 },
                { repo: 'frontend-app', score: 87, reviews: 15 },
                { repo: 'backend-api', score: 95, reviews: 19 },
                { repo: 'mobile-app', score: 78, reviews: 12 },
              ].map((repo, idx) => (
                <div key={idx} className="py-3 border-b border-gray-700 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{repo.repo}</span>
                    <span className="text-sm text-gray-400">{repo.reviews} reviews</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-[#0d1117] rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          repo.score >= 90 ? 'bg-green-500' :
                          repo.score >= 80 ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`}
                        style={{ width: `${repo.score}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-white font-medium w-12 text-right">{repo.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Review Timeline</h2>
          <div className="h-64 flex items-end justify-between space-x-2">
            {[45, 62, 38, 71, 55, 82, 67, 49, 73, 58, 85, 71, 64, 77].map((height, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t" style={{ height: `${height}%` }}></div>
                <span className="text-xs text-gray-500 mt-2">{idx + 1}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center space-x-6 mt-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-400">Reviews</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-400">Merged PRs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
