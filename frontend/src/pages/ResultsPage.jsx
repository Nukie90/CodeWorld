import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, HelpCircle, Upload, Expand, Play, Square, GitCommit, GripVertical, Copy, Check, Code, FileText, Hash } from 'lucide-react';
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

function ResultsPage() {
  const { state } = useLocation()
  const { analysisResult: initialAnalysisResult, token } = state || {}

  // Convert analysisResult to state so it can be updated when branch changes
  const [analysisResult, setAnalysisResult] = useState(initialAnalysisResult)

  const [activeTab, setActiveTab] = useState('bar');
  // Make center visualization wider by default
  const [graphWidth, setGraphWidth] = useState(12); // ~1.5/12
  const [visualizationWidth, setVisualizationWidth] = useState(70); // larger center panel
  const [isDragging, setIsDragging] = useState(null);
  const containerRef = useRef(null);

  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState("")
  const [branchLoading, setBranchLoading] = useState(false)
  const [selectedCode, setSelectedCode] = useState(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeDisplayMode, setCodeDisplayMode] = useState('plain') // 'plain', 'highlighted'
  const [showLineNumbers, setShowLineNumbers] = useState(false)
  const [wordWrap, setWordWrap] = useState(true)
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
    // fetch branches when this is a repo analysis
    async function fetchBranches() {
      if (!analysisResult?.repo_url) return
      try {
        const resp = await axios.get('http://127.0.0.1:8000/api/repo/branches', { params: { repo_url: analysisResult.repo_url, token } })
        const data = resp.data || {}
        const local = data.local || []
        const remote = data.remote || []
        const current = data.current || ''
        // merge lists: prefer local branch names, but include remotes
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


  // Derive values from analysisResult state (will update when branch changes)
  const folderMetrics = analysisResult?.analysis?.folder_metrics || {}
  const folderName = folderMetrics?.folder_name?.split('.git')[0] || ''
  const individual_files = analysisResult?.analysis?.individual_files || []

  const folderSummary = {
    'Total files': folderMetrics?.total_files,
    'Total lines': folderMetrics?.total_loc,
    'Logical LOC': folderMetrics?.total_nloc,
    'Total function': folderMetrics?.total_functions,
    'Avg. complexity': folderMetrics?.complexity_avg,
    'Max complexity': folderMetrics?.complexity_max
  };

  const handleMouseDown = (divider) => {
    setIsDragging(divider);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;
    const percentage = (mouseX / containerWidth) * 100;

    if (isDragging === 'first') {
      // Dragging between Graph and Visualization
      const newGraphWidth = Math.max(10, Math.min(40, percentage));
      const newVisualizationWidth = Math.max(30, Math.min(70, 100 - newGraphWidth - (100 - graphWidth - visualizationWidth)));
      setGraphWidth(newGraphWidth);
      setVisualizationWidth(newVisualizationWidth);
    } else if (isDragging === 'second') {
      // Dragging between Visualization and Raw code
      const newVisualizationWidth = Math.max(30, Math.min(70, percentage - graphWidth));
      setVisualizationWidth(newVisualizationWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const handleBranchChange = async (evt) => {
    const branch = evt.target.value
    if (!branch || !analysisResult?.repo_url) return
    setBranchLoading(true)
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/checkout', { repo_url: analysisResult.repo_url, branch, token })
      // server returns a new analysis payload
      if (resp.data) {
        setAnalysisResult(resp.data)
        setCurrentBranch(branch)
      }
    } catch (err) {
      console.error('Checkout failed', err)
      // keep UI responsive
    } finally {
      setBranchLoading(false)
    }
  }

  const handleFunctionClick = async (functionData) => {
    if (!analysisResult?.repo_url) return

    setCodeLoading(true)
    setSelectedCode(null)

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
    if (isAnimating) return; // Don't allow clicking during animation

    // Ensure we have a stable layout baseline
    if (!fixedFileOrder) {
      setFixedFileOrder([...individual_files]);
    }

    // Find index in allCommits if available
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [])


  return (
    <div
      className="min-h-screen bg-slate-100"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header - Full-width */}
      <header className="bg-blue-300 text-black py-4 shadow-sm">
        <div className="w-full mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold hover:opacity-90 transition-opacity">
            CodeWorld
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-sm"
          >
            <Upload size={16} />
            Analyze Code
          </Link>
        </div>
      </header>

      {/* Main Content - Full-width */}
      <main className="w-full mx-auto px-6 py-8">
        {/* Title Section - Outside blocks */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Github Analysis Result</h1>
          <p className="text-gray-600">Metrics for <span className="font-semibold">{folderName}</span></p>
        </div>

        {/* Main Layout with Resizable Panels */}
        <div ref={containerRef} className="flex gap-0 mb-6 relative" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          {/* Left Panel - Graph */}
          <div style={{ width: `${graphWidth}%` }} className="pr-3">
            <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                <h3 className="text-lg font-semibold whitespace-nowrap">Git Graph</h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                    <button
                      onClick={handleStepPrev}
                      disabled={branchLoading || branches.length === 0 || isAnimating || currentCommitIndex <= 0}
                      className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
                      title="Previous Commit"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <button
                      onClick={handlePlayAnimation}
                      disabled={branchLoading || branches.length === 0}
                      className={`transition-colors p-1 ${isAnimating ? 'text-red-500 hover:text-red-600' : 'text-blue-500 hover:text-blue-600'}`}
                      title={isAnimating ? 'Stop Animation' : 'Play Evolution Animation'}
                    >
                      {isAnimating ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>

                    <button
                      onClick={handleStepNext}
                      disabled={branchLoading || branches.length === 0 || isAnimating || currentCommitIndex >= allCommits.length - 1}
                      className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
                      title="Next Commit"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Speed Controller */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Speed</span>
                    <input
                      type="range"
                      min="200"
                      max="2000"
                      step="100"
                      value={2200 - animationSpeed}
                      onChange={(e) => setAnimationSpeed(2200 - parseInt(e.target.value))}
                      className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>
              </div>
              <select
                value={currentBranch}
                onChange={handleBranchChange}
                disabled={branchLoading || branches.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm mb-4 flex-shrink-0"
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {analysisResult?.repo_url && currentBranch ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <GitGraph
                    repoUrl={analysisResult.repo_url}
                    branch={currentBranch}
                    token={token}
                    activeCommitHash={animatingCommit?.hash}
                    onCommitClick={handleCommitClick}
                    externalCommits={allCommits && allCommits.length > 0 ? [...allCommits].reverse() : undefined}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm min-h-0">
                  {!currentBranch ? 'Please select a branch to view commit history' : 'Loading...'}
                </div>
              )}
            </div>
          </div>

          {/* First Divider */}
          <div
            className="flex items-center justify-center cursor-col-resize hover:bg-blue-100 transition-colors group relative z-10"
            style={{ width: '12px', flexShrink: 0 }}
            onMouseDown={() => handleMouseDown('first')}
          >
            <div className="h-full w-1 bg-gray-200 group-hover:bg-blue-400 transition-colors"></div>
            <GripVertical size={16} className="absolute text-gray-400 group-hover:text-blue-600" />
          </div>

          {/* Center Panel - Visualization + Summary */}
          <div style={{ width: `${visualizationWidth}%` }} className="px-3">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold">Visualization</h3>
                <HelpCircle size={16} className="text-gray-400" />
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-6 mb-6 border-b border-gray-200 justify-between items-center">
                <div className="flex gap-6">
                  {['bar', 'block', 'tree', 'treemap', 'flower', 'city', 'island', 'galaxy'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-3 px-1 font-medium transition-colors capitalize text-sm ${activeTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      {tab === 'bar' ? 'Bar' : tab === 'block' ? 'Block' : tab === 'flower' ? 'Flower' : tab === 'city' ? 'City 3D' : tab === 'island' ? 'Island 3D' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {isAnimating && animatingCommit && (
                  <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded border border-blue-100 mb-2 animate-pulse min-w-0">
                    <GitCommit size={14} className="text-blue-600 flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-semibold text-blue-900 truncate max-w-[150px]">
                        {animatingCommit.message}
                      </span>
                      <span className="text-[8px] font-mono text-blue-500">
                        {animatingCommit.hash.substring(0, 7)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Visualization Content */}
              <div className={`h-[55vh] ${activeTab === 'city' || activeTab === 'island' ? 'overflow-hidden' : 'overflow-auto'}`}>
                {activeTab === 'bar' && individual_files?.length > 0 && (
                  <BarChartVisualization
                    individualFiles={individual_files}
                    onFunctionClick={handleFunctionClick}
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
                  />
                )}
                {activeTab === 'island' && individual_files?.length > 0 && (
                  <Island3DVisualization
                    individualFiles={individual_files}
                    onFunctionClick={handleFunctionClick}
                  />
                )}
                {activeTab === 'galaxy' && individual_files?.length > 0 && (
                  <CodeGalaxySolarSystem
                    individualFiles={individual_files}
                    onFunctionClick={handleFunctionClick}
                  />
                )}
                {(!individual_files?.length || individual_files.length === 0) && (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No files to visualize
                  </div>
                )}
              </div>
            </div>

            {/* Folder Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-xl font-semibold">Folder summary</h3>
                <HelpCircle size={16} className="text-gray-400" />
              </div>

              {/* Two-column grid with vertical divider */}
              <div className="grid grid-cols-2 gap-x-16 gap-y-4 relative">
                {/* vertical divider */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2"></div>

                {Object.entries(folderSummary).map(([key, value], index) => (
                  <div
                    key={key}
                    className={`flex justify-between items-center pb-3 ${index % 2 === 0 ? 'pr-8' : 'pl-8'
                      }`}
                  >
                    <span className="text-gray-700 text-sm font-medium">{key}</span>
                    <span className="text-gray-900 font-bold text-lg">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Second Divider */}
          <div
            className="flex items-center justify-center cursor-col-resize hover:bg-blue-100 transition-colors group relative z-10"
            style={{ width: '12px', flexShrink: 0 }}
            onMouseDown={() => handleMouseDown('second')}
          >
            <div className="h-full w-1 bg-gray-200 group-hover:bg-blue-400 transition-colors"></div>
            <GripVertical size={16} className="absolute text-gray-400 group-hover:text-blue-600" />
          </div>

          {/* Right Panel - Raw Code */}
          <div style={{ width: `${100 - graphWidth - visualizationWidth}%` }} className="pl-3">
            <div className="bg-gray-100 rounded-lg shadow p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Raw code</h3>
                <button className="text-gray-400 hover:text-gray-600">
                  <Expand size={20} />
                </button>
              </div>

              {/* Code Display Options */}
              {selectedCode && (
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                    <button
                      onClick={() => setCodeDisplayMode('plain')}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${codeDisplayMode === 'plain'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      title="Plain text"
                    >
                      <FileText size={14} />
                      Plain
                    </button>
                    <button
                      onClick={() => setCodeDisplayMode('highlighted')}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${codeDisplayMode === 'highlighted'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      title="Syntax highlighted"
                    >
                      <Code size={14} />
                      Highlighted
                    </button>
                  </div>

                  <button
                    onClick={() => setShowLineNumbers(!showLineNumbers)}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors border ${showLineNumbers
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    title="Toggle line numbers"
                  >
                    <Hash size={14} />
                    Lines
                  </button>

                  <button
                    onClick={handleCopyCode}
                    className="px-2 py-1 rounded text-xs flex items-center gap-1 bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              <div className="bg-white rounded-lg p-0 flex-1 overflow-auto border border-gray-200 relative">
                {codeLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400 text-sm">Loading function code...</p>
                  </div>
                ) : selectedCode ? (
                  <div className="h-full flex flex-col">
                    <div className="p-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {selectedCode.functionName}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedCode.filename} (Lines {selectedCode.startLine}
                        {selectedCode.endLine ? `-${selectedCode.endLine}` : ''})
                      </p>
                    </div>

                    <div className={`flex-1 overflow-auto flex ${codeDisplayMode === 'highlighted' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                      {/* Line Numbers Column */}
                      {showLineNumbers && (
                        <div
                          className={`flex-shrink-0 select-none text-right py-4 px-3 border-r ${codeDisplayMode === 'highlighted'
                            ? 'bg-[#1e1e1e] text-gray-500 border-gray-700'
                            : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}
                          style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5' }}
                        >
                          {selectedCode.code.replace(/\n$/, '').split('\n').map((_, idx) => (
                            <div key={idx}>{selectedCode.startLine + idx}</div>
                          ))}
                        </div>
                      )}

                      {/* Code Content Column */}
                      <div className="flex-1 py-4 px-4 min-w-0">
                        <pre
                          className="font-mono text-xs whitespace-pre"
                          style={{
                            lineHeight: '1.5',
                            fontSize: '12px',
                            margin: 0,
                            color: codeDisplayMode === 'highlighted' ? '#d4d4d4' : '#1f2937'
                          }}
                        >
                          {codeDisplayMode === 'highlighted' ? (
                            <code style={{ color: '#d4d4d4' }}>
                              {selectedCode.code.replace(/\n$/, '').split('\n').map((line, idx) => {
                                // Simple syntax highlighting for common patterns
                                const highlighted = line
                                  .replace(/(['"`])(?:(?=(\\?))\2.)*?\1/g, '<span style="color: #ce9178">$&</span>')
                                  .replace(/\b(async|await|function|const|let|var|if|else|for|while|return|class|import|export|from|def|try|except|finally|with|as)\b/g, '<span style="color: #569cd6">$&</span>')
                                  .replace(/\b(\d+\.?\d*)\b/g, '<span style="color: #b5cea8">$&</span>')
                                  .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span style="color: #6a9955">$&</span>')
                                return (
                                  <div key={idx} dangerouslySetInnerHTML={{ __html: highlighted || ' ' }} className="h-[18px]" />
                                )
                              })}
                            </code>
                          ) : (
                            <code>
                              {selectedCode.code.replace(/\n$/, '').split('\n').map((line, idx) => (
                                <div key={idx} className="h-[18px]">{line || ' '}</div>
                              ))}
                            </code>
                          )}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full p-4">
                    <p className="text-gray-400 text-sm text-center">Click on a function block in the visualization to view its code...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Down Panel - Individaul files */}
        </div>
      </main>
    </div>
  );
}

export default ResultsPage;