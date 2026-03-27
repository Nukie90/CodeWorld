// Main Dashboard: Repository Analysis Results
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import BarChartVisualization from '../components/features/visualizations/BarChartVisualization';
import Island3DVisualization from '../components/features/visualizations/Island3DVisualization';
import CommitDetailModal from '../components/features/git_graph/CommitDetailModal';
import ResultsSidebar from '../components/features/results/ResultsSidebar';
import ResultsDetailsPanel from '../components/features/results/ResultsDetailsPanel';
import ResultsControlBar from '../components/features/results/ResultsControlBar';

import { useRepoBranches } from '../hooks/useRepoBranches';
import { useRepoAnimation } from '../hooks/useRepoAnimation';
import { repoService } from '../services/api';

import { Code, FileText, Hash, Sparkles, Check, Copy, FileText as FileTextIcon, ChevronDown, ChevronUp } from 'lucide-react';

function normalizeFunctionTotals(fn) {
  const normalizedChildren = (fn.children || []).map(normalizeFunctionTotals);
  const childSum = normalizedChildren.reduce((sum, child) => sum + (child.total_cognitive_complexity || 0), 0);
  const ownCc = fn.cognitive_complexity || 0;
  const total = fn.total_cognitive_complexity ?? (ownCc + childSum);

  return {
    ...fn,
    children: normalizedChildren,
    total_cognitive_complexity: total,
  };
}

function normalizeAnalysisResultPayload(result) {
  if (!result?.analysis?.individual_files) return result;

  const normalizedFiles = result.analysis.individual_files.map((file) => {
    const normalizedFunctions = (file.functions || []).map(normalizeFunctionTotals);
    const roots = normalizedFunctions.filter((fn) => fn.parentId == null);
    const totalFromFunctions = (roots.length > 0 ? roots : normalizedFunctions)
      .reduce((sum, fn) => sum + (fn.total_cognitive_complexity || 0), 0);

    return {
      ...file,
      functions: normalizedFunctions,
      total_cognitive_complexity: file.total_cognitive_complexity ?? totalFromFunctions,
    };
  });

  return {
    ...result,
    analysis: {
      ...result.analysis,
      individual_files: normalizedFiles,
    },
  };
}

function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { analysisResult: initialAnalysisResult, token, username } = state || {};

  const [analysisResult, setAnalysisResult] = useState(() => normalizeAnalysisResultPayload(initialAnalysisResult));
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
  const lintCache = useRef({});

  const [selectedCode, setSelectedCode] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeDisplayMode, setCodeDisplayMode] = useState('highlighted');
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showContributors, setShowContributors] = useState(false);
  const [topNComplexity, setTopNComplexity] = useState('All');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState('All');
  const [availableDirectories, setAvailableDirectories] = useState([]);
  const [lintResults, setLintResults] = useState(null);
  const [isLinting, setIsLinting] = useState(false);

  const applyAnalysisResult = useCallback((nextResult) => {
    setAnalysisResult(normalizeAnalysisResultPayload(nextResult));
  }, []);

  const individual_files = useMemo(() => analysisResult?.analysis?.individual_files || [], [analysisResult]);

  const {
    branches,
    currentBranch,
    branchLoading,
    handleBranchChange
  } = useRepoBranches(analysisResult?.repo_url, token, initialAnalysisResult, applyAnalysisResult);

  const {
    isAnimating,
    animationProgress,
    animatingCommit,
    allCommits,
    currentCommitIndex,
    animationSpeed,
    setAnimationSpeed,
    fixedFileOrder,
    handlePlayAnimation: baseHandlePlayAnimation,
    handlePlayFromDate: baseHandlePlayFromDate,
    handleStepPrev,
    handleStepNext,
    handleCommitClick
  } = useRepoAnimation(analysisResult, applyAnalysisResult, currentBranch, token, individual_files);

  const handlePlayAnimation = useCallback((...args) => {
    if (!isAnimating) {
      setIsRightPanelOpen(false);
    }
    baseHandlePlayAnimation(...args);
  }, [isAnimating, baseHandlePlayAnimation]);

  const handlePlayFromDate = useCallback((...args) => {
    setIsRightPanelOpen(false);
    baseHandlePlayFromDate(...args);
  }, [baseHandlePlayFromDate]);

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
    'Total complexity': folderMetrics?.total_complexity
  };

  const handleFunctionClick = useCallback(async (functionData) => {
    if (!analysisResult?.repo_url) return;
    setCodeLoading(true);
    setLintResults(null);
    setSelectedCode(null);
    setCodeDisplayMode('highlighted');
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

  const handleLintFile = useCallback(async (filename, force = false) => {
    if (!filename || !analysisResult?.repo_url) return;

    const commitHash = animatingCommit?.hash || currentBranch || 'HEAD';
    const cacheKey = `${filename}-${commitHash}`;

    if (!force && lintCache.current[cacheKey]) {
      setLintResults(lintCache.current[cacheKey]);
      return;
    }

    setIsLinting(true);
    setLintResults(null);
    try {
      const resp = await repoService.lintFile(filename, {
        repo_url: analysisResult.repo_url,
        commit_hash: commitHash,
        token: token
      });
      if (resp.data) {
        setLintResults(resp.data);
        lintCache.current[cacheKey] = resp.data;
      }
    } catch (err) {
      console.error('Failed to lint file', err);
    } finally {
      setIsLinting(false);
    }
  }, [analysisResult?.repo_url, animatingCommit?.hash, currentBranch, token]);

  const handleFileCodeFetch = useCallback(async (fileData) => {
    if (!analysisResult?.repo_url) return;
    setCodeLoading(true);
    setLintResults(null);
    setSelectedCode(null);
    setCodeDisplayMode('highlighted');
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
        lintResults={lintResults}
        isLinting={isLinting}
        handleLintFile={handleLintFile}
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
    </div>
  );
}

export default ResultsPage;
