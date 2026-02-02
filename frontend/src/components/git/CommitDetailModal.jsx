import { useState, useEffect } from 'react';
import axios from 'axios';
import { GitCommit, FileText, X } from 'lucide-react';

function CommitDetailModal({ commit, repoUrl, token, onClose, isDarkMode }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [parsedFiles, setParsedFiles] = useState([]);
    const [fileDiffs, setFileDiffs] = useState({});
    const [viewingFileContent, setViewingFileContent] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [loadingContent, setLoadingContent] = useState(false);

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

    const fetchFileContent = async (filename) => {
        setLoadingContent(true);
        setFileContent('');
        setViewingFileContent(filename);
        try {
            const resp = await axios.post('http://127.0.0.1:8000/api/repo/file-content', {
                repo_url: repoUrl,
                commit_hash: commit.hash,
                file_path: filename,
                token: token
            });
            setFileContent(resp.data.content);
        } catch (err) {
            console.error('Failed to fetch file content', err);
            setFileContent('Failed to load file content.');
        } finally {
            setLoadingContent(false);
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
                className={`rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                        <GitCommit size={20} className="text-blue-600" />
                        <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Commit Details</h2>
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
                                    <p className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{details.hash}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Message</label>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{details.message}</p>
                                    {details.body && (
                                        <p className={`text-sm mt-1 whitespace-pre-wrap ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{details.body}</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Author</label>
                                        <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{details.author}</p>
                                        {details.email && (
                                            <p className="text-xs text-gray-500">{details.email}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
                                        <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{formatDate(details.date)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Files Changed */}
                            {parsedFiles.length > 0 && (
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                                        Files Changed ({parsedFiles.length})
                                    </label>
                                    <div className={`rounded-lg border divide-y ${isDarkMode ? 'bg-gray-800 border-gray-700 divide-gray-700' : 'bg-gray-50 border-gray-200 divide-gray-200'}`}>
                                        {parsedFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedFile(selectedFile === file.filename ? null : file.filename)}
                                                className={`p-3 cursor-pointer transition-colors ${selectedFile === file.filename
                                                    ? (isDarkMode ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : 'bg-blue-50 border-l-4 border-l-blue-500')
                                                    : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100')
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
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
                                                {selectedFile === file.filename && (
                                                    <div className="mt-2 flex justify-end">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                fetchFileContent(file.filename);
                                                            }}
                                                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${isDarkMode ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/60' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                                        >
                                                            <FileText size={12} />
                                                            View Full File
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* File Content Modal */}
                            {viewingFileContent && (
                                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewingFileContent(null)}>
                                    <div className={`rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
                                        <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <FileText size={20} className="text-blue-600" />
                                                <h3 className={`font-semibold truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{viewingFileContent}</h3>
                                                <span className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'text-gray-400 bg-gray-800' : 'text-gray-500 bg-gray-100'}`}>
                                                    At commit {commit.hash.substring(0, 7)}
                                                </span>
                                            </div>
                                            <button onClick={() => setViewingFileContent(null)} className="text-gray-400 hover:text-gray-600">
                                                <X size={24} />
                                            </button>
                                        </div>
                                        <div className={`flex-1 overflow-auto p-4 ${isDarkMode ? 'bg-black' : 'bg-gray-50'}`}>
                                            {loadingContent ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="text-gray-500">Loading content...</div>
                                                </div>
                                            ) : (
                                                <pre className={`text-sm font-mono whitespace-pre-wrap break-words p-4 rounded border shadow-sm min-h-full ${isDarkMode ? 'text-gray-300 bg-gray-900 border-gray-700' : 'text-gray-800 bg-white border-gray-200'}`}>
                                                    {fileContent || '(Empty file)'}
                                                </pre>
                                            )}
                                        </div>
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

export default CommitDetailModal;
