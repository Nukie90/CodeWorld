import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Code, ArrowLeft } from 'lucide-react';

const FunctionTableView = ({ file, isDarkMode, onBack, onFunctionClick, onFileClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'start_line', direction: 'asc' });

    // Flatten functions to include children
    const flattenedFunctions = useMemo(() => {
        if (!file || !file.functions) return [];

        const flatten = (funcs, depth = 0) => {
            let result = [];
            funcs.forEach(fn => {
                result.push({ ...fn, depth });
                if (fn.children && fn.children.length > 0) {
                    result = result.concat(flatten(fn.children, depth + 1));
                }
            });
            return result;
        };

        return flatten(file.functions);
    }, [file]);

    // Filter functions based on search term
    const filteredFunctions = useMemo(() => {
        return flattenedFunctions.filter(fn =>
            fn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (fn.long_name && fn.long_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [flattenedFunctions, searchTerm]);

    // Sort functions
    const sortedFunctions = useMemo(() => {
        let sortableItems = [...filteredFunctions];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle special cases or defaults
                if (sortConfig.key === 'complexity') {
                    aValue = a.cognitive_complexity || 0;
                    bValue = b.cognitive_complexity || 0;
                }
                if (sortConfig.key === 'nloc') {
                    aValue = a.nloc || 0;
                    bValue = b.nloc || 0;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredFunctions, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    const getComplexityColor = (complexity) => {
        if (!complexity) return isDarkMode ? 'text-gray-400' : 'text-gray-500';
        if (complexity >= 20) return 'text-red-500 font-bold';
        if (complexity >= 15) return 'text-orange-500 font-semibold';
        if (complexity >= 10) return 'text-yellow-500 font-semibold';
        return isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
    };

    return (
        <div className={`w-full h-full flex flex-col p-6 overflow-hidden ${isDarkMode ? 'bg-slate-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6 animate-in slide-in-from-top-4 duration-500">
                <button
                    onClick={onBack}
                    className={`self-start flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700'
                        : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm'
                        }`}
                >
                    <ArrowLeft size={18} />
                    <span>Back to Island</span>
                </button>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                            {file?.name || 'Unknown File'}
                        </h1>
                        <div className={`flex gap-6 mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">{file?.totalLoc || 0}</span> Lines of Code
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">{file?.functions?.length || 0}</span> Functions
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search functions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDarkMode
                                ? 'bg-slate-800 border-slate-700 placeholder-gray-500 text-white'
                                : 'bg-white border-gray-200 placeholder-gray-400 text-gray-900 shadow-sm'
                                }`}
                        />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className={`flex-1 overflow-hidden rounded-2xl border flex flex-col shadow-xl backdrop-blur-sm ${isDarkMode
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white/80 border-gray-200'
                } animate-in fade-in zoom-in-95 duration-500 delay-100`}>

                {/* Table Header */}
                <div className={`grid grid-cols-12 gap-4 p-4 border-b text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-gray-400' : 'bg-gray-50/80 border-gray-200 text-gray-500'
                    }`}>
                    <div
                        className="col-span-5 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors"
                        onClick={() => requestSort('name')}
                    >
                        Function Name {getSortIcon('name')}
                    </div>
                    <div
                        className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors justify-end text-right"
                        onClick={() => requestSort('complexity')}
                    >
                        Complexity {getSortIcon('complexity')}
                    </div>
                    <div
                        className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors justify-end text-right"
                        onClick={() => requestSort('nloc')}
                    >
                        LOC {getSortIcon('nloc')}
                    </div>
                    <div
                        className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors justify-end text-right"
                        onClick={() => requestSort('start_line')}
                    >
                        Line {getSortIcon('start_line')}
                    </div>
                </div>

                {/* Table Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {sortedFunctions.length > 0 ? (
                        sortedFunctions.map((fn, index) => (
                            <div
                                key={index}
                                onClick={() => {
                                    if (fn.name === 'code outside functions' && onFileClick) {
                                        onFileClick(file);
                                    } else if (onFunctionClick) {
                                        onFunctionClick({
                                            filename: file.filename,
                                            functionName: fn.name,
                                            startLine: fn.start_line,
                                            nloc: fn.nloc
                                        });
                                    }
                                }}
                                className={`grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 items-center transition-all cursor-pointer group ${isDarkMode
                                    ? 'border-slate-700 hover:bg-slate-700/50'
                                    : 'border-gray-100 hover:bg-blue-50/50'
                                    }`}
                            >
                                <div className="col-span-5 font-mono text-sm font-medium truncate flex items-center gap-3" style={{ paddingLeft: `${fn.depth * 24}px` }}>
                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                        <Code size={14} />
                                    </div>
                                    <span className="truncate" title={fn.long_name || fn.name}>{fn.name}</span>
                                </div>
                                <div className={`col-span-2 text-right font-mono text-sm ${getComplexityColor(fn.cognitive_complexity)}`}>
                                    {fn.cognitive_complexity}
                                </div>
                                <div className={`col-span-2 text-right font-mono text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {fn.nloc}
                                </div>
                                <div className={`col-span-2 text-right font-mono text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                    :{fn.start_line}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={`flex flex-col items-center justify-center h-40 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            <p>No functions found matching "{searchTerm}"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FunctionTableView;
