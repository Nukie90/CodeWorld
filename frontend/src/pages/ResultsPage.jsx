// Main Dashboard: Repository Analysis Results
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Home, Moon, Sun, Play, Square, GitCommit, Copy, Check, Code, FileText, Hash, X } from 'lucide-react';
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import BarChartVisualization from '../components/results/visualizations/BarChartVisualization';
import Island3DVisualization from '../components/results/visualizations/Island3DVisualization';
import GitGraph from '../components/git/GitGraph';
import CommitDetailModal from '../components/git/CommitDetailModal';
import ChatBot from '../components/chat/ChatBot';

function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { analysisResult: initialAnalysisResult, token, username } = state || {};

  const [analysisResult, setAnalysisResult] = useState(initialAnalysisResult);
  const [activeTab, setActiveTab] = useState('island3D');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Panel visibility states
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isTopPanelOpen, setIsTopPanelOpen] = useState(false);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
  const [selectedCommitForModal, setSelectedCommitForModal] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState('summary');
  const [selectedFileForCard, setSelectedFileForCard] = useState(null);

  // Resizable Panel State
  const [leftPanelWidth, setLeftPanelWidth] = useState(400);
  const [rightPanelWidth, setRightPanelWidth] = useState(520);
  const [isDragging, setIsDragging] = useState(false);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const [selectedCode, setSelectedCode] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeDisplayMode, setCodeDisplayMode] = useState('plain');
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showContributors, setShowContributors] = useState(false);
  const [topNComplexity, setTopNComplexity] = useState('All');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState('All');
  const [availableDirectories, setAvailableDirectories] = useState([]);

  const individual_files = useMemo(() => analysisResult?.analysis?.individual_files || [], [analysisResult]);

  const {
    branches,
    currentBranch,
    branchLoading,
    handleBranchChange
  } = useRepoBranches(analysisResult?.repo_url, token, initialAnalysisResult, setAnalysisResult);

  const {
    isAnimating,
    animationProgress,
    animatingCommit,
    allCommits,
    currentCommitIndex,
    animationSpeed,
    setAnimationSpeed,
    fixedFileOrder,
    handlePlayAnimation,
    handlePlayFromDate,
    handleStepPrev,
    handleStepNext,
    handleCommitClick
  } = useRepoAnimation(analysisResult, setAnalysisResult, currentBranch, token, individual_files);

  // Extract unique directories
  useEffect(() => {
    if (individual_files && individual_files.length > 0) {
      const dirs = new Set();
      individual_files.forEach(f => {
        const parts = (f.filename || '').split('/');
        if (parts.length > 1) {
          let currentPath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            dirs.add(currentPath);
          }
        }
      });
      setAvailableDirectories(['All', ...Array.from(dirs).sort()]);
    } else {
      setAvailableDirectories(['All']);
    }
  }, [individual_files]);

  const filteredFiles = useMemo(() => {
    let result = [...individual_files];
    if (selectedDirectory !== 'All') {
      result = result.filter(f => (f.filename || '').startsWith(selectedDirectory + '/') || f.filename === selectedDirectory);
    }
    result.sort((a, b) => (b.total_cognitive_complexity || 0) - (a.total_cognitive_complexity || 0));
    if (topNComplexity !== 'All') {
      const topN = parseInt(topNComplexity);
      if (!isNaN(topN)) result = result.slice(0, topN);
    }
    return result;
  }, [individual_files, selectedDirectory, topNComplexity]);

  const folderMetrics = analysisResult?.analysis?.folder_metrics || {};
  const folderSummary = {
    'Total files': folderMetrics?.total_files,
    'Total lines': folderMetrics?.total_loc,
    'Logical LOC': folderMetrics?.total_lloc,
    'Total function': folderMetrics?.total_functions,
    'Total complexity': folderMetrics?.total_complexity,
    'Max complexity': folderMetrics?.complexity_max
  };

  const handleFunctionClick = useCallback(async (functionData) => {
    if (!analysisResult?.repo_url) return;
    setCodeLoading(true);
    setSelectedCode(null);
    setIsRightPanelOpen(true);
    setIsBottomPanelOpen(false);
    try {
      const resp = await repoService.getFunctionCode({
        repo_url: analysisResult.repo_url,
        filename: functionData.filename,
        function_name: functionData.functionName,
        start_line: functionData.startLine,
        lloc: functionData.lloc,
        token: token
      });
      if (resp.data) {
        setSelectedCode({
          code: resp.data.code,
          filename: resp.data.filename,
          functionName: resp.data.function_name,
          startLine: resp.data.start_line,
          endLine: resp.data.end_line
        });
      }
    } catch (err) {
      console.error('Failed to fetch function code', err);
    } finally {
      setCodeLoading(false);
    }
  }, [analysisResult?.repo_url, token]);

  const handleFileCodeFetch = useCallback(async (fileData) => {
    if (!analysisResult?.repo_url) return;
    setCodeLoading(true);
    setSelectedCode(null);
    setIsRightPanelOpen(true);
    setIsBottomPanelOpen(false);
    try {
      const resp = await repoService.getFileContent({
        repo_url: analysisResult.repo_url,
        file_path: fileData.filename,
        commit_hash: animatingCommit?.hash || currentBranch || 'HEAD',
        token: token
      });
      if (resp.data) {
        setSelectedCode({
          code: resp.data.content,
          filename: fileData.filename,
          functionName: fileData.filename.split('/').pop(),
          startLine: 1,
          endLine: resp.data.content.split('\n').length
        });
      }
    } catch (err) {
      console.error('Failed to fetch file code', err);
    } finally {
      setCodeLoading(false);
    }
  }, [analysisResult?.repo_url, animatingCommit?.hash, currentBranch, token]);

  const handleFileClickFrom3D = useCallback((fileData) => {
    const fullFileData = individual_files.find(f => f.filename === fileData.filename);
    setSelectedFileForCard(fullFileData);
    setRightPanelTab('analysis');
    setIsRightPanelOpen(true);
    setIsBottomPanelOpen(false);
    if (fileData.startLine) handleFunctionClick(fileData);
    else handleFileCodeFetch(fileData);
  }, [individual_files, handleFunctionClick, handleFileCodeFetch]);

  const handleCopyCode = async () => {
    if (selectedCode?.code) {
      try {
        await navigator.clipboard.writeText(selectedCode.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code', err);
      }
    }
  };

  const startResizingLeft = (e) => {
    isResizingLeft.current = true;
    setIsDragging(true);
    startX.current = e.clientX;
    startWidth.current = leftPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingRight = (e) => {
    isResizingRight.current = true;
    setIsDragging(true);
    startX.current = e.clientX;
    startWidth.current = rightPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const stopResizing = useCallback(() => {
    isResizingLeft.current = false;
    isResizingRight.current = false;
    setIsDragging(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const resize = useCallback((e) => {
    if (isResizingLeft.current) {
      const newWidth = startWidth.current + (e.clientX - startX.current);
      if (newWidth > 200 && newWidth < window.innerWidth * 0.8) setLeftPanelWidth(newWidth);
    }
    if (isResizingRight.current) {
      const newWidth = startWidth.current - (e.clientX - startX.current);
      if (newWidth > 300 && newWidth < window.innerWidth * 0.8) setRightPanelWidth(newWidth);
    }
  }, []);

  const formatCommitDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const parts = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).formatToParts(date);
      const p = {};
      parts.forEach(({ type, value }) => p[type] = value);
      return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
    } catch (err) {
      return dateString;
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const panelBg = isDarkMode ? 'bg-gray-800' : 'bg-white';

  return (
    <div className={`h-screen overflow-hidden ${bgColor} ${textColor} relative`}>
      <ResultsControlBar
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isAnimating={isAnimating}
        animatingCommit={animatingCommit}
        formatCommitDate={formatCommitDate}
      />

      <ResultsSidebar
        isDarkMode={isDarkMode}
        isLeftPanelOpen={isLeftPanelOpen}
        setIsLeftPanelOpen={setIsLeftPanelOpen}
        leftPanelWidth={leftPanelWidth}
        isDragging={isDragging}
        startResizingLeft={startResizingLeft}
        currentBranch={currentBranch}
        branches={branches}
        branchLoading={branchLoading}
        handleBranchChange={handleBranchChange}
        topNComplexity={topNComplexity}
        isCustomMode={isCustomMode}
        setTopNComplexity={setTopNComplexity}
        setIsCustomMode={setIsCustomMode}
        selectedDirectory={selectedDirectory}
        setSelectedDirectory={setSelectedDirectory}
        availableDirectories={availableDirectories}
        filteredFiles={filteredFiles}
        individual_files={individual_files}
        handleStepPrev={handleStepPrev}
        handleStepNext={handleStepNext}
        handlePlayAnimation={handlePlayAnimation}
        isAnimating={isAnimating}
        animationSpeed={animationSpeed}
        setAnimationSpeed={setAnimationSpeed}
        handlePlayFromDate={handlePlayFromDate}
        showContributors={showContributors}
        setShowContributors={setShowContributors}
        animatingCommit={animatingCommit}
        setSelectedCommitForModal={setSelectedCommitForModal}
        animationProgress={animationProgress}
        formatCommitDate={formatCommitDate}
        analysisResult={analysisResult}
        token={token}
        handleCommitClick={handleCommitClick}
        allCommits={allCommits}
        setIsBottomPanelOpen={setIsBottomPanelOpen}
        currentCommitIndex={currentCommitIndex}
      />

      {/* Left Panel Toggle Button */}
      <button
        onClick={() => {
          setIsLeftPanelOpen(!isLeftPanelOpen);
          if (!isLeftPanelOpen) setIsBottomPanelOpen(false);
        }}
        className={`absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl rounded-full p-4 z-40 ${isDragging ? 'transition-none duration-0' : 'transition-all'} hover:bg-white/20 dark:hover:bg-black/30 border border-white/20 dark:border-white/10 group`}
        style={{
          transform: `translateY(-50%) translateX(${isLeftPanelOpen ? `${leftPanelWidth}px` : '0'})`
        }}
      >
        {isLeftPanelOpen ? (
          <ChevronLeft size={24} strokeWidth={2.5} className="text-gray-700 dark:text-gray-300 transition-transform group-hover:scale-110" />
        ) : (
          <ChevronRight size={24} strokeWidth={2.5} className="text-gray-700 dark:text-gray-300 transition-transform group-hover:scale-110" />
        )}
      </button>

      <ResultsDetailsPanel
        isDarkMode={isDarkMode}
        isRightPanelOpen={isRightPanelOpen}
        setIsRightPanelOpen={setIsRightPanelOpen}
        rightPanelWidth={rightPanelWidth}
        isDragging={isDragging}
        startResizingRight={startResizingRight}
        selectedCode={selectedCode}
        codeDisplayMode={codeDisplayMode}
        setCodeDisplayMode={setCodeDisplayMode}
        showLineNumbers={showLineNumbers}
        setShowLineNumbers={setShowLineNumbers}
        handleCopyCode={handleCopyCode}
        copied={copied}
        codeLoading={codeLoading}
        selectedFileForCard={selectedFileForCard}
        rightPanelTab={rightPanelTab}
        setRightPanelTab={setRightPanelTab}
        folderSummary={folderSummary}
        individual_files={individual_files}
        handleFunctionClick={handleFunctionClick}
        isBottomPanelOpen={isBottomPanelOpen}
        setIsBottomPanelOpen={setIsBottomPanelOpen}
        setIsLeftPanelOpen={setIsLeftPanelOpen}
        borderColor={borderColor}
        textColor={textColor}
        panelBg={panelBg}
      />

      {/* Right Panel Toggle Button */}
      <button
        onClick={() => {
          setIsRightPanelOpen(!isRightPanelOpen);
          if (!isRightPanelOpen) setIsBottomPanelOpen(false);
        }}
        className={`absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl rounded-full p-4 z-40 ${isDragging ? 'transition-none duration-0' : 'transition-all'} hover:bg-white/20 dark:hover:bg-black/30 border border-white/20 dark:border-white/10 group`}
        style={{
          transform: `translateY(-50%) translateX(${isRightPanelOpen ? `-${rightPanelWidth}px` : '0'})`
        }}
      >
        {isRightPanelOpen ? (
          <ChevronRight size={24} strokeWidth={2.5} className="text-gray-700 dark:text-gray-300 transition-transform group-hover:scale-110" />
        ) : (
          <ChevronLeft size={24} strokeWidth={2.5} className="text-gray-700 dark:text-gray-300 transition-transform group-hover:scale-110" />
        )}
      </button>

      {/* Top Panel - Visualization Type Selector */}
      <div
        className={`absolute left-0 right-0 top-0 ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl shadow-2xl transition-transform duration-300 z-20 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'}`}
        style={{
          height: '90px',
          transform: isTopPanelOpen ? 'translateY(0)' : 'translateY(-90px)'
        }}
      >
        <div className="h-full flex items-center justify-center px-8">
          <div className="flex gap-4">
            {[
              { key: 'bar', label: 'Bar Chart' },
              { key: 'island3D', label: 'Island 3D' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                disabled={isAnimating}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === key
                  ? 'bg-gradient-to-r from-blue-400 to-blue-700 text-white backdrop-blur-xl shadow-2xl scale-110'
                  : `${isDarkMode ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700' : 'bg-gray-100/50 text-gray-700 hover:bg-gray-200'} border ${borderColor}`
                  } ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsTopPanelOpen(!isTopPanelOpen)}
        disabled={isAnimating}
        className={`absolute left-1/2 -translate-x-1/2 top-0 bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl rounded-b-2xl px-6 py-3 z-40 transition-all hover:bg-white/20 dark:hover:bg-black/30 border border-white/20 dark:border-white/10 border-t-0 text-sm font-bold uppercase tracking-wider ${textColor} ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{
          transform: `translateX(-50%) translateY(${isTopPanelOpen ? '90px' : '0'})`
        }}
      >
        {isTopPanelOpen ? '▲ Type' : '▼ Type'}
      </button>

      {/* Bottom Panel - Folder Summary with Tabs (Slide in/out) - Modern Design */}
      <div
        className={`absolute left-0 right-0 bottom-0 ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl shadow-2xl transition-transform duration-300 z-20 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'}`}
        style={{
          height: '420px',
          transform: isBottomPanelOpen ? 'translateY(0)' : 'translateY(420px)'
        }}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Tab System - Modern Design */}
          <div className={`flex ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-100/30'} backdrop-blur-sm p-1.5 m-6 mb-4 rounded-xl border ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'} shadow-lg gap-2`}>
            <button
              onClick={() => setRightPanelTab('summary')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all rounded-lg ${rightPanelTab === 'summary'
                ? 'bg-gradient-to-r from-blue-500 to-teal-600 text-white shadow-lg'
                : `${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`
                }`}
            >
              <FileText size={16} strokeWidth={2.5} /> Folder Summary
            </button>
            <button
              onClick={() => setRightPanelTab('analysis')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all rounded-lg ${rightPanelTab === 'analysis'
                ? 'bg-gradient-to-r from-blue-500 to-teal-600 text-white shadow-lg'
                : `${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`
                }`}
            >
              <Hash size={16} strokeWidth={2.5} /> File Analysis
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {rightPanelTab === 'summary' ? (
              /* Folder Summary Content */
              <div className="animate-in fade-in duration-300">
                <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Project Metrics</h3>
                <div className="grid grid-cols-3 gap-6">
                  {Object.entries(folderSummary).map(([key, value]) => (
                    <div key={key} className={`${isDarkMode ? 'bg-gray-800/50' : 'bg-gradient-to-br from-blue-50 to-purple-50'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg hover:shadow-xl transition-all`}>
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">{key}</span>
                      <span className={`font-black text-2xl ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* File Analysis Content */
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {selectedFileForCard ? (() => {
                  const fullFileData = individual_files?.find(f => f.filename === selectedFileForCard.filename) || selectedFileForCard;

                  return (
                    <div className={`${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-700' : 'bg-gradient-to-br from-white to-blue-50'} rounded-2xl p-6 border-l-4 border-l-blue-500 shadow-2xl`}>
                      <div className="mb-6">
                        <h3 className="text-xs font-bold text-blue-500 opacity-70 uppercase tracking-wider mb-2">Selected File</h3>
                        <h4 className="text-base font-black break-all leading-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {fullFileData.filename}
                        </h4>
                      </div>

                      <div className="grid grid-cols-5 gap-4 mb-6">
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Total LOC</span>
                          <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {fullFileData.total_loc || "—"}
                          </span>
                        </div>
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Logical LOC</span>
                          <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {fullFileData.total_lloc || "—"}
                          </span>
                        </div>
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Max Complexity</span>
                          <span className="text-xl font-black bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">{fullFileData.total_complexity || "—"}</span>
                        </div>
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Cog Complexity</span>
                          <span className="text-xl font-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{fullFileData.total_cognitive_complexity || "0"}</span>
                        </div>
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Functions</span>
                          <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {fullFileData.function_count || fullFileData.functions?.length || 0}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3">Functions List</h3>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2">
                          {selectedFileForCard.functions?.map((fn, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleFunctionClick({
                                filename: selectedFileForCard.filename,
                                functionName: fn.name,
                                startLine: fn.start_line,
                                lloc: fn.lloc
                              })}
                              className={`${isDarkMode ? 'bg-gray-800/70 hover:bg-gray-700' : 'bg-white/70 hover:bg-blue-50'} backdrop-blur-sm rounded-xl p-3 text-left transition-all border ${borderColor} shadow-md hover:shadow-lg hover:border-blue-400 group`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="font-bold text-sm truncate group-hover:text-blue-500 transition-colors">{fn.name}</span>
                                  <span className="text-xs opacity-60 font-medium">Lines: {fn.lloc}</span>
                                </div>
                                <span className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-black ${fn.cyclomatic_complexity > 10
                                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                  : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                  }`}>
                                  CC {fn.cyclomatic_complexity}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className={`h-64 flex flex-col items-center justify-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} text-center px-6 border-2 border-dashed ${borderColor} rounded-2xl backdrop-blur-sm`}>
                    <Code size={48} className="mb-4 opacity-20" strokeWidth={1.5} />
                    <p className="text-sm font-bold uppercase tracking-widest mb-2">No File Selected</p>
                    <p className="text-xs opacity-70 max-w-md">Click on a building in the 3D city, a bar in the chart, or any visualization element to see detailed file analysis</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Panel Toggle Button - Circular like play button */}
      {/* Bottom Panel Toggle Button - Circular like play button */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-4 z-40 transition-all"
        style={{
          transform: `translateX(-50%) translateY(${isBottomPanelOpen ? '-420px' : '0'})`
        }}
      >
        <button
          onClick={() => {
            const willOpen = !isBottomPanelOpen;
            setIsBottomPanelOpen(willOpen);
            if (willOpen) {
              setIsLeftPanelOpen(false);
              setIsRightPanelOpen(false);
            }
          }}
          className={`bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl rounded-full p-4 transition-all hover:bg-white/20 dark:hover:bg-black/30 hover:scale-110 border border-white/20 dark:border-white/10`}
        >
          {isBottomPanelOpen ? (
            <ChevronDown size={24} strokeWidth={2.5} className="text-gray-700 dark:text-gray-300" />
          ) : (
            <ChevronUp size={24} strokeWidth={2.5} className="text-gray-700 dark:text-gray-300" />
          )}
        </button>
      </div>

      {/* Main Visualization Area - Full Screen */}
      <div className={`h-full w-full flex items-center justify-center p-0 ${bgColor}`}>
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 overflow-hidden">
            {activeTab === 'bar' && filteredFiles?.length > 0 && (
              <BarChartVisualization
                individualFiles={filteredFiles}
                onFunctionClick={handleFunctionClick}
                onFileClick={handleFileClickFrom3D}
                fixedFileOrder={fixedFileOrder}
                isDarkMode={isDarkMode}
              />
            )}
            {activeTab === 'island3D' && filteredFiles?.length > 0 && (
              <Island3DVisualization
                individualFiles={filteredFiles}
                onFunctionClick={handleFunctionClick}
                onFileClick={handleFileClickFrom3D}
                isDarkMode={isDarkMode}
                isTimelinePlaying={isAnimating}
                animatingCommit={animatingCommit}
                showContributors={showContributors}
              />
            )}
            {(!filteredFiles?.length || filteredFiles.length === 0) && (
              <div className="flex items-center justify-center h-full text-gray-400">
                No files to visualize
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedCommitForModal && (
        <CommitDetailModal
          commit={selectedCommitForModal}
          repoUrl={analysisResult?.repo_url}
          token={token}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedCommitForModal(null)}
        />
      )}

      {/* AI Chatbot Overlay */}
      <ChatBot
        isDarkMode={isDarkMode}
        projectContext={{
          repo_url: analysisResult?.repo_url,
          folder_metrics: analysisResult?.analysis?.folder_metrics,
          individual_files: analysisResult?.analysis?.individual_files
        }}
      />
    </div>
  );
}

export default ResultsPage;