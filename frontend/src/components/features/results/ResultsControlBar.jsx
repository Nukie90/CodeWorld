// Top Nav Bar: Home & Theme Toggle Controls
import { useState } from 'react';
import { Home, Moon, Sun, GitCommit, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { audioManager } from '../../../utils/audioManager';

function ResultsControlBar({
    isDarkMode,
    setIsDarkMode,
    isAnimating,
    animatingCommit,
    formatCommitDate
}) {
    const navigate = useNavigate();
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const [isMuted, setIsMuted] = useState(audioManager.isMuted);

    const handleToggleMute = () => {
        audioManager.init(); // ensure init
        const newMutedState = audioManager.toggleMute();
        setIsMuted(newMutedState);
    };

    return (
        <>
            {/* Top Control Bar with Home, Theme Toggle, and Sound Toggle */}
            <div className={`absolute top-6 right-6 z-50 flex items-center gap-3`}>
                <button
                    onClick={handleToggleMute}
                    className={`p-3 rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all ${textColor} border border-white/20 dark:border-white/10 hover:scale-110 hover:bg-white/20 dark:hover:bg-black/30`}
                    title={isMuted ? "Unmute Sound" : "Mute Sound"}
                >
                    {isMuted ? <VolumeX size={22} strokeWidth={2.5} /> : <Volume2 size={22} strokeWidth={2.5} />}
                </button>
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

            {/* Commit Info - Floating Badge */}
            {isAnimating && animatingCommit && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 rounded-full shadow-2xl border border-white/20 backdrop-blur-md animate-pulse">
                        <GitCommit size={18} className="text-white" />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">
                                {formatCommitDate(animatingCommit.date)}
                            </span>
                            <span className="text-xs font-mono text-blue-100">
                                {animatingCommit.message}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ResultsControlBar;
