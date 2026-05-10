import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  CloudOutlined,
  CodeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LeftOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  TableOutlined,
  ThunderboltOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import './App.css';

const typeColors = {
  hash: 'blue',
  list: 'green',
  set: 'orange',
  zset: 'pink',
  string: 'purple',
  json: 'slate',
  stream: 'olive',
  none: 'gray',
};

const keyTypes = [
  { value: 'hash', label: 'Hash' },
  { value: 'list', label: 'List' },
  { value: 'set', label: 'Set' },
  { value: 'zset', label: 'Sorted Set' },
  { value: 'string', label: 'String' },
  { value: 'json', label: 'JSON' },
  { value: 'stream', label: 'Stream' },
];

const commandSuggestions = [
  'PING',
  'INFO keyspace',
  'SCAN 0 MATCH * COUNT 100',
  'GET key',
  'TTL key',
  'TYPE key',
  'HGETALL key',
  'LRANGE key 0 20',
  'SMEMBERS key',
  'ZRANGE key 0 20 WITHSCORES',
];

const terminalCommandSuggestions = [
  { command: 'PING', syntax: 'PING' },
  { command: 'GET', syntax: 'GET key' },
  { command: 'SET', syntax: 'SET key value' },
  { command: 'DEL', syntax: 'DEL key [key ...]' },
  { command: 'EXISTS', syntax: 'EXISTS key [key ...]' },
  { command: 'EXPIRE', syntax: 'EXPIRE key seconds' },
  { command: 'TTL', syntax: 'TTL key' },
  { command: 'TYPE', syntax: 'TYPE key' },
  { command: 'SCAN', syntax: 'SCAN cursor MATCH pattern COUNT count' },
  { command: 'KEYS', syntax: 'KEYS pattern' },
  { command: 'HGET', syntax: 'HGET key field' },
  { command: 'HSET', syntax: 'HSET key field value' },
  { command: 'HDEL', syntax: 'HDEL key field [field ...]' },
  { command: 'HGETALL', syntax: 'HGETALL key' },
  { command: 'HLEN', syntax: 'HLEN key' },
  { command: 'LRANGE', syntax: 'LRANGE key start stop' },
  { command: 'LPUSH', syntax: 'LPUSH key element [element ...]' },
  { command: 'RPUSH', syntax: 'RPUSH key element [element ...]' },
  { command: 'LPOP', syntax: 'LPOP key' },
  { command: 'RPOP', syntax: 'RPOP key' },
  { command: 'SMEMBERS', syntax: 'SMEMBERS key' },
  { command: 'SADD', syntax: 'SADD key member [member ...]' },
  { command: 'SREM', syntax: 'SREM key member [member ...]' },
  { command: 'ZRANGE', syntax: 'ZRANGE key start stop [WITHSCORES]' },
  { command: 'ZADD', syntax: 'ZADD key score member [score member ...]' },
  { command: 'ZREM', syntax: 'ZREM key member [member ...]' },
  { command: 'XADD', syntax: 'XADD key * field value [field value ...]' },
  { command: 'XLEN', syntax: 'XLEN key' },
  { command: 'XREAD', syntax: 'XREAD COUNT count STREAMS key id' },
  { command: 'INFO', syntax: 'INFO [section]' },
  { command: 'DBSIZE', syntax: 'DBSIZE' },
  { command: 'SELECT', syntax: 'SELECT index' },
  { command: 'FLUSHDB', syntax: 'FLUSHDB' },
];

const localRedisConnection = {
  id: 'local-redis',
  alias: 'Local Redis',
  host: '127.0.0.1',
  port: '6379',
  db: '0',
  password: '',
};

const defaultConnection = {
  id: localStorage.getItem('redis.connectionId') || localRedisConnection.id,
  alias: localStorage.getItem('redis.alias') || localRedisConnection.alias,
  host: localStorage.getItem('redis.host') || localRedisConnection.host,
  port: localStorage.getItem('redis.port') || localRedisConnection.port,
  db: localStorage.getItem('redis.db') || localRedisConnection.db,
  password: localStorage.getItem('redis.password') || localRedisConnection.password,
};

const customConnectionsStorageKey = 'redis.customConnections';
const activeViewStorageKey = 'redis.activeView';

function readStoredActiveView() {
  const view = localStorage.getItem(activeViewStorageKey);
  return view === 'databases' || view === 'workspace' ? view : 'workspace';
}

function writeStoredActiveView(view) {
  if (view === 'databases' || view === 'workspace') {
    localStorage.setItem(activeViewStorageKey, view);
  }
}

async function api(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!data) {
    const fallback = response.ok
      ? 'Empty response from Redis API proxy.'
      : `Redis API proxy returned HTTP ${response.status}. Check that the local API proxy is running on port 3001.`;
    throw new Error(text?.trim() || fallback);
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function connectionQuery(connection) {
  const params = new URLSearchParams();
  params.set('host', connection.host);
  params.set('port', connection.port);
  params.set('db', connection.db);
  if (connection.password) params.set('password', connection.password);
  return params;
}

function formatBytes(value) {
  if (value == null) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatTtl(ttl) {
  if (ttl === -2) return 'missing';
  if (ttl === -1) return 'persistent';
  if (ttl == null) return '-';
  const hours = Math.floor(ttl / 3600);
  const minutes = Math.floor((ttl % 3600) / 60);
  const seconds = ttl % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function formatTtlMeta(ttl) {
  if (ttl === -1) return 'No limit';
  return formatTtl(ttl);
}

function formatRefreshElapsed(timestamp) {
  if (!timestamp) return '-';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return '< 1 min';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function formatStreamIdTime(id) {
  const milliseconds = Number(String(id || '').split('-')[0]);
  if (!Number.isFinite(milliseconds)) return '-';
  return new Date(milliseconds).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function refreshRateSeconds(settings) {
  const seconds = Number(settings?.rate);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
}

function formatResult(value) {
  if (value == null) return '(nil)';
  if (Array.isArray(value)) return JSON.stringify(value, null, 2);
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function parseElementValues(input) {
  const text = String(input || '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
          .filter((item) => item.trim());
      }
    } catch {
      // Fall back to line parsing so invalid pasted arrays do not lock the user out.
    }
  }
  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRedisInfo(info = '', previous = {}) {
  const stats = {};
  const fields = {};
  info.split('\n').forEach((line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex > 0) {
      fields[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1).trim();
    }
    const match = line.match(/^(db\d+):keys=(\d+),expires=(\d+),avg_ttl=(\d+)/);
    if (match) {
      stats[match[1]] = {
        keys: Number(match[2]),
        expires: Number(match[3]),
        avgTtl: Number(match[4]),
      };
    }
  });
  const now = Date.now();
  const usedMemory = Number(fields.used_memory);
  const cpuSeconds = [
    fields.used_cpu_sys,
    fields.used_cpu_user,
    fields.used_cpu_sys_children,
    fields.used_cpu_user_children,
  ].reduce((total, value) => total + (Number(value) || 0), 0);
  const previousSample = previous.metrics?.cpuSample;
  const elapsedSeconds = previousSample ? (now - previousSample.at) / 1000 : 0;
  const cpuPercent = previousSample && elapsedSeconds > 0
    ? Math.max(0, ((cpuSeconds - previousSample.seconds) / elapsedSeconds) * 100)
    : null;
  stats.metrics = {
    cpuPercent,
    cpuSample: { seconds: cpuSeconds, at: now },
    opsPerSec: Number(fields.instantaneous_ops_per_sec),
    memoryHuman: fields.used_memory_human || (Number.isFinite(usedMemory) ? formatBytes(usedMemory) : null),
    connectedClients: Number(fields.connected_clients),
  };
  return stats;
}

function formatMetricNumber(value) {
  return Number.isFinite(value) ? String(value) : '-';
}

function formatMetricPercent(value) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(value < 10 ? 2 : 1)} %`;
}

function parseRedisConnectionUrl(input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('Connection URL is required.');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Enter a valid Redis URL, for example redis://127.0.0.1:6379/0.');
  }
  if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
    throw new Error('Connection URL must start with redis:// or rediss://.');
  }
  const dbPath = parsed.pathname.replace(/^\//, '');
  return {
    alias: parsed.hostname || 'Redis database',
    host: parsed.hostname || '127.0.0.1',
    port: parsed.port || '6379',
    db: dbPath || '0',
    password: parsed.password ? decodeURIComponent(parsed.password) : '',
  };
}

function formatRedisConnectionUrl(database) {
  const userInfo = database.password ? `default:${encodeURIComponent(database.password)}@` : 'default@';
  const dbPath = database.db && String(database.db) !== '0' ? `/${database.db}` : '';
  return `redis://${userInfo}${database.host || '127.0.0.1'}:${database.port || '6379'}${dbPath}`;
}

function normalizeDatabaseConnection(database) {
  return {
    id: database.id || `${Date.now()}-${database.host}-${database.port}`,
    alias: database.alias || database.host || 'Redis database',
    host: database.host || '127.0.0.1',
    port: String(database.port || '6379'),
    db: String(database.db || '0'),
    password: database.password || '',
  };
}

function normalizeCustomConnection(database) {
  const next = normalizeDatabaseConnection(database);
  return {
    ...next,
    type: database.type || 'Standalone',
    capabilities: database.capabilities || '-',
    lastConnection: database.lastConnection || 'Not connected',
    tags: database.tags || 'custom',
  };
}

function uniqueCustomConnections(items) {
  const byId = new Map();
  items.forEach((item) => {
    if (!item || item.id === 'local-redis') return;
    const next = normalizeCustomConnection(item);
    byId.set(next.id, next);
  });
  return Array.from(byId.values());
}

function readStoredCustomConnections(activeConnection = defaultConnection) {
  let stored = [];
  try {
    const raw = localStorage.getItem(customConnectionsStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) stored = parsed;
  } catch {
    stored = [];
  }
  const activeCustom = activeConnection?.id && activeConnection.id !== 'local-redis' ? [activeConnection] : [];
  return uniqueCustomConnections([...stored, ...activeCustom]);
}

function writeStoredCustomConnections(items) {
  try {
    localStorage.setItem(customConnectionsStorageKey, JSON.stringify(uniqueCustomConnections(items)));
  } catch {
    // Local storage can fail in private or restricted browser contexts.
  }
}

function writeActiveConnection(connection) {
  const next = normalizeDatabaseConnection(connection);
  try {
    localStorage.setItem('redis.connectionId', next.id);
    localStorage.setItem('redis.alias', next.alias);
    localStorage.setItem('redis.host', next.host);
    localStorage.setItem('redis.port', next.port);
    localStorage.setItem('redis.db', next.db);
    localStorage.setItem('redis.password', next.password);
  } catch {
    // Local storage can fail in private or restricted browser contexts.
  }
}

function TypeBadge({ type }) {
  const label = type === 'zset' ? 'ZSET' : String(type || 'none').toUpperCase();
  return <span className={`type-badge type-${typeColors[type] || 'gray'}`}>{label}</span>;
}

function TypeDot({ type }) {
  return <span className={`type-dot type-dot-${typeColors[type] || 'gray'}`} />;
}

function HoverTooltip({ label, children, align = 'center' }) {
  return (
    <span className={`hover-tooltip-wrap tooltip-${align}`} tabIndex={0}>
      {children}
      <span className="hover-tooltip" role="tooltip">{label}</span>
    </span>
  );
}

function ConfirmDialog({ dialog, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="confirm-icon"><DeleteOutlined /></div>
        <div className="confirm-copy">
          <h2 id="confirm-title">{dialog.title}</h2>
          <p>{dialog.message}</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="ghost-button" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>
            {busy ? 'Deleting...' : (dialog.confirmText || 'Delete')}
          </button>
        </div>
      </section>
    </div>
  );
}

function AddDatabaseDialog({ mode = 'add', initialDatabase, onCancel, onAdd }) {
  const isEdit = mode === 'edit';
  const [connectionUrl, setConnectionUrl] = useState(
    initialDatabase ? formatRedisConnectionUrl(initialDatabase) : 'redis://default@127.0.0.1:6379',
  );
  const [settingsOpen, setSettingsOpen] = useState(Boolean(initialDatabase));
  const [draft, setDraft] = useState({
    alias: initialDatabase?.alias || '',
    host: initialDatabase?.host || '127.0.0.1',
    port: initialDatabase?.port || '6379',
    db: initialDatabase?.db || '0',
    password: initialDatabase?.password || '',
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const mergeUrlIntoDraft = () => {
    const parsed = parseRedisConnectionUrl(connectionUrl);
    const next = { ...draft, ...parsed, alias: draft.alias || parsed.alias };
    setDraft((current) => ({
      ...current,
      host: parsed.host,
      port: parsed.port,
      db: parsed.db,
      password: parsed.password,
      alias: current.alias || parsed.alias,
    }));
    return next;
  };

  const getConnectionDraft = () => {
    if (!settingsOpen) return mergeUrlIntoDraft();
    const next = {
      alias: String(draft.alias || '').trim(),
      host: String(draft.host || '').trim(),
      port: String(draft.port || '6379').trim(),
      db: String(draft.db || '0').trim(),
      password: draft.password || '',
    };
    if (!next.alias) throw new Error('Database alias is required.');
    if (!next.host) throw new Error('Host is required.');
    if (!next.port) throw new Error('Port is required.');
    return next;
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage({ type: '', text: '' });
    try {
      const next = getConnectionDraft();
      const params = connectionQuery(next);
      await api(`/redis/ping?${params}`);
      setMessage({ type: 'success', text: 'Connection test succeeded.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setTesting(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const next = getConnectionDraft();
      if (!next.alias.trim()) throw new Error('Database alias is required.');
      if (!next.host.trim()) throw new Error('Host is required.');
      onAdd({
        alias: next.alias.trim(),
        host: next.host.trim(),
        port: String(next.port || '6379').trim(),
        db: String(next.db || '0').trim(),
        password: next.password || '',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="add-database-dialog" role="dialog" aria-modal="true" aria-labelledby="add-database-title">
        <button type="button" className="modal-close-button" aria-label="Close add database" onClick={onCancel}><CloseOutlined /></button>
        <h2 id="add-database-title">{isEdit ? 'Edit database' : 'Add database'}</h2>
        <form className="add-database-form" onSubmit={submit}>
          <label className="connection-url-field">
            <span>Connection URL <InfoCircleOutlined /></span>
            <textarea
              value={connectionUrl}
              onChange={(event) => setConnectionUrl(event.target.value)}
              onBlur={() => {
                try {
                  mergeUrlIntoDraft();
                } catch {
                  // Validation is shown by Test connection or Add database.
                }
              }}
            />
          </label>
          {settingsOpen && (
            <div className="connection-settings-grid">
              <label>
                <span>Database Alias</span>
                <input value={draft.alias} onChange={(event) => setDraft({ ...draft, alias: event.target.value })} />
              </label>
              <label>
                <span>Host</span>
                <input value={draft.host} onChange={(event) => setDraft({ ...draft, host: event.target.value })} />
              </label>
              <label>
                <span>Port</span>
                <input value={draft.port} onChange={(event) => setDraft({ ...draft, port: event.target.value })} />
              </label>
              <label>
                <span>Database</span>
                <input value={draft.db} onChange={(event) => setDraft({ ...draft, db: event.target.value })} />
              </label>
              <label className="settings-wide">
                <span>Password</span>
                <input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
              </label>
            </div>
          )}
          {message.text && <div className={`add-database-message ${message.type}`}>{message.text}</div>}
          <div className="add-database-actions">
            <button type="button" className="database-link-button" disabled={testing || saving} onClick={testConnection}>
              {testing ? 'Testing...' : 'Test connection'}
            </button>
            <div>
              <button
                type="button"
                className="ghost-button strong-outline"
                onClick={() => {
                  if (!settingsOpen) {
                    try {
                      mergeUrlIntoDraft();
                    } catch {
                      // The expanded fields still allow a manual connection config.
                    }
                  }
                  setSettingsOpen((open) => !open);
                }}
              >
                Connection settings
              </button>
              <button className="database-create-button" disabled={saving}>
                {saving ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save changes' : 'Add database')}
              </button>
            </div>
          </div>
        </form>
        <div className="add-database-divider"><span>Or</span></div>
        <div className="redis-cloud-start">
          <span>Get started with Redis Cloud account</span>
          <div>
            <button type="button"><CloudOutlined /><strong>Add databases</strong></button>
            <button type="button"><ThunderboltOutlined /><strong>New database</strong></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function RefreshControl({ lastRefreshAt, loading, settings, onSettingsChange, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [draftAuto, setDraftAuto] = useState(Boolean(settings.auto));
  const [draftRate, setDraftRate] = useState(settings.rate || '5.0');
  const [editingRate, setEditingRate] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setDraftAuto(Boolean(settings.auto));
    setDraftRate(settings.rate || '5.0');
    setEditingRate(false);
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, settings.auto, settings.rate]);

  const saveSettings = () => {
    const nextRate = Number(draftRate);
    if (!Number.isFinite(nextRate) || nextRate <= 0) return;
    onSettingsChange({ auto: draftAuto, rate: String(nextRate.toFixed(1)) });
    setDraftRate(String(nextRate.toFixed(1)));
    setEditingRate(false);
  };

  const cancelRateEdit = () => {
    setDraftRate(settings.rate || '5.0');
    setEditingRate(false);
  };

  return (
    <div className="refresh-control" ref={menuRef}>
      <span className="refresh-label">Last refresh: {formatRefreshElapsed(lastRefreshAt)}</span>
      <button className="icon-button" onClick={onRefresh} disabled={loading} title="Refresh now"><ReloadOutlined /></button>
      <button
        type="button"
        className={open ? 'refresh-menu-button active' : 'refresh-menu-button'}
        title="Refresh settings"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="select-chevron" />
      </button>
      {open && (
        <div className="refresh-popover">
          <button
            type="button"
            className={draftAuto ? 'auto-refresh-toggle active' : 'auto-refresh-toggle'}
            role="switch"
            aria-checked={draftAuto}
            onClick={() => setDraftAuto((value) => !value)}
          >
            <span className="toggle-track"><span /></span>
            <strong>Auto Refresh</strong>
          </button>
          <label className="refresh-rate-row">
            <span>Refresh rate:</span>
            {editingRate ? (
              <>
                <div className="refresh-rate-control editing">
                  <div className="refresh-rate-input-wrap">
                    <input
                      value={draftRate}
                      onChange={(event) => setDraftRate(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveSettings();
                        if (event.key === 'Escape') cancelRateEdit();
                      }}
                      inputMode="decimal"
                      autoFocus
                    />
                    <span>s</span>
                  </div>
                  <div className="refresh-popover-actions">
                    <button type="button" onClick={cancelRateEdit}>x</button>
                    <button type="button" onClick={saveSettings}><CheckOutlined /></button>
                  </div>
                </div>
              </>
            ) : (
              <div className="refresh-rate-display">
                <span>{Number(settings.rate || 5).toFixed(1)} s</span>
                <button type="button" title="Edit refresh rate" onClick={() => setEditingRate(true)}><EditOutlined /></button>
              </div>
            )}
          </label>
        </div>
      )}
    </div>
  );
}

function Sidebar({ activeView, onViewChange }) {
  return (
    <aside className="redis-sidebar">
      <nav className="side-nav" aria-label="Global">
        <button
          className={activeView === 'databases' ? 'side-button active' : 'side-button'}
          title="Database list"
          aria-label="Database list"
          onClick={() => onViewChange('databases')}
        >
          <DatabaseOutlined />
        </button>
        <button
          className={activeView === 'workspace' ? 'side-button active' : 'side-button'}
          title="Home"
          aria-label="Home"
          onClick={() => onViewChange('workspace')}
        >
          <HomeOutlined />
        </button>
        <button className="side-button" title="Cloud"><CloudOutlined /></button>
        <button className="side-button" title="Notifications"><BellOutlined /></button>
        <button className="side-button" title="Settings"><SettingOutlined /></button>
      </nav>
      <button className="side-button bottom" title="Workbench"><CodeOutlined /></button>
    </aside>
  );
}

const databaseListColumns = [
  { key: 'alias', label: 'Database Alias', width: 'minmax(190px, 1fr)', sortable: true },
  { key: 'hostPort', label: 'Host:Port', width: 'minmax(190px, 1fr)', sortable: true },
  { key: 'dbCount', label: 'DB Count', width: '136px', sortable: true },
  { key: 'type', label: 'Database Type', width: 'minmax(170px, 0.8fr)', sortable: true },
  { key: 'capabilities', label: 'Capabilities', width: 'minmax(160px, 0.75fr)', sortable: true },
  { key: 'lastConnection', label: 'Last connection', width: 'minmax(170px, 0.75fr)', sortable: true },
  { key: 'tags', label: 'Tags', width: 'minmax(150px, 0.7fr)', sortable: true },
  { key: 'actions', label: 'Actions', width: '96px', locked: true },
];

const defaultDatabaseVisibleColumns = Object.fromEntries(
  databaseListColumns.filter((column) => !column.locked).map((column) => [column.key, true]),
);

function getDatabaseSortValue(row, key) {
  if (key === 'dbCount') return Number(row.dbCount) || 0;
  if (key === 'lastConnection') return row.connected ? 0 : 1;
  if (key === 'capabilities') {
    const keys = Number(String(row.capabilities || '').match(/\d+/)?.[0]);
    return Number.isFinite(keys) ? keys : -1;
  }
  return String(row[key] || '').toLowerCase();
}

function DatabaseListPage({
  connection,
  status,
  stats,
  customConnections = [],
  onOpenDatabase,
  onAddDatabase,
  onUpdateDatabase,
  onDeleteDatabase,
}) {
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(defaultDatabaseVisibleColumns);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const columnsMenuRef = useRef(null);
  const dbStats = stats[`db${connection.db}`] || {};
  const logicalDbCount = 16;
  const visibleColumnDefs = useMemo(() => databaseListColumns.filter((column) => (
    column.locked || visibleColumns[column.key]
  )), [visibleColumns]);
  const databaseGridColumns = useMemo(() => (
    visibleColumnDefs.map((column) => column.width).join(' ')
  ), [visibleColumnDefs]);
  const databaseRows = useMemo(() => {
    const saved = {
      id: 'local-redis',
      alias: 'Local Redis',
      host: '127.0.0.1',
      port: '6379',
      db: '0',
      password: '',
      hostPort: '127.0.0.1:6379',
      dbCount: logicalDbCount,
      type: 'Standalone',
      capabilities: status.connected && connection.id === 'local-redis' ? `${dbStats.keys ?? 0} keys` : '-',
      lastConnection: status.connected && connection.id === 'local-redis' ? '< 1 minute ago' : 'Not connected',
      tags: 'local',
      connected: status.connected && connection.id === 'local-redis',
      protected: true,
    };
    return [
      saved,
      ...customConnections.map((item) => ({
        ...item,
        hostPort: `${item.host}:${item.port}`,
        dbCount: logicalDbCount,
        type: item.type || 'Standalone',
        capabilities: status.connected && connection.id === item.id ? `${dbStats.keys ?? 0} keys` : item.capabilities || '-',
        lastConnection: status.connected && connection.id === item.id ? '< 1 minute ago' : item.lastConnection || 'Not connected',
        tags: item.tags || 'custom',
        connected: status.connected && connection.id === item.id,
        protected: false,
      })),
    ];
  }, [connection.id, customConnections, dbStats.keys, logicalDbCount, status.connected]);
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filteredRows = needle ? databaseRows.filter((row) => (
      row.alias.toLowerCase().includes(needle)
      || row.hostPort.toLowerCase().includes(needle)
      || String(row.dbCount).includes(needle)
      || row.type.toLowerCase().includes(needle)
      || row.tags.toLowerCase().includes(needle)
    )) : databaseRows;
    if (!sortConfig.key) return filteredRows;
    const direction = sortConfig.direction === 'desc' ? -1 : 1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = getDatabaseSortValue(left, sortConfig.key);
      const rightValue = getDatabaseSortValue(right, sortConfig.key);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true }) * direction;
    });
  }, [databaseRows, search, sortConfig.direction, sortConfig.key]);

  useEffect(() => {
    if (!columnsOpen) return undefined;
    const onPointerDown = (event) => {
      if (!columnsMenuRef.current?.contains(event.target)) setColumnsOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setColumnsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [columnsOpen]);

  const toggleColumn = (key) => {
    setVisibleColumns((current) => {
      const visibleCount = Object.values(current).filter(Boolean).length;
      if (current[key] && visibleCount <= 1) return current;
      return { ...current, [key]: !current[key] };
    });
  };

  const toggleSort = (key) => {
    setSortConfig((current) => {
      if (current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: 'asc' };
    });
  };

  const sortLabel = (column) => {
    if (sortConfig.key !== column.key) return 'No sort';
    return sortConfig.direction === 'asc' ? 'Ascending' : 'Descending';
  };

  return (
    <main className="database-list-page">
      <div className="database-list-tabs">
        <button type="button" className="active">Redis Databases</button>
        <button type="button">Redis Data Integration</button>
      </div>
      <div className="database-list-topbar">
        <div className="database-list-actions">
          <button type="button" className="database-link-button" onClick={() => setAddDialogOpen(true)}>
            <PlusOutlined /> Connect existing database
          </button>
        </div>
        <div className="database-list-tools">
          <div className="columns-menu-wrap" ref={columnsMenuRef}>
            <button
              type="button"
              className={columnsOpen ? 'columns-button active' : 'columns-button'}
              title="Columns"
              onClick={() => setColumnsOpen((open) => !open)}
            >
              <TableOutlined />
              <span>Columns</span>
            </button>
            {columnsOpen && (
              <div className="columns-popover database-columns-popover">
                {databaseListColumns.filter((column) => !column.locked).map((column) => (
                  <button
                    type="button"
                    key={column.key}
                    className={visibleColumns[column.key] ? 'column-toggle active' : 'column-toggle'}
                    onClick={() => toggleColumn(column.key)}
                  >
                    <span className="check-box">{visibleColumns[column.key] && <CheckOutlined />}</span>
                    <span>{column.label}</span>
                    <InfoCircleOutlined className="column-info-icon" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="database-list-search">
            <SearchOutlined />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Database List Search"
            />
          </label>
        </div>
      </div>
      <section className="database-list-table" aria-label="Redis databases">
        <div className="database-list-row database-list-head" style={{ gridTemplateColumns: databaseGridColumns }}>
          {visibleColumnDefs.map((column) => (
            <span key={column.key}>
              {column.sortable ? (
                <button
                  type="button"
                  className={sortConfig.key === column.key ? 'database-list-sort-button active' : 'database-list-sort-button'}
                  onClick={() => toggleSort(column.key)}
                  aria-label={`Sort by ${column.label}: ${sortLabel(column)}`}
                >
                  <span>{column.label}</span>
                  {sortConfig.key === column.key ? (
                    sortConfig.direction === 'asc' ? <ArrowUpOutlined /> : <ArrowDownOutlined />
                  ) : null}
                </button>
              ) : column.label}
            </span>
          ))}
        </div>
        {visibleRows.map((row) => (
          <div
            className="database-list-row database-list-item"
            role="button"
            tabIndex={0}
            style={{ gridTemplateColumns: databaseGridColumns }}
            key={row.id || `${row.hostPort}-${row.dbCount}-${row.tags}`}
            onClick={() => onOpenDatabase(row)}
            onKeyDown={(event) => {
              if (event.target.closest('button')) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenDatabase(row);
              }
            }}
          >
            {visibleColumnDefs.map((column) => {
              if (column.key === 'actions') {
                return (
                  <span className="database-row-actions" aria-label={`${row.alias} actions`} key={column.key}>
                    <button
                      type="button"
                      className="database-row-action"
                      aria-label={`Edit ${row.alias}`}
                      title={row.protected ? 'Current connection cannot be edited here' : 'Edit database'}
                      disabled={row.protected}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingDatabase(row);
                      }}
                    >
                      <EditOutlined />
                    </button>
                    <button
                      type="button"
                      className="database-row-action danger"
                      aria-label={`Delete ${row.alias}`}
                      title={row.protected ? 'Current connection cannot be deleted here' : 'Delete database'}
                      disabled={row.protected}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteDatabase(row.id);
                      }}
                    >
                      <DeleteOutlined />
                    </button>
                  </span>
                );
              }
              return <span key={column.key}>{row[column.key]}</span>;
            })}
          </div>
        ))}
        {visibleRows.length === 0 && <div className="database-list-empty" style={{ minWidth: '1328px' }}>No databases match the current search.</div>}
      </section>
      {addDialogOpen && (
        <AddDatabaseDialog
          onCancel={() => setAddDialogOpen(false)}
          onAdd={(database) => {
            onAddDatabase(database);
            setAddDialogOpen(false);
          }}
        />
      )}
      {editingDatabase && (
        <AddDatabaseDialog
          mode="edit"
          initialDatabase={editingDatabase}
          onCancel={() => setEditingDatabase(null)}
          onAdd={(database) => {
            onUpdateDatabase(editingDatabase.id, database);
            setEditingDatabase(null);
          }}
        />
      )}
    </main>
  );
}

function Header({ connection, draft, status, stats, onConnect, onDisconnect, onNewKey, onDatabaseChange, onRefreshMetrics, loading }) {
  const tabs = ['Browse', 'Search', 'Workbench', 'Analyze', 'Pub/Sub'];
  const dbStats = stats[`db${connection.db}`] || {};
  const metrics = stats.metrics || {};
  const databaseAlias = status.connected ? (connection.alias || 'Redis database') : (draft.alias || 'Redis database');
  const databaseIndex = status.connected ? connection.db : draft.db;
  const endpointLabel = `${status.connected ? connection.host : draft.host}:${status.connected ? connection.port : draft.port}`;
  const connectionState = loading ? 'connecting' : status.connected ? 'connected' : 'disconnected';
  const connectionButton = {
    connected: { text: 'Disconnect', icon: <StopOutlined />, className: 'connection-button connected', action: onDisconnect },
    connecting: { text: 'Connecting', icon: <LoadingOutlined spin />, className: 'connection-button connecting', action: undefined },
    disconnected: { text: 'Connect', icon: <PlayCircleOutlined />, className: 'connection-button disconnected', action: onConnect },
  }[connectionState];

  return (
    <header className="redis-header">
      <div className="database-bar">
        <div className="database-title">
          <form className="connection-form" onSubmit={(event) => { event.preventDefault(); onConnect(); }}>
            <HoverTooltip label={endpointLabel} align="left">
              <span className="database-alias">{databaseAlias}</span>
            </HoverTooltip>
            <span className={`status-dot ${connectionState}`} />
            <label className="database-select-wrap" aria-label="Redis database">
              <select
                value={String(databaseIndex)}
                onChange={(event) => onDatabaseChange(event.target.value)}
                disabled={loading}
              >
                {Array.from({ length: 16 }, (_, index) => (
                  <option value={String(index)} key={index}>db{index}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={connectionButton.className}
              disabled={loading}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                connectionButton.action?.();
              }}
            >
              {connectionButton.icon} {connectionButton.text}
            </button>
          </form>
          <InfoCircleOutlined className="muted-icon" />
          {status.error && <span className="connection-error">{status.error}</span>}
        </div>

        <div className="header-metrics">
          <HoverTooltip label="Redis server CPU" align="center">
            <span className="metric-item"><ThunderboltOutlined /> {formatMetricPercent(metrics.cpuPercent)}</span>
          </HoverTooltip>
          <HoverTooltip label="Operations per second" align="center">
            <span className="metric-item"><DashboardOutlined /> {formatMetricNumber(metrics.opsPerSec)}</span>
          </HoverTooltip>
          <HoverTooltip label="Used memory" align="center">
            <span className="metric-item"><DatabaseOutlined /> {metrics.memoryHuman || '-'}</span>
          </HoverTooltip>
          <HoverTooltip label="Keys in current database" align="center">
            <span className="metric-item"><KeyOutlined /> {dbStats.keys ?? '-'}</span>
          </HoverTooltip>
          <HoverTooltip label="Connected clients" align="right">
            <span className="metric-item"><TeamOutlined /> {formatMetricNumber(metrics.connectedClients)}</span>
          </HoverTooltip>
          <button
            type="button"
            className="metric-refresh-button"
            title="Refresh metrics"
            disabled={!status.connected || loading}
            onClick={onRefreshMetrics}
          >
            <ReloadOutlined />
          </button>
        </div>
      </div>

      <div className="workspace-tabs-row">
        <nav className="workspace-tabs" aria-label="Workspace tabs">
          {tabs.map((tab) => <button key={tab} className={tab === 'Browse' ? 'workspace-tab active' : 'workspace-tab'}>{tab}</button>)}
        </nav>
        <div className="header-actions">
          <button className="secondary-action"><TableOutlined /> Bulk actions</button>
          <button className="primary-button" onClick={onNewKey} disabled={!status.connected}><PlusOutlined /> Add key</button>
        </div>
      </div>
    </header>
  );
}

function BrowseToolbar({ pattern, type, setPattern, setType }) {
  return (
    <form className="browse-toolbar" onSubmit={(event) => { event.preventDefault(); }}>
      <div className="view-toggle">
        <button type="button" className="active"><FilterOutlined /></button>
        <button type="button"><TableOutlined /></button>
      </div>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        aria-label="All Key Types"
      >
        <option value="all">All Key Types</option>
        <option value="string">String</option>
        <option value="list">List</option>
        <option value="set">Set</option>
        <option value="hash">Hash</option>
        <option value="zset">ZSet</option>
        <option value="stream">Stream</option>
        <option value="json">JSON</option>
      </select>
      <div className="browse-search">
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Filter by Key Name or Pattern" />
        <button type="button" title="Filter current keys"><SearchOutlined /></button>
      </div>
    </form>
  );
}

function KeyBrowser({ keys, selectedKey, loading, error, scanned, lastRefreshAt, refreshSettings, onRefreshSettingsChange, onRefresh, onSelect }) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({ ttl: true, size: true });
  const [sortState, setSortState] = useState({ field: null, direction: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const columnsMenuRef = useRef(null);
  const gridColumns = useMemo(() => [
    '86px',
    'minmax(0, 1fr)',
    visibleColumns.ttl ? '112px' : null,
    visibleColumns.size ? '104px' : null,
  ].filter(Boolean).join(' '), [visibleColumns.size, visibleColumns.ttl]);
  const displayedKeys = useMemo(() => {
    if (!sortState.field || !sortState.direction) return keys;
    const direction = sortState.direction === 'asc' ? 1 : -1;
    const valueForSort = (item) => {
      if (sortState.field === 'key') return item.key || '';
      if (sortState.field === 'ttl') return Number.isFinite(Number(item.ttl)) ? Number(item.ttl) : -1;
      if (sortState.field === 'size') return Number.isFinite(Number(item.memory)) ? Number(item.memory) : 0;
      return '';
    };
    return [...keys].sort((left, right) => {
      const leftValue = valueForSort(left);
      const rightValue = valueForSort(right);
      if (typeof leftValue === 'string' || typeof rightValue === 'string') {
        return String(leftValue).localeCompare(String(rightValue)) * direction;
      }
      return (leftValue - rightValue) * direction;
    });
  }, [keys, sortState.direction, sortState.field]);
  const pageCount = Math.max(1, Math.ceil(displayedKeys.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStartIndex = displayedKeys.length ? (currentPage - 1) * pageSize : 0;
  const pageEndIndex = Math.min(displayedKeys.length, pageStartIndex + pageSize);
  const pagedKeys = useMemo(() => (
    displayedKeys.slice(pageStartIndex, pageEndIndex)
  ), [displayedKeys, pageEndIndex, pageStartIndex]);
  const setSort = (field, direction) => {
    setSortState((current) => (
      current.field === field && current.direction === direction
        ? { field: null, direction: null }
        : { field, direction }
    ));
  };
  const goToPage = (nextPage) => {
    setPage(Math.min(pageCount, Math.max(1, nextPage)));
  };

  useEffect(() => {
    setPage(1);
  }, [keys, pageSize, sortState.direction, sortState.field]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (!columnsOpen) return undefined;
    const onPointerDown = (event) => {
      if (!columnsMenuRef.current?.contains(event.target)) setColumnsOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setColumnsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [columnsOpen]);

  return (
    <section className="panel key-browser">
      <div className="result-head">
        <div>
          <strong>Results: {keys.length}.</strong>
          <span>Scanned {scanned}</span>
        </div>
        <div className="result-actions">
          <RefreshControl
            lastRefreshAt={lastRefreshAt}
            loading={loading}
            settings={refreshSettings}
            onSettingsChange={onRefreshSettingsChange}
            onRefresh={onRefresh}
          />
          <div className="columns-menu-wrap" ref={columnsMenuRef}>
            <button
              type="button"
              className={columnsOpen ? 'columns-button active' : 'columns-button'}
              title="Columns"
              onClick={() => setColumnsOpen((open) => !open)}
            >
              <TableOutlined />
              <span>Columns</span>
            </button>
            {columnsOpen && (
              <div className="columns-popover">
                <button
                  type="button"
                  className={visibleColumns.size ? 'column-toggle active' : 'column-toggle'}
                  onClick={() => setVisibleColumns((current) => ({ ...current, size: !current.size }))}
                >
                  <span className="check-box">{visibleColumns.size && <CheckOutlined />}</span>
                  <span>Key size</span>
                  <InfoCircleOutlined className="column-info-icon" />
                </button>
                <button
                  type="button"
                  className={visibleColumns.ttl ? 'column-toggle active' : 'column-toggle'}
                  onClick={() => setVisibleColumns((current) => ({ ...current, ttl: !current.ttl }))}
                >
                  <span className="check-box">{visibleColumns.ttl && <CheckOutlined />}</span>
                  <span>TTL</span>
                </button>
                <div className="sort-divider">Sort by:</div>
                {[
                  { field: 'key', label: 'Key' },
                  { field: 'ttl', label: 'TTL' },
                  { field: 'size', label: 'Size' },
                ].map((option) => (
                  <div className="sort-row" key={option.field}>
                    <span>{option.label}</span>
                    <button
                      type="button"
                      className={sortState.field === option.field && sortState.direction === 'asc' ? 'sort-button active' : 'sort-button'}
                      title={`Sort ${option.label} ascending`}
                      onClick={() => setSort(option.field, 'asc')}
                    >
                      <ArrowUpOutlined />
                    </button>
                    <button
                      type="button"
                      className={sortState.field === option.field && sortState.direction === 'desc' ? 'sort-button active' : 'sort-button'}
                      title={`Sort ${option.label} descending`}
                      onClick={() => setSort(option.field, 'desc')}
                    >
                      <ArrowDownOutlined />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="key-table">
        {error && <div className="empty-state error">{error}</div>}
        {!error && !loading && keys.length === 0 && <div className="empty-state">No keys found. Connect or run SCAN.</div>}
        {loading && <div className="empty-state">Loading keys...</div>}
        {pagedKeys.map((item) => (
          <button
            key={item.key}
            className={selectedKey === item.key ? 'key-row selected' : 'key-row'}
            style={{ gridTemplateColumns: gridColumns }}
            onClick={() => onSelect(item.key)}
          >
            <TypeBadge type={item.type} />
            <span className="key-name">{item.key}</span>
            {visibleColumns.ttl && <span className="ttl">{formatTtl(item.ttl)}</span>}
            {visibleColumns.size && <span className="key-size">{formatBytes(item.memory)}</span>}
          </button>
        ))}
      </div>
      <div className="key-pagination">
        <span>
          {displayedKeys.length ? `${pageStartIndex + 1}-${pageEndIndex}` : '0-0'} of {displayedKeys.length}
        </span>
        <div className="key-pagination-controls">
          <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
            <LeftOutlined />
          </button>
          <span>Page {currentPage} / {pageCount}</span>
          <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)}>
            <RightOutlined />
          </button>
        </div>
        <label>
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            aria-label="Rows per page"
          >
            {[5, 10, 20, 50].map((size) => <option value={size} key={size}>{size}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

function PaginationBar({ total, page, pageSize, onPageChange, onPageSizeChange, className = 'key-pagination' }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStartIndex = total ? (currentPage - 1) * pageSize : 0;
  const pageEndIndex = Math.min(total, pageStartIndex + pageSize);

  return (
    <div className={className}>
      <span>
        {total ? `${pageStartIndex + 1}-${pageEndIndex}` : '0-0'} of {total}
      </span>
      <div className="key-pagination-controls">
        <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <LeftOutlined />
        </button>
        <span>Page {currentPage} / {pageCount}</span>
        <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}>
          <RightOutlined />
        </button>
      </div>
      <label>
        <span>Rows</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          aria-label="Rows per page"
        >
          {[5, 10, 20, 50].map((size) => <option value={size} key={size}>{size}</option>)}
        </select>
      </label>
    </div>
  );
}

function ValueContent({ detail, onDeleteField, onDeleteSetMember, onDeleteStreamEntry, onUpdateListElement, onUpdateSetMember }) {
  const [editingListIndex, setEditingListIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingOriginalValue, setEditingOriginalValue] = useState('');
  const [streamTab, setStreamTab] = useState('data');
  const [valuePage, setValuePage] = useState(1);
  const [valuePageSize, setValuePageSize] = useState(5);
  const [listIndexColumnWidth, setListIndexColumnWidth] = useState(32);
  const [columnDrag, setColumnDrag] = useState(null);
  const [showRangeFilter, setShowRangeFilter] = useState(false);
  const [rangeFilter, setRangeFilter] = useState({ start: '', end: '' });
  const tableRef = useRef(null);
  const savingListEditRef = useRef(false);
  useEffect(() => {
    if (!columnDrag) return undefined;
    const onPointerMove = (event) => {
      const delta = ((event.clientX - columnDrag.startX) / columnDrag.width) * 100;
      setListIndexColumnWidth(Math.min(60, Math.max(16, columnDrag.startWidth + delta)));
    };
    const onPointerUp = () => setColumnDrag(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [columnDrag]);

  useEffect(() => {
    setValuePage(1);
  }, [detail?.type, detail?.value?.length, rangeFilter.end, rangeFilter.start, streamTab, valuePageSize]);

  const setClampedValuePage = (nextPage, total) => {
    const pageCount = Math.max(1, Math.ceil(total / valuePageSize));
    setValuePage(Math.min(pageCount, Math.max(1, nextPage)));
  };

  if (!detail) return <div className="empty-value">Select a key to inspect its value.</div>;
  const value = detail.value;
  if (Array.isArray(value)) {
    const isHash = detail.type === 'hash';
    const isList = detail.type === 'list';
    const isSet = detail.type === 'set';
    const isStream = detail.type === 'stream';
    if (isStream) {
      const streamFields = [...new Set(value.flatMap((entry) => Object.keys(entry.fields || {})))];
      const consumerGroups = detail.consumerGroups || [];
      const firstEntry = value[0];
      const lastEntry = value[value.length - 1];
      const gridTemplateColumns = `minmax(210px, 1fr) ${streamFields.map(() => 'minmax(150px, 1fr)').join(' ')} 54px`;
      const activeStreamRows = streamTab === 'data' ? value : consumerGroups;
      const streamPageCount = Math.max(1, Math.ceil(activeStreamRows.length / valuePageSize));
      const streamCurrentPage = Math.min(valuePage, streamPageCount);
      const streamStartIndex = (streamCurrentPage - 1) * valuePageSize;
      const streamEndIndex = Math.min(activeStreamRows.length, streamStartIndex + valuePageSize);
      const pagedStreamEntries = value.slice(streamStartIndex, streamEndIndex);
      const pagedConsumerGroups = consumerGroups.slice(streamStartIndex, streamEndIndex);
      return (
        <div className="stream-view">
          <div className="stream-timeline">
            <span>{firstEntry ? formatStreamIdTime(firstEntry.id) : '-'}</span>
            <span>{lastEntry ? formatStreamIdTime(lastEntry.id) : '-'}</span>
          </div>
          <div className="stream-tabs">
            <button type="button" className={streamTab === 'data' ? 'active' : ''} onClick={() => setStreamTab('data')}>Stream Data</button>
            <button type="button" className={streamTab === 'groups' ? 'active' : ''} onClick={() => setStreamTab('groups')}>Consumer Groups</button>
          </div>
          {streamTab === 'data' ? (
            <div className="stream-table" style={{ '--stream-grid': gridTemplateColumns }}>
              <div className="stream-row stream-head">
                <span>Entry ID</span>
                {streamFields.map((field) => <span key={field}>{field}</span>)}
                <span />
              </div>
              {pagedStreamEntries.map((entry) => (
                <div className="stream-row" key={entry.id}>
                  <span className="stream-entry-id">
                    <strong>{formatStreamIdTime(entry.id)}</strong>
                    <small>{entry.id}</small>
                  </span>
                  {streamFields.map((field) => (
                    <span className="stream-field-value" key={`${entry.id}-${field}`}>{entry.fields?.[field] ?? ''}</span>
                  ))}
                  <button
                    type="button"
                    className="row-delete-cell"
                    title="Delete entry"
                    aria-label={`Delete stream entry ${entry.id}`}
                    onClick={() => onDeleteStreamEntry?.(entry.id)}
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="stream-table consumer-groups-table">
              <div className="stream-row stream-head">
                <span>Name</span>
                <span>Consumers</span>
                <span>Pending</span>
                <span>Last Delivered ID</span>
                <span>Entries Read</span>
                <span>Lag</span>
              </div>
              {consumerGroups.length === 0 ? (
                <div className="stream-empty-state">No consumer groups found.</div>
              ) : pagedConsumerGroups.map((group) => (
                <div className="stream-row" key={group.name}>
                  <span>{group.name}</span>
                  <span>{group.consumers ?? '-'}</span>
                  <span>{group.pending ?? '-'}</span>
                  <span>{group['last-delivered-id'] ?? '-'}</span>
                  <span>{group['entries-read'] ?? '-'}</span>
                  <span>{group.lag ?? '-'}</span>
                </div>
              ))}
            </div>
          )}
          <PaginationBar
            total={activeStreamRows.length}
            page={streamCurrentPage}
            pageSize={valuePageSize}
            onPageChange={(nextPage) => setClampedValuePage(nextPage, activeStreamRows.length)}
            onPageSizeChange={setValuePageSize}
            className="value-pagination"
          />
        </div>
      );
    }
    const isFieldValueTable = detail.type === 'hash' || detail.type === 'zset';
    const rows = value.map((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return { index: item.field ?? index, value: item.value };
      }
      if (Array.isArray(item)) return { index: item[0] ?? index, value: item[1] };
      return { index, value: item };
    });
    const visibleRows = isList
      ? rows.filter((row) => {
        const start = rangeFilter.start === '' ? 0 : Number(rangeFilter.start);
        const end = rangeFilter.end === '' ? Number.POSITIVE_INFINITY : Number(rangeFilter.end);
        const index = Number(row.index);
        if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(index)) return true;
        return index >= start && index <= end;
      })
      : rows;
    const valuePageCount = Math.max(1, Math.ceil(visibleRows.length / valuePageSize));
    const valueCurrentPage = Math.min(valuePage, valuePageCount);
    const valueStartIndex = (valueCurrentPage - 1) * valuePageSize;
    const valueEndIndex = Math.min(visibleRows.length, valueStartIndex + valuePageSize);
    const pagedRows = visibleRows.slice(valueStartIndex, valueEndIndex);
    const saveEditableValue = async (row) => {
      if (savingListEditRef.current) return;
      savingListEditRef.current = true;
      const nextValue = editingValue;
      const originalValue = editingOriginalValue;
      setEditingListIndex(null);
      setEditingValue('');
      setEditingOriginalValue('');
      try {
        if (nextValue === originalValue) return;
        if (isList && onUpdateListElement) {
          await onUpdateListElement({ index: row.index, value: nextValue });
        }
        if (isSet && nextValue.trim() && onUpdateSetMember) {
          await onUpdateSetMember({ oldValue: originalValue, value: nextValue });
        }
      } finally {
        savingListEditRef.current = false;
      }
    };
    const startEditableValue = (row) => {
      if (!isList && !isSet) return;
      const currentValue = formatResult(row.value);
      setEditingListIndex(isSet ? currentValue : row.index);
      setEditingValue(currentValue);
      setEditingOriginalValue(currentValue);
    };
    return (
      <div
        ref={tableRef}
        className={isHash ? 'value-table hash-value-table' : isList ? 'value-table list-value-table' : isSet ? 'value-table set-value-table' : 'value-table'}
        style={isList ? { '--list-index-column': `${listIndexColumnWidth}%` } : undefined}
      >
        <div className="value-table-head">
          {isSet ? (
            <>
              <span>Member</span>
              <span />
            </>
          ) : (
            <>
              <span className={isList ? 'list-index-head-cell' : ''}>
                <span>{isFieldValueTable ? 'Field' : 'Index'}</span>
                {isList && (
                  <>
                    <button
                      type="button"
                      className={showRangeFilter ? 'index-search-button active' : 'index-search-button'}
                      title="Filter index range"
                      onClick={() => setShowRangeFilter((open) => !open)}
                    >
                      <SearchOutlined />
                    </button>
                    <button
                      type="button"
                      className="column-resize-handle"
                      title="Resize column"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        const width = tableRef.current?.getBoundingClientRect().width || 1;
                        setColumnDrag({ startX: event.clientX, startWidth: listIndexColumnWidth, width });
                      }}
                    />
                  </>
                )}
              </span>
              <span>{isFieldValueTable ? 'Value' : 'Element'}</span>
              {isHash && <span>TTL</span>}
              {isHash && <span />}
            </>
          )}
        </div>
        {isList && showRangeFilter && (
          <div className="list-range-filter">
            <input
              type="number"
              min="0"
              value={rangeFilter.start}
              onChange={(event) => setRangeFilter({ ...rangeFilter, start: event.target.value })}
              placeholder="Start index"
            />
            <span>to</span>
            <input
              type="number"
              min="0"
              value={rangeFilter.end}
              onChange={(event) => setRangeFilter({ ...rangeFilter, end: event.target.value })}
              placeholder="End index"
            />
            <button type="button" onClick={() => setRangeFilter({ start: '', end: '' })}>Clear</button>
          </div>
        )}
        <div className="value-table-scroll">
        {pagedRows.map((row, index) => (
          isSet ? (
            <div className="value-table-row editable-set-row" key={`${row.value}-${index}`}>
              <span className="editable-value-cell" onClick={() => startEditableValue(row)}>
                {editingListIndex === formatResult(row.value) ? (
                  <input
                    autoFocus
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => saveEditableValue(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveEditableValue(row);
                      }
                      if (event.key === 'Escape') {
                        setEditingListIndex(null);
                        setEditingValue('');
                        setEditingOriginalValue('');
                      }
                    }}
                  />
                ) : (
                  <>
                    <span className="editable-value-text">{formatResult(row.value)}</span>
                    <EditOutlined className="edit-cell-icon" />
                  </>
                )}
              </span>
              <button
                type="button"
                className="row-delete-cell"
                title="Delete member"
                aria-label={`Delete member ${formatResult(row.value)}`}
                onClick={() => onDeleteSetMember?.(formatResult(row.value))}
              >
                <DeleteOutlined />
              </button>
            </div>
          ) : (
            <div className={isList ? 'value-table-row editable-list-row' : 'value-table-row'} key={`${row.index}-${row.value}-${index}`}>
              <span>{row.index}</span>
              <span
                className={isList ? 'editable-value-cell' : ''}
                onClick={() => startEditableValue(row)}
              >
                {isList && editingListIndex === row.index ? (
                  <input
                    autoFocus
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => saveEditableValue(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveEditableValue(row);
                      }
                      if (event.key === 'Escape') {
                        setEditingListIndex(null);
                        setEditingValue('');
                        setEditingOriginalValue('');
                      }
                    }}
                  />
                ) : (
                  <>
                    <span className="editable-value-text">{formatResult(row.value)}</span>
                    {isList && <EditOutlined className="edit-cell-icon" />}
                  </>
                )}
              </span>
              {isHash && <span>No Limit</span>}
              {isHash && (
                <button
                  type="button"
                  className="row-delete-cell"
                  title="Delete field"
                  aria-label={`Delete field ${row.index}`}
                  onClick={() => onDeleteField?.(row.index)}
                >
                  <DeleteOutlined />
                </button>
              )}
            </div>
          )
        ))}
        </div>
        <PaginationBar
          total={visibleRows.length}
          page={valueCurrentPage}
          pageSize={valuePageSize}
          onPageChange={(nextPage) => setClampedValuePage(nextPage, visibleRows.length)}
          onPageSizeChange={setValuePageSize}
          className="value-pagination"
        />
      </div>
    );
  }
  return <pre className="code-surface">{formatResult(value)}</pre>;
}

function NewKeyEditor({ draft, setDraft, saving, onCancel, onSubmit }) {
  const [typeOpen, setTypeOpen] = useState(false);
  const typePickerRef = useRef(null);
  const hashFields = draft.fields || [{ field: draft.field || '', value: draft.value || '', ttl: draft.fieldTtl || '' }];
  const isElementCollection = draft.type === 'set' || draft.type === 'list';
  const elementRows = draft.elements || [{ value: draft.value || '' }];
  const hasElementValue = elementRows.some((item) => item.value.trim());
  const canSubmit = draft.name.trim()
    && (draft.type !== 'string' || draft.value.trim())
    && (draft.type !== 'hash' || hashFields.some((item) => item.field.trim()))
    && (!isElementCollection || hasElementValue);
  const selectedType = keyTypes.find((item) => item.value === draft.type) || keyTypes[0];
  const updateHashField = (index, patch) => {
    setDraft({
      ...draft,
      fields: hashFields.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  };
  const addHashFieldRow = () => {
    setDraft({ ...draft, fields: [...hashFields, { field: '', value: '', ttl: '' }] });
  };
  const removeHashFieldRow = (index) => {
    if (hashFields.length === 1) {
      setDraft({ ...draft, fields: [{ field: '', value: '', ttl: '' }] });
      return;
    }
    setDraft({ ...draft, fields: hashFields.filter((_, itemIndex) => itemIndex !== index) });
  };
  const updateElementRow = (index, value) => {
    setDraft({
      ...draft,
      elements: elementRows.map((item, itemIndex) => (itemIndex === index ? { ...item, value } : item)),
    });
  };
  const addElementRow = () => {
    setDraft({ ...draft, elements: [...elementRows, { value: '' }] });
  };
  const removeElementRow = (index) => {
    if (elementRows.length === 1) {
      setDraft({ ...draft, elements: [{ value: '' }] });
      return;
    }
    setDraft({ ...draft, elements: elementRows.filter((_, itemIndex) => itemIndex !== index) });
  };

  useEffect(() => {
    if (!typeOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!typePickerRef.current?.contains(event.target)) {
        setTypeOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setTypeOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [typeOpen]);

  return (
    <section className="panel value-viewer new-key-editor">
      <div className="new-key-head">
        <h1>New Key</h1>
        <button className="close-button" onClick={onCancel}>x</button>
      </div>
      <form className="new-key-form" onSubmit={(event) => { event.preventDefault(); if (canSubmit) onSubmit(); }}>
        <div className="form-grid two">
          <label>
            <span>Key Type*</span>
            <div ref={typePickerRef} className={typeOpen ? 'type-picker open' : 'type-picker'}>
              <button type="button" className="type-picker-trigger" onClick={() => setTypeOpen((open) => !open)}>
                <span><TypeDot type={selectedType.value} />{selectedType.label}</span>
                <span className={typeOpen ? 'select-chevron open' : 'select-chevron'} />
              </button>
              {typeOpen && (
                <div className="type-picker-menu">
                  {keyTypes.map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      className={draft.type === item.value ? 'selected' : ''}
                      onClick={() => {
                        const nextIsCollection = item.value === 'set' || item.value === 'list';
                        setDraft({
                          ...draft,
                          type: item.value,
                          elements: nextIsCollection && !draft.elements ? [{ value: draft.value || '' }] : draft.elements,
                        });
                        setTypeOpen(false);
                      }}
                    >
                      <span><TypeDot type={item.value} />{item.label}</span>
                      {draft.type === item.value && <span className="check-mark">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label>
            <span>TTL</span>
            <input value={draft.ttl} onChange={(e) => setDraft({ ...draft, ttl: e.target.value })} placeholder="No limit" />
          </label>
        </div>
        <label>
          <span>Key Name*</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Key Name" />
        </label>
        {(draft.type === 'hash' || isElementCollection) && (
          <div className="new-key-add-fields-bar">
            <button type="button" className="add-fields-row-button" onClick={draft.type === 'hash' ? addHashFieldRow : addElementRow}>
              <PlusOutlined /> {draft.type === 'hash' ? 'Add Fields' : 'Add Elements'}
            </button>
          </div>
        )}
        <div className="form-divider" />
        {draft.type === 'hash' ? (
          <div className="field-rows">
            {hashFields.map((item, index) => (
              <div className="field-row" key={index}>
                <input value={item.field} onChange={(e) => updateHashField(index, { field: e.target.value })} placeholder="Enter Field" />
                <input value={item.value} onChange={(e) => updateHashField(index, { value: e.target.value })} placeholder="Enter Value" />
                <input value={item.ttl} onChange={(e) => updateHashField(index, { ttl: e.target.value })} placeholder="Enter TTL" />
                <div className="field-row-actions">
                  {hashFields.length > 1 && (
                    <button type="button" className="field-remove-button" onClick={() => removeHashFieldRow(index)} aria-label="Remove field">
                      <DeleteOutlined />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : isElementCollection ? (
          <div className="field-rows">
            {elementRows.map((item, index) => (
              <div className="element-row" key={index}>
                <input
                  value={item.value}
                  onChange={(e) => updateElementRow(index, e.target.value)}
                  placeholder={draft.type === 'set' ? 'Enter element or JSON array, e.g. ["1", "2"]' : 'Enter Element'}
                />
                <div className="field-row-actions">
                  {elementRows.length > 1 && (
                    <button type="button" className="field-remove-button" onClick={() => removeElementRow(index)} aria-label="Remove element">
                      <DeleteOutlined />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <label className="wide-value-field">
            <span>Value*</span>
            <textarea value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="Enter Value" />
          </label>
        )}
        <div className="new-key-footer">
          <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
          <button className="submit-key-button" disabled={!canSubmit || saving}>{saving ? 'Adding...' : 'Add Key'}</button>
        </div>
      </form>
    </section>
  );
}

function ValueViewer({ detail, selectedKey, loading, lastRefreshAt, refreshSettings, onRefreshSettingsChange, onReload, onOpenAddValue, onUpdateListElement, onUpdateSetMember, onUpdateString, onUpdateTtl, onDeleteKey, onDeleteField, onDeleteSetMember, onDeleteStreamEntry }) {
  const [viewMode, setViewMode] = useState('list');
  const [editingString, setEditingString] = useState(false);
  const [editingTtl, setEditingTtl] = useState(false);
  const [stringDraft, setStringDraft] = useState('');
  const [ttlDraft, setTtlDraft] = useState('');
  const isHash = detail?.type === 'hash';
  const isList = detail?.type === 'list';
  const isSet = detail?.type === 'set';
  const isStream = detail?.type === 'stream';
  const isString = detail?.type === 'string';
  const canAddValue = isHash || isList || isSet || isStream;
  const addLabel = isStream ? 'New Entry' : detail?.type === 'hash' ? 'Add Fields' : 'Add Elements';
  const body = useMemo(() => {
    if (!detail) return selectedKey ? 'Loading key value...' : 'Select a key from the browser or run SCAN first.';
    if (viewMode !== 'json') return formatResult(detail.value);
    if (detail.type === 'hash' && Array.isArray(detail.value)) {
      const objectValue = Object.fromEntries(detail.value.map((item) => [item.field, item.value]));
      return JSON.stringify(objectValue, null, 2);
    }
    try {
      return JSON.stringify(JSON.parse(formatResult(detail.value)), null, 2);
    } catch {
      return JSON.stringify(detail.value, null, 2);
    }
  }, [detail, selectedKey, viewMode]);

  useEffect(() => {
    setViewMode('list');
    setEditingString(false);
    setEditingTtl(false);
    setStringDraft('');
    setTtlDraft('');
  }, [selectedKey]);

  const startStringEdit = () => {
    setStringDraft(detail ? formatResult(detail.value) : '');
    setEditingString(true);
  };

  const submitStringEdit = async (event) => {
    event.preventDefault();
    if (!onUpdateString) return;
    await onUpdateString(stringDraft);
    setEditingString(false);
  };

  const startTtlEdit = () => {
    if (!selectedKey || !detail) return;
    setTtlDraft(detail.ttl && detail.ttl > 0 ? String(detail.ttl) : '');
    setEditingTtl(true);
  };

  const saveTtlEdit = async () => {
    if (!editingTtl || !onUpdateTtl) return;
    await onUpdateTtl(ttlDraft.trim());
    setEditingTtl(false);
  };

  return (
    <section className="panel value-viewer">
      <div className="value-header">
        <div className="value-title-block">
          <h1>{detail && <TypeBadge type={detail.type} />} <span>{selectedKey || 'No key selected'}</span></h1>
          <div className="value-meta inline">
            <span>Key Size: {detail ? formatBytes(detail.memory) : '-'}</span>
            <span>{isStream ? 'Entries' : 'Length'}: {detail?.length ?? '-'}</span>
            <span className="ttl-meta">
              TTL:
              {editingTtl ? (
                <input
                  value={ttlDraft}
                  onChange={(event) => setTtlDraft(event.target.value)}
                  onBlur={saveTtlEdit}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      saveTtlEdit();
                    }
                    if (event.key === 'Escape') {
                      setEditingTtl(false);
                      setTtlDraft('');
                    }
                  }}
                  autoFocus
                  placeholder="No limit"
                />
              ) : (
                <button type="button" className="ttl-edit-button" disabled={!selectedKey || !detail} onClick={startTtlEdit}>
                  {detail ? formatTtlMeta(detail.ttl) : '-'}
                  <EditOutlined />
                </button>
              )}
            </span>
          </div>
        </div>
        <div className="value-tools">
          <RefreshControl
            lastRefreshAt={lastRefreshAt}
            loading={!selectedKey || loading}
            settings={refreshSettings}
            onSettingsChange={onRefreshSettingsChange}
            onRefresh={onReload}
          />
          <button className="icon-button danger-icon-button" disabled={!selectedKey} onClick={onDeleteKey} title="Delete key">
            <DeleteOutlined />
          </button>
        </div>
      </div>
      <div className="value-actions">
        {isString ? (
          <>
            <button className="value-view-menu" disabled={!selectedKey}>
              JSON <span className="select-chevron" />
            </button>
            <button className="icon-inline-action" disabled={!selectedKey} onClick={startStringEdit} title="Edit value">
              <EditOutlined />
            </button>
          </>
        ) : (
          <>
            <button className={viewMode === 'list' ? 'selected-action' : ''} onClick={() => setViewMode('list')}>List</button>
            <button className={viewMode === 'json' ? 'selected-action' : ''} onClick={() => setViewMode('json')}>JSON</button>
            <button
              className="accent-action"
              disabled={!selectedKey || !canAddValue}
              onClick={onOpenAddValue}
            >
              <PlusOutlined /> {addLabel}
            </button>
          </>
        )}
      </div>
      <div className="value-body">
        {loading ? (
          <pre className="code-surface">Loading...</pre>
        ) : editingString ? (
          <form className="string-edit-form" onSubmit={submitStringEdit}>
            <textarea value={stringDraft} onChange={(event) => setStringDraft(event.target.value)} autoFocus />
            <div className="add-field-footer">
              <button type="button" className="ghost-button" onClick={() => setEditingString(false)}>Cancel</button>
              <button className="submit-key-button compact">Save</button>
            </div>
          </form>
        ) : viewMode === 'json' ? (
          <pre className="code-surface">{body}</pre>
        ) : (
          <ValueContent
            detail={detail}
            onDeleteField={onDeleteField}
            onDeleteSetMember={onDeleteSetMember}
            onDeleteStreamEntry={onDeleteStreamEntry}
            onUpdateListElement={onUpdateListElement}
            onUpdateSetMember={onUpdateSetMember}
          />
        )}
      </div>
    </section>
  );
}

function AddValuePanel({ detail, selectedKey, loading, onClose, onAddField, onAddElement, onAddStreamEntry }) {
  const [fieldDraft, setFieldDraft] = useState({ field: '', value: '', ttl: '', listSide: 'tail' });
  const [hashFieldRows, setHashFieldRows] = useState([{ field: '', value: '', ttl: '' }]);
  const [streamFieldRows, setStreamFieldRows] = useState([{ field: '', value: '' }]);
  const isHash = detail?.type === 'hash';
  const isList = detail?.type === 'list';
  const isSet = detail?.type === 'set';
  const isStream = detail?.type === 'stream';
  const panelTitle = isStream ? 'New Entry' : isHash ? 'Add Fields' : 'Add Elements';
  const parsedSetValues = isSet ? parseElementValues(fieldDraft.value) : [];
  const validHashFields = hashFieldRows
    .map((item) => ({ field: item.field.trim(), value: item.value, ttl: item.ttl.trim() }))
    .filter((item) => item.field);
  const validStreamFields = streamFieldRows
    .map((item) => ({ field: item.field.trim(), value: item.value }))
    .filter((item) => item.field && String(item.value).trim());
  const canSave = isHash
    ? validHashFields.length > 0
    : isStream
      ? validStreamFields.length > 0
    : isSet
      ? parsedSetValues.length > 0
      : Boolean(fieldDraft.value.trim());

  useEffect(() => {
    setFieldDraft({ field: '', value: '', ttl: '', listSide: 'tail' });
    setHashFieldRows([{ field: '', value: '', ttl: '' }]);
    setStreamFieldRows([{ field: '', value: '' }]);
  }, [selectedKey, detail?.type]);

  const updateHashFieldRow = (index, patch) => {
    setHashFieldRows((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addHashFieldRow = () => {
    setHashFieldRows((rows) => [...rows, { field: '', value: '', ttl: '' }]);
  };

  const removeHashFieldRow = (index) => {
    setHashFieldRows((rows) => (rows.length === 1 ? [{ field: '', value: '', ttl: '' }] : rows.filter((_, itemIndex) => itemIndex !== index)));
  };

  const updateStreamFieldRow = (index, patch) => {
    setStreamFieldRows((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addStreamFieldRow = () => {
    setStreamFieldRows((rows) => [...rows, { field: '', value: '' }]);
  };

  const removeStreamFieldRow = (index) => {
    setStreamFieldRows((rows) => (rows.length === 1 ? [{ field: '', value: '' }] : rows.filter((_, itemIndex) => itemIndex !== index)));
  };

  const submitField = async (event) => {
    event.preventDefault();
    if (isHash) {
      if (!validHashFields.length || !onAddField) return;
      for (const item of validHashFields) {
        await onAddField(item);
      }
    } else if (isStream) {
      if (!validStreamFields.length || !onAddStreamEntry) return;
      await onAddStreamEntry({ fields: validStreamFields });
    } else if (isList) {
      if (!fieldDraft.value.trim() || !onAddElement) return;
      await onAddElement({ value: fieldDraft.value, side: fieldDraft.listSide });
    } else if (isSet) {
      if (!parsedSetValues.length || !onAddElement) return;
      await onAddElement({ values: parsedSetValues });
    }
    setFieldDraft({ field: '', value: '', ttl: '', listSide: 'tail' });
    setHashFieldRows([{ field: '', value: '', ttl: '' }]);
    setStreamFieldRows([{ field: '', value: '' }]);
    onClose();
  };

  return (
    <aside className="panel add-value-panel">
      <div className="add-value-panel-head">
        <div>
          <strong>{panelTitle}</strong>
          <span>{selectedKey || 'No key selected'}</span>
        </div>
        <button type="button" className="modal-close-button inline" aria-label="Close add value panel" onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>
      <form className="add-field-row add-value-panel-form" onSubmit={submitField}>
        {isHash ? (
          <div className="hash-field-rows">
            <div className="stream-entry-add-row">
              <button type="button" className="add-fields-row-button" onClick={addHashFieldRow}>
                <PlusOutlined /> Add Field
              </button>
            </div>
            {hashFieldRows.map((item, index) => (
              <div className="hash-field-row" key={index}>
                <input value={item.field} onChange={(event) => updateHashFieldRow(index, { field: event.target.value })} placeholder="Enter Field" />
                <input value={item.value} onChange={(event) => updateHashFieldRow(index, { value: event.target.value })} placeholder="Enter Value" />
                <input value={item.ttl} onChange={(event) => updateHashFieldRow(index, { ttl: event.target.value })} placeholder="Enter TTL" />
                <button type="button" className="field-remove-button" onClick={() => removeHashFieldRow(index)} aria-label="Remove hash field">
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        ) : isStream ? (
          <div className="stream-entry-field-rows">
            <div className="stream-entry-add-row">
              <button type="button" className="add-fields-row-button" onClick={addStreamFieldRow}>
                <PlusOutlined /> Add Field
              </button>
            </div>
            {streamFieldRows.map((item, index) => (
              <div className="stream-entry-field-row" key={index}>
                <input value={item.field} onChange={(event) => updateStreamFieldRow(index, { field: event.target.value })} placeholder="Field" />
                <input value={item.value} onChange={(event) => updateStreamFieldRow(index, { value: event.target.value })} placeholder="Value" />
                <button type="button" className="field-remove-button" onClick={() => removeStreamFieldRow(index)} aria-label="Remove stream field">
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={isList ? 'add-field-inputs list-element-inputs' : isSet ? 'add-field-inputs set-element-inputs' : 'add-field-inputs'}>
            {isList && (
              <div className="list-side-select">
                <select
                  value={fieldDraft.listSide}
                  onChange={(event) => setFieldDraft({ ...fieldDraft, listSide: event.target.value })}
                >
                  <option value="tail">Push to tail</option>
                  <option value="head">Push to head</option>
                </select>
                <span aria-hidden="true" />
              </div>
            )}
            {isSet ? (
              <textarea
                className="bulk-element-input"
                value={fieldDraft.value}
                onChange={(event) => setFieldDraft({ ...fieldDraft, value: event.target.value })}
                placeholder={'Enter one member per line or JSON array, e.g. ["1", "2"]'}
              />
            ) : (
              <input
                value={fieldDraft.value}
                onChange={(event) => setFieldDraft({ ...fieldDraft, value: event.target.value })}
                placeholder={isList ? 'Enter Element' : 'Enter Value'}
              />
            )}
          </div>
        )}
        <div className="add-field-footer">
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button className="submit-key-button compact" disabled={!canSave || loading}>{loading ? 'Adding...' : 'Save'}</button>
        </div>
      </form>
    </aside>
  );
}

function TerminalPanel({ connection, connected, lines, setLines, onKeysChanged, initialCommand }) {
  const [command, setCommand] = useState('PING');
  const [running, setRunning] = useState(false);
  const commandHead = command.trimStart().split(/\s+/)[0] || '';
  const typedTokens = command.trim() ? command.trim().split(/\s+/) : [];
  const hasTrailingSpace = /\s$/.test(command);
  const matchedCommand = useMemo(() => {
    const needle = commandHead.toUpperCase();
    if (!needle) return null;
    return terminalCommandSuggestions.find((item) => item.command.startsWith(needle)) || null;
  }, [commandHead]);
  const inlineSuggestion = useMemo(() => {
    if (!matchedCommand) return '';
    const syntaxTokens = matchedCommand.syntax.split(/\s+/);
    const typedCommand = commandHead.toUpperCase();
    if (typedCommand !== matchedCommand.command) {
      const suffix = matchedCommand.command.slice(commandHead.length);
      const args = syntaxTokens.slice(1).join(' ');
      return `${suffix}${args ? ` ${args}` : ''}`.trimEnd();
    }

    const nextSyntaxIndex = Math.max(1, typedTokens.length);
    const remaining = syntaxTokens.slice(nextSyntaxIndex).join(' ');
    if (!remaining) return '';
    return hasTrailingSpace ? remaining : ` ${remaining}`;
  }, [commandHead, hasTrailingSpace, matchedCommand, typedTokens]);

  useEffect(() => {
    if (initialCommand) setCommand(initialCommand);
  }, [initialCommand]);

  const handleInputKeyDown = (event) => {
    if (event.key === 'Tab' && inlineSuggestion) {
      event.preventDefault();
      const leading = command.match(/^\s*/)?.[0] || '';
      if (commandHead.toUpperCase() !== matchedCommand.command) {
        setCommand(`${leading}${matchedCommand.syntax} `);
      } else {
        setCommand(`${command}${inlineSuggestion} `);
      }
    }
  };

  const execute = async (event) => {
    event.preventDefault();
    if (!command.trim() || !connected) return;
    const current = command.trim();
    setRunning(true);
    setLines((items) => [...items, `> ${current}`]);
    try {
      const data = await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection, command: current }),
      });
      setLines((items) => [...items, formatResult(data.result)]);
      if (/^(set|del|expire|rename|hset|lpush|rpush|sadd|zadd|flushdb|flushall)\b/i.test(current)) {
        onKeysChanged();
      }
    } catch (error) {
      setLines((items) => [...items, `(error) ${error.message}`]);
    } finally {
      setRunning(false);
      setCommand('');
    }
  };

  return (
    <section className="panel terminal-panel">
      <div className="bottom-head">
        <CodeOutlined />
        <strong>CLI Terminal</strong>
        <span>{connected ? `db${connection.db}` : 'offline'}</span>
      </div>
      <div className="terminal-body">
        {lines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
      </div>
      <form className="terminal-input" onSubmit={execute}>
        <span>&gt;</span>
        <div className="terminal-command-field">
          <span className="terminal-command-shadow" aria-hidden="true">
            <span className="typed-text">{command}</span>
            {inlineSuggestion && <span className="hint-text">{inlineSuggestion}</span>}
          </span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={!connected || running}
            placeholder={connected ? 'Enter Redis command' : 'Connect to Redis first'}
          />
        </div>
        <button disabled={!connected || running}><SendOutlined /></button>
      </form>
    </section>
  );
}

function CommandHelper({ onUseCommand }) {
  const [filter, setFilter] = useState('');
  const visible = commandSuggestions.filter((item) => item.toLowerCase().includes(filter.toLowerCase()));

  return (
    <section className="panel command-helper">
      <div className="bottom-head"><AppstoreOutlined /><strong>Command Helper</strong></div>
      <div className="command-input"><SearchOutlined /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Enter any command..." /></div>
      <div className="command-list">
        {visible.map((command) => (
          <button key={command} onClick={() => onUseCommand(command)}>
            <span>{command}</span>
            <small>Insert</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProfilerPanel({ logs }) {
  return (
    <section className="panel profiler-panel">
      <div className="bottom-head">
        <BarChartOutlined />
        <strong>Profiler / Logs</strong>
        <span>command history</span>
      </div>
      <div className="log-stream">
        {logs.length === 0 && <div className="empty-state">No command history yet.</div>}
        {logs.map((item, index) => (
          <div className="log-line" key={`${item.time}-${index}`}>
            <span className="log-time">{new Date(item.time).toLocaleTimeString()}</span>
            <span className="log-ip">{item.host ? `${item.host}:${item.port}` : '-'}</span>
            <span className={`log-level ${item.level}`}>{item.level}</span>
            <span className="log-message">{item.command || item.error} {item.durationMs ? `${item.durationMs}ms` : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const didAttemptAutoConnect = useRef(false);
  const [connection, setConnection] = useState(defaultConnection);
  const [draft, setDraft] = useState(defaultConnection);
  const [status, setStatus] = useState({ connected: false, error: '' });
  const [stats, setStats] = useState({});
  const [customConnections, setCustomConnections] = useState(() => readStoredCustomConnections(defaultConnection));
  const [keys, setKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [detail, setDetail] = useState(null);
  const [pattern, setPattern] = useState('*');
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [keysError, setKeysError] = useState('');
  const [scanned, setScanned] = useState(0);
  const [newKeyDraft, setNewKeyDraft] = useState(null);
  const [terminalLines, setTerminalLines] = useState(['Redis UI ready. Connect to a Redis server to begin.']);
  const [logs, setLogs] = useState([]);
  const [pendingCommand, setPendingCommand] = useState('');
  const [bottomHeight, setBottomHeight] = useState(300);
  const [verticalDrag, setVerticalDrag] = useState(null);
  const [bottomWidths, setBottomWidths] = useState([50, 25, 25]);
  const [bottomDrag, setBottomDrag] = useState(null);
  const [keyLastRefreshAt, setKeyLastRefreshAt] = useState(null);
  const [detailLastRefreshAt, setDetailLastRefreshAt] = useState(null);
  const [keyRefreshSettings, setKeyRefreshSettings] = useState({ auto: false, rate: '5.0' });
  const [detailRefreshSettings, setDetailRefreshSettings] = useState({ auto: false, rate: '5.0' });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [activeView, setActiveView] = useState(readStoredActiveView);
  const [addValuePanelOpen, setAddValuePanelOpen] = useState(false);
  const bottomDockRef = useRef(null);
  const workspaceRef = useRef(null);

  const activeConnection = useMemo(() => ({
    host: connection.host,
    port: connection.port,
    db: connection.db,
    password: connection.password,
  }), [connection]);

  const closeConfirmDialog = useCallback(() => {
    if (!confirmBusy) setConfirmDialog(null);
  }, [confirmBusy]);

  const runConfirmDialog = useCallback(async () => {
    if (!confirmDialog?.onConfirm) return;
    setConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmDialog]);

  const visibleKeys = useMemo(() => {
    const rawPattern = pattern.trim();
    const hasPattern = rawPattern && rawPattern !== '*';
    const escaped = hasPattern
      ? rawPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
      : '';
    const matcher = hasPattern ? new RegExp(`^${escaped}$`, 'i') : null;
    return keys.filter((item) => {
      const typeMatches = type === 'all' || item.type === type;
      const patternMatches = !matcher || matcher.test(item.key) || item.key.toLowerCase().includes(rawPattern.toLowerCase());
      return typeMatches && patternMatches;
    });
  }, [keys, pattern, type]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api('/redis/history');
      setLogs(data.history || []);
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    writeStoredCustomConnections(customConnections);
  }, [customConnections]);

  const loadKeys = useCallback(async (conn = activeConnection) => {
    setLoading(true);
    setKeysError('');
    try {
      const params = connectionQuery(conn);
      params.set('pattern', '*');
      params.set('type', 'all');
      const data = await api(`/redis/keys?${params}`);
      const nextKeys = data.keys || [];
      setKeys(nextKeys);
      setScanned(data.scanned ?? nextKeys.length);
      setKeyLastRefreshAt(Date.now());
      if (!nextKeys.some((item) => item.key === selectedKey)) {
        const nextSelectedKey = nextKeys[0]?.key || '';
        setSelectedKey(nextSelectedKey);
        if (!nextSelectedKey) setDetail(null);
      }
    } catch (error) {
      setKeys([]);
      setScanned(0);
      setSelectedKey('');
      setDetail(null);
      setKeysError(error.message);
    } finally {
      setLoading(false);
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const loadServerInfo = useCallback(async (conn = activeConnection) => {
    try {
      const params = connectionQuery(conn);
      const data = await api(`/redis/info?${params}`);
      setStats((current) => parseRedisInfo(data.info, current));
    } catch (error) {
      setKeysError(error.message);
    }
  }, [activeConnection]);

  const loadKeyDetail = useCallback(async (key = selectedKey, conn = activeConnection) => {
    if (!key) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const params = connectionQuery(conn);
      params.set('key', key);
      const data = await api(`/redis/key?${params}`);
      setDetail(data.data);
      setDetailLastRefreshAt(Date.now());
    } catch (error) {
      setDetail({ type: 'none', ttl: null, memory: null, value: `(error) ${error.message}` });
    } finally {
      setDetailLoading(false);
    }
  }, [activeConnection, selectedKey]);

  const connect = useCallback(async () => {
    const next = normalizeDatabaseConnection(draft);
    setConnectionLoading(true);
    try {
      const params = connectionQuery(next);
      const data = await api(`/redis/ping?${params}`);
      setConnection(next);
      setDraft(next);
      writeActiveConnection(next);
      localStorage.removeItem('redis.manualDisconnected');
      setStats((current) => parseRedisInfo(data.info, current));
      setStatus({ connected: true, error: '' });
      setTerminalLines((items) => [...items, `Connected to ${next.alias} (${next.host}:${next.port} db${next.db})`, `PING -> ${data.pong}`]);
      await loadKeys(next);
    } catch (error) {
      setStatus({ connected: false, error: error.message });
      setTerminalLines((items) => [...items, `(connect error) ${error.message}`]);
    } finally {
      setConnectionLoading(false);
      loadHistory();
    }
  }, [draft, loadHistory, loadKeys]);

  const switchDatabase = useCallback(async (db) => {
    const nextDb = String(db);
    setDraft((current) => ({ ...current, db: nextDb }));
    if (!status.connected) return;
    const next = { ...connection, db: nextDb };
    setConnectionLoading(true);
    try {
      const params = connectionQuery(next);
      const data = await api(`/redis/ping?${params}`);
      setConnection(next);
      setDraft(next);
      writeActiveConnection(next);
      setStats((current) => parseRedisInfo(data.info, current));
      setStatus({ connected: true, error: '' });
      setTerminalLines((items) => [...items, `Selected db${nextDb}`]);
      await loadKeys(next);
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
      setTerminalLines((items) => [...items, `(select db error) ${error.message}`]);
    } finally {
      setConnectionLoading(false);
      loadHistory();
    }
  }, [connection, loadHistory, loadKeys, status.connected]);

  const disconnect = useCallback(() => {
    localStorage.setItem('redis.manualDisconnected', '1');
    setStatus({ connected: false, error: '' });
    setStats({});
    setKeys([]);
    setSelectedKey('');
    setDetail(null);
    setKeysError('');
    setTerminalLines((items) => [...items, `Disconnected from ${connection.host}:${connection.port} db${connection.db}`]);
  }, [connection.db, connection.host, connection.port]);

  const openNewKeyEditor = useCallback(() => {
    if (!status.connected) return;
    setNewKeyDraft({ type: 'hash', ttl: '', name: '', value: '', fields: [{ field: '', value: '', ttl: '' }] });
    setSelectedKey('');
    setDetail(null);
  }, [status.connected]);

  const submitNewKey = useCallback(async () => {
    if (!newKeyDraft?.name.trim()) return;
    const key = newKeyDraft.name.trim();
    const ttl = newKeyDraft.ttl.trim();
    let args;
    if (newKeyDraft.type === 'hash') {
      const fields = (newKeyDraft.fields || [])
        .map((item) => [item.field.trim(), item.value])
        .filter(([field]) => field);
      args = ['HSET', key, ...fields.flat()];
    } else if (newKeyDraft.type === 'list') {
      const elements = (newKeyDraft.elements || [{ value: newKeyDraft.value || '' }])
        .flatMap((item) => parseElementValues(item.value));
      args = ['RPUSH', key, ...elements];
    } else if (newKeyDraft.type === 'set') {
      const elements = (newKeyDraft.elements || [{ value: newKeyDraft.value || '' }])
        .flatMap((item) => parseElementValues(item.value));
      args = ['SADD', key, ...elements];
    } else if (newKeyDraft.type === 'zset') {
      args = ['ZADD', key, '0', newKeyDraft.value];
    } else if (newKeyDraft.type === 'stream') {
      args = ['XADD', key, '*', newKeyDraft.field.trim() || 'field', newKeyDraft.value];
    } else if (newKeyDraft.type === 'json') {
      args = ['SET', key, newKeyDraft.value || '{}'];
    } else {
      args = ['SET', key, newKeyDraft.value];
    }
    setLoading(true);
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      if (ttl && Number(ttl) > 0) {
        await api('/redis/command', {
          method: 'POST',
          body: JSON.stringify({ connection: activeConnection, args: ['EXPIRE', key, ttl] }),
        });
      }
      setNewKeyDraft(null);
      setSelectedKey(key);
      await loadKeys();
      await loadKeyDetail(key);
    } catch (error) {
      setKeysError(error.message);
    } finally {
      setLoading(false);
      loadHistory();
    }
  }, [activeConnection, loadHistory, loadKeyDetail, loadKeys, newKeyDraft]);

  const addHashField = useCallback(async ({ field, value }) => {
    if (!selectedKey || !field) return;
    const nextField = String(field).trim();
    const args = ['HSET', selectedKey, nextField, value];
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setDetail((current) => {
        if (!current || current.type !== 'hash' || !Array.isArray(current.value)) return current;
        const exists = current.value.some((item) => item.field === nextField);
        return {
          ...current,
          length: exists ? current.length : (current.length ?? current.value.length) + 1,
          value: exists
            ? current.value.map((item) => (item.field === nextField ? { ...item, value } : item))
            : [...current.value, { field: nextField, value }],
        };
      });
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const addElement = useCallback(async ({ value, values, side }) => {
    const nextValues = (values?.length ? values : parseElementValues(value)).filter((item) => item.trim());
    if (!selectedKey || !nextValues.length) return;
    const uniqueSetValues = [...new Set(nextValues)];
    const args = detail?.type === 'set'
      ? ['SADD', selectedKey, ...uniqueSetValues]
      : [side === 'head' ? 'LPUSH' : 'RPUSH', selectedKey, ...nextValues];
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setDetail((current) => {
        if (!current || !Array.isArray(current.value)) return current;
        if (current.type === 'list') {
          const nextList = side === 'head' ? [...nextValues].reverse().concat(current.value) : [...current.value, ...nextValues];
          return { ...current, length: (current.length ?? current.value.length) + nextValues.length, value: nextList };
        }
        if (current.type === 'set') {
          const currentMembers = new Set(current.value);
          const newMembers = uniqueSetValues.filter((item) => !currentMembers.has(item));
          if (!newMembers.length) return current;
          return { ...current, length: (current.length ?? current.value.length) + newMembers.length, value: [...current.value, ...newMembers] };
        }
        return current;
      });
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, detail?.type, loadHistory, selectedKey]);

  const addStreamEntry = useCallback(async ({ fields }) => {
    const pairs = (fields || [])
      .map((item) => [item.field.trim(), item.value])
      .filter(([field, value]) => field && String(value).trim());
    if (!selectedKey || !pairs.length) return;
    try {
      const data = await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args: ['XADD', selectedKey, '*', ...pairs.flat()] }),
      });
      const entryId = data.result;
      setDetail((current) => {
        if (!current || current.type !== 'stream' || !Array.isArray(current.value)) return current;
        return {
          ...current,
          length: (current.length ?? current.value.length) + 1,
          value: [...current.value, { id: entryId, fields: Object.fromEntries(pairs) }],
        };
      });
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const updateListElement = useCallback(async ({ index, value }) => {
    if (!selectedKey) return;
    const args = ['LSET', selectedKey, String(index), value];
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setDetail((current) => {
        if (!current || current.type !== 'list' || !Array.isArray(current.value)) return current;
        return {
          ...current,
          value: current.value.map((item, itemIndex) => (itemIndex === Number(index) ? value : item)),
        };
      });
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const updateSetMember = useCallback(async ({ oldValue, value }) => {
    if (!selectedKey || !oldValue || !value.trim()) return;
    const nextValue = value;
    const script = 'if redis.call("SREM", KEYS[1], ARGV[1]) == 1 then return redis.call("SADD", KEYS[1], ARGV[2]) else return 0 end';
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args: ['EVAL', script, '1', selectedKey, oldValue, nextValue] }),
      });
      setDetail((current) => {
        if (!current || current.type !== 'set' || !Array.isArray(current.value)) return current;
        const alreadyExists = current.value.some((item) => item === nextValue && item !== oldValue);
        const nextMembers = current.value
          .filter((item) => item !== oldValue)
          .concat(alreadyExists ? [] : [nextValue]);
        return {
          ...current,
          length: nextMembers.length,
          value: nextMembers,
        };
      });
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const updateStringValue = useCallback(async (value) => {
    if (!selectedKey) return;
    const args = ['SET', selectedKey, value];
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setDetail((current) => (current?.type === 'string' ? { ...current, value } : current));
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const updateKeyTtl = useCallback(async (ttlValue) => {
    if (!selectedKey) return;
    const key = selectedKey;
    const rawValue = String(ttlValue || '').trim();
    const persist = rawValue === '';
    const seconds = persist ? -1 : Number(rawValue);
    if (!persist && (!Number.isInteger(seconds) || seconds <= 0)) {
      setKeysError('TTL must be a positive number of seconds, or empty for no limit.');
      return;
    }
    const args = persist ? ['PERSIST', key] : ['EXPIRE', key, String(seconds)];
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      const nextTtl = persist ? -1 : seconds;
      setDetail((current) => (current ? { ...current, ttl: nextTtl } : current));
      setKeys((current) => current.map((item) => (item.key === key ? { ...item, ttl: nextTtl } : item)));
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const deleteSelectedKey = useCallback(async () => {
    if (!selectedKey) return;
    const key = selectedKey;
    setConfirmDialog({
      title: 'Delete key',
      message: `Delete key "${key}"? This action cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api('/redis/command', {
            method: 'POST',
            body: JSON.stringify({ connection: activeConnection, args: ['DEL', key] }),
          });
          setKeys((current) => {
            const nextKeys = current.filter((item) => item.key !== key);
            const nextSelectedKey = nextKeys[0]?.key || '';
            setSelectedKey(nextSelectedKey);
            if (!nextSelectedKey) setDetail(null);
            return nextKeys;
          });
        } catch (error) {
          setKeysError(error.message);
        } finally {
          loadHistory();
        }
      },
    });
  }, [activeConnection, loadHistory, selectedKey]);

  const deleteHashField = useCallback(async (field) => {
    if (!selectedKey || !field) return;
    const key = selectedKey;
    const fieldName = String(field);
    setConfirmDialog({
      title: 'Delete field',
      message: `Delete field "${fieldName}" from "${key}"? This action cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api('/redis/command', {
            method: 'POST',
            body: JSON.stringify({ connection: activeConnection, args: ['HDEL', key, fieldName] }),
          });
          setDetail((current) => {
            if (!current || current.type !== 'hash' || !Array.isArray(current.value)) return current;
            const nextValue = current.value.filter((item) => item.field !== fieldName);
            return { ...current, length: nextValue.length, value: nextValue };
          });
        } catch (error) {
          setKeysError(error.message);
        } finally {
          loadHistory();
        }
      },
    });
  }, [activeConnection, loadHistory, selectedKey]);

  const deleteSetMember = useCallback(async (member) => {
    if (!selectedKey || !member) return;
    const key = selectedKey;
    const memberName = String(member);
    setConfirmDialog({
      title: 'Delete member',
      message: `Delete member "${memberName}" from "${key}"? This action cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api('/redis/command', {
            method: 'POST',
            body: JSON.stringify({ connection: activeConnection, args: ['SREM', key, memberName] }),
          });
          setDetail((current) => {
            if (!current || current.type !== 'set' || !Array.isArray(current.value)) return current;
            const nextValue = current.value.filter((item) => item !== memberName);
            return { ...current, length: nextValue.length, value: nextValue };
          });
        } catch (error) {
          setKeysError(error.message);
        } finally {
          loadHistory();
        }
      },
    });
  }, [activeConnection, loadHistory, selectedKey]);

  const deleteStreamEntry = useCallback(async (entryId) => {
    if (!selectedKey || !entryId) return;
    const key = selectedKey;
    const id = String(entryId);
    setConfirmDialog({
      title: 'Delete stream entry',
      message: `Delete entry "${id}" from "${key}"? This action cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api('/redis/command', {
            method: 'POST',
            body: JSON.stringify({ connection: activeConnection, args: ['XDEL', key, id] }),
          });
          setDetail((current) => {
            if (!current || current.type !== 'stream' || !Array.isArray(current.value)) return current;
            const nextValue = current.value.filter((entry) => entry.id !== id);
            return { ...current, length: nextValue.length, value: nextValue };
          });
        } catch (error) {
          setKeysError(error.message);
        } finally {
          loadHistory();
        }
      },
    });
  }, [activeConnection, loadHistory, selectedKey]);

  useEffect(() => {
    if (didAttemptAutoConnect.current) return;
    didAttemptAutoConnect.current = true;
    if (localStorage.getItem('redis.manualDisconnected') !== '1') {
      connect();
    }
  }, []);

  useEffect(() => {
    if (status.connected && selectedKey) loadKeyDetail(selectedKey);
  }, [loadKeyDetail, selectedKey, status.connected]);

  const refreshSelectedKeyDetail = useCallback(() => {
    if (!selectedKey) return;
    loadKeyDetail(selectedKey);
  }, [loadKeyDetail, selectedKey]);

  useEffect(() => {
    if (!status.connected || !keyRefreshSettings.auto) return undefined;
    const timer = setInterval(() => {
      loadKeys();
    }, refreshRateSeconds(keyRefreshSettings) * 1000);
    return () => clearInterval(timer);
  }, [keyRefreshSettings, loadKeys, status.connected]);

  useEffect(() => {
    if (!status.connected) return undefined;
    const timer = setInterval(() => {
      loadServerInfo();
    }, 5000);
    return () => clearInterval(timer);
  }, [loadServerInfo, status.connected]);

  useEffect(() => {
    if (!status.connected || !selectedKey || !detailRefreshSettings.auto) return undefined;
    const timer = setInterval(() => {
      loadKeyDetail(selectedKey);
    }, refreshRateSeconds(detailRefreshSettings) * 1000);
    return () => clearInterval(timer);
  }, [detailRefreshSettings, loadKeyDetail, selectedKey, status.connected]);

  useEffect(() => {
    const timer = setInterval(loadHistory, 3000);
    return () => clearInterval(timer);
  }, [loadHistory]);

  const insertCommand = (command) => {
    setPendingCommand(command);
    setTerminalLines((items) => [...items, `# ${command}`]);
  };

  const selectExistingKey = (key) => {
    setNewKeyDraft(null);
    setAddValuePanelOpen(false);
    setSelectedKey(key);
  };

  const changeActiveView = useCallback((view) => {
    setActiveView(view);
    writeStoredActiveView(view);
  }, []);

  const openDatabaseConnection = useCallback(async (database) => {
    const next = normalizeDatabaseConnection(database);
    setDraft(next);
    setConnection(next);
    changeActiveView('workspace');
    setConnectionLoading(true);
    try {
      const params = connectionQuery(next);
      const data = await api(`/redis/ping?${params}`);
      writeActiveConnection(next);
      localStorage.removeItem('redis.manualDisconnected');
      setStats((current) => parseRedisInfo(data.info, current));
      setStatus({ connected: true, error: '' });
      setTerminalLines((items) => [...items, `Connected to ${next.alias} (${next.host}:${next.port} db${next.db})`, `PING -> ${data.pong}`]);
      await loadKeys(next);
    } catch (error) {
      setStatus({ connected: false, error: error.message });
      setStats({});
      setKeys([]);
      setSelectedKey('');
      setDetail(null);
      setKeysError(error.message);
      setTerminalLines((items) => [...items, `(connect error) ${next.alias}: ${error.message}`]);
    } finally {
      setConnectionLoading(false);
      loadHistory();
    }
  }, [changeActiveView, loadHistory, loadKeys]);

  const addDatabaseConnection = useCallback((database) => {
    const next = normalizeCustomConnection({
      ...database,
      id: `${Date.now()}-${database.host}-${database.port}`,
    });
    setCustomConnections((current) => uniqueCustomConnections([...current, next]));
  }, []);

  const updateDatabaseConnection = useCallback((id, database) => {
    const next = normalizeDatabaseConnection({ ...database, id });
    setCustomConnections((current) => uniqueCustomConnections(current.map((item) => (
      item.id === id
        ? {
          ...item,
          alias: next.alias,
          host: next.host,
          port: next.port,
          db: next.db,
          password: next.password,
        }
        : item
    ))));
    setConnection((current) => (current.id === id ? { ...current, ...next } : current));
    setDraft((current) => (current.id === id ? { ...current, ...next } : current));
    if (connection.id === id) writeActiveConnection(next);
  }, [connection.id]);

  const deleteDatabaseConnection = useCallback((id) => {
    setCustomConnections((current) => uniqueCustomConnections(current.filter((item) => item.id !== id)));
    setConnection((current) => {
      if (current.id !== id) return current;
      setStatus({ connected: false, error: '' });
      setStats({});
      setKeys([]);
      setSelectedKey('');
      setDetail(null);
      setDraft(localRedisConnection);
      writeActiveConnection(localRedisConnection);
      return localRedisConnection;
    });
  }, []);

  const startBottomResize = (index, event) => {
    event.preventDefault();
    setBottomDrag({
      index,
      startX: event.clientX,
      widths: bottomWidths,
      containerWidth: bottomDockRef.current?.getBoundingClientRect().width || 1,
    });
  };

  const startVerticalResize = (event) => {
    event.preventDefault();
    setVerticalDrag({
      startY: event.clientY,
      startHeight: bottomHeight,
      workspaceHeight: workspaceRef.current?.getBoundingClientRect().height || 1,
    });
  };

  useEffect(() => {
    if (!bottomDrag) return undefined;
    const onPointerMove = (event) => {
      const delta = ((event.clientX - bottomDrag.startX) / bottomDrag.containerWidth) * 100;
      const next = [...bottomDrag.widths];
      const left = bottomDrag.index;
      const right = bottomDrag.index + 1;
      const min = Math.max(12, (260 / bottomDrag.containerWidth) * 100);
      const pairTotal = bottomDrag.widths[left] + bottomDrag.widths[right];
      const leftWidth = Math.min(pairTotal - min, Math.max(min, bottomDrag.widths[left] + delta));
      next[left] = leftWidth;
      next[right] = pairTotal - leftWidth;
      setBottomWidths(next);
    };
    const onPointerUp = () => setBottomDrag(null);
    document.body.classList.add('resizing-panels');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      document.body.classList.remove('resizing-panels');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [bottomDrag]);

  useEffect(() => {
    if (!verticalDrag) return undefined;
    const onPointerMove = (event) => {
      const delta = verticalDrag.startY - event.clientY;
      const maxBottom = Math.max(220, verticalDrag.workspaceHeight - 300);
      setBottomHeight(Math.min(maxBottom, Math.max(180, verticalDrag.startHeight + delta)));
    };
    const onPointerUp = () => setVerticalDrag(null);
    document.body.classList.add('resizing-vertical-panels');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      document.body.classList.remove('resizing-vertical-panels');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [verticalDrag]);

  return (
    <div className="redis-window">
      <div className="menu-bar"><span>Window</span><span>View</span><span>Help</span></div>
      <div className="redis-app">
        <Sidebar activeView={activeView} onViewChange={changeActiveView} />
        <div className="app-shell">
          {activeView === 'databases' ? (
            <DatabaseListPage
              connection={connection}
              status={status}
              stats={stats}
              customConnections={customConnections}
              onOpenDatabase={openDatabaseConnection}
              onAddDatabase={addDatabaseConnection}
              onUpdateDatabase={updateDatabaseConnection}
              onDeleteDatabase={deleteDatabaseConnection}
            />
          ) : (
            <>
              <Header
                connection={connection}
                draft={draft}
                status={status}
                stats={stats}
                onConnect={connect}
                onDisconnect={disconnect}
                onNewKey={openNewKeyEditor}
                onDatabaseChange={switchDatabase}
                onRefreshMetrics={() => loadServerInfo()}
                loading={connectionLoading}
              />
              <main className="workspace" ref={workspaceRef}>
                <div className="browse-strip">
                  <BrowseToolbar
                    pattern={pattern}
                    type={type}
                    setPattern={setPattern}
                    setType={setType}
                  />
                </div>
                <div className={addValuePanelOpen ? 'top-section add-panel-open' : 'top-section'}>
                  <div className="browse-main">
                    <KeyBrowser
                      keys={visibleKeys}
                      selectedKey={selectedKey}
                      scanned={scanned}
                      lastRefreshAt={keyLastRefreshAt}
                      refreshSettings={keyRefreshSettings}
                      onRefreshSettingsChange={setKeyRefreshSettings}
                      onRefresh={() => loadKeys()}
                      onSelect={selectExistingKey}
                      loading={loading}
                      error={keysError}
                    />
                    {newKeyDraft ? (
                      <NewKeyEditor
                        draft={newKeyDraft}
                        setDraft={setNewKeyDraft}
                        saving={loading}
                        onCancel={() => setNewKeyDraft(null)}
                        onSubmit={submitNewKey}
                      />
                    ) : (
                      <ValueViewer
                        detail={detail}
                        selectedKey={selectedKey}
                        loading={detailLoading}
                        lastRefreshAt={detailLastRefreshAt}
                        refreshSettings={detailRefreshSettings}
                        onRefreshSettingsChange={setDetailRefreshSettings}
                        onReload={refreshSelectedKeyDetail}
                        onOpenAddValue={() => setAddValuePanelOpen(true)}
                        onUpdateListElement={updateListElement}
                        onUpdateSetMember={updateSetMember}
                        onUpdateString={updateStringValue}
                        onUpdateTtl={updateKeyTtl}
                        onDeleteKey={deleteSelectedKey}
                        onDeleteField={deleteHashField}
                        onDeleteSetMember={deleteSetMember}
                        onDeleteStreamEntry={deleteStreamEntry}
                      />
                    )}
                  </div>
                  <div className="add-value-panel-slot" aria-hidden={!addValuePanelOpen}>
                    {addValuePanelOpen && (
                      <AddValuePanel
                        detail={detail}
                        selectedKey={selectedKey}
                        loading={loading}
                        onClose={() => setAddValuePanelOpen(false)}
                        onAddField={addHashField}
                        onAddElement={addElement}
                        onAddStreamEntry={addStreamEntry}
                      />
                    )}
                  </div>
                </div>
                <div className="horizontal-resizer" role="separator" aria-label="Resize main and bottom panels" onPointerDown={startVerticalResize} />
                <div
                  ref={bottomDockRef}
                  className="bottom-section"
                  style={{
                    flexBasis: `${bottomHeight}px`,
                    height: `${bottomHeight}px`,
                    gridTemplateColumns: `${bottomWidths[0]}fr 8px ${bottomWidths[1]}fr 8px ${bottomWidths[2]}fr`,
                  }}
                >
                  <TerminalPanel
                    key={pendingCommand}
                    connection={activeConnection}
                    connected={status.connected}
                    lines={terminalLines}
                    setLines={setTerminalLines}
                    onKeysChanged={() => loadKeys()}
                    initialCommand={pendingCommand}
                  />
                  <div className="dock-resizer" role="separator" aria-label="Resize CLI and Command Helper" onPointerDown={(event) => startBottomResize(0, event)} />
                  <CommandHelper onUseCommand={insertCommand} />
                  <div className="dock-resizer" role="separator" aria-label="Resize Command Helper and Profiler" onPointerDown={(event) => startBottomResize(1, event)} />
                  <ProfilerPanel logs={logs} />
                </div>
              </main>
            </>
          )}
        </div>
      </div>
      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          busy={confirmBusy}
          onCancel={closeConfirmDialog}
          onConfirm={runConfirmDialog}
        />
      )}
    </div>
  );
}

export default App;
