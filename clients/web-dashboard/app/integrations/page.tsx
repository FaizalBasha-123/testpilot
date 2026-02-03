'use client';

import Sidebar from '../components/Sidebar';

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
          <p className="text-gray-400">Connect TestPilot with your favorite development tools.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-[#24292f] rounded-lg flex items-center justify-center text-2xl">
                🐙
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">GitHub</h3>
                <p className="text-sm text-gray-400">Connected</p>
              </div>
              <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-sm">
                Active
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              TestPilot is connected to your GitHub account and monitoring your repositories.
            </p>
            <button className="px-4 py-2 bg-[#0d1117] border border-gray-700 text-white rounded-md text-sm hover:bg-[#161b22] transition-colors w-full">
              Manage Settings
            </button>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-[#24292f] rounded-lg flex items-center justify-center text-2xl">
                💬
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Slack</h3>
                <p className="text-sm text-gray-400">Not connected</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Get notified in Slack when TestPilot reviews your pull requests.
            </p>
            <button className="px-4 py-2 bg-[#1f6feb] hover:bg-[#1a5cd7] text-white rounded-md text-sm transition-colors w-full">
              Connect Slack
            </button>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-[#24292f] rounded-lg flex items-center justify-center text-2xl">
                📧
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Email Notifications</h3>
                <p className="text-sm text-gray-400">Configured</p>
              </div>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-sm">
                Enabled
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Receive email updates for important events and weekly summaries.
            </p>
            <button className="px-4 py-2 bg-[#0d1117] border border-gray-700 text-white rounded-md text-sm hover:bg-[#161b22] transition-colors w-full">
              Configure Preferences
            </button>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-[#24292f] rounded-lg flex items-center justify-center text-2xl">
                🔔
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Discord</h3>
                <p className="text-sm text-gray-400">Not connected</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Get TestPilot notifications in your Discord server.
            </p>
            <button className="px-4 py-2 bg-[#1f6feb] hover:bg-[#1a5cd7] text-white rounded-md text-sm transition-colors w-full">
              Connect Discord
            </button>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-[#24292f] rounded-lg flex items-center justify-center text-2xl">
                🔗
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Webhooks</h3>
                <p className="text-sm text-gray-400">Custom endpoints</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Send TestPilot events to your custom webhook endpoints.
            </p>
            <button className="px-4 py-2 bg-[#1f6feb] hover:bg-[#1a5cd7] text-white rounded-md text-sm transition-colors w-full">
              Add Webhook
            </button>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-[#24292f] rounded-lg flex items-center justify-center text-2xl">
                🔧
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">API Access</h3>
                <p className="text-sm text-gray-400">Generate tokens</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Create API tokens for programmatic access to TestPilot.
            </p>
            <button className="px-4 py-2 bg-[#1f6feb] hover:bg-[#1a5cd7] text-white rounded-md text-sm transition-colors w-full">
              Manage API Keys
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
