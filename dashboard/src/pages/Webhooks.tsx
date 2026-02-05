import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Play,
  ExternalLink,
  Loader2,
  X,
  Webhook as WebhookIcon,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { webhookApi, sessionApi, type Webhook, type Session } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { PageHeader } from '../components/PageHeader';
import './Webhooks.css';

const availableEvents = [
  { name: 'message.received', description: 'When a message is received' },
  { name: 'message.sent', description: 'When a message is sent' },
  { name: 'session.connected', description: 'When a session connects' },
  { name: 'session.disconnected', description: 'When a session disconnects' },
  { name: 'session.qr', description: 'When QR code is generated' },
  { name: '*', description: 'All events' },
];

export function Webhooks() {
  useDocumentTitle('Webhooks');
  const { canWrite } = useRole();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ sessionId: string; id: string; url: string } | null>(null);
  const [editWebhook, setEditWebhook] = useState<Webhook | null>(null);
  const [newWebhook, setNewWebhook] = useState({ url: '', events: ['message.received'], sessionId: '' });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [webhooksData, sessionsData] = await Promise.all([
        webhookApi.listAll().catch(() => []),
        sessionApi.list().catch(() => []),
      ]);
      setWebhooks(webhooksData);
      setSessions(sessionsData);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newWebhook.url || !newWebhook.sessionId) return;
    try {
      const created = await webhookApi.create(newWebhook.sessionId, {
        url: newWebhook.url,
        events: newWebhook.events,
      });
      setWebhooks([...webhooks, created]);
      setShowCreateModal(false);
      setNewWebhook({ url: '', events: ['message.received'], sessionId: '' });
      setToast({ type: 'success', message: 'Webhook created successfully' });
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to create webhook: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const confirmDelete = (sessionId: string, id: string, url: string) => {
    setDeleteTarget({ sessionId, id, url });
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await webhookApi.delete(deleteTarget.sessionId, deleteTarget.id);
      setWebhooks(webhooks.filter(w => w.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setToast({ type: 'success', message: 'Webhook deleted successfully' });
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to delete webhook: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const handleTest = async (sessionId: string, id: string) => {
    setTestingId(id);
    try {
      const result = await webhookApi.test(sessionId, id);
      if (result.success) {
        setToast({ type: 'success', message: `Webhook test successful! Status: ${result.statusCode}` });
      } else {
        setToast({ type: 'error', message: `Webhook test failed: ${result.error || `Status ${result.statusCode}`}` });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to test webhook: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setTestingId(null);
    }
  };

  const openEdit = (webhook: Webhook) => {
    setEditWebhook({ ...webhook });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editWebhook) return;
    try {
      const updated = await webhookApi.update(editWebhook.sessionId, editWebhook.id, {
        url: editWebhook.url,
        events: editWebhook.events,
        active: editWebhook.active,
      });
      setWebhooks(webhooks.map(w => (w.id === updated.id ? updated : w)));
      setShowEditModal(false);
      setEditWebhook(null);
      setToast({ type: 'success', message: 'Webhook updated successfully' });
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to update webhook: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const toggleEditEvent = (event: string) => {
    if (!editWebhook) return;
    setEditWebhook({
      ...editWebhook,
      events: editWebhook.events.includes(event)
        ? editWebhook.events.filter(e => e !== event)
        : [...editWebhook.events, event],
    });
  };

  const toggleNewEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event) ? prev.events.filter(e => e !== event) : [...prev.events, event],
    }));
  };

  if (loading) {
    return (
      <div
        className="webhooks-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="webhooks-page">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <PageHeader
        title="Webhooks"
        subtitle="Configure HTTP callbacks for real-time event notifications"
        actions={
          canWrite && (
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} />
              Add Webhook
            </button>
          )
        }
      />

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Webhook</h2>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>Session</label>
              <select
                value={newWebhook.sessionId}
                onChange={e => setNewWebhook({ ...newWebhook, sessionId: e.target.value })}
              >
                <option value="">Select session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <label>URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={newWebhook.url}
                onChange={e => setNewWebhook({ ...newWebhook, url: e.target.value })}
              />
              <label>Events</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {availableEvents.map(e => (
                  <button
                    key={e.name}
                    type="button"
                    className={`event-tag ${newWebhook.events.includes(e.name) ? 'selected' : ''}`}
                    onClick={() => toggleNewEvent(e.name)}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreate}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editWebhook && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Webhook</h2>
              <button className="btn-icon" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>URL</label>
              <input
                type="url"
                value={editWebhook.url}
                onChange={e => setEditWebhook({ ...editWebhook, url: e.target.value })}
              />
              <label>Events</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {availableEvents.map(e => (
                  <button
                    key={e.name}
                    type="button"
                    className={`event-tag ${editWebhook.events.includes(e.name) ? 'selected' : ''}`}
                    onClick={() => toggleEditEvent(e.name)}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
              <div className="toggle-group">
                <span className="toggle-label">Status</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={editWebhook.active}
                    onChange={e => setEditWebhook({ ...editWebhook, active: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className={`toggle-status ${editWebhook.active ? 'active' : 'inactive'}`}>
                  {editWebhook.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Webhook</h2>
              <button className="btn-icon" onClick={() => setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this webhook?</p>
              <code
                style={{
                  display: 'block',
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  wordBreak: 'break-all',
                }}
              >
                {deleteTarget.url}
              </code>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="webhooks-content">
        <div className="webhooks-table-container">
          <div className="webhooks-table">
            <div className="table-row header">
              <span>URL</span>
              <span>Events</span>
              <span>Session</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {webhooks.length === 0 ? (
              <div className="empty-table-state">
                <WebhookIcon size={48} strokeWidth={1} />
                <h3>No webhooks configured</h3>
                <p>Add a webhook to receive real-time event notifications</p>
              </div>
            ) : (
              webhooks.map(webhook => (
                <div key={webhook.id} className="table-row">
                  <span className="url-cell">
                    <code>{webhook.url}</code>
                    <ExternalLink size={14} />
                  </span>
                  <span className="events-cell">
                    {webhook.events.map((event: string) => (
                      <span key={event} className="event-tag">
                        {event}
                      </span>
                    ))}
                  </span>
                  <span>
                    {sessions.find(s => s.id === webhook.sessionId)?.name || webhook.sessionId.substring(0, 8)}
                  </span>
                  <span>
                    <span className={`status-badge ${webhook.active ? 'active' : 'inactive'}`}>
                      {webhook.active ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                  <span className="actions-cell">
                    <button
                      className="icon-btn"
                      title="Test"
                      onClick={() => handleTest(webhook.sessionId, webhook.id)}
                      disabled={testingId === webhook.id}
                    >
                      {testingId === webhook.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    </button>
                    {canWrite && (
                      <>
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(webhook)}>
                          <Edit size={16} />
                        </button>
                        <button
                          className="icon-btn danger"
                          title="Delete"
                          onClick={() => confirmDelete(webhook.sessionId, webhook.id, webhook.url)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="events-reference">
          <h3>Available Events</h3>
          <div className="events-list">
            {availableEvents.map(event => (
              <div key={event.name} className="event-item">
                <code>{event.name}</code>
                <span>{event.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
