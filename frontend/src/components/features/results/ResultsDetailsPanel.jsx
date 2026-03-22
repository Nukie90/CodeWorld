// Side/Bottom Panels: Code Viewer & Metrics Tables
import { Code, FileText, Hash, Sparkles, Check, Copy, FileText as FileTextIcon, ChevronDown, ChevronUp, AlertTriangle, Info, CheckCircle } from 'lucide-react';

function ResultsDetailsPanel({
    isDarkMode,
    isRightPanelOpen,
    setIsRightPanelOpen,
    rightPanelWidth,
    isDragging,
    startResizingRight,
    selectedCode,
    codeDisplayMode,
    setCodeDisplayMode,
    showLineNumbers,
    setShowLineNumbers,
    handleCopyCode,
    copied,
    codeLoading,
    selectedFileForCard,
    rightPanelTab,
    setRightPanelTab,
    folderSummary,
    individual_files,
    handleFunctionClick,
    isBottomPanelOpen,
    setIsBottomPanelOpen,
    setIsLeftPanelOpen,
    lintResults,
    isLinting,
    handleLintFile
}) {
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const panelBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

    return (
        <>
            {/* Right Panel - Raw Code */}
            <div
                className={`absolute right-0 top-0 h-full ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl shadow-2xl ${isDragging ? 'transition-none duration-0' : 'transition-transform duration-300'} z-30 border-l ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'}`}
                style={{
                    width: `${rightPanelWidth}px`,
                    transform: isRightPanelOpen ? 'translateX(0)' : `translateX(${rightPanelWidth}px)`
                }}
            >
                <div className="h-full flex flex-col p-6 relative">
                    <div
                        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-50"
                        onMouseDown={startResizingRight}
                    />
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent">Raw Code</h3>
                    </div>

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
                                <button
                                    onClick={() => setCodeDisplayMode('aiSuggest')}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${codeDisplayMode === 'aiSuggest'
                                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                                        : `${textColor} hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white`
                                        }`}
                                    title="AI Suggestions"
                                >
                                    <Sparkles size={14} strokeWidth={2.5} />
                                    AI Suggest
                                </button>
                                <button
                                    onClick={() => {
                                        setCodeDisplayMode('linterSuggest');
                                        handleLintFile(selectedCode.filename);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${codeDisplayMode === 'linterSuggest'
                                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg'
                                        : `${textColor} hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white`
                                        }`}
                                    title="Linter Suggestions"
                                >
                                    <AlertTriangle size={14} strokeWidth={2.5} />
                                    Linter Suggest
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

                    <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl ${codeDisplayMode === 'aiSuggest' || codeDisplayMode === 'linterSuggest' ? 'p-0' : 'p-5'} flex-1 overflow-auto border ${borderColor} shadow-inner`}>
                        {codeLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-400 text-sm">Loading function code...</p>
                            </div>
                        ) : selectedCode ? (
                            <div className="h-full flex flex-col">
                                {codeDisplayMode !== 'aiSuggest' && (
                                    <div className={`mb-4 pb-3 border-b ${borderColor}`}>
                                        <h4 className={`font-bold text-base ${textColor}`}>
                                            {selectedCode.functionName}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                                            {selectedCode.filename} (Lines {selectedCode.startLine}
                                            {selectedCode.endLine ? `-${selectedCode.endLine}` : ''})
                                        </p>
                                    </div>
                                )}
                                {codeDisplayMode === 'aiSuggest' && (
                                    <h4 className={`text-base font-semibold px-4 pt-4 ${isDarkMode ? 'text-indigo-200' : 'text-indigo-900/80'}`}>
                                        Let's spice up that code a bit!
                                    </h4>
                                )}
                                {codeDisplayMode === 'linterSuggest' && (
                                    <div className="flex items-center justify-between px-6 pt-6 mb-2">
                                        <h4 className={`text-xl font-black bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent`}>
                                            Linter Insights
                                        </h4>
                                        {lintResults?.lint_score != null && (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                                <span className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">Lint Score</span>
                                                <span className="text-lg font-black text-emerald-500">{(lintResults.lint_score).toFixed(1)}/10</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex-1 overflow-auto relative">
                                    {codeDisplayMode === 'aiSuggest' ? (
                                        <div className={`h-full flex flex-col overflow-y-auto rounded-xl p-4`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                            <div className="space-y-4">
                                                <div className={`p-5 rounded-[2rem] shadow-sm transform transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
                                                    <span className={`text-xs font-medium mb-1.5 block opacity-50 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        Create a modular structure
                                                    </span>
                                                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        By extracting the core validation logic into a dedicated helper, you can whisk the complexity away and leave a clean, readable entry point...
                                                    </p>
                                                </div>
                                                <div className={`p-5 rounded-[2rem] shadow-sm transform transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
                                                    <span className={`text-xs font-medium mb-1.5 block opacity-50 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        Simplify logic flow
                                                    </span>
                                                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        Skillful use of guard clauses has the magical power to flatten nested conditionals and transport the next developer to a land of clarity...
                                                    </p>
                                                </div>
                                                <div className={`p-5 rounded-[2rem] shadow-sm transform transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
                                                    <span className={`text-xs font-medium mb-1.5 block opacity-50 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        Improve readability
                                                    </span>
                                                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        Through the art of descriptive naming, you can mesmerize your team, taking them on a journey through the logic without a single comment...
                                                    </p>
                                                </div>
                                                <div className={`p-5 rounded-[2rem] shadow-sm flex items-start gap-4 ${isDarkMode ? 'bg-gray-800/60 border border-gray-700' : 'bg-white'}`}>
                                                    <div className="flex-1">
                                                        <span className={`text-xs font-medium mb-1.5 block opacity-50 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            Original: {selectedCode.functionName}
                                                        </span>
                                                        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                            The current implementation of "{selectedCode.functionName}" has high cyclomatic complexity and could benefit from some of the optimizations suggested above...
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : codeDisplayMode === 'linterSuggest' ? (
                                        <div className={`h-full flex flex-col overflow-y-auto rounded-xl p-4`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                            {isLinting ? (
                                                <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                                                    <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                                                    <p className="text-sm font-bold text-gray-500 animate-pulse uppercase tracking-widest">Running Linter...</p>
                                                </div>
                                            ) : lintResults ? (
                                                <div className="space-y-4">
                                                    {lintResults.lint_errors.length === 0 ? (
                                                        <div className={`p-8 rounded-[2rem] flex flex-col items-center justify-center text-center gap-4 ${isDarkMode ? 'bg-gray-800/40' : 'bg-emerald-50/30'}`}>
                                                            <CheckCircle size={48} className="text-emerald-500" />
                                                            <div>
                                                                <h5 className="font-black text-lg text-emerald-500">Pristine Code!</h5>
                                                                <p className="text-sm opacity-60">No linting issues were found. Your code is clean and follows best practices.</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        lintResults.lint_errors.map((error, idx) => (
                                                            <div key={idx} className={`group p-5 rounded-[2rem] shadow-sm transform transition-all hover:scale-[1.01] flex gap-4 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100 shadow-md'}`}>
                                                                <div className={`mt-1 h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center ${error.type === 'error' ? 'bg-red-500/10 text-red-500' :
                                                                    error.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                                                        'bg-blue-500/10 text-blue-500'
                                                                    }`}>
                                                                    {error.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${error.type === 'error' ? 'bg-red-500/10 text-red-500' :
                                                                            error.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                                                                'bg-blue-500/10 text-blue-500'
                                                                            }`}>
                                                                            {error.symbol || error.type}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold opacity-40">Line {error.line}:{error.column}</span>
                                                                    </div>
                                                                    <p className={`text-sm font-semibold leading-relaxed mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                        {error.message}
                                                                    </p>
                                                                    <span className="text-[10px] opacity-40 font-mono tracking-tighter">ID: {error.message_id}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                                                    <p className="text-sm font-bold text-gray-500 opacity-50 uppercase tracking-widest">No linting data available</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : codeDisplayMode === 'highlighted' ? (
                                        <div className="relative">
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

            {/* Bottom Panel - Folder Summary */}
            <div
                className={`absolute left-0 right-0 bottom-0 ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl shadow-2xl transition-transform duration-300 z-20 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'}`}
                style={{
                    height: '420px',
                    transform: isBottomPanelOpen ? 'translateY(0)' : 'translateY(420px)'
                }}
            >
                <div className="h-full flex flex-col overflow-hidden">
                    <div className={`flex ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-100/30'} backdrop-blur-sm p-1.5 m-6 mb-4 rounded-xl border ${isDarkMode ? 'border-white/10' : 'border-gray-200/50'} shadow-lg gap-2`}>
                        <button
                            onClick={() => setRightPanelTab('summary')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all rounded-lg ${rightPanelTab === 'summary'
                                ? 'bg-gradient-to-r from-blue-500 to-teal-600 text-white shadow-lg'
                                : `${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`
                                }`}
                        >
                            <FileTextIcon size={16} strokeWidth={2.5} /> Folder Summary
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

                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                        {rightPanelTab === 'summary' ? (
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
                                                    <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{fullFileData.total_loc || "—"}</span>
                                                </div>
                                                <div className={`${isDarkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg`}>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block mb-2">Logical LOC</span>
                                                    <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{fullFileData.total_nloc || "—"}</span>
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
                                                    <span className={`text-xl font-black ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{fullFileData.function_count || fullFileData.functions?.length || 0}</span>
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

            {/* Bottom Panel Toggle */}
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
        </>
    );
}

export default ResultsDetailsPanel;
