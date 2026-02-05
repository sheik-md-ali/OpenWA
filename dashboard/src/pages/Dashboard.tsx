import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Webhook, Activity, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { sessionApi, webhookApi, type Session, type SessionStats } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import './Dashboard.css';

export function Dashboard() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [webhookCount, setWebhookCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [sessionsData, statsData, webhooksData] = await Promise.all([
          sessionApi.list(),
          sessionApi.getStats(),
          webhookApi.listAll().catch(() => []),
        ]);
        setSessions(sessionsData);
        setStats(statsData);
        setWebhookCount(webhooksData.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleDisconnect = async (id: string) => {
    try {
      await sessionApi.stop(id);
      setSessions(sessions.map(s => (s.id === id ? { ...s, status: 'disconnected' } : s)));
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const statsCards = [
    {
      label: 'Active Sessions',
      value: stats?.active ?? 0,
      icon: MessageSquare,
      trend: `+${stats?.ready ?? 0}`,
      trendUp: true,
    },
    { label: 'Messages Today', value: '—', icon: Send, trend: '0', trendUp: null },
    { label: 'Webhooks Configured', value: webhookCount, icon: Webhook, trend: '0', trendUp: null },
    { label: 'API Calls (24h)', value: '—', icon: Activity, trend: '0', trendUp: null },
  ];

  const formatLastActive = (date?: string) => {
    if (!date) return 'Never';
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      created: 'New',
      idle: 'Idle',
      initializing: 'Starting...',
      connecting: 'Connecting...',
      qr_ready: 'Scan QR',
      ready: 'Connected',
      disconnected: 'Disconnected',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div
        className="dashboard"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard" style={{ padding: '2rem' }}>
        <div style={{ background: '#FEE2E2', padding: '1rem', borderRadius: '8px', color: '#DC2626' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your WhatsApp sessions and activity"
        badge={
          <span className={`status-badge ${stats && stats.ready > 0 ? 'connected' : 'disconnected'}`}>
            {stats && stats.ready > 0 ? 'Connected' : 'Disconnected'}
          </span>
        }
      />

      <div className="stats-grid">
        {statsCards.map(({ label, value, icon: Icon, trend, trendUp }) => (
          <div key={label} className="stat-card">
            <Icon className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{label}</span>
              <Icon size={20} className="stat-icon" />
            </div>
            <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            {trend !== '0' && (
              <div className={`stat-trend ${trendUp ? 'up' : 'down'}`}>
                {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {trend}
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="sessions-section">
        <div className="section-header">
          <h2>Sessions Overview</h2>
          <span className="section-subtitle">
            Showing {sessions.length} of {stats?.total ?? 0} sessions
          </span>
        </div>

        <div className="sessions-table">
          <div className="table-header">
            <span>Session ID</span>
            <span>Phone Number</span>
            <span>Status</span>
            <span>Last Active</span>
            <span>Actions</span>
          </div>
          {sessions.length === 0 ? (
            <div className="table-row" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
              No sessions found. Create one to get started.
            </div>
          ) : (
            sessions.map(session => (
              <div key={session.id} className="table-row">
                <div className="session-info-cell">
                  <span className="session-id">{session.id.substring(0, 12)}</span>
                  <span className="session-name" title={session.name}>
                    {session.name}
                  </span>
                </div>
                <span className="phone">{session.phone || '—'}</span>
                <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
                <span className="last-active">{formatLastActive(session.lastActive)}</span>
                <div className="actions">
                  <button className="btn-sm" onClick={() => navigate('/sessions')}>
                    View
                  </button>
                  {['ready', 'initializing', 'connecting', 'qr_ready'].includes(session.status) && (
                    <button className="btn-sm danger" onClick={() => handleDisconnect(session.id)}>
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
