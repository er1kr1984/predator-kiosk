import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import KioskPage from './pages/KioskPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

function RequireUser({ children }) {
  const user = sessionStorage.getItem('kioskUser');
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const user = sessionStorage.getItem('kioskUser');
  const isAdmin = sessionStorage.getItem('kioskIsAdmin') === 'true';
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/kiosk" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/kiosk"
          element={
            <RequireUser>
              <KioskPage />
            </RequireUser>
          }
        />
        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      </Routes>
    </BrowserRouter>
  );
}
