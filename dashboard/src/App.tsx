import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Sessions } from './pages/Sessions';
import { Webhooks } from './pages/Webhooks';
import { Logs } from './pages/Logs';
import { ApiKeys } from './pages/ApiKeys';
import { MessageTester } from './pages/MessageTester';
import { Infrastructure } from './pages/Infrastructure';
import Plugins from './pages/Plugins';
import { ToastProvider } from './components/Toast';
import { RoleProvider, useRole, type UserRole } from './hooks/useRole';
import './App.css';

function AppContent() {
  // Initialize from localStorage to avoid setState in effect
  const savedKey = localStorage.getItem('openwa_api_key');
  const [isAuthenticated, setIsAuthenticated] = useState(!!savedKey);
  const [, setApiKey] = useState(savedKey || '');
  const { setRole, role } = useRole();

  const handleLogin = async (key: string) => {
    setApiKey(key);
    localStorage.setItem('openwa_api_key', key);

    // Fetch the role from API
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'X-API-Key': key },
      });
      if (response.ok) {
        const data = await response.json();
        setRole(data.role as UserRole);
      }
    } catch {
      // Default to viewer if we can't fetch role
      setRole('viewer');
    }

    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setApiKey('');
    setIsAuthenticated(false);
    setRole(null);
    localStorage.removeItem('openwa_api_key');
  };

  // Re-validate and get role on mount if already authenticated
  useEffect(() => {
    if (!savedKey) return;

    fetch('/api/auth/validate', {
      method: 'POST',
      headers: { 'X-API-Key': savedKey },
    })
      .then(res => res.json())
      .then(data => {
        if (data.valid && data.role) {
          setRole(data.role as UserRole);
        }
      })
      .catch(() => {
        // Keep existing role from localStorage if validation fails
      });
  }, [savedKey, setRole]);

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
            <Route index element={<Dashboard />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="webhooks" element={<Webhooks />} />
            {role === 'admin' && <Route path="api-keys" element={<ApiKeys />} />}
            <Route path="logs" element={<Logs />} />
            <Route path="message-tester" element={<MessageTester />} />
            <Route path="infrastructure" element={<Infrastructure />} />
            {role === 'admin' && <Route path="plugins" element={<Plugins />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

function App() {
  return (
    <RoleProvider>
      <AppContent />
    </RoleProvider>
  );
}

export default App;
