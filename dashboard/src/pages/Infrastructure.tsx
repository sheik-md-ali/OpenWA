import { useState, useEffect } from 'react';
import {
  Database,
  Server,
  HardDrive,
  Save,
  ExternalLink,
  Loader2,
  CheckCircle,
  Trash2,
  Globe,
  Webhook,
  Gauge,
} from 'lucide-react';
import { infraApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import './Infrastructure.css';

// Watermark icons
import sqliteIcon from '../assets/icons/sqlite.svg';
import postgresIcon from '../assets/icons/postgresql.svg';
import folderIcon from '../assets/icons/folder.svg';
import s3Icon from '../assets/icons/s3.svg';

interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  builtIn: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  sslEnabled: boolean;
}

interface RedisConfig {
  builtIn: boolean;
  host: string;
  port: string;
  password: string;
  connected: boolean;
}

interface StorageConfig {
  type: 'local' | 's3';
  builtIn: boolean;
  localPath: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Endpoint: string;
}

interface QueueStats {
  pending: number;
  completed: number;
  failed: number;
}

interface ServerConfig {
  port: string;
  nodeEnv: 'production' | 'development';
  domain: string;
  dashboardPort: string;
  baseUrl: string;
  dashboardUrl: string;
  corsOrigins: string;
}

interface WebhookConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface RateLimitConfig {
  ttl: number;
  max: number;
}

export function Infrastructure() {
  useDocumentTitle('Infrastructure');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restartCountdown, setRestartCountdown] = useState(0);
  const [restartStatus, setRestartStatus] = useState<'idle' | 'restarting' | 'waiting' | 'success' | 'error'>('idle');

  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    type: 'sqlite',
    builtIn: false,
    host: 'localhost',
    port: '5432',
    username: 'postgres',
    password: '',
    database: 'openwa',
    poolSize: 10,
    sslEnabled: false,
  });

  const [redisConfig, setRedisConfig] = useState<RedisConfig>({
    builtIn: false,
    host: 'localhost',
    port: '6379',
    password: '',
    connected: false,
  });

  const [storageConfig, setStorageConfig] = useState<StorageConfig>({
    type: 'local',
    builtIn: false,
    localPath: './data/media',
    s3Bucket: '',
    s3Region: 'ap-southeast-1',
    s3AccessKey: '',
    s3SecretKey: '',
    s3Endpoint: '',
  });

  const [queueStats, setQueueStats] = useState({
    messages: { pending: 0, completed: 0, failed: 0 } as QueueStats,
    webhooks: { pending: 0, completed: 0, failed: 0 } as QueueStats,
  });

  const [redisEnabled, setRedisEnabled] = useState(false);
  const [queueEnabled, setQueueEnabled] = useState(false);
  const [pendingProfiles, setPendingProfiles] = useState<string[]>([]);
  const [previousProfiles, setPreviousProfiles] = useState<string[]>([]); // Track previously enabled for removal

  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    port: '2785',
    nodeEnv: 'development',
    domain: 'localhost',
    dashboardPort: '2886',
    baseUrl: '',
    dashboardUrl: '',
    corsOrigins: '*',
  });

  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    timeout: 10000,
    maxRetries: 3,
    retryDelay: 5000,
  });

  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig>({
    ttl: 60,
    max: 100,
  });

  // Fetch infrastructure status from API
  useEffect(() => {
    const fetchInfraStatus = async () => {
      try {
        const status = await infraApi.getStatus();

        // Update configs with real data
        setDbConfig(prev => ({
          ...prev,
          type: (status.database.type as 'sqlite' | 'postgres') || 'sqlite',
          host: status.database.host || 'localhost',
        }));

        setRedisConfig(prev => ({
          ...prev,
          host: status.redis.host,
          port: String(status.redis.port),
          connected: status.redis.connected,
        }));

        setStorageConfig(prev => ({
          ...prev,
          type: status.storage.type,
          localPath: status.storage.path || './uploads',
        }));

        setQueueEnabled(status.queue.enabled);
        setQueueStats({
          messages: status.queue.messages,
          webhooks: status.queue.webhooks,
        });
      } catch (err) {
        console.error('Failed to fetch infra status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInfraStatus();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div
        className="infrastructure-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const updateDbConfig = (key: keyof DatabaseConfig, value: string | number | boolean) => {
    setDbConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateRedisConfig = (key: keyof RedisConfig, value: string | boolean) => {
    setRedisConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateStorageConfig = (key: keyof StorageConfig, value: string | boolean) => {
    setStorageConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateServerConfig = (key: keyof ServerConfig, value: string) => {
    setServerConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateWebhookConfig = (key: keyof WebhookConfig, value: number) => {
    setWebhookConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateRateLimitConfig = (key: keyof RateLimitConfig, value: number) => {
    setRateLimitConfig(prev => ({ ...prev, [key]: value }));
  };

  // Save and restart handlers
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const payload = {
        database: {
          type: dbConfig.type,
          builtIn: dbConfig.builtIn,
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          poolSize: dbConfig.poolSize,
          sslEnabled: dbConfig.sslEnabled,
        },
        redis: {
          enabled: redisEnabled,
          builtIn: redisConfig.builtIn,
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
        },
        queue: {
          enabled: queueEnabled,
        },
        storage: {
          type: storageConfig.type,
          builtIn: storageConfig.builtIn,
          localPath: storageConfig.localPath,
          s3Bucket: storageConfig.s3Bucket,
          s3Region: storageConfig.s3Region,
          s3AccessKey: storageConfig.s3AccessKey,
          s3SecretKey: storageConfig.s3SecretKey,
          s3Endpoint: storageConfig.s3Endpoint,
        },
        server: {
          port: serverConfig.port,
          nodeEnv: serverConfig.nodeEnv,
          domain: serverConfig.domain,
          dashboardPort: serverConfig.dashboardPort,
          baseUrl: serverConfig.baseUrl,
          dashboardUrl: serverConfig.dashboardUrl,
          corsOrigins: serverConfig.corsOrigins,
        },
        webhook: {
          timeout: webhookConfig.timeout,
          maxRetries: webhookConfig.maxRetries,
          retryDelay: webhookConfig.retryDelay,
        },
        rateLimit: {
          ttl: rateLimitConfig.ttl,
          max: rateLimitConfig.max,
        },
      };

      const result = await infraApi.saveConfig(payload);
      if (result.saved) {
        // Store current profiles as previous before updating to new ones
        setPreviousProfiles(pendingProfiles);
        setPendingProfiles(result.profiles || []);
        setShowRestartModal(true);
      } else {
        alert('Failed to save configuration: ' + result.message);
      }
    } catch (err) {
      alert('Failed to save configuration: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    setRestartStatus('restarting');
    setRestartCountdown(30); // Default, will be updated after API call

    // Compute profiles to remove (were enabled before, now disabled)
    const profilesToRemove = previousProfiles.filter(p => !pendingProfiles.includes(p));

    let countdownTime = 30; // Default fallback
    try {
      const response = await infraApi.restart(pendingProfiles, profilesToRemove);
      // Use server-provided estimated time if available
      if (response.estimatedTime) {
        countdownTime = response.estimatedTime;
        setRestartCountdown(countdownTime);
      }
    } catch {
      // Expected - server is shutting down, use default countdown
    }

    // Start countdown (visual feedback only)
    setRestartStatus('waiting');

    // Store interval ID to allow early termination when health check succeeds
    let intervalRef: ReturnType<typeof setInterval> | null = null;

    const stopCountdown = () => {
      if (intervalRef) {
        clearInterval(intervalRef);
        intervalRef = null;
      }
    };

    intervalRef = setInterval(() => {
      setRestartCountdown(prev => {
        if (prev <= 1) {
          stopCountdown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Start health polling IMMEDIATELY - this is more accurate than countdown
    // Server will respond as soon as it's ready, stopping countdown early
    checkServerHealth(stopCountdown);
  };

  const checkServerHealth = async (stopCountdown?: () => void) => {
    let attempts = 0;
    const maxAttempts = 60; // Allow up to 60 attempts (60 seconds)

    const check = async () => {
      try {
        await infraApi.healthCheck();
        // Server is back! Stop countdown and show success
        stopCountdown?.();
        setRestartCountdown(0);
        setRestartStatus('success');
        // Reload page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(check, 1000);
        } else {
          setRestartStatus('error');
        }
      }
    };

    // Start checking immediately with a small delay for server to begin shutdown
    setTimeout(check, 3000);
  };

  return (
    <div className="infrastructure-page">
      <PageHeader title="Infrastructure" subtitle="Configure server, database, cache, storage, and engine settings" />

      <div className="infra-sections">
        {/* Server Configuration Section */}
        <section className="infra-card">
          <div className="card-header">
            <div className="header-left">
              <Globe size={20} />
              <h2>Server Configuration</h2>
            </div>
            <span className={`status-indicator ${serverConfig.nodeEnv === 'production' ? 'connected' : 'sqlite'}`}>
              ● {serverConfig.nodeEnv === 'production' ? 'Production' : 'Development'}
            </span>
          </div>

          <div className="config-form">
            <div className="form-row">
              <div className="form-group">
                <label>Environment</label>
                <select
                  value={serverConfig.nodeEnv}
                  onChange={e => updateServerConfig('nodeEnv', e.target.value as 'production' | 'development')}
                >
                  <option value="production">Production</option>
                  <option value="development">Development</option>
                </select>
              </div>
              <div className="form-group">
                <label>Domain</label>
                <input
                  type="text"
                  value={serverConfig.domain}
                  onChange={e => updateServerConfig('domain', e.target.value)}
                  placeholder="localhost"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group small">
                <label>API Port</label>
                <input
                  type="text"
                  value={serverConfig.port}
                  onChange={e => updateServerConfig('port', e.target.value)}
                />
              </div>
              <div className="form-group small">
                <label>Dashboard Port</label>
                <input
                  type="text"
                  value={serverConfig.dashboardPort}
                  onChange={e => updateServerConfig('dashboardPort', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>CORS Origins</label>
                <input
                  type="text"
                  value={serverConfig.corsOrigins}
                  onChange={e => updateServerConfig('corsOrigins', e.target.value)}
                  placeholder="* or comma-separated origins"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Public API URL (optional)</label>
                <input
                  type="text"
                  value={serverConfig.baseUrl}
                  onChange={e => updateServerConfig('baseUrl', e.target.value)}
                  placeholder="https://api.yourdomain.com"
                />
              </div>
              <div className="form-group">
                <label>Public Dashboard URL (optional)</label>
                <input
                  type="text"
                  value={serverConfig.dashboardUrl}
                  onChange={e => updateServerConfig('dashboardUrl', e.target.value)}
                  placeholder="https://dashboard.yourdomain.com"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Webhook & Rate Limiting Section */}
        <section className="infra-card">
          <div className="card-header">
            <div className="header-left">
              <Webhook size={20} />
              <h2>Webhook & Rate Limiting</h2>
            </div>
          </div>

          <div className="config-form">
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', color: '#475569', fontWeight: 600 }}>
              <Webhook size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              Webhook Settings
            </h3>
            <div className="form-row">
              <div className="form-group">
                <label>Timeout (ms)</label>
                <input
                  type="number"
                  value={webhookConfig.timeout}
                  onChange={e => updateWebhookConfig('timeout', parseInt(e.target.value) || 10000)}
                />
              </div>
              <div className="form-group small">
                <label>Max Retries</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={webhookConfig.maxRetries}
                  onChange={e => updateWebhookConfig('maxRetries', parseInt(e.target.value) || 3)}
                />
              </div>
              <div className="form-group">
                <label>Retry Delay (ms)</label>
                <input
                  type="number"
                  value={webhookConfig.retryDelay}
                  onChange={e => updateWebhookConfig('retryDelay', parseInt(e.target.value) || 5000)}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', color: '#475569', fontWeight: 600 }}>
                <Gauge size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Rate Limiting
              </h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Time Window (seconds)</label>
                  <input
                    type="number"
                    value={rateLimitConfig.ttl}
                    onChange={e => updateRateLimitConfig('ttl', parseInt(e.target.value) || 60)}
                  />
                </div>
                <div className="form-group">
                  <label>Max Requests per Window</label>
                  <input
                    type="number"
                    value={rateLimitConfig.max}
                    onChange={e => updateRateLimitConfig('max', parseInt(e.target.value) || 100)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Database Section */}
        <section className="infra-card">
          <div className="card-header">
            <div className="header-left">
              <Database size={20} />
              <h2>Database Configuration</h2>
            </div>
            <span className={`status-indicator ${dbConfig.type === 'postgres' ? 'connected' : 'sqlite'}`}>
              ● {dbConfig.type === 'postgres' ? 'PostgreSQL' : 'SQLite'}
            </span>
          </div>

          <div className="radio-group">
            <label className={`radio-option ${dbConfig.type === 'sqlite' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="dbType"
                checked={dbConfig.type === 'sqlite'}
                onChange={() => updateDbConfig('type', 'sqlite')}
              />
              <img src={sqliteIcon} alt="" className="watermark-icon" />
              <span>SQLite</span>
              <small>Local file-based database</small>
            </label>
            <label className={`radio-option ${dbConfig.type === 'postgres' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="dbType"
                checked={dbConfig.type === 'postgres'}
                onChange={() => updateDbConfig('type', 'postgres')}
              />
              <img src={postgresIcon} alt="" className="watermark-icon" />
              <span>PostgreSQL</span>
              <small>Production-ready database</small>
            </label>
          </div>

          {dbConfig.type === 'postgres' && (
            <>
              <div className="toggle-row" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <div className="toggle-info">
                  <span>Use Built-in PostgreSQL Container</span>
                  <small>OpenWA will manage a PostgreSQL container for you</small>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={dbConfig.builtIn}
                    onChange={e => updateDbConfig('builtIn', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {!dbConfig.builtIn && (
                <div className="config-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Host</label>
                      <input type="text" value={dbConfig.host} onChange={e => updateDbConfig('host', e.target.value)} />
                    </div>
                    <div className="form-group small">
                      <label>Port</label>
                      <input type="text" value={dbConfig.port} onChange={e => updateDbConfig('port', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Username</label>
                      <input
                        type="text"
                        value={dbConfig.username}
                        onChange={e => updateDbConfig('username', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        value={dbConfig.password}
                        onChange={e => updateDbConfig('password', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Database Name</label>
                      <input
                        type="text"
                        value={dbConfig.database}
                        onChange={e => updateDbConfig('database', e.target.value)}
                      />
                    </div>
                    <div className="form-group small">
                      <label>Pool Size</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={dbConfig.poolSize}
                        onChange={e => updateDbConfig('poolSize', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="toggle-row">
                    <div className="toggle-info">
                      <span>SSL Connection</span>
                      <small>Enable TLS/SSL for secure database connections</small>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={dbConfig.sslEnabled}
                        onChange={e => updateDbConfig('sslEnabled', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          <div
            className="empty-state-card"
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px dashed #E2E8F0',
              marginTop: '1rem',
            }}
          >
            <Database size={32} style={{ color: '#22C55E', marginBottom: '1rem', opacity: 0.7 }} />
            <p style={{ margin: 0, color: '#475569', fontSize: '0.9375rem', fontWeight: 500 }}>Database Migrations</p>
            <p
              style={{
                margin: '0.75rem 0 0',
                color: '#22C55E',
                fontSize: '0.875rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
              }}
            >
              <CheckCircle size={16} />
              Schema is auto-synchronized with TypeORM
            </p>
            <p style={{ margin: '0.5rem 0 0', color: '#64748B', fontSize: '0.8125rem', lineHeight: 1.5 }}>
              Migrations are managed automatically. Use CLI for manual migrations.
            </p>
          </div>
        </section>

        {/* Redis Section */}
        <section className="infra-card">
          <div className="card-header">
            <div className="header-left">
              <Server size={20} />
              <h2>Redis</h2>
            </div>
            <span
              className={`status-indicator ${redisEnabled && redisConfig.connected ? 'connected' : 'disconnected'}`}
            >
              ● {redisEnabled ? (redisConfig.connected ? 'Connected' : 'Disconnected') : 'Disabled'}
            </span>
          </div>

          <div
            className="toggle-row"
            style={{
              borderBottom: redisEnabled ? '1px solid var(--border)' : 'none',
              marginBottom: redisEnabled ? '1.5rem' : 0,
              paddingBottom: redisEnabled ? '1.25rem' : 0,
            }}
          >
            <div className="toggle-info">
              <span>Enable Redis</span>
              <small>Required for caching, session storage, and BullMQ queues</small>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={redisEnabled}
                onChange={e => {
                  setRedisEnabled(e.target.checked);
                  if (!e.target.checked) setQueueEnabled(false);
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {redisEnabled ? (
            <>
              <div className="toggle-row" style={{ marginBottom: '1rem' }}>
                <div className="toggle-info">
                  <span>Use Built-in Redis Container</span>
                  <small>OpenWA will manage a Redis container for you</small>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={redisConfig.builtIn}
                    onChange={e => updateRedisConfig('builtIn', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {!redisConfig.builtIn && (
                <div className="config-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Host</label>
                      <input
                        type="text"
                        value={redisConfig.host}
                        onChange={e => updateRedisConfig('host', e.target.value)}
                      />
                    </div>
                    <div className="form-group small">
                      <label>Port</label>
                      <input
                        type="text"
                        value={redisConfig.port}
                        onChange={e => updateRedisConfig('port', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        value={redisConfig.password}
                        onChange={e => updateRedisConfig('password', e.target.value)}
                        placeholder="(optional)"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* BullMQ Queue Toggle */}
              <div
                className="toggle-row"
                style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}
              >
                <div className="toggle-info">
                  <span>Enable BullMQ Queue System</span>
                  <small>Use message queues for reliable message and webhook delivery</small>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={queueEnabled} onChange={e => setQueueEnabled(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {queueEnabled && (
                <div className="queue-stats">
                  <h3>Queue Statistics</h3>
                  <div className="stats-row">
                    <div className="queue-stat-card">
                      <h4>Message Queue</h4>
                      <div className="stat-values">
                        <div className="stat-item pending">
                          <span className="value">{queueStats.messages.pending}</span>
                          <span className="label">Pending</span>
                        </div>
                        <div className="stat-item completed">
                          <span className="value">{queueStats.messages.completed.toLocaleString()}</span>
                          <span className="label">Completed</span>
                        </div>
                        <div className="stat-item failed">
                          <span className="value">{queueStats.messages.failed}</span>
                          <span className="label">Failed</span>
                        </div>
                      </div>
                    </div>
                    <div className="queue-stat-card">
                      <h4>Webhook Queue</h4>
                      <div className="stat-values">
                        <div className="stat-item pending">
                          <span className="value">{queueStats.webhooks.pending}</span>
                          <span className="label">Pending</span>
                        </div>
                        <div className="stat-item completed">
                          <span className="value">{queueStats.webhooks.completed.toLocaleString()}</span>
                          <span className="label">Completed</span>
                        </div>
                        <div className="stat-item failed">
                          <span className="value">{queueStats.webhooks.failed}</span>
                          <span className="label">Failed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="queue-actions">
                    <button className="btn-danger-outline">
                      <Trash2 size={16} />
                      Clear Failed Jobs
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => window.open('http://localhost:2785/api/admin/queues', '_blank')}
                    >
                      <ExternalLink size={16} />
                      View Bull MQ Dashboard
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="empty-state-card"
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                background: '#F8FAFC',
                borderRadius: '12px',
                border: '1px dashed #E2E8F0',
                marginTop: '1rem',
              }}
            >
              <Server size={32} style={{ color: '#94A3B8', marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ margin: 0, color: '#475569', fontSize: '0.9375rem', fontWeight: 500 }}>Redis is Disabled</p>
              <p style={{ margin: '0.5rem 0 0', color: '#64748B', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                Enable Redis for caching, session storage, <br />
                and BullMQ message queues.
              </p>
            </div>
          )}
        </section>

        {/* Storage Section */}
        <section className="infra-card">
          <div className="card-header">
            <div className="header-left">
              <HardDrive size={20} />
              <h2>Storage Configuration</h2>
            </div>
          </div>

          <div className="radio-group">
            <label className={`radio-option ${storageConfig.type === 'local' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="storageType"
                checked={storageConfig.type === 'local'}
                onChange={() => updateStorageConfig('type', 'local')}
              />
              <img src={folderIcon} alt="" className="watermark-icon" />
              <span>Local Filesystem</span>
              <small>Store media files locally</small>
            </label>
            <label className={`radio-option ${storageConfig.type === 's3' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="storageType"
                checked={storageConfig.type === 's3'}
                onChange={() => updateStorageConfig('type', 's3')}
              />
              <img src={s3Icon} alt="" className="watermark-icon" />
              <span>Amazon S3</span>
              <small>Cloud storage (S3 compatible)</small>
            </label>
          </div>

          <div className="config-form">
            {storageConfig.type === 'local' && (
              <div className="form-group">
                <label>Storage Path</label>
                <input
                  type="text"
                  value={storageConfig.localPath}
                  onChange={e => updateStorageConfig('localPath', e.target.value)}
                />
              </div>
            )}

            {storageConfig.type === 's3' && (
              <>
                <div className="toggle-row" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <div className="toggle-info">
                    <span>Use Built-in MinIO Container</span>
                    <small>OpenWA will manage a MinIO (S3-compatible) container for you</small>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={storageConfig.builtIn}
                      onChange={e => updateStorageConfig('builtIn', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {!storageConfig.builtIn && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Bucket Name</label>
                        <input
                          type="text"
                          value={storageConfig.s3Bucket}
                          onChange={e => updateStorageConfig('s3Bucket', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Region</label>
                        <input
                          type="text"
                          value={storageConfig.s3Region}
                          onChange={e => updateStorageConfig('s3Region', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Access Key</label>
                        <input
                          type="text"
                          value={storageConfig.s3AccessKey}
                          onChange={e => updateStorageConfig('s3AccessKey', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Secret Key</label>
                        <input
                          type="password"
                          value={storageConfig.s3SecretKey}
                          onChange={e => updateStorageConfig('s3SecretKey', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Custom Endpoint (optional)</label>
                      <input
                        type="text"
                        value={storageConfig.s3Endpoint}
                        onChange={e => updateStorageConfig('s3Endpoint', e.target.value)}
                        placeholder="For MinIO or other S3-compatible services"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Restart Modal */}
      {showRestartModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none' }}>
              <h2>
                {restartStatus === 'idle' && '⚙️ Configuration Saved'}
                {restartStatus === 'restarting' && '🔄 Restarting Server...'}
                {restartStatus === 'waiting' && '⏳ Please Wait...'}
                {restartStatus === 'success' && '✅ Server Ready'}
                {restartStatus === 'error' && '❌ Restart Failed'}
              </h2>
            </div>
            <div className="modal-body" style={{ padding: '2rem' }}>
              {restartStatus === 'idle' && (
                <>
                  <p style={{ fontSize: '1rem', color: '#475569', marginBottom: '1.5rem' }}>
                    Configuration has been saved to <code>.env.generated</code>.<br />A server restart is required to
                    apply the changes.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={() => setShowRestartModal(false)}>
                      Restart Later
                    </button>
                    <button className="btn-primary" onClick={handleRestart}>
                      Restart Now
                    </button>
                  </div>
                </>
              )}

              {(restartStatus === 'restarting' || restartStatus === 'waiting') && (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <Loader2 className="animate-spin" size={48} style={{ color: '#22C55E', marginBottom: '1rem' }} />
                    <p style={{ fontSize: '1.125rem', color: '#1E293B', fontWeight: 500 }}>
                      {restartCountdown > 0 ? `Server restarting... ${restartCountdown}s` : 'Checking server status...'}
                    </p>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background: '#E2E8F0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: restartCountdown > 0 ? `${((30 - restartCountdown) / 30) * 100}%` : '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, #22C55E, #10B981)',
                        transition: 'width 1s linear',
                      }}
                    />
                  </div>
                  <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#64748B' }}>
                    Please do not close this window
                  </p>
                </>
              )}

              {restartStatus === 'success' && (
                <>
                  <CheckCircle size={48} style={{ color: '#22C55E', marginBottom: '1rem' }} />
                  <p style={{ fontSize: '1rem', color: '#475569' }}>
                    Server is back online! The page will reload automatically.
                  </p>
                </>
              )}

              {restartStatus === 'error' && (
                <>
                  <p style={{ fontSize: '1rem', color: '#DC2626', marginBottom: '1rem' }}>
                    Server did not respond after 30 seconds.
                    <br />
                    Please check the Docker logs and restart manually.
                  </p>
                  <button className="btn-primary" onClick={() => window.location.reload()}>
                    Reload Page
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="page-footer">
        <button className="btn-primary large" onClick={handleSaveConfig} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </footer>
    </div>
  );
}
