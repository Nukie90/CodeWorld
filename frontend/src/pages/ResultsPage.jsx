import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Home, Moon, Sun, Play, Square, GitCommit, Copy, Check, Code, FileText, Hash, X } from 'lucide-react';
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import BarChartVisualization from '../components/results/visualizations/BarChartVisualization';
import CirclePackingVisualization from '../components/results/visualizations/CirclePackingVisualization';
import TreemapVisualization from '../components/results/visualizations/TreemapVisualization';
import ForceTreeVisualization from '../components/results/visualizations/ForceTreeVisualization';
import RadarChartVisualization from '../components/results/visualizations/RadarChartVisualization';
import CodeCity3DVisualization from '../components/results/visualizations/CodeCity3DVisualization';
import Island3DVisualization from '../components/results/visualizations/Island3DVisualization';
import CodeGalaxySolarSystem from '../components/results/visualizations/CodeGalaxySolarSystem';
import GitGraph from '../components/git/GitGraph';
import CommitDetailModal from '../components/git/CommitDetailModal';

function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation()
  const { analysisResult: initialAnalysisResult, token } = state || {}

  // Convert analysisResult to state so it can be updated when branch changes
  const [analysisResult, setAnalysisResult] = useState(initialAnalysisResult)
  const [activeTab, setActiveTab] = useState('bar');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Panel visibility states
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isTopPanelOpen, setIsTopPanelOpen] = useState(false);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
  const [selectedCommitForModal, setSelectedCommitForModal] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState('summary'); // 'summary' or 'analysis'
  const [selectedFileForCard, setSelectedFileForCard] = useState(null);

  // Resizable Panel State
  const [leftPanelWidth, setLeftPanelWidth] = useState(400);
  const [rightPanelWidth, setRightPanelWidth] = useState(520);
  const [isDragging, setIsDragging] = useState(false);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState("")
  const [branchLoading, setBranchLoading] = useState(false)
  const [selectedCode, setSelectedCode] = useState(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeDisplayMode, setCodeDisplayMode] = useState('plain')
  const [showLineNumbers, setShowLineNumbers] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const isAnimatingRef = useRef(false)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [animatingCommit, setAnimatingCommit] = useState(null)
  const [fixedFileOrder, setFixedFileOrder] = useState(null)
  const [allCommits, setAllCommits] = useState([])
  const [currentCommitIndex, setCurrentCommitIndex] = useState(-1)
  const [animationSpeed, setAnimationSpeed] = useState(800)
  const animationRef = useRef(null)

  console.log('analysisResult in ResultsPage:', analysisResult);

  useEffect(() => {
    async function fetchBranches() {
      if (!analysisResult?.repo_url) return
      try {
        const resp = await axios.get('http://127.0.0.1:8000/api/repo/branches', { params: { repo_url: analysisResult.repo_url, token } })
        const data = resp.data || {}
        const local = data.local || []
        const remote = data.remote || []
        const current = data.current || ''
        const combined = [...local]
        remote.forEach(r => { if (!combined.includes(r)) combined.push(r) })
        setBranches(combined)
        setCurrentBranch(current)
      } catch (err) {
        console.error('Failed to fetch branches', err)
      }
    }
    fetchBranches()
  }, [analysisResult?.repo_url, token])

  const folderMetrics = analysisResult?.analysis?.folder_metrics || {}
  const folderName = folderMetrics?.folder_name?.split('.git')[0] || ''
  const individual_files = analysisResult?.analysis?.individual_files || []

  const folderSummary = {
    'Total files': folderMetrics?.total_files,
    'Total lines': folderMetrics?.total_loc,
    'Logical LOC': folderMetrics?.total_nloc,
    'Total function': folderMetrics?.total_functions,
    'Total complexity': folderMetrics?.total_complexity,
    'Max complexity': folderMetrics?.complexity_max
  };

  const handleBranchChange = async (evt) => {
    const branch = evt.target.value
    if (!branch || !analysisResult?.repo_url) return
    setBranchLoading(true)
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/checkout', { repo_url: analysisResult.repo_url, branch, token })
      if (resp.data) {
        setAnalysisResult(resp.data)
        setCurrentBranch(branch)
      }
    } catch (err) {
      console.error('Checkout failed', err)
    } finally {
      setBranchLoading(false)
    }
  }

  const handleFunctionClick = async (functionData) => {
    if (!analysisResult?.repo_url) return

    setCodeLoading(true)
    setSelectedCode(null)
    setIsRightPanelOpen(true)
    setIsBottomPanelOpen(false)

    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/function-code', {
        repo_url: analysisResult.repo_url,
        filename: functionData.filename,
        function_name: functionData.functionName,
        start_line: functionData.startLine,
        nloc: functionData.nloc,
        token: token
      })

      if (resp.data) {
        setSelectedCode({
          code: resp.data.code,
          filename: resp.data.filename,
          functionName: resp.data.function_name,
          startLine: resp.data.start_line,
          endLine: resp.data.end_line
        })
      }
    } catch (err) {
      console.error('Failed to fetch function code', err)
      setSelectedCode({
        code: `// Error loading function code: ${err.response?.data?.detail || err.message}`,
        filename: functionData.filename,
        functionName: functionData.functionName,
        startLine: functionData.startLine,
        endLine: null
      })
    } finally {
      setCodeLoading(false)
    }
  }

  const handleFileCodeFetch = async (fileData) => {
    if (!analysisResult?.repo_url) return;

    setCodeLoading(true);
    setSelectedCode(null);
    setIsRightPanelOpen(true);
    setIsBottomPanelOpen(false);

    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/file-content', {
        repo_url: analysisResult.repo_url,
        file_path: fileData.filename,
        commit_hash: animatingCommit?.hash || currentBranch || 'HEAD',
        token: token
      });

      const onlyfilename = fileData.filename.split('/').pop();

      if (resp.data) {
        setSelectedCode({
          code: resp.data.content,
          filename: fileData.filename,
          functionName: onlyfilename,
          startLine: 1,
          endLine: resp.data.content.split('\n').length
        });
      }
    } catch (err) {
      console.error('Failed to fetch file code', err);
      setSelectedCode({
        code: `// Error loading file code: ${err.response?.data?.detail || err.message}`,
        filename: fileData.filename,
        functionName: 'Error',
        startLine: 1,
        endLine: null
      });
    } finally {
      setCodeLoading(false);
    }
  };

  const handleFileClickFrom3D = (fileData) => {
    const fullFileData = individual_files.find(f => f.filename === fileData.filename);
    setSelectedFileForCard(fullFileData);
    setRightPanelTab('analysis'); // Switch to Analysis tab when clicked
    setIsRightPanelOpen(true); // Open the right panel
    setIsBottomPanelOpen(false);

    if (fileData.startLine) {
      handleFunctionClick(fileData);
    } else {
      handleFileCodeFetch(fileData);
    }
  };

  const handleCopyCode = async () => {
    if (selectedCode?.code) {
      try {
        await navigator.clipboard.writeText(selectedCode.code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy code', err)
      }
    }
  }

  const handlePlayAnimation = async () => {
    if (isAnimating) {
      setIsAnimating(false)
      isAnimatingRef.current = false
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
      return
    }

    if (!analysisResult?.repo_url || !currentBranch) return

    setIsAnimating(true)
    isAnimatingRef.current = true
    setAnimationProgress(0)
    setAnimatingCommit(null)
    setFixedFileOrder([...individual_files])
    setActiveTab('bar')

    try {
      let commits = allCommits;
      if (commits.length === 0) {
        const resp = await axios.post('http://127.0.0.1:8000/api/repo/commits', {
          repo_url: analysisResult.repo_url,
          branch: currentBranch,
          limit: 1000,
          token: token
        })
        const fetchedCommits = resp.data.commits || []
        if (fetchedCommits.length === 0) {
          setIsAnimating(false)
          isAnimatingRef.current = false
          return
        }
        commits = [...fetchedCommits].reverse()
        setAllCommits(commits)
      }

      const runStep = async (index) => {
        if (index >= commits.length || !isAnimatingRef.current) {
          setIsAnimating(false)
          isAnimatingRef.current = false
          return
        }

        const commit = commits[index]
        setCurrentCommitIndex(index)
        setAnimatingCommit(commit)
        setAnimationProgress(Math.round((index / (commits.length - 1)) * 100))

        try {
          const checkoutResp = await axios.post('http://127.0.0.1:8000/api/repo/checkout', {
            repo_url: analysisResult.repo_url,
            branch: commit.hash,
            token: token
          })

          if (checkoutResp.data) {
            setAnalysisResult(checkoutResp.data)
          }
        } catch (err) {
          console.error(`Animation step failed at commit ${commit.hash}`, err)
        }

        animationRef.current = setTimeout(() => runStep(index + 1), animationSpeed)
      }

      await runStep(currentCommitIndex === -1 || currentCommitIndex >= commits.length - 1 ? 0 : currentCommitIndex + 1)

    } catch (err) {
      console.error('Failed to start animation', err)
      setIsAnimating(false)
      isAnimatingRef.current = false
    }
  }

  const handleStepPrev = async () => {
    if (isAnimating || currentCommitIndex <= 0) return
    if (!fixedFileOrder) setFixedFileOrder([...individual_files])
    const newIndex = currentCommitIndex - 1
    const commit = allCommits[newIndex]
    setCurrentCommitIndex(newIndex)
    setAnimatingCommit(commit)
    setAnimationProgress(Math.round((newIndex / (allCommits.length - 1)) * 100))

    try {
      const checkoutResp = await axios.post('http://127.0.0.1:8000/api/repo/checkout', {
        repo_url: analysisResult.repo_url,
        branch: commit.hash,
        token: token
      })
      if (checkoutResp.data) setAnalysisResult(checkoutResp.data)
    } catch (err) {
      console.error('Manual step failed', err)
    }
  }

  const handleStepNext = async () => {
    if (isAnimating || currentCommitIndex >= allCommits.length - 1) return
    if (!fixedFileOrder) setFixedFileOrder([...individual_files])
    const newIndex = currentCommitIndex + 1
    const commit = allCommits[newIndex]
    setCurrentCommitIndex(newIndex)
    setAnimatingCommit(commit)
    setAnimationProgress(Math.round((newIndex / (allCommits.length - 1)) * 100))

    try {
      const checkoutResp = await axios.post('http://127.0.0.1:8000/api/repo/checkout', {
        repo_url: analysisResult.repo_url,
        branch: commit.hash,
        token: token
      })
      if (checkoutResp.data) setAnalysisResult(checkoutResp.data)
    } catch (err) {
      console.error('Manual step failed', err)
    }
  }

  const handleCommitClick = async (commit) => {
    if (isAnimating) return;

    if (!fixedFileOrder) {
      setFixedFileOrder([...individual_files]);
    }

    let index = -1;
    if (allCommits.length > 0) {
      index = allCommits.findIndex(c => c.hash === commit.hash);
      if (index !== -1) {
        setCurrentCommitIndex(index);
      }
    }

    setAnimatingCommit(commit);
    setAnimationProgress(index !== -1 ? Math.round((index / (allCommits.length - 1)) * 100) : 0);

    try {
      const checkoutResp = await axios.post('http://127.0.0.1:8000/api/repo/checkout', {
        repo_url: analysisResult.repo_url,
        branch: commit.hash,
        token: token
      });

      if (checkoutResp.data) {
        setAnalysisResult(checkoutResp.data);
      }
    } catch (err) {
      console.error('Failed to visualize commit', err);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [])

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const panelBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

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

  const stopResizing = () => {
    isResizingLeft.current = false;
    isResizingRight.current = false;
    setIsDragging(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  const resize = (e) => {
    if (isResizingLeft.current) {
      const newWidth = startWidth.current + (e.clientX - startX.current);
      if (newWidth > 200 && newWidth < window.innerWidth * 0.8) setLeftPanelWidth(newWidth);
    }
    if (isResizingRight.current) {
      const newWidth = startWidth.current - (e.clientX - startX.current);
      if (newWidth > 300 && newWidth < window.innerWidth * 0.8) setRightPanelWidth(newWidth);
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, []);

  return (
    <div className={`h-screen overflow-hidden ${bgColor} ${textColor} relative`}>
      {/* Top Control Bar with Home and Theme Toggle - Modern Glassmorphism */}
      <div className={`absolute top-6 right-6 z-50 flex items-center gap-3`}>
        <button
          onClick={() => navigate('/')}
          className={`p-3 rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all ${textColor} border border-white/20 dark:border-white/10 hover:scale-110 hover:bg-white/20 dark:hover:bg-black/30`}
          title="Go to Home"
        >
          <Home size={22} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-3 rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all ${textColor} border border-white/20 dark:border-white/10 hover:scale-110 hover:bg-white/20 dark:hover:bg-black/30`}
          title="Toggle Dark/Light Mode"
        >
          {isDarkMode ? <Sun size={22} strokeWidth={2.5} /> : <Moon size={22} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Left Panel - Git Graph (Slide in/out) - Modern Design */}
      <div
        className={`absolute left-0 top-0 h-full ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl shadow-2xl ${isDragging ? 'transition-none duration-0' : 'transition-transform duration-300'} z-30 border-r ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'}`}
        style={{
          width: `${leftPanelWidth}px`,
          transform: isLeftPanelOpen ? 'translateX(0)' : `translateX(-${leftPanelWidth}px)`
        }}
      >
        <div className="h-full flex flex-col p-6 relative">
          {/* Resize Handle */}
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-50"
            onMouseDown={startResizingLeft}
          />
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-blue-800 bg-clip-text text-transparent">Git Graph</h3>
          </div>

          <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/50'} backdrop-blur-sm px-3 py-2 rounded-xl mb-4 border ${borderColor}`}>
            <button
              onClick={handleStepPrev}
              disabled={branchLoading || branches.length === 0 || isAnimating || currentCommitIndex <= 0}
              className={`p-2 rounded-lg ${isDarkMode ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700' : 'text-gray-400 hover:text-blue-600 hover:bg-white'} disabled:opacity-30 transition-all`}
              title="Previous Commit"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>

            <button
              onClick={handlePlayAnimation}
              disabled={branchLoading || branches.length === 0}
              className={`transition-all p-2 rounded-lg ${isAnimating ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
              title={isAnimating ? 'Stop Animation' : 'Play Evolution Animation'}
            >
              {isAnimating ? <Square size={18} fill="currentColor" strokeWidth={2.5} /> : <Play size={18} fill="currentColor" strokeWidth={2.5} />}
            </button>

            <button
              onClick={handleStepNext}
              disabled={branchLoading || branches.length === 0 || isAnimating || currentCommitIndex >= allCommits.length - 1}
              className={`p-2 rounded-lg ${isDarkMode ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700' : 'text-gray-400 hover:text-blue-600 hover:bg-white'} disabled:opacity-30 transition-all`}
              title="Next Commit"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Speed</span>
              <input
                type="range"
                min="200"
                max="2000"
                step="100"
                value={2200 - animationSpeed}
                onChange={(e) => setAnimationSpeed(2200 - parseInt(e.target.value))}
                className="w-20 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <select
            value={currentBranch}
            onChange={handleBranchChange}
            disabled={branchLoading || branches.length === 0}
            className={`w-full px-4 py-3 border ${borderColor} rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm mb-4 ${panelBg} font-medium transition-all hover:border-blue-400`}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Current Commit Display - Clickable to open modal */}
          {animatingCommit && (
            <button
              onClick={() => setSelectedCommitForModal(animatingCommit)}
              className={`mb-4 p-4 rounded-xl border ${borderColor} ${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600' : 'bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100'} w-full text-left transition-all shadow-lg hover:shadow-xl`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 backdrop-blur-sm">
                  <GitCommit size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-200 truncate mb-1">
                    {animatingCommit.message}
                  </p>
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                    {animatingCommit.hash?.substring(0, 12)}
                  </p>
                  {animationProgress > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        <span>Progress</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{animationProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${animationProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Click for details →</p>
                </div>
              </div>
            </button>
          )}

          {analysisResult?.repo_url && currentBranch ? (
            <div className={`flex-1 min-h-0 overflow-hidden rounded-xl ${isDarkMode ? 'bg-gray-900' : 'bg-white'} border ${borderColor} shadow-inner`}>
              <GitGraph
                repoUrl={analysisResult.repo_url}
                branch={currentBranch}
                token={token}
                activeCommitHash={animatingCommit?.hash}
                onCommitClick={handleCommitClick}
                externalCommits={allCommits && allCommits.length > 0 ? [...allCommits].reverse() : undefined}
                isDarkMode={isDarkMode}
                onCommitDoubleClick={(commit) => setSelectedCommitForModal(commit)}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm min-h-0">
              {!currentBranch ? 'Please select a branch to view commit history' : 'Loading...'}
            </div>
          )}
        </div>
      </div>

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

      {/* Right Panel - Raw Code (Slide in/out) - Modern Design */}
      <div
        className={`absolute right-0 top-0 h-full ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl shadow-2xl ${isDragging ? 'transition-none duration-0' : 'transition-transform duration-300'} z-30 border-l ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'}`}
        style={{
          width: `${rightPanelWidth}px`,
          transform: isRightPanelOpen ? 'translateX(0)' : `translateX(${rightPanelWidth}px)`
        }}
      >
        <div className="h-full flex flex-col p-6 relative">
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-50"
            onMouseDown={startResizingRight}
          />
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent">Raw Code</h3>
          </div>

          {/* Code Display Options */}
          {selectedCode && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/50'} backdrop-blur-sm rounded-xl p-1.5 border ${borderColor}`}>
                <button
                  onClick={() => setCodeDisplayMode('plain')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${codeDisplayMode === 'plain'
                    ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg'
                    : `${textColor} hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white`
                    }`}
                  title="Plain text"
                >
                  <FileText size={14} strokeWidth={2.5} />
                  Plain
                </button>
                <button
                  onClick={() => setCodeDisplayMode('highlighted')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${codeDisplayMode === 'highlighted'
                    ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg'
                    : `${textColor} hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white`
                    }`}
                  title="Syntax highlighted"
                >
                  <Code size={14} strokeWidth={2.5} />
                  Highlighted
                </button>
              </div>

              <button
                onClick={() => setShowLineNumbers(!showLineNumbers)}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border ${showLineNumbers
                  ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white border-transparent shadow-lg'
                  : `${panelBg} ${textColor} ${borderColor} hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white`
                  }`}
                title="Toggle line numbers"
              >
                <Hash size={14} strokeWidth={2.5} />
                Lines
              </button>



              <button
                onClick={handleCopyCode}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${panelBg} ${textColor} border ${borderColor} hover:bg-gray-200 hover:text-white dark:hover:bg-gray-700 transition-all shadow-sm`}
                title="Copy code"
              >
                {copied ? <Check size={14} strokeWidth={2.5} className="text-green-600" /> : <Copy size={14} strokeWidth={2.5} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl p-5 flex-1 overflow-auto border ${borderColor} shadow-inner`}>
            {codeLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-sm">Loading function code...</p>
              </div>
            ) : selectedCode ? (
              <div className="h-full flex flex-col">
                <div className={`mb-4 pb-3 border-b ${borderColor}`}>
                  <h4 className={`font-bold text-base ${textColor}`}>
                    {selectedCode.functionName}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    {selectedCode.filename} (Lines {selectedCode.startLine}
                    {selectedCode.endLine ? `-${selectedCode.endLine}` : ''})
                  </p>
                </div>
                <div className="flex-1 overflow-auto relative">
                  {codeDisplayMode === 'highlighted' ? (
                    <div className="relative">
                      {showLineNumbers && (
                        <div
                          className="absolute left-0 top-0 bottom-0 text-gray-500 select-none pr-4 border-r border-gray-700"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            lineHeight: '1.5',
                            paddingTop: '1rem',
                            paddingBottom: '1rem',
                            backgroundColor: '#1e1e1e',
                            paddingLeft: '1rem',
                            paddingRight: '0.75rem'
                          }}
                        >
                          {selectedCode.code.split('\n').map((_, idx) => (
                            <div key={idx} style={{ textAlign: 'right' }}>
                              {selectedCode.startLine + idx}
                            </div>
                          ))}
                        </div>
                      )}
                      <pre
                        className="text-xs font-mono whitespace-pre inline-block min-w-full w-fit"
                        style={{
                          backgroundColor: '#1e1e1e',
                          color: '#d4d4d4',
                          padding: '1rem',
                          paddingLeft: showLineNumbers ? '4rem' : '1rem',
                          borderRadius: '0.75rem',
                          lineHeight: '1.5',
                          margin: 0,
                          display: 'block'
                        }}
                      >
                        <code style={{ color: '#d4d4d4' }}>
                          {selectedCode.code.split('\n').map((line, idx) => {
                            const highlighted = line
                              .replace(/(['"`])(?:(?=(\\?))\2.)*?\1/g, '<span style="color: #ce9178">$&</span>')
                              .replace(/\b(async|await|function|const|let|var|if|else|for|while|return|class|import|export|from|def|try|except|finally|with|as)\b/g, '<span style="color: #569cd6">$&</span>')
                              .replace(/\b(\d+\.?\d*)\b/g, '<span style="color: #b5cea8">$&</span>')
                              .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span style="color: #6a9955">$&</span>')
                            return (
                              <div key={idx} dangerouslySetInnerHTML={{ __html: highlighted || ' ' }} />
                            )
                          })}
                        </code>
                      </pre>
                    </div>
                  ) : (
                    <div className="relative">
                      {showLineNumbers && (
                        <div
                          className={`absolute left-0 top-0 bottom-0 text-gray-400 select-none pr-4 border-r ${borderColor}`}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            lineHeight: '1.5',
                            paddingTop: '1rem',
                            paddingBottom: '1rem',
                            backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                            paddingLeft: '1rem',
                            paddingRight: '0.75rem'
                          }}
                        >
                          {selectedCode.code.split('\n').map((_, idx) => (
                            <div key={idx} style={{ textAlign: 'right' }}>
                              {selectedCode.startLine + idx}
                            </div>
                          ))}
                        </div>
                      )}
                      <pre
                        className={`text-xs font-mono ${textColor} whitespace-pre inline-block min-w-full w-fit`}
                        style={{
                          paddingLeft: showLineNumbers ? '4rem' : '0',
                          paddingTop: '1rem',
                          paddingBottom: '1rem',
                          paddingRight: '1rem',
                          margin: 0
                        }}
                      >
                        <code>{selectedCode.code}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Click on a function block in the visualization to view its code...</p>
            )}
          </div>
        </div>
      </div>

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

      {/* Top Panel - Visualization Type Selector (Slide in/out) - Modern Design */}
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
              { key: 'block', label: 'Blocks' },
              { key: 'tree', label: 'Tree' },
              { key: 'treemap', label: 'Treemap' },
              { key: 'flower', label: 'Flower' },
              { key: 'city', label: 'City 3D' },
              { key: 'galaxy', label: 'Galaxy' },
              { key: 'island3D', label: 'Island 3D' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === key
                  ? 'bg-gradient-to-r from-blue-400 to-blue-700 text-white backdrop-blur-xl shadow-2xl scale-110'
                  : `${isDarkMode ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700' : 'bg-gray-100/50 text-gray-700 hover:bg-gray-200'} border ${borderColor}`
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Panel Toggle Button */}
      <button
        onClick={() => setIsTopPanelOpen(!isTopPanelOpen)}
        className={`absolute left-1/2 -translate-x-1/2 top-0 bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl rounded-b-2xl px-6 py-3 z-40 transition-all hover:bg-white/20 dark:hover:bg-black/30 border border-white/20 dark:border-white/10 border-t-0 text-sm font-bold uppercase tracking-wider ${textColor}`}
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
                  // Ensure we have the full file data
                  const fullFileData = individual_files?.find(f => f.filename === selectedFileForCard.filename) || selectedFileForCard;
                  const totalNloc = fullFileData.functions?.reduce((sum, fn) => sum + (fn.nloc || 0), 0) || 0;

                  return (
                    <div className={`${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-700' : 'bg-gradient-to-br from-white to-blue-50'} rounded-2xl p-6 border-l-4 border-l-blue-500 shadow-2xl`}>
                      <div className="mb-6">
                        <h3 className="text-xs font-bold text-blue-500 opacity-70 uppercase tracking-wider mb-2">Selected File</h3>
                        <h4 className="text-base font-black break-all leading-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {fullFileData.filename}
                        </h4>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Total LOC</span>
                          <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {fullFileData.loc || fullFileData.total_loc || totalNloc || "—"}
                          </span>
                        </div>
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Logical LOC</span>
                          <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {fullFileData.nloc || fullFileData.total_nloc || totalNloc || "—"}
                          </span>
                        </div>
                        <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Max Complexity</span>
                          <span className="text-xl font-black bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">{fullFileData.total_complexity || "—"}</span>
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
                                nloc: fn.nloc
                              })}
                              className={`${isDarkMode ? 'bg-gray-800/70 hover:bg-gray-700' : 'bg-white/70 hover:bg-blue-50'} backdrop-blur-sm rounded-xl p-3 text-left transition-all border ${borderColor} shadow-md hover:shadow-lg hover:border-blue-400 group`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="font-bold text-sm truncate group-hover:text-blue-500 transition-colors">{fn.name}</span>
                                  <span className="text-xs opacity-60 font-medium">Lines: {fn.nloc}</span>
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
          {/* Commit Info - Floating Badge */}
          {isAnimating && animatingCommit && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 rounded-full shadow-2xl border border-white/20 backdrop-blur-md animate-pulse">
                <GitCommit size={18} className="text-white" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">
                    {animatingCommit.message}
                  </span>
                  <span className="text-xs font-mono text-blue-100">
                    {animatingCommit.hash.substring(0, 7)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Visualization Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'bar' && individual_files?.length > 0 && (
              <BarChartVisualization
                individualFiles={individual_files}
                onFunctionClick={handleFunctionClick}
                onFileClick={handleFileClickFrom3D}
                fixedFileOrder={fixedFileOrder}
              />
            )}
            {activeTab === 'block' && individual_files?.length > 0 && (
              <CirclePackingVisualization individualFiles={individual_files} folderName={folderName} />
            )}
            {activeTab === 'tree' && individual_files?.length > 0 && (
              <ForceTreeVisualization individualFiles={individual_files} folderName={folderName} />
            )}
            {activeTab === 'treemap' && individual_files?.length > 0 && (
              <TreemapVisualization individualFiles={individual_files} folderName={folderName} />
            )}
            {activeTab === 'flower' && individual_files?.length > 0 && (
              <RadarChartVisualization individualFiles={individual_files} />
            )}
            {activeTab === 'city' && individual_files?.length > 0 && (
              <CodeCity3DVisualization
                individualFiles={individual_files}
                onFunctionClick={handleFunctionClick}
                onFileClick={handleFileClickFrom3D}
              />
            )}
            {activeTab === 'galaxy' && individual_files?.length > 0 && (
              <CodeGalaxySolarSystem
                individualFiles={individual_files}
                onFunctionClick={handleFunctionClick}
                onFileClick={handleFileClickFrom3D}
              />
            )}
            {activeTab === 'island3D' && individual_files?.length > 0 && (
              <Island3DVisualization
                individualFiles={individual_files}
                onFunctionClick={handleFunctionClick}
                onFileClick={handleFileClickFrom3D}
                isDarkMode={isDarkMode}
              />
            )}
            {(!individual_files?.length || individual_files.length === 0) && (
              <div className="flex items-center justify-center h-full text-gray-400">
                No files to visualize
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Commit Detail Modal */}
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