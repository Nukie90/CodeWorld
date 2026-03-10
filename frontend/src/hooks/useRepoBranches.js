import { useState, useEffect } from 'react';
import { repoService } from '../services/api';

export function useRepoBranches(repoUrl, token, initialAnalysisResult, setAnalysisResult) {
    const [branches, setBranches] = useState([]);
    const [currentBranch, setCurrentBranch] = useState("");
    const [branchLoading, setBranchLoading] = useState(false);

    useEffect(() => {
        async function fetchBranches() {
            if (!repoUrl) return;
            try {
                const resp = await repoService.getBranches(repoUrl, token);
                const data = resp.data || {};
                const local = data.local || [];
                const remote = data.remote || [];
                const current = data.current || '';
                const combined = [...local];
                remote.forEach(r => { if (!combined.includes(r)) combined.push(r); });
                setBranches(combined);
                setCurrentBranch(current);
            } catch (err) {
                console.error('Failed to fetch branches', err);
            }
        }
        fetchBranches();
    }, [repoUrl, token]);

    const handleBranchChange = async (evt) => {
        const branch = evt.target.value;
        if (!branch || !repoUrl) return;
        setBranchLoading(true);
        try {
            const resp = await repoService.checkout(repoUrl, branch, token);
            if (resp.data) {
                setAnalysisResult(resp.data);
                setCurrentBranch(branch);
            }
        } catch (err) {
            console.error('Checkout failed', err);
        } finally {
            setBranchLoading(false);
        }
    };

    return {
        branches,
        currentBranch,
        setCurrentBranch,
        branchLoading,
        handleBranchChange
    };
}
