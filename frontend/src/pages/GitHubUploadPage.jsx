import { useState } from 'react';
import { X, Pause, XCircle, FolderArchive } from 'lucide-react';

function GitHubUploadPage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');

  const handleUpload = () => {
    if (!repoUrl) return;

    setUploadStatus('uploading');
    setProgress(0);
    setFileName('src.zip');
    setFileSize('5.3MB');

    // Simulate upload progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) {
          clearInterval(interval);
          setTimeRemaining('30 seconds remaining');
          return 85;
        }
        const newProgress = prev + 5;
        const remaining = Math.ceil((100 - newProgress) / 5);
        setTimeRemaining(`${remaining * 6} seconds remaining`);
        return newProgress;
      });
    }, 300);
  };

  const handleCancel = () => {
    setUploadStatus('idle');
    setProgress(0);
    setRepoUrl('');
    setFileName('');
  };

  const handleRemoveFile = () => {
    setFileName('');
    setUploadStatus('idle');
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-blue-300 text-black py-4 shadow-sm">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="text-2xl font-bold hover:opacity-90 transition-opacity">
            CodeWorld
          </div>
          <div
            className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-sm"
          >
           Login
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          {/* Title Section */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">Code Analysis Tool</h2>
            <p className="text-gray-600">Upload JavaScript files or folders for complexity analysis</p>
          </div>

          {/* Upload Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Upload from GitHub URL</h3>

            {/* URL Input */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Add file URL"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={uploadStatus === 'uploading'}
              />
              <button
                onClick={handleUpload}
                disabled={!repoUrl || uploadStatus === 'uploading'}
                className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Upload
              </button>
            </div>

            {/* File Preview (when URL is entered) */}
            {fileName && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-100 p-2 rounded-lg">
                      <FolderArchive className="text-yellow-600" size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{fileName}</p>
                      <p className="text-sm text-gray-600">{fileSize}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploadStatus === 'uploading' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Uploading...</span>
                    <span className="text-sm text-blue-600 font-semibold">{progress}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{timeRemaining}</p>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <Pause size={20} />
                  </button>
                  <button 
                    onClick={handleCancel}
                    className="p-2 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <XCircle size={20} />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled
                    className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Initial State - Show Next button when no upload */}
            {uploadStatus === 'idle' && !fileName && (
              <div className="flex justify-end pt-4">
                <button
                  disabled
                  className="px-6 py-2 bg-gray-300 text-white font-semibold rounded-lg cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default GitHubUploadPage;