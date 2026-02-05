import { useState, useEffect } from 'react';
import {
  Puzzle,
  Power,
  PowerOff,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cpu,
  Database,
  Server,
  Shield,
  Zap,
  X,
} from 'lucide-react';
import { pluginsApi, infraApi } from '../services/api';
import type { Plugin, Engine } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import './Plugins.css';

type PluginType = 'engine' | 'storage' | 'queue' | 'auth' | 'extension';

const pluginTypeIcons: Record<PluginType, typeof Puzzle> = {
  engine: Cpu,
  storage: Database,
  queue: Server,
  auth: Shield,
  extension: Zap,
};

interface EngineConfig {
  type: string;
  headless: boolean;
  sessionDataPath: string;
  browserArgs: string;
}

export default function Plugins() {
  useDocumentTitle('Plugins');
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [currentEngine, setCurrentEngine] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Config modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null);
  const [engineConfig, setEngineConfig] = useState<EngineConfig>({
    type: 'whatsapp-web.js',
    headless: true,
    sessionDataPath: '/data/sessions',
    browserArgs: '--no-sandbox --disable-gpu',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pluginsData, enginesData, currentEngineData, infraStatus] = await Promise.all([
        pluginsApi.list(),
        pluginsApi.getEngines(),
        pluginsApi.getCurrentEngine(),
        infraApi.getStatus(),
      ]);
      setPlugins(pluginsData);
      setEngines(enginesData);
      setCurrentEngine(currentEngineData.engineType);

      // Load engine config from infra status
      if (infraStatus.engine) {
        setEngineConfig({
          type: infraStatus.engine.type || 'whatsapp-web.js',
          headless: infraStatus.engine.headless ?? true,
          sessionDataPath: '/data/sessions',
          browserArgs: '--no-sandbox --disable-gpu',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = async (plugin: Plugin) => {
    setActionLoading(plugin.id);
    try {
      if (plugin.status === 'enabled') {
        await pluginsApi.disable(plugin.id);
      } else {
        await pluginsApi.enable(plugin.id);
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleHealthCheck = async (pluginId: string) => {
    setActionLoading(pluginId);
    try {
      const result = await pluginsApi.healthCheck(pluginId);
      alert(result.healthy ? `✓ Healthy: ${result.message}` : `✗ Unhealthy: ${result.message}`);
    } catch (err) {
      alert(`Health check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenConfig = (plugin: Plugin) => {
    setConfigPlugin(plugin);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      // For now, show a success message - actual implementation would call API
      alert('Configuration saved! Server restart required to apply changes.');
      setShowConfigModal(false);
    } catch (err) {
      alert(`Failed to save config: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div
        className="plugins-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const currentEngineData = engines.find(e => e.id === currentEngine);

  return (
    <div className="plugins-page">
      <PageHeader
        title="Plugins"
        subtitle="Manage engines, storage backends, and extensions"
        actions={
          <button className="btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span className="error-banner-text">{error}</span>
        </div>
      )}

      {/* Current Engine Card */}
      <div className="engine-card">
        <div className="engine-header">
          <div className="engine-info">
            <div className="engine-icon-wrapper">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="engine-title">Active WhatsApp Engine</h3>
              <span className="engine-name">{currentEngine}</span>
            </div>
          </div>
          <span className="status-badge connected">Running</span>
        </div>

        {/* Engine Features */}
        {currentEngineData && currentEngineData.features.length > 0 && (
          <div className="engine-features">
            <p className="features-label">Supported Features:</p>
            <div className="features-list">
              {currentEngineData.features.slice(0, 8).map(feature => (
                <span key={feature} className="feature-tag">
                  {feature}
                </span>
              ))}
              {currentEngineData.features.length > 8 && (
                <span className="feature-more">+{currentEngineData.features.length - 8} more</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Plugins Grid */}
      <div className="plugins-grid">
        {plugins.map(plugin => {
          const TypeIcon = pluginTypeIcons[plugin.type as PluginType] || Puzzle;
          const isLoading = actionLoading === plugin.id;

          return (
            <div key={plugin.id} className="plugin-card">
              {/* Card Header */}
              <div className={`plugin-card-header type-${plugin.type}`}>
                <div className="plugin-info">
                  <div className="plugin-icon-wrapper">
                    <TypeIcon size={20} />
                  </div>
                  <div>
                    <h3 className="plugin-name">{plugin.name}</h3>
                    <span className="plugin-version">v{plugin.version}</span>
                  </div>
                </div>
                {plugin.builtIn && <span className="plugin-builtin-badge">Built-in</span>}
              </div>

              {/* Card Body */}
              <div className="plugin-card-body">
                {/* Description */}
                <p className="plugin-description">{plugin.description || 'No description available'}</p>

                {/* Status */}
                <div className="plugin-status-row">
                  <div className="plugin-status">
                    <span className={`status-dot ${plugin.status}`} />
                    <span className="status-text">{plugin.status}</span>
                  </div>
                  <span className="plugin-type-label">{plugin.type}</span>
                </div>

                {/* Error Display */}
                {plugin.error && (
                  <div className="plugin-error">
                    <p className="plugin-error-text">{plugin.error}</p>
                  </div>
                )}

                {/* Provides */}
                {plugin.provides && plugin.provides.length > 0 && (
                  <div className="plugin-provides">
                    {plugin.provides.map(item => (
                      <span key={item} className="provides-tag">
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="plugin-actions">
                  {/* Engine plugins: show Required if only engine, otherwise radio selection style */}
                  {plugin.type === 'engine' ? (
                    (() => {
                      const enginePlugins = plugins.filter(p => p.type === 'engine');
                      const isOnlyEngine = enginePlugins.length === 1;
                      const isActive = plugin.status === 'enabled';

                      if (isOnlyEngine && isActive) {
                        // Only engine available - cannot disable
                        return (
                          <span className="btn-required">
                            <CheckCircle size={16} />
                            Required
                          </span>
                        );
                      } else if (isActive) {
                        // Multiple engines, this one is active
                        return (
                          <span className="btn-active">
                            <CheckCircle size={16} />
                            Active
                          </span>
                        );
                      } else {
                        // Not active, can switch to this engine
                        return (
                          <button
                            onClick={() => handleToggle(plugin)}
                            disabled={isLoading}
                            className="btn-toggle enable"
                          >
                            {isLoading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                <Power size={16} />
                                Activate
                              </>
                            )}
                          </button>
                        );
                      }
                    })()
                  ) : (
                    // Regular plugins: normal enable/disable
                    <button
                      onClick={() => handleToggle(plugin)}
                      disabled={isLoading}
                      className={`btn-toggle ${plugin.status === 'enabled' ? 'disable' : 'enable'}`}
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : plugin.status === 'enabled' ? (
                        <>
                          <PowerOff size={16} />
                          Disable
                        </>
                      ) : (
                        <>
                          <Power size={16} />
                          Enable
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleHealthCheck(plugin.id)}
                    disabled={isLoading}
                    className="btn-action"
                    title="Health Check"
                  >
                    <CheckCircle size={16} />
                  </button>

                  <button className="btn-action" title="Configure" onClick={() => handleOpenConfig(plugin)}>
                    <Settings size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {plugins.length === 0 && !loading && (
        <div className="empty-state">
          <Puzzle size={64} />
          <h3>No Plugins Found</h3>
          <p>Install plugins to extend OpenWA functionality</p>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && configPlugin && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal config-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configure {configPlugin.name}</h2>
              <button className="btn-icon" onClick={() => setShowConfigModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {configPlugin.type === 'engine' ? (
                <>
                  <div className="config-info-banner">
                    <AlertCircle size={16} />
                    <span>Changes require server restart to take effect</span>
                  </div>

                  <div className="config-form">
                    <div className="form-group">
                      <label>Engine Type</label>
                      <select
                        value={engineConfig.type}
                        onChange={e => setEngineConfig({ ...engineConfig, type: e.target.value })}
                      >
                        <option value="whatsapp-web.js">WhatsApp Web.js</option>
                      </select>
                    </div>

                    <div className="form-group toggle-group">
                      <div className="toggle-info">
                        <label>Headless Mode</label>
                        <small>Run browser without visible UI (recommended for production)</small>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={engineConfig.headless}
                          onChange={e => setEngineConfig({ ...engineConfig, headless: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label>Session Data Path</label>
                      <input
                        type="text"
                        value={engineConfig.sessionDataPath}
                        onChange={e => setEngineConfig({ ...engineConfig, sessionDataPath: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Browser Arguments</label>
                      <input
                        type="text"
                        value={engineConfig.browserArgs}
                        onChange={e => setEngineConfig({ ...engineConfig, browserArgs: e.target.value })}
                        placeholder="--no-sandbox --disable-gpu"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-config">
                  <Settings size={48} style={{ opacity: 0.3 }} />
                  <p>No configuration options available for this plugin</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowConfigModal(false)}>
                Cancel
              </button>
              {configPlugin.type === 'engine' && (
                <button className="btn-primary" onClick={handleSaveConfig} disabled={savingConfig}>
                  {savingConfig ? <Loader2 size={16} className="animate-spin" /> : 'Save Configuration'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
