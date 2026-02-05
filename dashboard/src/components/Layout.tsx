import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  Webhook,
  Key,
  FileText,
  LogOut,
  Send,
  Server,
  Puzzle,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { type UserRole } from '../hooks/useRole';
import './Layout.css';

interface LayoutProps {
  onLogout: () => void;
  userRole: UserRole | null;
}

const allNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
  { to: '/sessions', icon: Smartphone, label: 'Sessions', adminOnly: false },
  { to: '/webhooks', icon: Webhook, label: 'Webhooks', adminOnly: false },
  { to: '/api-keys', icon: Key, label: 'API Keys', adminOnly: true },
  { to: '/message-tester', icon: Send, label: 'Message Tester', adminOnly: false },
  { to: '/infrastructure', icon: Server, label: 'Infrastructure', adminOnly: false },
  { to: '/plugins', icon: Puzzle, label: 'Plugins', adminOnly: true },
  { to: '/logs', icon: FileText, label: 'Logs', adminOnly: false },
];

const themeIcons = { light: Sun, dark: Moon, system: Monitor };
const themeLabels = { light: 'Light', dark: 'Dark', system: 'System' };

export function Layout({ onLogout, userRole }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = themeIcons[theme];

  // Filter navigation items based on user role
  const navItems = allNavItems.filter(item => !item.adminOnly || userRole === 'admin');

  // Sidebar state - collapsed on desktop, hidden on mobile
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar when nav item is clicked
  const handleNavClick = () => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  // Handle body scroll lock when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  return (
    <div className="layout">
      {/* Mobile Header */}
      {isMobile && (
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={toggleMobile}>
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="mobile-brand">
            <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
            <span className="brand-name">OpenWA</span>
          </div>
          <div style={{ width: 40 }} /> {/* Spacer for centering */}
        </header>
      )}

      {/* Overlay for mobile */}
      {isMobile && isMobileOpen && <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isMobileOpen ? 'open' : ''}`}
      >
        <div className="sidebar-header">
          <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
          {!isCollapsed && (
            <div className="sidebar-brand">
              <span className="brand-name">OpenWA</span>
              <span className="brand-subtitle">WhatsApp API</span>
            </div>
          )}
        </div>

        {/* Collapse toggle button - positioned at edge */}
        {!isMobile && (
          <button className="collapse-toggle" onClick={toggleCollapse} title={isCollapsed ? 'Expand' : 'Collapse'}>
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={to === '/'}
              onClick={handleNavClick}
              title={isCollapsed ? label : undefined}
            >
              <Icon size={20} />
              {!isCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme} title={`Theme: ${themeLabels[theme]}`}>
            <ThemeIcon size={18} />
            {!isCollapsed && <span>{themeLabels[theme]}</span>}
          </button>
          <button className="logout-btn" onClick={onLogout} title={isCollapsed ? 'Logout' : undefined}>
            <LogOut size={20} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className={`main-content ${isCollapsed ? 'expanded' : ''} ${isMobile ? 'mobile' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
