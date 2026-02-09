'use client';

import Sidebar from '../components/Sidebar';
import { BookOpen, Github, Terminal, Puzzle } from 'lucide-react';

export default function LearningsPage() {
  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Documentation</h1>
            <p className="text-gray-400">Get started with TestPilot and integrate it into your workflow.</p>
          </div>

          <div className="space-y-8">
            {/* Installation Section */}
            <section className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
                <Github className="text-white" size={24} />
                <h2 className="text-xl font-semibold text-white">Installing the GitHub App</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-300">
                  To start using TestPilot, you need to install our GitHub App on your repositories.
                  This allows TestPilot to monitor pull requests and provide automated feedback.
                </p>
                <ol className="list-decimal list-inside space-y-2 text-gray-400 ml-2">
                  <li>Navigate to the <span className="text-blue-400">Repositories</span> tab in the dashboard.</li>
                  <li>Click on <span className="text-white font-medium">"Install GitHub App"</span>.</li>
                  <li>Select the organization or personal account where you want to install TestPilot.</li>
                  <li>Choose to install on <span className="font-medium">All repositories</span> or <span className="font-medium">Selected repositories</span>.</li>
                  <li>Click <span className="font-medium">Install</span> to confirm.</li>
                </ol>
                <div className="mt-4 p-4 bg-[#0d1117] rounded border border-gray-700">
                  <p className="text-xs text-gray-500 uppercase mb-2">Note</p>
                  <p className="text-sm text-gray-300">
                    TestPilot requires <strong>Read</strong> access to code and <strong>Read & Write</strong> access to pull requests to function correctly.
                  </p>
                </div>
              </div>
            </section>

            {/* Usage in PRs */}
            <section className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
                <BookOpen className="text-white" size={24} />
                <h2 className="text-xl font-semibold text-white">Using TestPilot in Pull Requests</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-300">
                  Once installed, TestPilot automatically runs on every new Pull Request and subsequent commits.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mr-4 mt-1">1</div>
                    <div>
                      <h4 className="text-white font-medium">Create a Pull Request</h4>
                      <p className="text-sm text-gray-400 mt-1">Open a new PR in any enabled repository.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mr-4 mt-1">2</div>
                    <div>
                      <h4 className="text-white font-medium">Wait for Analysis</h4>
                      <p className="text-sm text-gray-400 mt-1">TestPilot will comment "👀 Reviewing..." and start analyzing your changes.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mr-4 mt-1">3</div>
                    <div>
                      <h4 className="text-white font-medium">Review Feedback</h4>
                      <p className="text-sm text-gray-400 mt-1">Within seconds, you'll receive a detailed review summary and inline comments on specific lines of code.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mr-4 mt-1">4</div>
                    <div>
                      <h4 className="text-white font-medium">Interact with the Bot</h4>
                      <p className="text-sm text-gray-400 mt-1">Reply to any comment with <code className="bg-gray-800 px-1 py-0.5 rounded">/fix</code> to have TestPilot generate a code fix for you.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* VS Code Extension */}
            <section className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
                <Terminal className="text-white" size={24} />
                <h2 className="text-xl font-semibold text-white">VS Code Extension Setup</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-300">
                  Get TestPilot feedback directly in your editor before you even push your code.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#0d1117] p-4 rounded border border-gray-700">
                    <h4 className="text-white font-medium mb-2">1. Install Extension</h4>
                    <p className="text-sm text-gray-400">Search for <strong>"TestPilot AI"</strong> in the VS Code Marketplace and click Install.</p>
                  </div>
                  <div className="bg-[#0d1117] p-4 rounded border border-gray-700">
                    <h4 className="text-white font-medium mb-2">2. Authenticate</h4>
                    <p className="text-sm text-gray-400">Run <code className="bg-gray-800 px-1 py-0.5 rounded">TestPilot: Sign In</code> in the Command Palette (Ctrl+Shift+P) to link your account.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-white font-medium mb-2">Key Features</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 text-sm ml-2">
                    <li>Real-time code analysis as you type</li>
                    <li>One-click fix suggestions</li>
                    <li>Chat with TestPilot about your codebase</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Enterprise Features */}
            <section className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
                <Puzzle className="text-white" size={24} />
                <h2 className="text-xl font-semibold text-white">Enterprise Configuration</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-300">
                  For large teams, TestPilot offers advanced configuration options via a <code className="bg-gray-800 px-1 py-0.5 rounded">.testpilot.yaml</code> file in the root of your repository.
                </p>
                <pre className="bg-[#0d1117] p-4 rounded border border-gray-700 overflow-x-auto text-sm text-gray-300 font-mono">
                  {`version: 1.0
rules:
  - id: security-check
    level: error
  - id: code-style
    level: warning
ignore:
  - "**/*.test.ts"
  - "dist/**"`}
                </pre>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
