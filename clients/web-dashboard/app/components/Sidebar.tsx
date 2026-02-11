'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Box,
  Zap,
  BarChart,
  GraduationCap,
  Settings,
  User,
  LogOut
} from 'lucide-react';
import { BACKEND_URL, fetchWithToken, MeResponse } from '../../lib/api';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Repositories', path: '/repositories', icon: Box },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Integrations', path: '/integrations', icon: Zap },
  { name: 'Reports', path: '/reports', icon: BarChart },
  { name: 'Learnings', path: '/learnings', icon: GraduationCap },
  { name: 'Configuration', path: '/settings', icon: Settings },
  { name: 'Account Settings', path: '/account', icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState('Workspace User');

  useEffect(() => {
    const token = localStorage.getItem('tp_token');
    if (!token) {
      return;
    }
    fetchWithToken<MeResponse>('/api/me', token)
      .then((me) => {
        if (me.login) {
          setUsername(me.login);
        }
      })
      .catch(() => {
        // Keep fallback name; user can still navigate.
      });
  }, []);

  return (
    <div className="w-64 bg-[#0d1117] border-r border-gray-800 min-h-screen flex flex-col">
      {/* User Profile Section */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{username}</p>
            <p className="text-xs text-gray-400">PRO</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive
                  ? 'bg-[#1f6feb] text-white'
                  : 'text-gray-300 hover:bg-[#161b22] hover:text-white'
                }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-800">
        <div className="bg-[#161b22] rounded-lg p-3 mb-3">
          <p className="text-xs text-gray-400 mb-1">Get started with</p>
          <p className="text-sm font-semibold text-white mb-2">TestPilot</p>
          <p className="text-xs text-gray-500 mb-3">Up Next: connect repositories and run your first review</p>
          <a
            href={`${BACKEND_URL}/auth/install`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs text-blue-400 hover:text-blue-300"
          >
            Install GitHub App
          </a>
        </div>
        <button
          onClick={() => {
            localStorage.clear();
            router.push('/login');
          }}
          className="w-full flex items-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#161b22] rounded-md transition-colors text-left"
        >
          <LogOut size={16} className="mr-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
