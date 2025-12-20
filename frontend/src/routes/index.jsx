import { createBrowserRouter } from 'react-router-dom';
import ResultsPage from '../pages/ResultsPage.jsx';
import App from '../App';
import CodeCity3D from '../components/Visualization/CodeCity3D';
import GitHubUploadPage from '../pages/GitHubUploadPage.jsx';
import GitHubCallbackPage from '../pages/GitHubCallbackPage.jsx';
import BlockStack from '../components/Visualization/BlockStack.jsx';
import Results from '../components/results/Results.jsx';

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
    path: '/analyze',
    element: <App />,
  },
  {
    path: '/3d',
    element: <CodeCity3D />,
  },
  {
    path: '/results',
    element: <ResultsPage />,
  },
  {
    path: '/stack',
    element: <BlockStack />,
  },
]);

export default router;


