import { createBrowserRouter } from 'react-router-dom';
import ResultsPage from '../pages/ResultsPage.jsx';
import GitHubUploadPage from '../pages/GitHubUploadPage.jsx';
import GitHubCallbackPage from '../pages/GitHubCallbackPage.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <GitHubUploadPage />,
  },
  {
    path: '/auth/callback/github',
    element: <GitHubCallbackPage />,
  },
  {
    path: '/results',
    element: <ResultsPage />,
  }
]);

export default router;


