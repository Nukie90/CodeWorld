import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { GitCommit, Calendar, User } from 'lucide-react';

function GitGraph({ repoUrl, branch, token }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCommit, setSelectedCommit] = useState(null);

  const fetchCommits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/commits', {
        repo_url: repoUrl,
        branch: branch,
        limit: 5,
        token: token
      });
      setCommits(resp.data.commits || []);
    } catch (err) {
      console.error('Failed to fetch commits', err);
      setError('Failed to load commit history');
    } finally {
      setLoading(false);
    }
  }, [repoUrl, branch, token]);

  useEffect(() => {
    if (repoUrl && branch) {
      fetchCommits();
    } else {
      setCommits([]);
      setError(null);
    }
  }, [repoUrl, branch, fetchCommits]);

  const handleCommitDoubleClick = (commit) => {
    setSelectedCommit(commit);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getShortHash = (hash) => {
    return hash ? hash.substring(0, 7) : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <p className="text-gray-400 text-sm">Loading commit history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <p className="text-gray-400 text-sm">No commits found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-3 p-2">
        {commits.map((commit) => (
          <div
            key={commit.hash}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-colors cursor-pointer group"
            onDoubleClick={() => handleCommitDoubleClick(commit)}
          >
            {/* Commit info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {commit.message || 'No message'}
                </p>
                <span className="text-xs font-mono text-gray-500 flex-shrink-0 truncate">
                  {getShortHash(commit.hash)}
                </span>
              </div>
              
                <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
                  <User size={12} />
                  <span className="truncate">{commit.author || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
                  <Calendar size={12} />
                  <span>{formatDate(commit.date)}</span>
                </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 truncate">
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Commit detail modal */}
      {selectedCommit && (
        <CommitDetailModal
          commit={selectedCommit}
          repoUrl={repoUrl}
          token={token}
          onClose={() => setSelectedCommit(null)}
        />
      )}
    </div>
  );
}

function CommitDetailModal({ commit, repoUrl, token, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCommitDetails();
  }, [commit.hash]);

  const fetchCommitDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/commit-details', {
        repo_url: repoUrl,
        commit_hash: commit.hash,
        token: token
      });
      setDetails(resp.data);
    } catch (err) {
      console.error('Failed to fetch commit details', err);
      setError('Failed to load commit details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderDiff = (diff) => {
    if (!diff) return null;
    
    const lines = diff.split('\n');
    return lines.map((line, idx) => {
      let className = 'text-gray-800';
      if (line.startsWith('+')) {
        className = 'text-green-600 bg-green-50';
      } else if (line.startsWith('-')) {
        className = 'text-red-600 bg-red-50';
      } else if (line.startsWith('@@')) {
        className = 'text-blue-600 bg-blue-50 font-semibold';
      } else if (line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
        className = 'text-gray-600 bg-gray-50';
      }
      
      return (
        <div key={idx} className={`px-2 py-0.5 font-mono text-xs ${className}`}>
          {line || ' '}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GitCommit size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Commit Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-400 text-sm">Loading commit details...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : details ? (
            <div className="space-y-4">
              {/* Commit Info */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Commit Hash</label>
                  <p className="text-sm font-mono text-gray-900">{details.hash}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Message</label>
                  <p className="text-sm text-gray-900">{details.message}</p>
                  {details.body && (
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{details.body}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Author</label>
                    <p className="text-sm text-gray-900">{details.author}</p>
                    {details.email && (
                      <p className="text-xs text-gray-500">{details.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
                    <p className="text-sm text-gray-900">{formatDate(details.date)}</p>
                  </div>
                </div>
              </div>

              {/* Files Changed */}
              {details.files_changed && details.files_changed.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Files Changed</label>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {details.files_changed.map((file, idx) => (
                      <div key={idx} className="text-sm font-mono text-gray-700">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diff */}
              {details.diff && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Changes</label>
                  <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                    <div className="overflow-auto max-h-96">
                      {renderDiff(details.diff)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default GitGraph;

