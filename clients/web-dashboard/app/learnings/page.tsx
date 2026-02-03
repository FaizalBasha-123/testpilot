'use client';

import Sidebar from '../components/Sidebar';

export default function LearningsPage() {
  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Learnings & Insights</h1>
          <p className="text-gray-400">Discover patterns and improve code quality based on AI-powered analysis.</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6 mb-8">
          <div className="flex items-start space-x-4">
            <div className="text-4xl">🎓</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2">Your Team's Progress</h3>
              <p className="text-gray-300 mb-4">Based on 47 code reviews this week, here are the key insights TestPilot has discovered.</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0d1117]/50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-white mb-1">85%</p>
                  <p className="text-sm text-gray-400">Code Quality Score</p>
                </div>
                <div className="bg-[#0d1117]/50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-white mb-1">23</p>
                  <p className="text-sm text-gray-400">Issues Prevented</p>
                </div>
                <div className="bg-[#0d1117]/50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-white mb-1">+12%</p>
                  <p className="text-sm text-gray-400">Improvement</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">🔥</span> Common Patterns
            </h2>
            <div className="space-y-4">
              {[
                { 
                  pattern: 'Unhandled Promise Rejections',
                  occurrences: 12,
                  trend: 'down',
                  description: 'Always add .catch() or try-catch blocks'
                },
                {
                  pattern: 'Missing Input Validation',
                  occurrences: 8,
                  trend: 'up',
                  description: 'Validate user inputs before processing'
                },
                {
                  pattern: 'Inefficient Database Queries',
                  occurrences: 5,
                  trend: 'down',
                  description: 'Use indexes and optimize JOIN operations'
                },
              ].map((item, idx) => (
                <div key={idx} className="bg-[#0d1117] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{item.pattern}</h4>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm">{item.occurrences}</span>
                      <span className={item.trend === 'down' ? 'text-green-400' : 'text-red-400'}>
                        {item.trend === 'down' ? '↓' : '↑'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">💡</span> Recommended Best Practices
            </h2>
            <div className="space-y-4">
              {[
                {
                  title: 'Error Handling',
                  impact: 'high',
                  description: 'Implement comprehensive error boundaries and logging'
                },
                {
                  title: 'Code Documentation',
                  impact: 'medium',
                  description: 'Add JSDoc comments to exported functions'
                },
                {
                  title: 'Type Safety',
                  impact: 'high',
                  description: 'Use TypeScript strict mode for better type checking'
                },
                {
                  title: 'Test Coverage',
                  impact: 'medium',
                  description: 'Aim for >80% test coverage on critical paths'
                },
              ].map((practice, idx) => (
                <div key={idx} className="bg-[#0d1117] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{practice.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs ${
                      practice.impact === 'high' 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      {practice.impact} impact
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{practice.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="text-3xl mb-3">📚</div>
            <h3 className="text-lg font-semibold text-white mb-2">Learning Resources</h3>
            <p className="text-sm text-gray-400 mb-4">Curated articles and tutorials based on your code patterns</p>
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors w-full">
              View Resources
            </button>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="text-3xl mb-3">🏆</div>
            <h3 className="text-lg font-semibold text-white mb-2">Team Achievements</h3>
            <p className="text-sm text-gray-400 mb-4">Celebrate milestones and track progress</p>
            <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm transition-colors w-full">
              View Achievements
            </button>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-white mb-2">Code Quality Trends</h3>
            <p className="text-sm text-gray-400 mb-4">Visualize your improvement over time</p>
            <button className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md text-sm transition-colors w-full">
              View Trends
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
