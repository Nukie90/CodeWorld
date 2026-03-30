import { renderHook, act, waitFor } from '@testing-library/react';
import { useGithubAuth } from '../hooks/useGithubAuth';
import { authService } from '../services/api';

jest.mock('../services/api');

describe('useGithubAuth', () => {
    const originalLocation = window.location;

    beforeAll(() => {
        delete window.location;
        window.location = {
            assign: jest.fn(),
            search: ''
        };
    });

    afterAll(() => {
        window.location = originalLocation;
    });

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        
        // Reset URL to base state before each test
        window.history.pushState({}, 'Test Title', '/');
        window.location.search = '';
        
        jest.spyOn(window.history, 'replaceState');
    });

    it('initializes from localStorage', () => {
        localStorage.setItem('access_token', 'test-token');
        localStorage.setItem('username', 'test-user');

        const { result } = renderHook(() => useGithubAuth());

        expect(result.current.token).toBe('test-token');
        expect(result.current.username).toBe('test-user');
    });

    it('handles OAuth callback from URL params', async () => {
        window.location.search = '?token=new-token&username=new-user';

        const { result } = renderHook(() => useGithubAuth());

        await waitFor(() => {
            expect(result.current.token).toBe('new-token');
            expect(result.current.username).toBe('new-user');
        });
        
        expect(localStorage.getItem('access_token')).toBe('new-token');
        expect(localStorage.getItem('username')).toBe('new-user');
        expect(window.history.replaceState).toHaveBeenCalled();
    });

    it('login redirects to auth URL', async () => {
        const authUrl = 'http://github.com/login/oauth';
        authService.login.mockResolvedValue({ data: { auth_url: authUrl } });

        const { result } = renderHook(() => useGithubAuth());

        await act(async () => {
            await result.current.login();
        });

        await waitFor(() => {
            expect(window.location.assign).toHaveBeenCalledWith(authUrl);
        });
    });

    it('logout clears state and localStorage', async () => {
        localStorage.setItem('access_token', 'token');
        localStorage.setItem('username', 'user');

        const { result } = renderHook(() => useGithubAuth());

        await act(async () => {
            await result.current.logout();
        });

        expect(result.current.token).toBe('');
        expect(result.current.username).toBe('');
        expect(localStorage.getItem('access_token')).toBeNull();
        expect(localStorage.getItem('username')).toBeNull();
        expect(authService.logout).toHaveBeenCalledWith('token');
    });

    it('sets error message on login failure', async () => {
        authService.login.mockRejectedValue({ 
            response: { data: { detail: 'Auth error' } } 
        });

        const { result } = renderHook(() => useGithubAuth());

        await act(async () => {
            await result.current.login();
        });

        expect(result.current.statusMessage).toContain('Auth error');
    });
});
