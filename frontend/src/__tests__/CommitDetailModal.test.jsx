import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import axios from 'axios';
import CommitDetailModal from '../components/features/git_graph/CommitDetailModal';

jest.mock('axios');

describe('CommitDetailModal', () => {
    const mockCommit = {
        hash: 'abc123def',
        message: 'feat: add login',
        author: 'John Doe',
        date: '2023-01-01T10:00:00Z'
    };

    const mockDetails = {
        hash: 'abc123def',
        message: 'feat: add login',
        author: 'John Doe',
        email: 'john@example.com',
        date: '2023-01-01T10:00:00Z',
        files_changed: [
            { filename: 'src/App.js', additions: 10, deletions: 2 }
        ],
        diff: 'diff --git a/src/App.js b/src/App.js\nindex 123..456 100644\n--- a/src/App.js\n+++ b/src/App.js\n@@ -1,1 +1,1 @@\n-old\n+new'
    };

    beforeEach(() => {
        axios.post.mockResolvedValue({ data: mockDetails });
    });

    it('renders loading state initially and then displays commit details', async () => {
        render(
            <CommitDetailModal 
                commit={mockCommit} 
                repoUrl="https://github.com/test/repo" 
                onClose={() => {}} 
                isDarkMode={true} 
            />
        );

        expect(screen.getByText(/Loading commit details.../i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('abc123def')).toBeInTheDocument();
            expect(screen.getByText('feat: add login')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
    });

    it('displays changed files and toggles diff', async () => {
        render(
            <CommitDetailModal 
                commit={mockCommit} 
                repoUrl="https://github.com/test/repo" 
                onClose={() => {}} 
                isDarkMode={true} 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('src/App.js')).toBeInTheDocument();
        });

        const fileItem = screen.getByText('src/App.js');
        fireEvent.click(fileItem);

        expect(screen.getByText(/Changes in src\/App.js/i)).toBeInTheDocument();
        expect(screen.getByText('new')).toHaveClass('text-green-400');
        expect(screen.getByText('old')).toHaveClass('text-red-400');
    });

    it('calls onClose when close button is clicked', async () => {
        const onCloseMock = jest.fn();
        render(
            <CommitDetailModal 
                commit={mockCommit} 
                repoUrl="https://github.com/test/repo" 
                onClose={onCloseMock} 
                isDarkMode={true} 
            />
        );

        await waitFor(() => {
            screen.getByRole('button', { name: '' }); // The SVG button doesn't have text
            // Need to find the button with the close icon or just use the first button in header
            const buttons = screen.getAllByRole('button');
            fireEvent.click(buttons[0]); // Header close button
            expect(onCloseMock).toHaveBeenCalled();
        });
    });

    it('fetches and displays full file content when "View Full File" is clicked', async () => {
        axios.post.mockImplementation((url, _data) => {
            if (url.includes('commit-details')) return Promise.resolve({ data: mockDetails });
            if (url.includes('file-content')) return Promise.resolve({ data: { content: 'FULL FILE CONTENT' } });
            return Promise.reject(new Error('Unknown URL'));
        });

        render(
            <CommitDetailModal 
                commit={mockCommit} 
                repoUrl="https://github.com/test/repo" 
                onClose={() => {}} 
                isDarkMode={true} 
            />
        );

        await waitFor(() => screen.getByText('src/App.js'));
        fireEvent.click(screen.getByText('src/App.js'));

        const viewFullBtn = await screen.findByText(/View Full File/i);
        fireEvent.click(viewFullBtn);

        await waitFor(() => {
            expect(screen.getByText('FULL FILE CONTENT')).toBeInTheDocument();
        });
    });
});
