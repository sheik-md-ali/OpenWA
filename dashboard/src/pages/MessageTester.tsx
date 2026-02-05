import { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { sessionApi, messageApi, type Session } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { PageHeader } from '../components/PageHeader';
import './MessageTester.css';

interface ApiResponse {
  success: boolean;
  messageId?: string;
  timestamp: string;
  error?: string;
}

interface Group {
  id: string;
  name: string;
}

export function MessageTester() {
  useDocumentTitle('Message Tester');
  const { canWrite } = useRole();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState<'personal' | 'group'>('personal');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [messageType, setMessageType] = useState<'text' | 'image' | 'video' | 'audio' | 'document'>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const data = await sessionApi.list();
        const readySessions = data.filter(s => s.status === 'ready');
        setSessions(readySessions);
        if (readySessions.length > 0) setSession(readySessions[0].id);
      } catch {
        // Handle error
      } finally {
        setLoadingSessions(false);
      }
    }
    fetchSessions();
  }, []);

  // Fetch groups when session changes and recipientType is group
  useEffect(() => {
    if (!session || recipientType !== 'group') {
      setGroups([]);
      setSelectedGroup('');
      return;
    }

    async function fetchGroups() {
      setLoadingGroups(true);
      try {
        const groupList = await sessionApi.getGroups(session);
        setGroups(groupList);
        if (groupList.length > 0) setSelectedGroup(groupList[0].id);
      } catch {
        setGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    }
    fetchGroups();
  }, [session, recipientType]);

  const handleSend = async () => {
    // For groups, use selectedGroup; for personal, use recipient
    const targetId = recipientType === 'group' ? selectedGroup : recipient;
    if (!session || !targetId) return;
    setIsLoading(true);
    setResponse(null);

    // For personal, add @c.us suffix; for group, ID already has @g.us
    const chatId = recipientType === 'group' ? targetId : targetId.replace(/[^0-9]/g, '') + '@c.us';

    try {
      let result;
      if (messageType === 'text') {
        result = await messageApi.sendText(session, chatId, content);
      } else if (messageType === 'image') {
        result = await messageApi.sendImage(session, chatId, mediaUrl, content);
      } else if (messageType === 'video') {
        result = await messageApi.sendVideo(session, chatId, mediaUrl, content);
      } else if (messageType === 'audio') {
        result = await messageApi.sendAudio(session, chatId, mediaUrl);
      } else {
        result = await messageApi.sendDocument(session, chatId, mediaUrl, content);
      }

      // Infer success from having messageId - backend doesn't return success field
      setResponse({
        success: !!result.messageId,
        messageId: result.messageId,
        timestamp: result.timestamp ? new Date(result.timestamp * 1000).toISOString() : new Date().toISOString(),
      });
    } catch (err) {
      setResponse({
        success: false,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Failed to send message',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingSessions) {
    return (
      <div
        className="message-tester"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="message-tester">
      <PageHeader title="Message Tester" subtitle="Send test messages through the API" />

      <div className="tester-panels">
        <div className="compose-panel">
          <h2>Send Test Message</h2>

          <div className="form-group">
            <label>Session</label>
            <select value={session} onChange={e => setSession(e.target.value)}>
              {sessions.length === 0 && <option value="">No ready sessions</option>}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || 'No phone'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Recipient Type</label>
            <div className="toggle-group">
              <button
                className={recipientType === 'personal' ? 'active' : ''}
                onClick={() => setRecipientType('personal')}
              >
                Personal
              </button>
              <button className={recipientType === 'group' ? 'active' : ''} onClick={() => setRecipientType('group')}>
                Group
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>{recipientType === 'group' ? 'Select Group' : 'Recipient Phone Number'}</label>
            {recipientType === 'group' ? (
              <>
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  disabled={loadingGroups || groups.length === 0}
                >
                  {loadingGroups && <option value="">Loading groups...</option>}
                  {!loadingGroups && groups.length === 0 && <option value="">No groups found</option>}
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <span className="hint">Select a group from your WhatsApp</span>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="+62812345678"
                />
                <span className="hint">Use international format without spaces</span>
              </>
            )}
          </div>

          <div className="form-group">
            <label>Message Type</label>
            <div className="toggle-group">
              {(['text', 'image', 'video', 'audio', 'document'] as const).map(type => (
                <button
                  key={type}
                  className={messageType === type ? 'active' : ''}
                  onClick={() => setMessageType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {messageType === 'text' ? (
            <div className="form-group">
              <label>Message Content</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Enter your message here..."
                rows={5}
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Media URL</label>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/file.jpg"
                />
              </div>
              {messageType !== 'audio' && (
                <div className="form-group">
                  <label>{messageType === 'document' ? 'Filename' : 'Caption'} (optional)</label>
                  <input
                    type="text"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={messageType === 'document' ? 'document.pdf' : 'Enter caption...'}
                  />
                </div>
              )}
            </>
          )}

          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!canWrite || isLoading || !session || (recipientType === 'group' ? !selectedGroup : !recipient)}
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {isLoading ? 'Sending...' : canWrite ? 'Send Message' : 'View Only'}
          </button>
        </div>

        <div className="response-panel">
          <h2>API Response</h2>

          {response ? (
            <>
              <div className={`response-status ${response.success ? 'success' : 'error'}`}>
                {response.success ? (
                  <>
                    <CheckCircle size={20} />
                    <span>200 OK - Success</span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} />
                    <span>400 - Failed</span>
                  </>
                )}
              </div>

              <div className="response-details">
                <div className="detail-row">
                  <span className="detail-label">Timestamp</span>
                  <span className="detail-value">{response.timestamp}</span>
                </div>
                {response.messageId && (
                  <div className="detail-row">
                    <span className="detail-label">Message ID</span>
                    <span className="detail-value mono">{response.messageId}</span>
                  </div>
                )}
                {response.error && (
                  <div className="detail-row">
                    <span className="detail-label">Error</span>
                    <span className="detail-value" style={{ color: '#DC2626' }}>
                      {response.error}
                    </span>
                  </div>
                )}
              </div>

              <div className="response-json">
                <pre>{JSON.stringify(response, null, 2)}</pre>
              </div>
            </>
          ) : (
            <div className="response-empty">
              <p>Send a message to see the API response</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
