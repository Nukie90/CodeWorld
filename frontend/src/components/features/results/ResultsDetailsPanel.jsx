import React, { useRef, useEffect } from 'react';
import { Code, FileText, Hash, Sparkles, Check, Copy, FileText as FileTextIcon, ChevronDown, ChevronUp, AlertTriangle, Info, CheckCircle, ExternalLink, RotateCw, OctagonAlert } from 'lucide-react';
import LintScoreGauge from './visualizations/LintScoreGauge';
import LintErrorDistribution from './visualizations/LintErrorDistribution';

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
    const [activeLintError, setActiveLintError] = React.useState(null);

    // Reset active error when code changes
    useEffect(() => {
        setActiveLintError(null);
    }, [selectedCode?.filename, selectedCode?.functionName]);

    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const panelBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const hasFatalLint = Boolean(lintResults?.lint_errors?.some((error) => error.type === 'fatal' || error.message_id === 'invalid-syntax'));
    const getLintVisualType = (error) => {
        if (error.type === 'fatal' || error.message_id === 'invalid-syntax') return 'fatal';
        return error.type;
    };

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
                                    <div className={`mb-4 pb-3 border-b ${borderColor} ${codeDisplayMode === 'linterSuggest' ? 'px-6 pt-6' : ''}`}>
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
                                                <div className="space-y-4 px-2">
                                                    {/* Scrolling Header inside the content area */}
                                                    <div className="flex items-center justify-between mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                                        <h4 className="text-2xl font-black bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent tracking-tighter">
                                                            Linter Insights
                                                        </h4>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleLintFile(selectedCode.filename, true)}
                                                                disabled={isLinting}
                                                                className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-teal-400' : 'hover:bg-gray-100 text-gray-500 hover:text-teal-600'} ${isLinting ? 'opacity-50' : 'hover:rotate-180 duration-500'}`}
                                                                title="Recompute Linter"
                                                            >
                                                                <RotateCw size={18} strokeWidth={2.5} className={isLinting ? 'animate-spin' : ''} />
                                                            </button>
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                                                Quality Analysis
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {lintResults.lint_score != null && (
                                                        <div className={`p-6 mb-4 rounded-[2.5rem] border shadow-2xl relative overflow-hidden transition-all hover:scale-[1.02] duration-500 ${isDarkMode ? 'bg-gray-800/40 border-white/5' : 'bg-white border-gray-100'}`}>
                                                            {/* Background Glow */}
                                                            <div className={`absolute -right-20 -top-20 w-64 h-64 blur-[100px] pointer-events-none ${hasFatalLint ? 'bg-red-500/15' : 'bg-emerald-500/10'}`} />

                                                            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-8 relative z-10">
                                                                <LintScoreGauge score={lintResults.lint_score} isDarkMode={isDarkMode} isFatal={hasFatalLint} />
                                                                <div className="space-y-6">
                                                                    {hasFatalLint && (
                                                                        <div className={`p-4 rounded-3xl border flex items-start gap-3 ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                                                            <OctagonAlert size={18} className="mt-0.5 shrink-0" />
                                                                            <div>
                                                                                <div className="text-[10px] font-black uppercase tracking-widest mb-1">Fatal Lint Issue</div>
                                                                                <p className="text-xs leading-relaxed">The linter found a fatal issue, usually invalid syntax. Fix this first before trusting the rest of the results.</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <LintErrorDistribution errors={lintResults.lint_errors} isDarkMode={isDarkMode} />

                                                                    <div className={`p-4 rounded-3xl text-[11px] leading-relaxed italic opacity-80 border ${isDarkMode ? 'bg-gray-900/50 border-white/5 text-gray-400' : 'bg-gray-50 border-black/5 text-gray-500'}`}>
                                                                        "Maintaining high code quality scores ensures long-term project health and reduces technical debt accumulation."
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
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
                                                            (() => {
                                                                const visualType = getLintVisualType(error);
                                                                return (
                                                            <div
                                                                key={idx}
                                                                onClick={() => {
                                                                    setActiveLintError(error);
                                                                    setCodeDisplayMode('highlighted');
                                                                    setTimeout(() => {
                                                                        const element = document.getElementById(`line-${error.line}`);
                                                                        if (element) {
                                                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        }
                                                                    }, 300);
                                                                }}
                                                                className={`group p-5 rounded-[2rem] shadow-sm transform transition-all hover:scale-[1.01] hover:shadow-xl cursor-pointer flex gap-4 border ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-blue-500/50' : 'bg-white border-gray-100 hover:border-blue-300'}`}
                                                            >
                                                                <div className={`mt-1 h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 ${visualType === 'fatal' ? 'bg-red-600/15 text-red-600' :
                                                                    visualType === 'error' ? 'bg-red-500/10 text-red-500' :
                                                                    visualType === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                                                        'bg-blue-500/10 text-blue-500'
                                                                    }`}>
                                                                    {visualType === 'fatal' ? <OctagonAlert size={20} /> : visualType === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${visualType === 'fatal' ? 'bg-red-600/15 text-red-600' :
                                                                            visualType === 'error' ? 'bg-red-500/10 text-red-500' :
                                                                            visualType === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                                                                'bg-blue-500/10 text-blue-500'
                                                                            }`}>
                                                                            {visualType === 'fatal' ? 'FATAL' : error.symbol || error.type}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-bold opacity-40">Line {error.line}:{error.column}</span>
                                                                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                                                        </div>
                                                                    </div>
                                                                    <p className={`text-sm font-semibold leading-relaxed mb-1 transition-colors group-hover:text-blue-500 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                        {error.message}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                                );
                                                            })()
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
                                                        const currentLine = idx + 1;
                                                        const lineErrors = (codeDisplayMode === 'linterSuggest' || activeLintError) ?
                                                            (lintResults?.lint_errors?.filter(e => e.line === currentLine) || []) : [];
                                                        const isTargetLine = activeLintError && currentLine === activeLintError.line;

                                                        const highlighted = line
                                                            .replace(/(['"`])(?:(?=(\\?))\2.)*?\1/g, '<span style="color: #ce9178">$&</span>')
                                                            .replace(/\b(async|await|function|const|let|var|if|else|for|while|return|class|import|export|from|def|try|except|finally|with|as)\b/g, '<span style="color: #569cd6">$&</span>')
                                                            .replace(/\b(\d+\.?\d*)\b/g, '<span style="color: #b5cea8">$&</span>')
                                                            .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span style="color: #6a9955">$&</span>')

                                                        return (
                                                            <div
                                                                key={idx}
                                                                id={`line-${currentLine}`}
                                                                className={`relative group transition-all duration-500 ${isTargetLine ? (isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50/50') : lineErrors.length > 0 ? (isDarkMode ? 'bg-red-500/5' : 'bg-red-50/30') : ''}`}
                                                            >
                                                                {/* Column highlights for all errors on this line */}
                                                                {lineErrors.map((err, eIdx) => (
                                                                    <div
                                                                        key={`col-${eIdx}`}
                                                                        className={`absolute h-full z-0 ${err === activeLintError ? 'bg-blue-500/30 border-b-2 border-blue-500' : 'bg-red-500/20 border-b border-red-500/50'}`}
                                                                        style={{
                                                                            left: `${err.column - 1}ch`,
                                                                            width: `${(err.endColumn || err.column + 1) - err.column}ch`,
                                                                            pointerEvents: 'none'
                                                                        }}
                                                                    />
                                                                ))}

                                                                <div
                                                                    className="relative z-10"
                                                                    dangerouslySetInnerHTML={{ __html: highlighted || ' ' }}
                                                                />

                                                                {/* Stacked error bubbles for all errors on this line */}
                                                                {lineErrors.map((err, eIdx) => (
                                                                    <div key={`msg-${eIdx}`} className={`mt-2 mb-2 p-4 rounded-2xl shadow-xl border animate-in zoom-in-95 slide-in-from-top-2 duration-300 relative z-20 ${err === activeLintError
                                                                        ? (isDarkMode ? 'bg-gray-800 border-blue-500 ring-1 ring-blue-500/50 text-blue-100' : 'bg-blue-50 border-blue-300 text-blue-800')
                                                                        : (isDarkMode ? 'bg-gray-800 border-red-500/50 text-red-200' : 'bg-red-50 border-red-200 text-red-700')
                                                                        }`}>
                                                                        <div className="flex items-start gap-3">
                                                                            <div className={`p-1.5 rounded-lg ${err === activeLintError ? (isDarkMode ? 'bg-blue-500/20' : 'bg-blue-500/10') : (isDarkMode ? 'bg-red-500/20' : 'bg-red-500/10')}`}>
                                                                                {err === activeLintError ? <CheckCircle size={14} className="text-blue-500" /> : <AlertTriangle size={14} className={err.type === 'error' ? 'text-red-500' : 'text-amber-500'} />}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center justify-between mb-1">
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                                                                                        {err.symbol || err.type}
                                                                                    </span>
                                                                                    {err === activeLintError && (
                                                                                        <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">ACTIVE</span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-sm font-bold leading-tight">
                                                                                    {err.message}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        {/* Carrot arrow pointing up */}
                                                                        {eIdx === 0 && (
                                                                            <div className={`absolute -top-1.5 left-4 w-3 h-3 rotate-45 border-t border-l ${err === activeLintError
                                                                                ? (isDarkMode ? 'bg-gray-800 border-blue-500' : 'bg-blue-50 border-blue-300')
                                                                                : (isDarkMode ? 'bg-gray-800 border-red-500/50' : 'bg-red-50 border-red-200')
                                                                                }`} />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )
                                                    })}
                                                </code>
                                            </pre>
                                            {/* Scroll Observer/Utility to detect line from scroll? (Optional future feature) */}
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
                    <div className="flex items-center gap-3 px-6 mt-8 mb-2 text-slate-900 dark:text-gray-100">
                        <FileTextIcon size={20} strokeWidth={2.5} className="text-blue-600 dark:text-blue-400" />
                        <span className="text-lg font-black uppercase tracking-widest">Folder Summary</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
                        <div className="animate-in fade-in duration-300">
                            <h3 className="text-sm font-bold mb-4 text-gray-500 dark:text-gray-400 uppercase tracking-widest">Project Metrics</h3>
                            <div className="grid grid-cols-3 gap-6">
                                {Object.entries(folderSummary).map(([key, value]) => (
                                    <div key={key} className={`${isDarkMode ? 'bg-gray-800/50' : 'bg-gradient-to-br from-blue-50 to-purple-50'} backdrop-blur-sm rounded-xl p-4 border ${borderColor} shadow-lg hover:shadow-xl transition-all`}>
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">{key}</span>
                                        <span className={`font-black text-2xl ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
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
