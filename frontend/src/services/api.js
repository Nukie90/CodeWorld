import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const authService = {
    login: () => api.get('/auth/github/login'),
    logout: (token) => api.post('/auth/logout', { token }),
};

export const repoService = {
    getBranches: (repo_url, token) => api.get('/repo/branches', { params: { repo_url, token } }),
    checkout: (repo_url, branch, token) => api.post('/repo/checkout', { repo_url, branch, token }),
    getFunctionCode: (data) => api.post('/repo/function-code', data),
    getFileContent: (data) => api.post('/repo/file-content', data),
    getCommits: (repo_url, branch, token, limit = 1000) =>
        api.post('/repo/commits', { repo_url, branch, token, limit }),
    analyzeRepo: (data) => api.post('/analyze/repo', data),
};

export default api;
