'use client';

import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Settings, Shield, Zap, BookOpen, AlertOctagon, FileText } from 'lucide-react';

export default function SettingsPage() {
  const [autoReview, setAutoReview] = useState(true);
  const [reviewLevel, setReviewLevel] = useState('balanced');
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />

      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Configuration</h1>
          <p className="text-gray-400">Customize TestPilot behavior and review preferences.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Settings size={20} className="mr-2" />
              Review Settings
            </h2>

            <div className="space-y-6">
              <div className="flex items-center justify-between pb-6 border-b border-gray-700">
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-1">Automatic Code Reviews</h3>
                  <p className="text-sm text-gray-400">Automatically review pull requests when opened or updated</p>
                </div>
                <button
                  onClick={() => setAutoReview(!autoReview)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${autoReview ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoReview ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                </button>
              </div>

              <div className="pb-6 border-b border-gray-700">
                <h3 className="text-white font-medium mb-3">Review Thoroughness</h3>
                <p className="text-sm text-gray-400 mb-4">Choose how detailed the code reviews should be</p>
                <div className="space-y-2">
                  {[
                    { value: 'quick', label: 'Quick', desc: 'Fast reviews focusing on critical issues', icon: Zap },
                    { value: 'balanced', label: 'Balanced', desc: 'Standard reviews with good coverage', icon: Shield },
                    { value: 'thorough', label: 'Thorough', desc: 'Deep analysis of all code changes', icon: BookOpen },
                  ].map((option) => {
                    const Icon = option.icon;
                    return (
                      <label key={option.value} className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${reviewLevel === option.value ? 'bg-blue-500/10 border-blue-500/30' : 'bg-[#0d1117] border-transparent hover:bg-[#161b22]'
                        }`}>
                        <input
                          type="radio"
                          name="reviewLevel"
                          value={option.value}
                          checked={reviewLevel === option.value}
                          onChange={(e) => setReviewLevel(e.target.value)}
                          className="mr-3"
                        />
                        <div className="p-2 bg-[#161b22] rounded mr-3">
                          <Icon size={18} className="text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className={`font-medium ${reviewLevel === option.value ? 'text-blue-400' : 'text-white'}`}>{option.label}</div>
                          <div className="text-sm text-gray-400">{option.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-1">Email Notifications</h3>
                  <p className="text-sm text-gray-400">Receive email updates for review completions</p>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${notifications ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Shield size={20} className="mr-2" />
              Code Quality Rules
            </h2>
            <div className="space-y-4">
              {[
                { name: 'Security Scanning', enabled: true, desc: 'Detect security vulnerabilities' },
                { name: 'Performance Analysis', enabled: true, desc: 'Identify performance bottlenecks' },
                { name: 'Best Practices', enabled: true, desc: 'Enforce coding standards' },
                { name: 'Code Complexity', enabled: false, desc: 'Flag overly complex functions' },
                { name: 'Test Coverage', enabled: false, desc: 'Require tests for new code' },
              ].map((rule, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-[#0d1117] rounded-lg">
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">{rule.name}</h4>
                    <p className="text-sm text-gray-400">{rule.desc}</p>
                  </div>
                  <div className={`px-3 py-1 rounded text-sm ${rule.enabled
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <AlertOctagon size={20} className="mr-2" />
              Advanced Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Review Comment Style</label>
                <select className="w-full px-4 py-2 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500">
                  <option>Conversational</option>
                  <option>Technical</option>
                  <option>Concise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Languages to Review</label>
                <div className="flex flex-wrap gap-2">
                  {['JavaScript', 'TypeScript', 'Python', 'Go', 'Java', 'C++'].map((lang) => (
                    <button key={lang} className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-sm hover:bg-blue-500/20 transition-colors">
                      {lang} ✓
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ignored File Patterns</label>
                <textarea
                  className="w-full px-4 py-2 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  rows={3}
                  placeholder="*.test.js&#10;*.spec.ts&#10;dist/**"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button className="px-6 py-2 bg-[#0d1117] border border-gray-700 text-white rounded-md hover:bg-[#161b22] transition-colors">
              Reset to Defaults
            </button>
            <button className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
