import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CloudOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FilterOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  TableOutlined,
  ThunderboltOutlined,
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

const defaultConnection = {
  host: localStorage.getItem('redis.host') || '127.0.0.1',
  port: localStorage.getItem('redis.port') || '6379',
  db: localStorage.getItem('redis.db') || '0',
  password: localStorage.getItem('redis.password') || '',
};

async function api(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const data = await response.json();
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

function formatResult(value) {
  if (value == null) return '(nil)';
  if (Array.isArray(value)) return JSON.stringify(value, null, 2);
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function parseKeyspace(info = '') {
  const stats = {};
  info.split('\n').forEach((line) => {
    const match = line.match(/^(db\d+):keys=(\d+),expires=(\d+),avg_ttl=(\d+)/);
    if (match) {
      stats[match[1]] = {
        keys: Number(match[2]),
        expires: Number(match[3]),
        avgTtl: Number(match[4]),
      };
    }
  });
  return stats;
}

function TypeBadge({ type }) {
  const label = type === 'zset' ? 'ZSET' : String(type || 'none').toUpperCase();
  return <span className={`type-badge type-${typeColors[type] || 'gray'}`}>{label}</span>;
}

function TypeDot({ type }) {
  return <span className={`type-dot type-dot-${typeColors[type] || 'gray'}`} />;
}

function Sidebar() {
  return (
    <aside className="redis-sidebar">
      <div className="brand-mark"><DatabaseOutlined /></div>
      <nav className="side-nav" aria-label="Global">
        <button className="side-button active" title="Home"><HomeOutlined /></button>
        <button className="side-button" title="Cloud"><CloudOutlined /></button>
        <button className="side-button" title="Notifications"><BellOutlined /></button>
        <button className="side-button" title="Settings"><SettingOutlined /></button>
      </nav>
      <button className="side-button bottom" title="Workbench"><CodeOutlined /></button>
    </aside>
  );
}

function Header({ connection, draft, setDraft, status, stats, onConnect, onDisconnect, onNewKey, loading }) {
  const tabs = ['Browse', 'Search', 'Workbench', 'Analyze', 'Pub/Sub'];
  const dbStats = stats[`db${connection.db}`] || {};
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
          <a>Databases</a>
          <span>/</span>
          <form className="connection-form" onSubmit={(event) => { event.preventDefault(); onConnect(); }}>
            <div className="endpoint-fields">
              <input aria-label="Redis host" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} />
              <span>:</span>
              <input aria-label="Redis port" value={draft.port} onChange={(e) => setDraft({ ...draft, port: e.target.value })} />
            </div>
            <span className={`status-dot ${connectionState}`} />
            <input aria-label="Redis db" title="Redis database index" value={draft.db} onChange={(e) => setDraft({ ...draft, db: e.target.value })} />
            <input aria-label="Redis password" type="password" placeholder="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
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
          <span><ThunderboltOutlined /> {status.connected ? '0.71 %' : '-'}</span>
          <span><ReloadOutlined /> {status.connected ? '0' : '-'}</span>
          <span><DatabaseOutlined /> {dbStats.keys ?? '-'} keys</span>
          <span><InfoCircleOutlined /> {dbStats.expires ?? '-'} exp</span>
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

function KeyBrowser({ keys, selectedKey, loading, error, scanned, onRefresh, onSelect }) {
  return (
    <section className="panel key-browser">
      <div className="result-head">
        <div>
          <strong>Results: {keys.length}.</strong>
          <span>Scanned {scanned}</span>
        </div>
        <div className="result-actions">
          <span>Last refresh: &lt; 1 min</span>
          <button className="icon-button" onClick={onRefresh} disabled={loading} title="Refresh keys"><ReloadOutlined /></button>
          <button className="icon-button active" title="Columns"><TableOutlined /></button>
        </div>
      </div>
      <div className="key-table">
        {error && <div className="empty-state error">{error}</div>}
        {!error && !loading && keys.length === 0 && <div className="empty-state">No keys found. Connect or run SCAN.</div>}
        {loading && <div className="empty-state">Loading keys...</div>}
        {keys.map((item) => (
          <button key={item.key} className={selectedKey === item.key ? 'key-row selected' : 'key-row'} onClick={() => onSelect(item.key)}>
            <span className="key-name">{item.key}</span>
            <TypeBadge type={item.type} />
            <span className="ttl">{formatTtl(item.ttl)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ValueContent({ detail, onDeleteField, onUpdateListElement }) {
  const [editingListIndex, setEditingListIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingOriginalValue, setEditingOriginalValue] = useState('');
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

  if (!detail) return <div className="empty-value">Select a key to inspect its value.</div>;
  const value = detail.value;
  if (Array.isArray(value)) {
    const isHash = detail.type === 'hash';
    const isList = detail.type === 'list';
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
    const saveListElement = async (index) => {
      if (savingListEditRef.current) return;
      savingListEditRef.current = true;
      const nextValue = editingValue;
      setEditingListIndex(null);
      setEditingValue('');
      setEditingOriginalValue('');
      try {
        if (nextValue !== editingOriginalValue && onUpdateListElement) {
          await onUpdateListElement({ index, value: nextValue });
        }
      } finally {
        savingListEditRef.current = false;
      }
    };
    const startListEdit = (row) => {
      if (!isList) return;
      const currentValue = formatResult(row.value);
      setEditingListIndex(row.index);
      setEditingValue(currentValue);
      setEditingOriginalValue(currentValue);
    };
    return (
      <div
        ref={tableRef}
        className={isHash ? 'value-table hash-value-table' : isList ? 'value-table list-value-table' : 'value-table'}
        style={isList ? { '--list-index-column': `${listIndexColumnWidth}%` } : undefined}
      >
        <div className="value-table-head">
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
        {visibleRows.map((row, index) => (
          <div className={isList ? 'value-table-row editable-list-row' : 'value-table-row'} key={`${row.index}-${row.value}-${index}`}>
            <span>{row.index}</span>
            <span
              className={isList ? 'editable-value-cell' : ''}
              onClick={() => startListEdit(row)}
            >
              {isList && editingListIndex === row.index ? (
                <input
                  autoFocus
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
                  onBlur={() => saveListElement(row.index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      saveListElement(row.index);
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
        ))}
      </div>
    );
  }
  return <pre className="code-surface">{formatResult(value)}</pre>;
}

function NewKeyEditor({ draft, setDraft, saving, onCancel, onSubmit }) {
  const [typeOpen, setTypeOpen] = useState(false);
  const typePickerRef = useRef(null);
  const hashFields = draft.fields || [{ field: draft.field || '', value: draft.value || '', ttl: draft.fieldTtl || '' }];
  const canSubmit = draft.name.trim() && (draft.type !== 'string' || draft.value.trim()) && (draft.type !== 'hash' || hashFields.some((item) => item.field.trim()));
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
                        setDraft({ ...draft, type: item.value });
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
        {draft.type === 'hash' && (
          <div className="new-key-add-fields-bar">
            <button type="button" className="add-fields-row-button" onClick={addHashFieldRow}>
              <PlusOutlined /> Add Fields
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

function ValueViewer({ detail, selectedKey, loading, onReload, onAddField, onAddElement, onUpdateListElement, onUpdateString, onDeleteField }) {
  const [viewMode, setViewMode] = useState('list');
  const [addingField, setAddingField] = useState(false);
  const [editingString, setEditingString] = useState(false);
  const [fieldDraft, setFieldDraft] = useState({ field: '', value: '', ttl: '', listSide: 'tail' });
  const [stringDraft, setStringDraft] = useState('');
  const isHash = detail?.type === 'hash';
  const isList = detail?.type === 'list';
  const isString = detail?.type === 'string';
  const canAddValue = isHash || isList;
  const addLabel = detail?.type === 'hash' ? 'Add Fields' : 'Add Elements';
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
    setAddingField(false);
    setEditingString(false);
    setFieldDraft({ field: '', value: '', ttl: '', listSide: 'tail' });
    setStringDraft('');
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

  const submitField = async (event) => {
    event.preventDefault();
    const field = fieldDraft.field.trim();
    if (isHash) {
      if (!field || !onAddField) return;
      await onAddField({ field, value: fieldDraft.value, ttl: fieldDraft.ttl.trim() });
    } else if (isList) {
      if (!fieldDraft.value.trim() || !onAddElement) return;
      await onAddElement({ value: fieldDraft.value, side: fieldDraft.listSide });
    }
    setFieldDraft({ field: '', value: '', ttl: '', listSide: 'tail' });
    setAddingField(false);
  };

  return (
    <section className="panel value-viewer">
      <div className="value-header">
        <div>
          <h1>{detail && <TypeBadge type={detail.type} />} {selectedKey || 'No key selected'}</h1>
          <div className="value-meta inline">
            <span>Key Size: {detail ? formatBytes(detail.memory) : '-'}</span>
            <span>Length: {detail?.length ?? '-'}</span>
            <span>TTL: {detail ? formatTtl(detail.ttl) : '-'}</span>
          </div>
        </div>
        <div className="value-tools">
          <span>Last refresh: &lt; 1 min</span>
          <button className="icon-button" onClick={onReload} disabled={!selectedKey || loading}><ReloadOutlined /></button>
        </div>
      </div>
      <div className="value-actions">
        {!isString && <button className={viewMode === 'list' ? 'selected-action' : ''} onClick={() => setViewMode('list')}>List</button>}
        {!isString && <button className={viewMode === 'json' ? 'selected-action' : ''} onClick={() => setViewMode('json')}>JSON</button>}
        {isString ? (
          <button className="accent-action" disabled={!selectedKey} onClick={startStringEdit}>
            <EditOutlined /> Edit
          </button>
        ) : (
          <button
            className="accent-action"
            disabled={!selectedKey || !canAddValue}
            onClick={() => setAddingField((open) => !open)}
          >
            <PlusOutlined /> {addLabel}
          </button>
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
          <ValueContent detail={detail} onDeleteField={onDeleteField} onUpdateListElement={onUpdateListElement} />
        )}
        {addingField && canAddValue && (
          <form className="add-field-row" onSubmit={submitField}>
            <div className={isList ? 'add-field-inputs list-element-inputs' : 'add-field-inputs'}>
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
              {isHash && (
                <input
                  value={fieldDraft.field}
                  onChange={(event) => setFieldDraft({ ...fieldDraft, field: event.target.value })}
                  placeholder="Enter Field"
                />
              )}
              <input
                value={fieldDraft.value}
                onChange={(event) => setFieldDraft({ ...fieldDraft, value: event.target.value })}
                placeholder={isList ? 'Enter Element' : 'Enter Value'}
              />
              {isHash && (
                <input
                  value={fieldDraft.ttl}
                  onChange={(event) => setFieldDraft({ ...fieldDraft, ttl: event.target.value })}
                  placeholder="Enter TTL"
                />
              )}
            </div>
            <div className="add-field-footer">
              <button type="button" className="ghost-button" onClick={() => setAddingField(false)}>Cancel</button>
              <button className="submit-key-button compact" disabled={(isHash ? !fieldDraft.field.trim() : !fieldDraft.value.trim()) || loading}>{loading ? 'Adding...' : 'Save'}</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function InsightsPanel({ selectedKey }) {
  return (
    <aside className="panel insights-panel">
      <div className="insights-head">
        <strong>Insights</strong>
        <span>_ x</span>
      </div>
      <div className="insight-tabs"><button className="active">Tutorials</button><button>Tips</button></div>
      <div className="doc-title">
        <FileTextOutlined />
        <div>
          <h2>How To Query Your Data</h2>
          <span>Commands below run against the connected Redis server through the local API proxy.</span>
        </div>
      </div>
      <div className="doc-section">
        <h3>Find keys</h3>
        <pre>SCAN 0 MATCH * COUNT 100</pre>
        <p>The key browser uses SCAN instead of KEYS so large databases stay responsive.</p>
      </div>
      <div className="doc-section">
        <h3>Inspect selected key</h3>
        <pre>{selectedKey ? `TYPE ${selectedKey}\nTTL ${selectedKey}` : 'TYPE key\nTTL key'}</pre>
        <p>Value loading uses GET, LRANGE, SMEMBERS, ZRANGE, or HGETALL based on the Redis type.</p>
      </div>
      <div className="notice">
        <ThunderboltOutlined />
        <span>CLI commands are real Redis commands. Mutating commands such as SET, DEL, EXPIRE and FLUSHDB will affect the connected database.</span>
      </div>
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
  const bottomDockRef = useRef(null);
  const workspaceRef = useRef(null);

  const activeConnection = useMemo(() => ({
    host: connection.host,
    port: connection.port,
    db: connection.db,
    password: connection.password,
  }), [connection]);

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
    } catch (error) {
      setDetail({ type: 'none', ttl: null, memory: null, value: `(error) ${error.message}` });
    } finally {
      setDetailLoading(false);
    }
  }, [activeConnection, selectedKey]);

  const connect = useCallback(async () => {
    const next = { ...draft, port: String(draft.port || 6379), db: String(draft.db || 0) };
    setConnectionLoading(true);
    try {
      const params = connectionQuery(next);
      const data = await api(`/redis/ping?${params}`);
      setConnection(next);
      localStorage.setItem('redis.host', next.host);
      localStorage.setItem('redis.port', next.port);
      localStorage.setItem('redis.db', next.db);
      localStorage.setItem('redis.password', next.password);
      localStorage.removeItem('redis.manualDisconnected');
      setStats(parseKeyspace(data.info));
      setStatus({ connected: true, error: '' });
      setTerminalLines((items) => [...items, `Connected to ${next.host}:${next.port} db${next.db}`, `PING -> ${data.pong}`]);
      await loadKeys(next);
    } catch (error) {
      setStatus({ connected: false, error: error.message });
      setTerminalLines((items) => [...items, `(connect error) ${error.message}`]);
    } finally {
      setConnectionLoading(false);
      loadHistory();
    }
  }, [draft, loadHistory, loadKeys]);

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
      args = ['RPUSH', key, newKeyDraft.value];
    } else if (newKeyDraft.type === 'set') {
      args = ['SADD', key, newKeyDraft.value];
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
      setTerminalLines((items) => [...items, `> ${args.join(' ')}`, 'OK']);
      await loadKeys();
      await loadKeyDetail(key);
    } catch (error) {
      setTerminalLines((items) => [...items, `(new key error) ${error.message}`]);
    } finally {
      setLoading(false);
      loadHistory();
    }
  }, [activeConnection, loadHistory, loadKeyDetail, loadKeys, newKeyDraft]);

  const addHashField = useCallback(async ({ field, value }) => {
    if (!selectedKey || !field) return;
    const args = ['HSET', selectedKey, field, value];
    setLoading(true);
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setTerminalLines((items) => [...items, `> ${args.join(' ')}`, 'OK']);
      await loadKeyDetail(selectedKey);
      await loadKeys();
    } catch (error) {
      setTerminalLines((items) => [...items, `(add field error) ${error.message}`]);
    } finally {
      setLoading(false);
      loadHistory();
    }
  }, [activeConnection, loadHistory, loadKeyDetail, loadKeys, selectedKey]);

  const addListElement = useCallback(async ({ value, side }) => {
    if (!selectedKey || !value.trim()) return;
    const args = [side === 'head' ? 'LPUSH' : 'RPUSH', selectedKey, value];
    setLoading(true);
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setTerminalLines((items) => [...items, `> ${args.join(' ')}`, 'OK']);
      await loadKeyDetail(selectedKey);
      await loadKeys();
    } catch (error) {
      setTerminalLines((items) => [...items, `(add element error) ${error.message}`]);
    } finally {
      setLoading(false);
      loadHistory();
    }
  }, [activeConnection, loadHistory, loadKeyDetail, loadKeys, selectedKey]);

  const updateListElement = useCallback(async ({ index, value }) => {
    if (!selectedKey) return;
    const args = ['LSET', selectedKey, String(index), value];
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setTerminalLines((items) => [...items, `> ${args.join(' ')}`, 'OK']);
      setDetail((current) => {
        if (!current || current.type !== 'list' || !Array.isArray(current.value)) return current;
        return {
          ...current,
          value: current.value.map((item, itemIndex) => (itemIndex === Number(index) ? value : item)),
        };
      });
    } catch (error) {
      setTerminalLines((items) => [...items, `(update element error) ${error.message}`]);
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
      setTerminalLines((items) => [...items, `> SET ${selectedKey} ${value}`, 'OK']);
      setDetail((current) => (current?.type === 'string' ? { ...current, value } : current));
    } catch (error) {
      setTerminalLines((items) => [...items, `(update string error) ${error.message}`]);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const deleteHashField = useCallback(async (field) => {
    if (!selectedKey || !field) return;
    if (!window.confirm(`Delete field "${field}" from "${selectedKey}"?`)) return;
    const args = ['HDEL', selectedKey, String(field)];
    setLoading(true);
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args }),
      });
      setTerminalLines((items) => [...items, `> ${args.join(' ')}`, 'OK']);
      await loadKeyDetail(selectedKey);
      await loadKeys();
    } catch (error) {
      setTerminalLines((items) => [...items, `(delete field error) ${error.message}`]);
    } finally {
      setLoading(false);
      loadHistory();
    }
  }, [activeConnection, loadHistory, loadKeyDetail, loadKeys, selectedKey]);

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
    const timer = setInterval(loadHistory, 3000);
    return () => clearInterval(timer);
  }, [loadHistory]);

  const insertCommand = (command) => {
    setPendingCommand(command);
    setTerminalLines((items) => [...items, `# ${command}`]);
  };

  const selectExistingKey = (key) => {
    setNewKeyDraft(null);
    setSelectedKey(key);
  };

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
        <Sidebar />
        <div className="app-shell">
          <Header
            connection={connection}
            draft={draft}
            setDraft={setDraft}
            status={status}
            stats={stats}
            onConnect={connect}
            onDisconnect={disconnect}
            onNewKey={openNewKeyEditor}
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
            <div className="top-section">
              <div className="browse-main">
                <KeyBrowser
                  keys={visibleKeys}
                  selectedKey={selectedKey}
                  scanned={scanned}
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
                    onReload={refreshSelectedKeyDetail}
                    onAddField={addHashField}
                    onAddElement={addListElement}
                    onUpdateListElement={updateListElement}
                    onUpdateString={updateStringValue}
                    onDeleteField={deleteHashField}
                  />
                )}
              </div>
              <InsightsPanel selectedKey={selectedKey} />
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
          </div>
        </div>
      </div>
  );
}

export default App;
