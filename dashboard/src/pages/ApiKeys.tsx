import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type VisibilityState,
} from '@tanstack/react-table';
import { Plus, Copy, RefreshCw, Trash2, Eye, EyeOff, Loader2, X, Check, KeyRound, AlertTriangle } from 'lucide-react';
import { apiKeyApi, type ApiKey } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import './ApiKeys.css';

const permissionsReference = [
  { name: 'admin', description: 'Full access to all resources' },
  { name: 'operator', description: 'Session & message management' },
  { name: 'viewer', description: 'Read-only access' },
];

// Hook to track window size
function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

const columnHelper = createColumnHelper<ApiKey>();

export function ApiKeys() {
  useDocumentTitle('API Keys');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', role: 'operator' });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'revoke'; id: string; name: string } | null>(
    null,
  );

  const windowWidth = useWindowSize();
  const isMobile = windowWidth < 768;
  const isSmall = windowWidth < 640;

  // Column visibility based on screen size
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    setColumnVisibility({
      key: !isSmall, // Hide key column on very small screens
      lastUsed: !isMobile, // Hide last used on mobile
    });
  }, [isMobile, isSmall]);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const data = await apiKeyApi.list();
      setApiKeys(data);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKey.name) return;
    try {
      const created = await apiKeyApi.create({ name: newKey.name, role: newKey.role });
      setApiKeys([...apiKeys, created]);
      setCreatedKey(created.apiKey || null);
      setNewKey({ name: '', role: 'operator' });
    } catch (err) {
      console.error('Failed to create:', err);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiKeyApi.revoke(id);
      setApiKeys(apiKeys.map(k => (k.id === id ? { ...k, isActive: false } : k)));
    } catch (err) {
      console.error('Failed to revoke:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiKeyApi.delete(id);
      setApiKeys(apiKeys.filter(k => k.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') {
      handleDelete(confirmAction.id);
    } else {
      handleRevoke(confirmAction.id);
    }
    setConfirmAction(null);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Define columns using TanStack Table
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: info => <span className="name-cell">{info.getValue()}</span>,
      }),
      columnHelper.accessor('keyPrefix', {
        id: 'key',
        header: 'Key',
        cell: info => {
          const apiKey = info.row.original;
          return (
            <span className="key-cell">
              <code>{visibleKeys.has(apiKey.id) ? apiKey.keyPrefix + '...' : apiKey.keyPrefix + '****'}</code>
              <button className="icon-btn-sm" onClick={() => toggleKeyVisibility(apiKey.id)}>
                {visibleKeys.has(apiKey.id) ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>
          );
        },
      }),
      columnHelper.accessor('role', {
        header: 'Role',
        cell: info => <span className="permission-badge">{info.getValue()}</span>,
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: info => (
          <span className={`status-badge ${info.getValue() ? 'active' : 'inactive'}`}>
            {info.getValue() ? 'Active' : 'Revoked'}
          </span>
        ),
      }),
      columnHelper.accessor('lastUsedAt', {
        id: 'lastUsed',
        header: 'Last Used',
        cell: info => (
          <span className="last-used">
            {info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : 'Never'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: info => {
          const apiKey = info.row.original;
          return (
            <span className="actions-cell">
              <button className="icon-btn" onClick={() => copyToClipboard(apiKey.keyPrefix, apiKey.id)} title="Copy">
                {copied === apiKey.id ? <Check size={16} /> : <Copy size={16} />}
              </button>
              {apiKey.isActive && (
                <button
                  className="icon-btn"
                  onClick={() => setConfirmAction({ type: 'revoke', id: apiKey.id, name: apiKey.name })}
                  title="Revoke"
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <button
                className="icon-btn danger"
                onClick={() => setConfirmAction({ type: 'delete', id: apiKey.id, name: apiKey.name })}
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </span>
          );
        },
      }),
    ],
    [visibleKeys, copied],
  );

  const table = useReactTable({
    data: apiKeys,
    columns,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div
        className="api-keys-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <PageHeader
        title="API Keys"
        subtitle="Manage API keys for authentication and access control"
        actions={
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Create API Key
          </button>
        }
      />

      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowModal(false);
            setCreatedKey(null);
          }}
        >
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{createdKey ? 'API Key Created' : 'Create API Key'}</h2>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModal(false);
                  setCreatedKey(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {createdKey ? (
                <div>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                    Copy this key now. You won't be able to see it again.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <code
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '6px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {createdKey}
                    </code>
                    <button className="btn-primary" onClick={() => copyToClipboard(createdKey, 'modal')}>
                      {copied === 'modal' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label>Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Production Key"
                    value={newKey.name}
                    onChange={e => setNewKey({ ...newKey, name: e.target.value })}
                  />
                  <label>Role</label>
                  <select value={newKey.role} onChange={e => setNewKey({ ...newKey, role: e.target.value })}>
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </>
              )}
            </div>
            {!createdKey && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleCreate}>
                  Create
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="api-keys-content">
        <div className="keys-table-container">
          {apiKeys.length === 0 ? (
            <div className="empty-table-state">
              <KeyRound size={48} strokeWidth={1} />
              <h3>No API keys created</h3>
              <p>Create an API key to authenticate your requests</p>
            </div>
          ) : (
            <table className="keys-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="table-row header">
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="table-row">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="permissions-reference">
          <h3>Roles Reference</h3>
          <div className="permissions-list">
            {permissionsReference.map(perm => (
              <div key={perm.name} className="perm-item">
                <code>{perm.name}</code>
                <span>{perm.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{confirmAction.type === 'delete' ? 'Delete API Key' : 'Revoke API Key'}</h2>
              <button className="btn-icon" onClick={() => setConfirmAction(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="confirm-icon-wrapper">
                <AlertTriangle size={48} className="confirm-warning-icon" />
              </div>
              <p className="confirm-message">
                {confirmAction.type === 'delete' ? (
                  <>
                    Are you sure you want to permanently delete <strong>{confirmAction.name}</strong>? This action
                    cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to revoke <strong>{confirmAction.name}</strong>? It will no longer work.
                  </>
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button className={`btn-danger`} onClick={confirmAndExecute}>
                {confirmAction.type === 'delete' ? 'Delete' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
