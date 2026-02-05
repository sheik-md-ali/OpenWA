import { useState, useEffect, useCallback } from 'react';
import { Download, Search, Filter, Loader2, FileText } from 'lucide-react';
import { auditApi, type AuditLog } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import './Logs.css';

export function Logs() {
  useDocumentTitle('Audit Logs');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: { severity?: string; limit: number; offset: number } = {
        limit,
        offset: (page - 1) * limit,
      };
      if (severityFilter !== 'all') params.severity = severityFilter;
      const result = await auditApi.list(params);
      setLogs(result.data);
      setTotal(result.total);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [severityFilter, page, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.errorMessage || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(total / limit);

  const formatTimestamp = (date: string) => {
    return new Date(date).toLocaleString();
  };

  if (loading && logs.length === 0) {
    return (
      <div
        className="logs-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="logs-page">
      <PageHeader
        title="Audit Logs"
        subtitle="Track and review all API actions and system events"
        actions={
          <button className="btn-secondary">
            <Download size={18} />
            Export CSV
          </button>
        }
      />

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={16} />
          <select
            value={severityFilter}
            onChange={e => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <div className="logs-table-container">
        <div className="logs-table">
          <div className="table-row header">
            <span>Timestamp</span>
            <span>Action</span>
            <span>Session</span>
            <span>API Key</span>
            <span>IP Address</span>
            <span>Severity</span>
          </div>
          {filteredLogs.length === 0 ? (
            <div className="empty-table-state">
              <FileText size={48} strokeWidth={1} />
              <h3>No logs found</h3>
              <p>Audit logs will appear here as actions are performed</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="table-row">
                <span className="timestamp">{formatTimestamp(log.createdAt)}</span>
                <span className="action">{log.action}</span>
                <span>{log.sessionName || log.sessionId || '—'}</span>
                <span className="api-key">{log.apiKeyName || '—'}</span>
                <span className="ip">{log.ipAddress || '—'}</span>
                <span>
                  <span className={`severity-badge ${log.severity}`}>{log.severity.toUpperCase()}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </button>
          <span className="page-numbers">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
