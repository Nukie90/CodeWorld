import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';

/**
 * LintScoreGauge - A beautiful circular gauge to display lint scores (0-10)
 * Uses a Recharts PieChart to create the arc effect.
 */
const LintScoreGauge = ({ score, isDarkMode, isFatal = false, isNotApplicable = false }) => {
    // Ensure score is a number between 0 and 10
    const numericScore = typeof score === 'number' ? Math.min(10, Math.max(0, score)) : 0;

    // Data for the gauge: [score value, remaining to 10]
    const data = [
        { name: 'Score', value: numericScore },
        { name: 'Remaining', value: 10 - numericScore },
    ];

    // Dynamic color based on score
    const getGaugeColor = (s) => {
        if (isNotApplicable) return isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.18)';
        if (isFatal) return '#dc2626';
        if (s >= 8) return '#10b981'; // Emerald/Green (Good)
        if (s >= 5) return '#f59e0b'; // Amber/Yellow (Warning)
        return '#ef4444'; // Red (Danger)
    };

    const activeColor = getGaugeColor(numericScore);
    const bgColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    // Rank logic
    const getRank = (s) => {
        if (isNotApplicable) return { label: 'N/A', color: isDarkMode ? '#cbd5e1' : '#475569' };
        if (isFatal) return { label: 'FATAL', color: '#dc2626' };
        if (s >= 10) return { label: 'S+', color: '#10b981' };
        if (s >= 9.5) return { label: 'S', color: '#10b981' };
        if (s >= 8.5) return { label: 'A', color: '#10b981' };
        if (s >= 7.0) return { label: 'B', color: '#f59e0b' };
        if (s >= 5.0) return { label: 'C', color: '#f59e0b' };
        return { label: 'F', color: '#ef4444' };
    };

    const rank = getRank(numericScore);

    return (
        <div className="relative w-full h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="70%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell fill={activeColor} stroke={activeColor} strokeWidth={2} />
                        <Cell fill={bgColor} />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>

            {/* Center Text Overlay */}
            <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center">
                <div
                    className="text-4xl font-black tracking-tighter transition-all duration-700"
                    style={{ color: isDarkMode ? '#fff' : '#111' }}
                >
                    {isNotApplicable ? 'N/A' : numericScore.toFixed(1)}
                </div>
                <div
                    className={`text-[10px] font-black uppercase tracking-widest mt-1 px-3 py-1 rounded-full border shadow-lg animate-in zoom-in duration-500`}
                    style={{
                        backgroundColor: `${rank.color}15`,
                        borderColor: `${rank.color}30`,
                        color: rank.color
                    }}
                >
                    {isFatal || isNotApplicable ? rank.label : `Rank ${rank.label}`}
                </div>
            </div>
        </div>
    );
};

export default LintScoreGauge;
