import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { GitCommit, Calendar, User } from 'lucide-react';

function GitGraph({ repoUrl, branch, token, activeCommitHash, onCommitClick, externalCommits }) {
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
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3 p-2">
          {commits.map((commit) => (
            <div
              key={commit.hash}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer group ${activeCommitHash === commit.hash
                ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                : 'border-gray-200 hover:bg-gray-50 hover:border-blue-300'
                }`}
              onClick={() => onCommitClick && onCommitClick(commit)}
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
      </div>

      {/* Load More Button */}
      {
        hasMore && commits.length > 0 && (
          <div className="p-3 border-t border-gray-200">
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

      {/* Commit detail modal */}
      {
        selectedCommit && (
          <CommitDetailModal
            commit={selectedCommit}
            repoUrl={repoUrl}
            token={token}
            onClose={() => setSelectedCommit(null)}
          />
        )
      }
    </div >
  );
}

function CommitDetailModal({ commit, repoUrl, token, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedFiles, setParsedFiles] = useState([]);
  const [fileDiffs, setFileDiffs] = useState({});

  useEffect(() => {
    fetchCommitDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit.hash]);

  const fetchCommitDetails = async () => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/commit-details', {
        repo_url: repoUrl,
        commit_hash: commit.hash,
        token: token
      });
      setDetails(resp.data);

      // Set files changed
      if (resp.data.files_changed) {
        setParsedFiles(resp.data.files_changed);
      }

      // Parse diff into per-file diffs
      if (resp.data.diff) {
        const diffs = parseDiffByFile(resp.data.diff);
        setFileDiffs(diffs);
      }
    } catch (err) {
      console.error('Failed to fetch commit details', err);
      setError('Failed to load commit details');
    } finally {
      setLoading(false);
    }
  };



  const parseDiffByFile = (diff) => {
    const fileDiffs = {};
    const lines = diff.split('\n');
    let currentFile = null;
    let currentDiff = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for file header
      if (line.startsWith('diff --git')) {
        // Save previous file diff
        if (currentFile && currentDiff.length > 0) {
          fileDiffs[currentFile] = currentDiff.join('\n');
        }

        // Extract filename from "diff --git a/path b/path"
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (match) {
          currentFile = match[2]; // Use the 'b' path (new file)
          currentDiff = [line];
        }
      } else if (currentFile) {
        currentDiff.push(line);
      }
    }

    // Save last file diff
    if (currentFile && currentDiff.length > 0) {
      fileDiffs[currentFile] = currentDiff.join('\n');
    }

    return fileDiffs;
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
    let oldLineNum = 0;
    let newLineNum = 0;

    return lines.map((line, idx) => {
      let className = 'text-gray-300';
      let bgColor = 'bg-gray-900';
      let lineNum = null;

      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          const oldStart = parseInt(match[1]);
          const newStart = parseInt(match[3]);
          oldLineNum = oldStart - 1;
          newLineNum = newStart - 1;
        }
        className = 'text-blue-400 bg-blue-900/30 font-semibold';
        bgColor = 'bg-gray-900';
      } else if (line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
        className = 'text-gray-400 bg-gray-800/50';
        bgColor = 'bg-gray-900';
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        newLineNum++;
        lineNum = newLineNum;
        className = 'text-green-400';
        bgColor = 'bg-green-900/20';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        oldLineNum++;
        lineNum = oldLineNum;
        className = 'text-red-400';
        bgColor = 'bg-red-900/20';
      } else if (line.startsWith('\\')) {
        className = 'text-gray-500';
        bgColor = 'bg-gray-900';
      } else {
        // Context line
        oldLineNum++;
        newLineNum++;
        lineNum = newLineNum;
        className = 'text-gray-300';
        bgColor = 'bg-gray-900';
      }

      const lineContent = line.startsWith('+') || line.startsWith('-')
        ? line.substring(1)
        : line.startsWith('@@') || line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++') || line.startsWith('\\')
          ? line
          : line;

      return (
        <div key={idx} className={`flex ${bgColor} hover:bg-opacity-50 transition-colors`}>
          <div className="flex-shrink-0 w-16 text-right pr-4 text-gray-500 text-xs select-none border-r border-gray-700">
            {lineNum !== null && !line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('@@') && !line.startsWith('\\') ? lineNum : ''}
          </div>
          <div className="flex-shrink-0 w-8 text-center text-gray-600 text-xs select-none">
            {line.startsWith('+') && !line.startsWith('+++') ? '+' : line.startsWith('-') && !line.startsWith('---') ? '-' : ''}
          </div>
          <div className={`flex-1 px-2 py-0.5 font-mono text-xs ${className} whitespace-pre-wrap break-words`}>
            {lineContent}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
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
              {parsedFiles.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                    Files Changed ({parsedFiles.length})
                  </label>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
                    {parsedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedFile(selectedFile === file.filename ? null : file.filename)}
                        className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors ${selectedFile === file.filename ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {file.filename}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            {file.additions > 0 && (
                              <span className="text-xs text-green-600 font-medium">
                                +{file.additions}
                              </span>
                            )}
                            {file.deletions > 0 && (
                              <span className="text-xs text-red-600 font-medium">
                                -{file.deletions}
                              </span>
                            )}
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${selectedFile === file.filename ? 'rotate-90' : ''
                                }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File Diff */}
              {selectedFile && fileDiffs[selectedFile] && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase">
                      Changes in {selectedFile}
                    </label>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                    <div className="overflow-auto max-h-96">
                      {renderDiff(fileDiffs[selectedFile])}
                    </div>
                  </div>
                </div>
              )}

              {/* Show all diff if no file selected */}
              {!selectedFile && details.diff && parsedFiles.length === 0 && (
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
      </div>
    </div>
  );
}

export default GitGraph;

