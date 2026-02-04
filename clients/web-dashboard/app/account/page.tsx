'use client';

import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useRouter } from 'next/navigation';
import { User, CreditCard, Bell, ShieldAlert } from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState('faisalbasha@gmail.com');
  const [workplace, setWorkplace] = useState('');

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />

      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
          <p className="text-gray-400">Manage your personal information and account preferences.</p>
        </div>

        <div className="space-y-6 max-w-3xl">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <User size={20} className="mr-2" />
              Profile Information
            </h2>

            <div className="space-y-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-semibold">
                  F
                </div>
                <div>
                  <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors mr-2">
                    Change Avatar
                  </button>
                  <button className="px-4 py-2 bg-[#0d1117] border border-gray-700 text-white rounded-md text-sm hover:bg-[#161b22] transition-colors">
                    Remove
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <input
                  type="text"
                  defaultValue="Faisal Basha"
                  className="w-full px-4 py-2 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Workplace</label>
                <input
                  type="text"
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                  placeholder="Company name"
                  className="w-full px-4 py-2 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">GitHub Username</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    defaultValue="FaizalBasha-123"
                    disabled
                    className="flex-1 px-4 py-2 bg-[#0d1117] border border-gray-700 rounded-md text-gray-500 cursor-not-allowed"
                  />
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-sm">
                    Connected
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <CreditCard size={20} className="mr-2" />
              Subscription
            </h2>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg mb-4">
              <div>
                <h3 className="text-white font-semibold mb-1">Pro Plan</h3>
                <p className="text-sm text-gray-400">Unlimited repositories and advanced features</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">$29</p>
                <p className="text-xs text-gray-400">per month</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button className="flex-1 px-4 py-2 bg-[#0d1117] border border-gray-700 text-white rounded-md hover:bg-[#161b22] transition-colors">
                Change Plan
              </button>
              <button className="flex-1 px-4 py-2 bg-[#0d1117] border border-gray-700 text-white rounded-md hover:bg-[#161b22] transition-colors">
                Billing History
              </button>
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Bell size={20} className="mr-2" />
              Notification Preferences
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Review Completed', desc: 'When TestPilot finishes reviewing a PR', checked: true },
                { label: 'Critical Issues Found', desc: 'When security vulnerabilities are detected', checked: true },
                { label: 'Weekly Summary', desc: 'Summary of activity and metrics', checked: false },
                { label: 'Product Updates', desc: 'New features and announcements', checked: true },
              ].map((pref, idx) => (
                <label key={idx} className="flex items-start space-x-3 p-3 bg-[#0d1117] rounded-lg cursor-pointer hover:bg-[#161b22] transition-colors">
                  <input type="checkbox" defaultChecked={pref.checked} className="mt-1" />
                  <div className="flex-1">
                    <div className="text-white font-medium">{pref.label}</div>
                    <div className="text-sm text-gray-400">{pref.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#161b22] border border-red-500/20 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center">
              <ShieldAlert size={20} className="mr-2" />
              Danger Zone
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#0d1117] rounded-lg">
                <div>
                  <h4 className="text-white font-medium mb-1">Sign Out</h4>
                  <p className="text-sm text-gray-400">Sign out from your current session</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-md hover:bg-yellow-500/20 transition-colors"
                >
                  Sign Out
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0d1117] rounded-lg">
                <div>
                  <h4 className="text-white font-medium mb-1">Delete Account</h4>
                  <p className="text-sm text-gray-400">Permanently delete your account and all data</p>
                </div>
                <button className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md hover:bg-red-500/20 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button className="px-6 py-2 bg-[#0d1117] border border-gray-700 text-white rounded-md hover:bg-[#161b22] transition-colors">
              Cancel
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
