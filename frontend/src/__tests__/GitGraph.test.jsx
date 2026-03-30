import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import axios from 'axios';
import GitGraph from '../components/features/git_graph/GitGraph';

jest.mock('axios');

describe('GitGraph', () => {
    const mockCommits = [
        { hash: 'hash1', message: 'feat: add feature 1', author: 'User A', date: '2023-01-01T10:00:00Z' },
        { hash: 'hash2', message: 'fix: bug fix 2', author: 'User B', date: '2023-01-02T11:00:00Z' }
    ];

    beforeEach(() => {
        axios.post.mockResolvedValue({ data: { commits: mockCommits } });
    });

    it('renders loading state initially', async () => {
        render(
            <GitGraph 
                repoUrl="https://github.com/test/repo" 
                branch="main" 
                token="token" 
                isDarkMode={true} 
            />
        );

        expect(screen.getByText(/Loading commit history.../i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('feat: add feature 1')).toBeInTheDocument();
            expect(screen.getByText('fix: bug fix 2')).toBeInTheDocument();
        });
    });

    it('calls onCommitClick when a commit is clicked', async () => {
        const onCommitClickMock = jest.fn();
        render(
            <GitGraph 
                repoUrl="https://github.com/test/repo" 
                branch="main" 
                token="token" 
                onCommitClick={onCommitClickMock}
                isDarkMode={true} 
            />
        );

        await waitFor(() => screen.getByText('feat: add feature 1'));
        
        fireEvent.click(screen.getByText('feat: add feature 1'));
        expect(onCommitClickMock).toHaveBeenCalledWith(mockCommits[0]);
    });

    it('shows "No commits found" when API returns empty list', async () => {
        axios.post.mockResolvedValue({ data: { commits: [] } });
        
        render(
            <GitGraph 
                repoUrl="https://github.com/test/repo" 
                branch="main" 
                token="token" 
                isDarkMode={true} 
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/No commits found/i)).toBeInTheDocument();
        });
    });

    it('handles error state gracefully', async () => {
        axios.post.mockRejectedValue(new Error('API Error'));
        
        render(
            <GitGraph 
                repoUrl="https://github.com/test/repo" 
                branch="main" 
                token="token" 
                isDarkMode={true} 
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Failed to load commit history/i)).toBeInTheDocument();
        });
    });

    it('loads more commits when "Load More" is clicked', async () => {
        // First call returns 20 commits to trigger hasMore=true
        const longList = Array.from({ length: 20 }, (_, i) => ({
            hash: `hash${i}`,
            message: `commit ${i}`,
            author: 'author',
            date: '2023-01-01'
        }));
        
        axios.post.mockResolvedValueOnce({ data: { commits: longList } });
        
        render(
            <GitGraph 
                repoUrl="https://github.com/test/repo" 
                branch="main" 
                token="token" 
                isDarkMode={true} 
            />
        );

        await waitFor(() => screen.getByText('Load More'));
        
        axios.post.mockResolvedValueOnce({ data: { commits: [{ hash: 'hash21', message: 'commit 21' }] } });
        
        fireEvent.click(screen.getByText('Load More'));
        
        await waitFor(() => {
            expect(screen.getByText('commit 21')).toBeInTheDocument();
        });
    });
});
