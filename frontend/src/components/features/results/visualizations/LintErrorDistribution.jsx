import React from 'react';

/**
 * LintErrorDistribution - A horizontal stacked bar chart showing 
 * the breakdown of Errors, Warnings, and Info.
 */
const LintErrorDistribution = ({ errors, isDarkMode }) => {
    if (!errors || errors.length === 0) return null;

    // Process error counts
    const counts = {
        fatal: 0,
        error: 0,
        warning: 0,
    };

    errors.forEach(err => {
        const type = err.type?.toLowerCase();
        if (type === 'fatal') counts.fatal++;
        else if (type === 'error') counts.error++;
        else if (type === 'warning' || type === 'refactor') counts.warning++;
    });

    const total = counts.fatal + counts.error + counts.warning;
    if (total === 0) return null;

    // Percentages for the bar
    const percentages = {
        fatal: (counts.fatal / total) * 100,
        error: (counts.error / total) * 100,
        warning: (counts.warning / total) * 100,
    };

    const colors = {
        fatal: '#7f1d1d', // Dark Red/Maroon
        error: '#ef4444', // Red
        warning: '#f59e0b', // Amber
    };

    return (
        <div className="w-full flex flex-col gap-3 px-2">
            <div className="flex justify-between items-end mb-1">
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Issue Distribution
                </h5>
                <span className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Total Issues: {total}
                </span>
            </div>

            {/* Stacked Bar Container */}
            <div className={`h-3 w-full rounded-full overflow-hidden flex shadow-inner border ${isDarkMode ? 'border-white/5 bg-gray-900/50' : 'border-black/5 bg-gray-50'}`}>
                {counts.fatal > 0 && (
                    <div
                        style={{ width: `${percentages.fatal}%`, backgroundColor: colors.fatal }}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 hover:brightness-110"
                        title={`Fatal: ${counts.fatal}`}
                    />
                )}
                {counts.error > 0 && (
                    <div
                        style={{ width: `${percentages.error}%`, backgroundColor: colors.error }}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 hover:brightness-110"
                        title={`Errors: ${counts.error}`}
                    />
                )}
                {counts.warning > 0 && (
                    <div
                        style={{ width: `${percentages.warning}%`, backgroundColor: colors.warning }}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 hover:brightness-110"
                        title={`Warnings: ${counts.warning}`}
                    />
                )}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-1">
                {counts.fatal > 0 && (
                    <div className="flex items-center gap-1.5 grayscale-[0.2] hover:grayscale-0 transition-all">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.fatal }} />
                        <span className="text-[10px] font-bold opacity-60">Fatal ({counts.fatal})</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5 grayscale-[0.2] hover:grayscale-0 transition-all">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.error }} />
                    <span className="text-[10px] font-bold opacity-60">Errors ({counts.error})</span>
                </div>
                <div className="flex items-center gap-1.5 grayscale-[0.2] hover:grayscale-0 transition-all">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.warning }} />
                    <span className="text-[10px] font-bold opacity-60">Warnings ({counts.warning})</span>
                </div>
            </div>
        </div>
    );
};

export default LintErrorDistribution;
