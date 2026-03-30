import { useState } from 'react';
import { ChevronLeft, ChevronRight, GitCommit, Play, Square, Minimize2, Maximize2 } from 'lucide-react';
import GitGraph from '../git_graph/GitGraph';

function ResultsSidebar({
    isDarkMode,
    isLeftPanelOpen,
    leftPanelWidth,
    isDragging,
    startResizingLeft,
    currentBranch,
    branches,
    branchLoading,
    handleBranchChange,
    topNComplexity,
    isCustomMode,
    setTopNComplexity,
    setIsCustomMode,
    selectedDirectory,
    setSelectedDirectory,
    availableDirectories,
    filteredFiles,
    individual_files,
    handleStepPrev,
    handleStepNext,
    handlePlayAnimation,
    isAnimating,
    animationSpeed,
    setAnimationSpeed,
    handlePlayFromDate,
    showContributors,
    setShowContributors,
    animatingCommit,
    setSelectedCommitForModal,
    animationProgress,
    analysisResult,
    token,
    handleCommitClick,
    allCommits,
    currentCommitIndex
}) {
    const [isMinimized, setIsMinimized] = useState(false);
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const panelBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

    return (
        <div
            className={`absolute left-0 top-0 h-full ${isDarkMode ? 'bg-gray-900/20' : 'bg-white/60'} backdrop-blur-xl shadow-2xl ${isDragging ? 'transition-none duration-0' : 'transition-transform duration-300'} z-30 border-r ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}
            style={{
                width: `${leftPanelWidth}px`,
                transform: isLeftPanelOpen ? 'translateX(0)' : `translateX(-${leftPanelWidth}px)`
            }}
        >
            <div className="h-full flex flex-col p-6 relative">
                <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-50"
                    onMouseDown={startResizingLeft}
                />
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-blue-800 bg-clip-text text-transparent">Git Graph</h3>
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

                <div className={`grid grid-cols-2 gap-2 mb-4 p-3 rounded-xl border ${borderColor} ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-50/50'} backdrop-blur-sm`}>
                    <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Top Complexity:</span>
                        <div className="flex gap-1">
                            <select
                                value={isCustomMode ? 'Custom' : topNComplexity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'Custom') {
                                        setIsCustomMode(true);
                                        if (topNComplexity === 'All') setTopNComplexity('500');
                                    } else {
                                        setIsCustomMode(false);
                                        setTopNComplexity(val);
                                    }
                                }}
                                className={`flex-1 px-2 py-1.5 border ${borderColor} rounded-lg text-xs ${panelBg} focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium`}
                            >
                                {['20', '50', '100', '250', '500', '1000', 'All'].map(val => (
                                    <option key={val} value={val}>{val === 'All' ? 'All Files' : `Top ${val}`}</option>
                                ))}
                                <option value="Custom">Custom...</option>
                            </select>
                            {isCustomMode && (
                                <input
                                    type="number"
                                    value={topNComplexity}
                                    onChange={(e) => setTopNComplexity(e.target.value)}
                                    className={`w-16 px-2 py-1.5 border ${borderColor} rounded-lg text-xs ${panelBg} focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-bold text-blue-500`}
                                    title="Enter custom number of files"
                                    min="1"
                                />
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Directory:</span>
                        <select
                            value={selectedDirectory}
                            onChange={(e) => setSelectedDirectory(e.target.value)}
                            className={`w-full px-2 py-1.5 border ${borderColor} rounded-lg text-xs ${panelBg} focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all`}
                        >
                            {availableDirectories.map(dir => (
                                <option key={dir} value={dir}>{dir === 'All' ? 'Root (All)' : dir}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4 px-3">
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Showing <span className="text-blue-500">{filteredFiles.length}</span> of <span className={textColor}>{individual_files.length}</span> files
                    </span>
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
                        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${animationSpeed === 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                            Speed {animationSpeed === 0 && '(MAX)'}
                        </span>
                        <input
                            type="range"
                            min="200"
                            max="2200"
                            step="100"
                            value={2200 - animationSpeed}
                            onChange={(e) => setAnimationSpeed(2200 - parseInt(e.target.value))}
                            className="w-20 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1 mb-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Start Timeline From:
                    </span>
                    <select
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'all') {
                                handlePlayFromDate('all');
                            } else {
                                handlePlayFromDate(parseInt(val));
                            }
                            e.target.value = "";
                        }}
                        defaultValue=""
                        disabled={branchLoading || branches.length === 0}
                        className={`w-full px-3 py-1.5 border ${borderColor} rounded-lg text-xs ${panelBg} focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium`}
                    >
                        <option value="" disabled>Select Starting Point...</option>
                        <option value="0">Today</option>
                        <option value="1">Yesterday</option>
                        <option value="7">1 week ago</option>
                        <option value="14">2 weeks ago</option>
                        <option value="30">1 month ago</option>
                        <option value="60">2 months ago</option>
                        <option value="180">6 months ago</option>
                        <option value="365">1 year ago</option>
                        <option value="730">2 years ago</option>
                        <option value="all">All</option>
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 border border-white/20 dark:border-gray-700 rounded-xl bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm shadow-sm hover:border-blue-400/50 transition-all">
                    <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Display Contributors</span>
                        <button
                            onClick={() => setShowContributors(!showContributors)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showContributors
                                ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                : (isDarkMode ? 'bg-gray-700' : 'bg-gray-300')
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showContributors ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {animatingCommit && (
                    <div className="relative group/card">
                        <button
                            onClick={() => setSelectedCommitForModal(animatingCommit)}
                            className={`mb-4 p-4 rounded-xl border ${borderColor} ${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600' : 'bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100'} w-full text-left transition-all shadow-lg hover:shadow-xl relative overflow-hidden`}
                        >
                            <div className={`flex items-start gap-3 ${isMinimized ? 'items-center' : ''}`}>
                                <div className={`p-2 rounded-lg bg-blue-500/20 backdrop-blur-sm transition-all ${isMinimized ? 'p-1.5' : ''}`}>
                                    <GitCommit size={isMinimized ? 14 : 18} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={`font-bold text-blue-900 dark:text-blue-200 truncate ${isMinimized ? 'text-xs' : 'text-sm mb-1'}`}>
                                            {isMinimized ? `Animating: ${animatingCommit.message}` : animatingCommit.message}
                                        </p>
                                    </div>
                                    {!isMinimized && (
                                        <>
                                            {animationProgress > 0 && (
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                                        <span>Commit {currentCommitIndex + 1} of {allCommits?.length || 0}</span>
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
                                        </>
                                    )}
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMinimized(!isMinimized);
                            }}
                            className={`absolute right-2 top-2 p-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 transition-all z-10 opacity-0 group-hover/card:opacity-100 shadow-sm border ${borderColor}`}
                            title={isMinimized ? "Expand" : "Minimize"}
                        >
                            {isMinimized ? <Maximize2 size={12} className="text-gray-500" /> : <Minimize2 size={12} className="text-gray-500" />}
                        </button>
                    </div>
                )}

                {analysisResult?.repo_url && currentBranch ? (
                    <div className={`flex-1 min-h-0 overflow-hidden rounded-xl ${isDarkMode ? 'bg-black/0' : 'bg-white/0'} backdrop-blur-md border ${isDarkMode ? 'border-white/0' : 'border-black/0'} shadow-inner`}>
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
    );
}

export default ResultsSidebar;
