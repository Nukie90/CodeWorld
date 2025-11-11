import { createBrowserRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import App from '../App';
import CodeCity3D from '../components/Visualization/CodeCity3D';
import GitHubUploadPage from '../pages/GitHubUploadPage.jsx';
import BlockStack from '../components/Visualization/BlockStack.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
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
    path: '/upload',
    element: <GitHubUploadPage />,
  },
  {
    path: '/stack',
    element: <BlockStack />,
  },
]);

export default router;


