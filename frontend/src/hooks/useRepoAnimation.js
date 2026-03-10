import { useState, useRef, useEffect } from 'react';
import { repoService } from '../services/api';

export function useRepoAnimation(analysisResult, setAnalysisResult, currentBranch, token, individual_files) {
    const [isAnimating, setIsAnimating] = useState(false);
    const isAnimatingRef = useRef(false);
    const [animationProgress, setAnimationProgress] = useState(0);
    const [animatingCommit, setAnimatingCommit] = useState(null);
    const [fixedFileOrder, setFixedFileOrder] = useState(null);
    const [allCommits, setAllCommits] = useState([]);
    const [currentCommitIndex, setCurrentCommitIndex] = useState(-1);
    const [animationSpeed, setAnimationSpeed] = useState(400);

    const animationRef = useRef(null);
    const animationSpeedRef = useRef(animationSpeed);

    useEffect(() => {
        animationSpeedRef.current = animationSpeed;
    }, [animationSpeed]);

    const handlePlayAnimation = async (customStartIndex = null) => {
        const isOverride = typeof customStartIndex === 'number';

        if (isAnimating && !isOverride) {
            setIsAnimating(false);
            isAnimatingRef.current = false;
            if (animationRef.current) {
                clearTimeout(animationRef.current);
            }
            return;
        }

        if (!analysisResult?.repo_url || !currentBranch) return;

        if (isAnimating && isOverride && animationRef.current) {
            clearTimeout(animationRef.current);
        }

        setIsAnimating(true);
        isAnimatingRef.current = true;
        if (!fixedFileOrder) setFixedFileOrder([...individual_files]);

        try {
            let commits = allCommits;
            if (commits.length === 0) {
                const resp = await repoService.getCommits(analysisResult.repo_url, currentBranch, token);
                const fetchedCommits = resp.data.commits || [];
                if (fetchedCommits.length === 0) {
                    setIsAnimating(false);
                    isAnimatingRef.current = false;
                    return;
                }
                commits = [...fetchedCommits].reverse();
                setAllCommits(commits);
            }

            const runStep = async (index) => {
                if (index >= commits.length || !isAnimatingRef.current) {
                    setIsAnimating(false);
                    isAnimatingRef.current = false;
                    return;
                }

                const commit = commits[index];
                setCurrentCommitIndex(index);
                setAnimatingCommit(commit);
                setAnimationProgress(Math.round((index / (commits.length - 1)) * 100));

                try {
                    const checkoutResp = await repoService.checkout(analysisResult.repo_url, commit.hash, token);
                    if (checkoutResp.data) {
                        setAnalysisResult(checkoutResp.data);
                    }
                } catch (err) {
                    console.error(`Animation step failed at commit ${commit.hash}`, err);
                }

                animationRef.current = setTimeout(() => runStep(index + 1), animationSpeedRef.current);
            };

            const startIdx = isOverride ? customStartIndex : (currentCommitIndex === -1 || currentCommitIndex >= commits.length - 1 ? 0 : currentCommitIndex + 1);
            await runStep(startIdx);

        } catch (err) {
            console.error('Failed to start animation', err);
            setIsAnimating(false);
            isAnimatingRef.current = false;
        }
    };

    const handlePlayFromDate = async (daysAgo) => {
        if (!analysisResult?.repo_url || !currentBranch) return;

        let commits = allCommits;
        if (commits.length === 0) {
            try {
                const resp = await repoService.getCommits(analysisResult.repo_url, currentBranch, token);
                const fetchedCommits = resp.data.commits || [];
                if (fetchedCommits.length === 0) return;
                commits = [...fetchedCommits].reverse();
                setAllCommits(commits);
            } catch (err) {
                console.error('Failed to fetch commits for date filter', err);
                return;
            }
        }

        if (daysAgo === 'all') {
            handlePlayAnimation(0);
            return;
        }

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysAgo);

        let targetIndex = commits.findIndex(c => new Date(c.date) >= targetDate);
        if (targetIndex === -1) {
            targetIndex = commits.length > 0 && new Date(commits[0].date) >= targetDate ? 0 : commits.length - 1;
        }

        handlePlayAnimation(targetIndex);
    };

    const handleStepPrev = async () => {
        if (isAnimating || currentCommitIndex <= 0) return;
        if (!fixedFileOrder) setFixedFileOrder([...individual_files]);
        const newIndex = currentCommitIndex - 1;
        const commit = allCommits[newIndex];
        setCurrentCommitIndex(newIndex);
        setAnimatingCommit(commit);
        setAnimationProgress(Math.round((newIndex / (allCommits.length - 1)) * 100));

        try {
            const checkoutResp = await repoService.checkout(analysisResult.repo_url, commit.hash, token);
            if (checkoutResp.data) setAnalysisResult(checkoutResp.data);
        } catch (err) {
            console.error('Manual step failed', err);
        }
    };

    const handleStepNext = async () => {
        if (isAnimating || currentCommitIndex >= allCommits.length - 1) return;
        if (!fixedFileOrder) setFixedFileOrder([...individual_files]);
        const newIndex = currentCommitIndex + 1;
        const commit = allCommits[newIndex];
        setCurrentCommitIndex(newIndex);
        setAnimatingCommit(commit);
        setAnimationProgress(Math.round((newIndex / (allCommits.length - 1)) * 100));

        try {
            const checkoutResp = await repoService.checkout(analysisResult.repo_url, commit.hash, token);
            if (checkoutResp.data) setAnalysisResult(checkoutResp.data);
        } catch (err) {
            console.error('Manual step failed', err);
        }
    };

    const handleCommitClick = async (commit) => {
        if (isAnimating) return;
        if (!fixedFileOrder) setFixedFileOrder([...individual_files]);

        let index = -1;
        if (allCommits.length > 0) {
            index = allCommits.findIndex(c => c.hash === commit.hash);
            if (index !== -1) setCurrentCommitIndex(index);
        }

        setAnimatingCommit(commit);
        setAnimationProgress(index !== -1 ? Math.round((index / (allCommits.length - 1)) * 100) : 0);

        try {
            const checkoutResp = await repoService.checkout(analysisResult.repo_url, commit.hash, token);
            if (checkoutResp.data) setAnalysisResult(checkoutResp.data);
        } catch (err) {
            console.error('Failed to visualize commit', err);
        }
    };

    useEffect(() => {
        return () => {
            if (animationRef.current) clearTimeout(animationRef.current);
        };
    }, []);

    return {
        isAnimating,
        animationProgress,
        animatingCommit,
        allCommits,
        currentCommitIndex,
        animationSpeed,
        setAnimationSpeed,
        fixedFileOrder,
        handlePlayAnimation,
        handlePlayFromDate,
        handleStepPrev,
        handleStepNext,
        handleCommitClick
    };
}
