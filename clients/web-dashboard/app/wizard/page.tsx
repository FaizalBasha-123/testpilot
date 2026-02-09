'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function WizardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [hearAbout, setHearAbout] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Store wizard data (you can send to backend if needed)
    localStorage.setItem('wizard_completed', 'true');
    localStorage.setItem('user_email', email);
    localStorage.setItem('user_workplace', workplace);
    localStorage.setItem('user_referral', hearAbout);

    // Redirect to dashboard
    setTimeout(() => {
      router.push('/dashboard');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-white mb-2">Getting started with TestPilot</h1>
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-gray-300 text-sm"
          >
            ↻ Skip onboarding
          </button>
        </div>

        {/* Main Form Card */}
        <div className="bg-[#161b22] rounded-lg shadow-xl border border-gray-800 p-8 max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-white">Complete your signup</h2>
            <button className="text-gray-400 hover:text-gray-300 px-4 py-2 border border-gray-700 rounded-md text-sm">
              📄 View Documentation
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Primary Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Primary Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="your.email@company.com"
              />
              <p className="mt-2 text-sm text-gray-400">
                Please <span className="font-medium">confirm</span> the email address we should use for subscription-related communication. We <span className="font-medium">recommend</span> using a work email.
              </p>
            </div>

            {/* Where do you work */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Where do you work? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Company name"
              />
              <p className="mt-2 text-sm text-gray-400">
                Share where you work (if applicable) to help us understand your background.
              </p>
            </div>

            {/* How did you hear about us */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                How did you hear about us? <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={hearAbout}
                onChange={(e) => setHearAbout(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select --</option>
                <option value="search">Search Engine</option>
                <option value="social">Social Media</option>
                <option value="referral">Friend/Colleague Referral</option>
                <option value="blog">Blog/Article</option>
                <option value="github">GitHub Marketplace</option>
                <option value="youtube">YouTube</option>
                <option value="podcast">Podcast</option>
                <option value="conference">Conference/Event</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !workplace || !hearAbout}
              className="w-full py-3 bg-[#ff6b35] hover:bg-[#ff5722] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </form>

          {/* Progress Indicator */}
          <div className="mt-6 text-right">
            <span className="text-gray-400 text-sm">1 / 3 done</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WizardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <WizardForm />
    </Suspense>
  );
}
