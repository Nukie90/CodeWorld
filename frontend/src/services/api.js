import axios from 'axios';

// const API_BASE_URL = 'http://localhost:8000/api';
const API_BASE_URL = import.meta.env.DEV 
    ? `http://${window.location.hostname}:8000/api` 
    : `http://${window.location.hostname}:8100/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const authService = {
    login: () => api.get('/auth/github/login'),
    logout: (token) => api.post('/auth/logout', { token }),
    getRepos: (token) => api.get('/auth/github/repos', { params: { token } }),
};

export const repoService = {
    getBranches: (repo_url, token) => api.get('/repo/branches', { params: { repo_url, token } }),
    checkout: (repo_url, branch, token) => api.post('/repo/checkout', { repo_url, branch, token }),
    getFunctionCode: (data) => api.post('/repo/function-code', data),
    getFileContent: (data) => api.post('/repo/file-content', data),
    getCommits: (repo_url, branch, token, limit = 1000) =>
        api.post('/repo/commits', { repo_url, branch, token, limit }),
    analyzeRepo: (data) => api.post('/analyze/repo', data),
    lintFile: (fileName, data) => api.post(`/lint/${fileName}`, data),
};
export const userService = {
    getRecentRepos: (token) => api.get('/user/repos/recent', { params: { token } }),
    getFavouriteRepos: (token) => api.get('/user/repos/favourites', { params: { token } }),
    addFavouriteRepo: (token, repo_full_name, repo_url) => api.post('/user/repos/favourites', { token, repo_full_name, repo_url }),
    removeFavouriteRepo: (token, repo_full_name) => api.delete('/user/repos/favourites', { params: { token, repo_full_name } }),
};

export default api;
