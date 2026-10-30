import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { RouteGuard } from '@/components/common/RouteGuard';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { routes } from './routes';

const App = () => (
  <Router>
    <AuthProvider>
      <RouteGuard>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </RouteGuard>
    </AuthProvider>
  </Router>
);

export default App;
