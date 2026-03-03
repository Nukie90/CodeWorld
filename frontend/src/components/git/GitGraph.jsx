import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { GitCommit, Calendar, User, FileText, X } from 'lucide-react';

function GitGraph({ repoUrl, branch, token, activeCommitHash, onCommitClick, externalCommits, isDarkMode, onCommitDoubleClick }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const COMMITS_PER_PAGE = 20;

  const fetchCommits = useCallback(async (skipCount = 0, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/commits', {
        repo_url: repoUrl,
        branch: branch,
        limit: COMMITS_PER_PAGE,
        skip: skipCount,
        token: token
      });
      const newCommits = resp.data.commits || [];

      if (append) {
        setCommits(prev => [...prev, ...newCommits]);
      } else {
        setCommits(newCommits);
      }

      // If we got fewer commits than requested, there are no more
      setHasMore(newCommits.length === COMMITS_PER_PAGE);
      setSkip(skipCount + newCommits.length);
    } catch (err) {
      console.error('Failed to fetch commits', err);
      setError('Failed to load commit history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [repoUrl, branch, token]);

  useEffect(() => {
    if (externalCommits && externalCommits.length > 0) {
      setCommits(externalCommits);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (repoUrl && branch) {
      setSkip(0);
      setHasMore(true);
      fetchCommits(0, false);
    } else {
      setCommits([]);
      setError(null);
      setSkip(0);
      setHasMore(true);
    }
  }, [repoUrl, branch, fetchCommits, externalCommits]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchCommits(skip, true);
    }
  };

  const handleCommitDoubleClick = (commit) => {
    setSelectedCommit(commit);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-UK', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
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
    //card
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3 p-2">
          {commits.map((commit) => (
            <div
              key={commit.hash}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group backdrop-blur-md ${activeCommitHash === commit.hash
                ? isDarkMode
                  ? 'bg-blue-600/30 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)] ring-1 ring-blue-400'
                  : 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)] ring-1 ring-blue-500'
                : isDarkMode
                  ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                  : 'bg-black/5 border-black/5 hover:bg-black/10 hover:border-black/10'
                }`}
              onClick={() => onCommitClick && onCommitClick(commit)}
              onDoubleClick={() => onCommitDoubleClick && onCommitDoubleClick(commit)}
            >
              {/* Commit info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`text-sm font-medium truncate group-hover:text-blue-600 transition-colors ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {commit.message || 'No message'}
                  </p>
                  <span className={`gap-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {/* {getShortHash(commit.hash)} */}
                    <span>{formatDate(commit.date)}</span>
                  </span>
                </div>

                <div className={`flex items-center gap-1 text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <User size={12} />
                  <span className="truncate">{commit.author || 'Unknown'}</span>
                </div>
                {/* <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
                  <Calendar size={12} />
                  <span>{formatDate(commit.date)}</span>
                </div> */}
                <div className="flex items-center gap-4 text-xs text-gray-500 truncate">
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Load More Button */}
      {
        hasMore && commits.length > 0 && (
          <div className={`p-3 border-t backdrop-blur-md ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )
      }
    </div >
  );
}

export default GitGraph;
