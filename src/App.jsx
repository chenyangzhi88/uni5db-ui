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
import BenchmarkPage from './BenchmarkPage';

const typeColors = {
  hash: 'blue',
  list: 'green',
  set: 'orange',
  zset: 'pink',
  string: 'purple',
  json: 'slate',
  stream: 'olive',
  vector: 'cyan',
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

const workbenchTemplates = [
  {
    name: 'Keyspace overview',
    description: 'Inspect server and current database state.',
    commands: 'PING\nINFO keyspace\nDBSIZE\nSCAN 0 MATCH * COUNT 20',
  },
  {
    name: 'Demo seed checks',
    description: 'Read the seeded demo keys on the onedis target.',
    commands: 'TYPE demo:seed:20260613:string:welcome\nGET demo:seed:20260613:string:welcome\nHGETALL demo:seed:20260613:hash:user:1001\nLRANGE demo:seed:20260613:list:tasks 0 -1',
  },
  {
    name: 'Full text probe',
    description: 'Check RediSearch indexes and run a broad query.',
    commands: 'FT._LIST\nFT.INFO ft_probe_idx_route_20260613_0915\nFT.SEARCH ft_probe_idx_route_20260613_0915 * WITHSCORES LIMIT 0 10',
  },
  {
    name: 'Vector probe',
    description: 'Inspect vector set metadata with text-safe commands.',
    commands: 'TYPE demo:seed:20260613:vset:products\nVCARD demo:seed:20260613:vset:products\nVINFO demo:seed:20260613:vset:products\nVGETATTR demo:seed:20260613:vset:products product:phone:1',
  },
  {
    name: 'Pub/Sub publish',
    description: 'Publish a message to the demo Pub/Sub channel.',
    commands: 'PUBLISH demo:pubsub:orders {"event":"workbench.publish","source":"template"}',
  },
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

const wasmTemplates = [
  {
    id: 'rust-add-i64',
    language: 'Rust',
    name: 'math_rust',
    fn: 'add',
    args: '40 2',
    valueType: 'i64',
    operation: 'add',
    source: `#[no_mangle]
pub extern "C" fn add(left: i64, right: i64) -> i64 {
    left + right
}`,
  },
  {
    id: 'c-mul-i64',
    language: 'C',
    name: 'math_c',
    fn: 'multiply',
    args: '7 6',
    valueType: 'i64',
    operation: 'mul',
    source: `long long multiply(long long left, long long right) {
    return left * right;
}`,
  },
  {
    id: 'assemblyscript-sub-i32',
    language: 'AssemblyScript',
    name: 'math_as',
    fn: 'subtract',
    args: '50 8',
    valueType: 'i32',
    operation: 'sub',
    source: `export function subtract(left: i32, right: i32): i32 {
  return left - right;
}`,
  },
  {
    id: 'wat-add-i32',
    language: 'WAT',
    name: 'math_wat',
    fn: 'add32',
    args: '11 31',
    valueType: 'i32',
    operation: 'add',
    source: `(module
  (func $add32 (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add)
  (export "add32" (func $add32)))`,
  },
];

const wasmValueTypes = {
  i32: 0x7f,
  i64: 0x7e,
};

const wasmBinaryOpcodes = {
  i32: { add: 0x6a, sub: 0x6b, mul: 0x6c },
  i64: { add: 0x7c, sub: 0x7d, mul: 0x7e },
};

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
const operationsConsoleUrl = 'http://192.168.0.103:17201/';
const kvEngineReviewedTestsStorageKey = 'tasteCoding.kvEngine.reviewedTests.v1';
const paginationPageSizes = [5, 10, 20, 50];
const keyBrowserPageSizeStorageKey = 'redis.keyBrowser.pageSize';
const valueViewerPageSizeStorageKey = 'redis.valueViewer.pageSize';

function readStoredActiveView() {
  const view = localStorage.getItem(activeViewStorageKey);
  return view === 'databases' || view === 'workspace' || view === 'operations' || view === 'projects' || view === 'benchmarks' ? view : 'workspace';
}

function writeStoredActiveView(view) {
  if (view === 'databases' || view === 'workspace' || view === 'operations' || view === 'projects' || view === 'benchmarks') {
    localStorage.setItem(activeViewStorageKey, view);
  }
}

function readReviewedTestMap() {
  try {
    return JSON.parse(localStorage.getItem(kvEngineReviewedTestsStorageKey) || '{}');
  } catch {
    return {};
  }
}

function writeReviewedTestMap(value) {
  localStorage.setItem(kvEngineReviewedTestsStorageKey, JSON.stringify(value || {}));
}

function readStoredPageSize(storageKey, fallback = 5) {
  try {
    const value = Number(localStorage.getItem(storageKey));
    return paginationPageSizes.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredPageSize(storageKey, value) {
  if (!paginationPageSizes.includes(value)) return;
  try {
    localStorage.setItem(storageKey, String(value));
  } catch {
    // Local storage can fail in private or restricted browser contexts.
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

function isBinaryStringValue(value) {
  return typeof value === 'string' && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/.test(value);
}

function stringToBytePreview(value) {
  const bytes = [];
  for (const char of String(value || '')) {
    const code = char.charCodeAt(0);
    if (code <= 0xff) bytes.push(code);
    else bytes.push(...new TextEncoder().encode(char));
  }
  return bytes;
}

function formatBinaryPreview(value) {
  const bytes = stringToBytePreview(value);
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
  const ascii = bytes.map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')).join('');
  return { bytes, hex, ascii };
}

function parseHexBytes(input) {
  const normalized = String(input || '').replace(/[^0-9a-fA-F]/g, '');
  if (!normalized) return new Uint8Array();
  if (normalized.length % 2 !== 0) {
    throw new Error('HEX input must contain an even number of digits.');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

function bytesToLatin1String(bytes) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return value;
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

function parseVectorValues(input) {
  const text = String(input || '').trim();
  if (!text) return [];
  let parts = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) parts = parsed;
  } catch {
    parts = text.split(/[\s,]+/);
  }
  return parts.map(Number).filter((value) => Number.isFinite(value));
}

function formatFieldJsonValue(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseFieldJsonEntries(input) {
  const text = String(input || '').trim();
  if (!text) return { fields: [], error: '' };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { fields: [], error: 'Invalid JSON' };
  }

  const fields = [];
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (Array.isArray(item)) {
        fields.push({ field: String(item[0] ?? '').trim(), value: formatFieldJsonValue(item[1]) });
      } else if (item && typeof item === 'object') {
        const field = item.field ?? item.key ?? item.name;
        fields.push({ field: String(field ?? '').trim(), value: formatFieldJsonValue(item.value) });
      }
    });
  } else if (parsed && typeof parsed === 'object') {
    Object.entries(parsed).forEach(([field, value]) => {
      fields.push({ field: String(field).trim(), value: formatFieldJsonValue(value) });
    });
  } else {
    return { fields: [], error: 'JSON must be an object or an array' };
  }

  const validFields = fields.filter((item) => item.field);
  return {
    fields: validFields,
    error: validFields.length ? '' : 'JSON must include at least one field',
  };
}

function encodeUnsignedLeb128(value) {
  const bytes = [];
  let next = Number(value) >>> 0;
  do {
    let byte = next & 0x7f;
    next >>>= 7;
    if (next !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (next !== 0);
  return bytes;
}

function encodeWasmName(value) {
  const bytes = Array.from(new TextEncoder().encode(value));
  return [...encodeUnsignedLeb128(bytes.length), ...bytes];
}

function wasmSection(id, payload) {
  return [id, ...encodeUnsignedLeb128(payload.length), ...payload];
}

function generateBinaryWasm({ fn, valueType, operation }) {
  const type = wasmValueTypes[valueType] || wasmValueTypes.i64;
  const opcode = wasmBinaryOpcodes[valueType]?.[operation] ?? wasmBinaryOpcodes.i64.add;
  const typeSection = [0x01, 0x60, 0x02, type, type, 0x01, type];
  const functionSection = [0x01, 0x00];
  const exportSection = [0x01, ...encodeWasmName(fn), 0x00, 0x00];
  const body = [0x00, 0x20, 0x00, 0x20, 0x01, opcode, 0x0b];
  const codeSection = [0x01, ...encodeUnsignedLeb128(body.length), ...body];
  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d,
    0x01, 0x00, 0x00, 0x00,
    ...wasmSection(1, typeSection),
    ...wasmSection(3, functionSection),
    ...wasmSection(7, exportSection),
    ...wasmSection(10, codeSection),
  ]);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function formatWasmBytes(bytes) {
  if (!bytes?.length) return '-';
  return `${bytes.length} bytes`;
}

function formatHexPreview(bytes, limit = 96) {
  if (!bytes?.length) return '';
  const shown = Array.from(bytes.slice(0, limit)).map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
  return bytes.length > limit ? `${shown} ...` : shown;
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
  const label = type === 'zset' ? 'ZSET' : type === 'vector' ? 'VECTOR' : String(type || 'none').toUpperCase();
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
  const [connectionUrlDirty, setConnectionUrlDirty] = useState(false);
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

  const parseUrlDraft = () => {
    const parsed = parseRedisConnectionUrl(connectionUrl);
    const next = { ...draft, ...parsed, alias: draft.alias || parsed.alias };
    return next;
  };

  const mergeUrlIntoDraft = () => {
    const next = parseUrlDraft();
    setDraft((current) => ({
      ...current,
      host: next.host,
      port: next.port,
      db: next.db,
      password: next.password,
      alias: current.alias || next.alias,
    }));
    setConnectionUrlDirty(false);
    return next;
  };

  const updateDraftField = (field, value) => {
    setConnectionUrlDirty(false);
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const getConnectionDraft = () => {
    if (!settingsOpen || connectionUrlDirty) return parseUrlDraft();
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
              onChange={(event) => {
                setConnectionUrl(event.target.value);
                setConnectionUrlDirty(true);
              }}
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
                <input value={draft.alias} onChange={(event) => updateDraftField('alias', event.target.value)} />
              </label>
              <label>
                <span>Host</span>
                <input value={draft.host} onChange={(event) => updateDraftField('host', event.target.value)} />
              </label>
              <label>
                <span>Port</span>
                <input value={draft.port} onChange={(event) => updateDraftField('port', event.target.value)} />
              </label>
              <label>
                <span>Database</span>
                <input value={draft.db} onChange={(event) => updateDraftField('db', event.target.value)} />
              </label>
              <label className="settings-wide">
                <span>Password</span>
                <input type="password" value={draft.password} onChange={(event) => updateDraftField('password', event.target.value)} />
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
        <button
          className={activeView === 'projects' ? 'side-button active' : 'side-button'}
          title="Project management"
          aria-label="Project management"
          onClick={() => onViewChange('projects')}
        >
          <AppstoreOutlined />
        </button>
        <button
          className={activeView === 'benchmarks' ? 'side-button active' : 'side-button'}
          title="Benchmark lab"
          aria-label="Benchmark lab"
          onClick={() => onViewChange('benchmarks')}
        >
          <BarChartOutlined />
        </button>
        <button
          className={activeView === 'operations' ? 'side-button active' : 'side-button'}
          title="Operations"
          aria-label="Operations"
          onClick={() => onViewChange('operations')}
        >
          <DashboardOutlined />
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
  draft,
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
    const localConnection = connection.id === localRedisConnection.id
      ? connection
      : draft.id === localRedisConnection.id
        ? draft
        : defaultConnection;
    const saved = {
      id: localRedisConnection.id,
      alias: localConnection.alias || localRedisConnection.alias,
      host: localConnection.host || localRedisConnection.host,
      port: localConnection.port || localRedisConnection.port,
      db: localConnection.db || localRedisConnection.db,
      password: localConnection.password || '',
      hostPort: `${localConnection.host || localRedisConnection.host}:${localConnection.port || localRedisConnection.port}`,
      dbCount: logicalDbCount,
      type: 'Standalone',
      capabilities: status.connected && connection.id === localRedisConnection.id ? `${dbStats.keys ?? 0} keys` : '-',
      lastConnection: status.connected && connection.id === localRedisConnection.id ? '< 1 minute ago' : 'Not connected',
      tags: 'local',
      connected: status.connected && connection.id === localRedisConnection.id,
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
  }, [connection, customConnections, dbStats.keys, draft, logicalDbCount, status.connected]);
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
                      title="Edit database"
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

function OperationsPage() {
  const [filters, setFilters] = useState({
    tablet: '',
    node_state: 'All',
    route_state: 'All',
    command_status: 'All',
    focus_node_id: '0',
  });
  const [dashboardHtml, setDashboardHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(null);

  const loadDashboard = useCallback(async () => {
    const params = new URLSearchParams(filters);
    setLoading(true);
    setError('');
    try {
      const data = await api(`/operations/dashboard?${params}`);
      setDashboardHtml(data.html || '');
      setLastRefreshAt(Date.now());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 250);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(loadDashboard, 4000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <main className="operations-page">
      <section className="operations-header">
        <div>
          <span className="section-eyebrow">Operations</span>
          <h1>Operations Console</h1>
          <p>{operationsConsoleUrl}</p>
        </div>
        <div className="operations-actions">
          <span className="operations-status">
            {loading && <LoadingOutlined />}
            {error ? 'Target unavailable' : lastRefreshAt ? `Updated ${new Date(lastRefreshAt).toLocaleTimeString()}` : 'Waiting for data'}
          </span>
          <button type="button" className="secondary-action strong-outline" onClick={loadDashboard} disabled={loading}>
            <ReloadOutlined /> Reload
          </button>
          <a className="primary-button operations-open-link" href={operationsConsoleUrl} target="_blank" rel="noreferrer">
            <DashboardOutlined /> Open
          </a>
        </div>
      </section>
      <section className="operations-filter-bar">
        <input
          value={filters.tablet}
          onChange={(event) => updateFilter('tablet', event.target.value)}
          placeholder="Search tablet id"
        />
        <select value={filters.node_state} onChange={(event) => updateFilter('node_state', event.target.value)}>
          <option value="All">All Node States</option>
          <option value="Up">Up</option>
          <option value="Down">Down</option>
          <option value="Tombstone">Tombstone</option>
        </select>
        <select value={filters.route_state} onChange={(event) => updateFilter('route_state', event.target.value)}>
          <option value="All">All Route States</option>
          <option value="Assigned">Leader Assigned</option>
          <option value="Unassigned">Leader Unassigned</option>
        </select>
        <select value={filters.command_status} onChange={(event) => updateFilter('command_status', event.target.value)}>
          <option value="All">All Command States</option>
          <option value="Pending">Pending</option>
          <option value="Acked">Acked</option>
          <option value="Completed">Completed</option>
          <option value="Failed">Failed</option>
        </select>
      </section>
      <section className="operations-dashboard-shell">
        {error ? (
          <div className="operations-error">
            <strong>Unable to load operations dashboard</strong>
            <span>{error}</span>
          </div>
        ) : (
          <div className="operations-dashboard" dangerouslySetInnerHTML={{ __html: dashboardHtml }} />
        )}
      </section>
    </main>
  );
}

const kvEngineUnitSuites = [
  { file: 'src/db/db_impl_tests.rs', count: 106, purpose: '端到端验证 DbImpl 核心读写语义。', coverage: 'put/get/delete/write batch、WAL recovery、flush、snapshot、range delete、merge operator、iterator、row cache、GC。' },
  { file: 'src/db/transaction_center/transaction.rs', count: 47, purpose: '验证事务 API 的读写隔离和悲观锁行为。', coverage: 'snapshot view、read own writes、commit conflict、range scan conflict、pessimistic lock、timeout、error display。' },
  { file: 'tests/skip_map.rs', count: 34, purpose: '验证并发 skip map 数据结构。', coverage: 'insert/remove/get/range iter、compare insert、entry reposition、并发 insert/remove、内存释放路径。' },
  { file: 'src/wal/wal_manager.rs', count: 27, purpose: '验证 WAL manager 的日志轮转和恢复。', coverage: '多 WAL recovery、put/delete/range delete/merge 记录、corrupted tail、arena full rotate、文件创建失败路径。' },
  { file: 'src/db/transaction_center/occ_pipeline.rs', count: 26, purpose: '验证 OCC 提交流水线和冲突检测。', coverage: 'intent table、read/write conflict、phantom detection、hotspot tracker、prewrite retry、commit pipeline、pending intent。' },
  { file: 'src/memtable/vec_table.rs', count: 26, purpose: '验证 VecTable memtable 后端。', coverage: 'put/get/scan、overwrite、chunk freeze、background compaction、snapshot visibility、heap scan、tombstone、flush preparation。' },
  { file: 'tests/block_skiplist.rs', count: 25, purpose: '验证 block skiplist 容器行为。', coverage: 'insert/remove/get、bounds、iter/range iter、entry API、parallel get_or_insert、drop/clear、remove race。' },
  { file: 'src/compaction/flush.rs', count: 20, purpose: '验证 memtable flush 到 tablet/level block 的路径。', coverage: '空 flush、多 immutable、range tombstone、merge chain、prefix compression、L3 大块切分、并行度和内存统计。' },
  { file: 'src/cache/row_cache.rs', count: 19, purpose: '验证 row cache 正确性和维护任务。', coverage: 'version check、put/get/delete、older version reject、page eviction、range tombstone cleanup、memory stats、hash collision。' },
  { file: 'src/db/db_iterator_impl.rs', count: 19, purpose: '验证 DB iterator 的可见性和排序。', coverage: 'memtable/disk merge、merge chain materialize、range tombstone、seek、bounds、prefix scan、snapshot isolation。' },
  { file: 'src/memtable/skiplist_table.rs', count: 19, purpose: '验证 SkipListTable memtable 后端。', coverage: 'put/get/overwrite、ordered iter、capacity、raw put、seek/next、range tombstone、seq visibility、trait object。' },
  { file: 'src/db/db_diagnostics.rs', count: 16, purpose: '验证诊断和空间放大统计。', coverage: 'data layout print、flush 后布局、immutable memtable、hidden bytes、reclaimable tablet、orphan block、metadata breakdown。' },
  { file: 'src/db/range_tombstone.rs', count: 15, purpose: '验证 range tombstone 过滤和 fragment rebuild。', coverage: 'key range 命中、read seq、overlap rebuild、boundary、filter、internal key、snapshot range。' },
  { file: 'src/db/transaction_center/mvcc_txn/mod.rs', count: 15, purpose: '验证 MVCC transaction 高层行为。', coverage: 'commit/abort、delete tombstone、read own writes、snapshot isolation、并发同 key、deadlock、shared lock。' },
  { file: 'src/storage/block/level_block/merge.rs', count: 15, purpose: '验证 level block 合并和层级提升。', coverage: 'L1/L2/L3 promotion、tiny block fallback、raw iter 构建、range filter、版本保留、range tombstone 保留。' },
  { file: 'src/storage/version_manager/query.rs', count: 15, purpose: '验证 version manager 查询路由。', coverage: 'tablet lookup、missing key、dead tablet invisible、多 tablet、scan visibility、trace、fallback older overlapping tablet、multi_get。' },
  { file: 'src/db/transaction_center/lock_manager.rs', count: 13, purpose: '验证悲观事务锁管理。', coverage: 'point/range lock、deadlock、reentrant、release、timeout、point-range conflict、wait then release。' },
  { file: 'src/db/memtable_manager.rs', count: 12, purpose: '验证 memtable manager 的多版本读取。', coverage: 'get_at_seq、rotation、delete marker、recovery internal key、arena id、scan order、multi_get、range tombstone。' },
  { file: 'src/storage/block/sst_block/merge.rs', count: 12, purpose: '验证 SST block 合并和重建。', coverage: 'merge blocks、pagination、partial overlap、empty result、large data、older versions、empty iter/block。' },
  { file: 'src/storage/tablet/builder.rs', count: 12, purpose: '验证 tablet view/builder。', coverage: 'empty/single/multiple block view、locate、gap miss、range query、truncated header/entry 容错、tablet range。' },
  { file: 'src/db/db.rs', count: 11, purpose: '验证 DB trait 默认方法和 mock 行为。', coverage: 'prefix upper bound、contains_key、scan_prefix、multi_get、iterator defaults、mock snapshot/flush/sync。' },
  { file: 'src/storage/block/sst_page/iter.rs', count: 11, purpose: '验证 SST page 迭代读取。', coverage: 'prefix compression、merge write type、seek、find internal key、first/last、read entry、invalid footer/out of bounds。' },
  { file: 'src/storage/tablet/view.rs', count: 11, purpose: '验证 tablet view 查询和懒加载。', coverage: 'get/get_at_seq、scan all versions、group by level block、cross-tablet owner、poisoned binary search fallback、lazy fetch。' },
  { file: 'src/compaction/publish.rs', count: 10, purpose: '验证 compaction publish 后 tablet 元数据变更。', coverage: 'multi-tablet split、小 tablet merge、stats summary、grouping、clone error、L2 page ranges、旧 tablet reclaim。' },
  { file: 'src/storage/block/level_block_meta/query.rs', count: 10, purpose: '验证 level block meta 查询策略。', coverage: 'L1/L2 bloom、L2 linear search、L3 priority、higher-level tombstone、invalid filter、trace/read helpers。' },
  { file: 'src/storage/block/level_block/iterator.rs', count: 10, purpose: '验证 level block iterator/get 路由。', coverage: 'range tombstone filtering、physical raw iterator、dedupe same key、meta page subset、多 L1 page read。' },
  { file: 'src/storage/block/level_block/store.rs', count: 10, purpose: '验证 level block store。', coverage: 'read/fill cache、read page、duplicate block reject、memory/buffer limit、GC options、retire/list/latest/tablet store。' },
  { file: 'src/storage/version_edit.rs', count: 10, purpose: '验证 version edit 编解码。', coverage: 'add/retire tablet roundtrip、truncated/corrupt record、unknown tag、empty record、legacy fields。' },
  { file: 'src/wal/mod.rs', count: 10, purpose: '验证 WAL 写线程基础生命周期。', coverage: 'new/drop、single/multiple batch、after drop、concurrent writes、empty/large batch、IO thread failure、channel disconnect。' },
  { file: 'src/compaction/input.rs', count: 9, purpose: '验证 flush/compaction 输入构建。', coverage: 'immutable entries、merge operands、snapshot preserve、merged memtable iterator、bounds、heap ordering、builder finish。' },
  { file: 'src/db/merge_operator.rs', count: 9, purpose: '验证 i64 add merge operator。', coverage: 'full/partial merge、invalid length、missing base、invalid existing/operand、operator name。' },
  { file: 'src/memtable/mod.rs', count: 9, purpose: '验证 memtable trait 默认逻辑。', coverage: 'internal key put、invalid key、range tombstone page、fragment/filter builder、point result tombstone application。' },
  { file: 'src/storage/block/sst_page/writer.rs', count: 9, purpose: '验证 SST page writer/decoder。', coverage: 'CRC valid/invalid、restart interval、empty finish、roundtrip、page block encoding、bad CRC/raw page reject。' },
  { file: 'src/db/cf_cache.rs', count: 8, purpose: '验证 column family cache。', coverage: 'insert/retrieve、eviction、drop cleanup thread、remove、send command、capacity cleanup、version-based eviction。' },
  { file: 'src/storage/memtable_file.rs', count: 8, purpose: '验证 memtable file 存储。', coverage: 'open capacity、write/read_at、read_at_into、partial read error、preallocated zeros、flush、多次写、file id。' },
  { file: 'src/db/block_ref_manager.rs', count: 7, purpose: '验证 block 引用计数管理。', coverage: 'default、acquire/release、zero noop、missing release、unknown strong count、clear。' },
  { file: 'src/memtable/memtable_impl.rs', count: 7, purpose: '验证 memtable facade。', coverage: 'put/get_at_seq、overwrite、delete、scan internal keys、skiplist backend、vec backend、range tombstone。' },
  { file: 'src/storage/tablet/mod.rs', count: 7, purpose: '验证 Tablet 基础模型。', coverage: 'key ordering、debug display、lightweight/default、single anchor、explicit level block ids、metadata init。' },
  { file: 'src/storage/version_manager/recovery.rs', count: 7, purpose: '验证 version manager recovery。', coverage: 'rebuild sorted tablets、arbiter snapshot block id、manifest update、version edit cleanup、empty store、sequence roundtrip、reserved id skip。' },
  { file: 'src/storage/version_manager/reclaim.rs', count: 6, purpose: '验证 dead tablet reclaim。', coverage: 'old ref version wait、zero-ref block remove、plan stats、live tablet reference preserve、no GC version、empty plan。' },
  { file: 'src/storage/tablet/merge.rs', count: 6, purpose: '验证 tablet 层级块合并计划。', coverage: 'single block range、empty stream、multi range routing、range key compare、small L3 helpers、plan execute。' },
  { file: 'src/storage/block/level_block/mod.rs', count: 5, purpose: '验证 level block 基础工具。', coverage: 'raw user key、range overlap lower/upper/no bound、empty page select。' },
  { file: 'src/storage/block/sst_block/block.rs', count: 5, purpose: '验证 SST block 构建。', coverage: 'block/footer、merge、split、range footer helpers、tombstone page helpers。' },
  { file: 'src/storage/tablet/iter.rs', count: 5, purpose: '验证 tablet iterator。', coverage: 'meta iterator 跨 level block、store-backed all versions、next_ref、physical raw ref、empty tablet。' },
  { file: 'src/db/transaction_center/mvcc_txn/deadlock_detector.rs', count: 4, purpose: '验证 MVCC deadlock detector。', coverage: '无环、二节点环、三节点环、abort youngest 策略。' },
  { file: 'src/storage/block/level_block_meta/meta.rs', count: 4, purpose: '验证 level block meta 类型工具。', coverage: 'level name、page handle clone/eq、range handle clone/eq、page id roundtrip。' },
  { file: 'src/compaction/test_support.rs', count: 3, purpose: '验证 compaction 测试工具自身。', coverage: 'put/merge record encoder、L3-only meta、mixed-level meta scan。' },
  { file: 'src/db/transaction_center/mvcc_txn/lock_table.rs', count: 3, purpose: '验证 MVCC lock table。', coverage: 'free key exclusive lock、shared lock coexist、release promotes waiter。' },
  { file: 'src/db/transaction_center/mvcc_txn/mvcc_store.rs', count: 3, purpose: '验证 MVCC store 版本读取。', coverage: 'latest version、tombstone hides value、missing key。' },
  { file: 'src/storage/block/level_block_meta/builder.rs', count: 3, purpose: '验证 level block meta builder。', coverage: 'footer access、iterators、大索引序列化。' },
  { file: 'src/storage/block/sst_block/iterator.rs', count: 3, purpose: '验证 SST block iterator。', coverage: 'KV traversal、多 prefix-compressed page roundtrip、merge block with iter 保持交错 key。' },
  { file: 'src/storage/block/sst_page/debug.rs', count: 3, purpose: '验证 SST page debug 输出。', coverage: 'entries dump、limit、debug wrapper。' },
  { file: 'src/wal/reader.rs', count: 3, purpose: '验证 WAL reader。', coverage: 'basic write/read、checksum corruption、tail truncation。' },
  { file: 'src/db/write_thread.rs', count: 2, purpose: '验证 write thread 分组边界。', coverage: 'request limit、sync boundary、size boundary。' },
  { file: 'src/compaction/merge.rs', count: 1, purpose: '验证 merge operand collapse。', coverage: '连续 merge records 合并。' },
  { file: 'src/storage/block/level_block_meta/raw.rs', count: 1, purpose: '验证 raw meta 容错。', coverage: 'truncated index 不 panic。' },
  { file: 'src/storage/block/range_tombstone_page.rs', count: 1, purpose: '验证 tombstone page 编解码。', coverage: 'fragment roundtrip。' },
  { file: 'src/storage/version_manager/mod.rs', count: 1, purpose: '验证 tablet id 编码规则。', coverage: 'engine id 写入高 24 位。' },
];

const projectModules = [
  {
    id: 'onedis-server',
    name: 'onedis-server',
    path: 'crates/onedis-server',
    language: 'Rust',
    role: 'Redis protocol, command routing, wasm runtime, coordinator client',
    status: 'Hot path',
    coverage: 64,
    tests: '182 passing',
    risks: ['RESP binary boundary', 'command atomicity', 'scheduler backpressure'],
    smell: 'Command handlers and storage side effects are still too close.',
    docs: ['README.md', 'docs/redis-protocol.md', 'docs/wasm-runtime.md'],
    unitSuites: ['command_router', 'resp_binary', 'wasm_commands'],
    benchmarks: ['redis_benchmark_set', 'pipeline_latency', 'wasm_call_overhead'],
  },
  {
    id: 'mysql',
    name: 'mysql',
    path: 'integrations/mysql',
    language: 'SQL / Rust',
    role: 'MySQL compatibility, migration probes, smoke workloads',
    status: 'Adapter',
    coverage: 51,
    tests: '38 passing',
    risks: ['type coercion', 'DDL drift', 'transaction edge cases'],
    smell: 'Compatibility fixtures need stronger golden coverage.',
    docs: ['docs/mysql-compat.md', 'docs/type-mapping.md'],
    unitSuites: ['mysql_smoke', 'ddl_mapping', 'transaction_edges'],
    benchmarks: ['mysql_insert_adapter', 'schema_probe_latency'],
  },
  {
    id: 'pg_gateway',
    name: 'pg_gateway',
    path: 'crates/pg_gateway',
    language: 'Rust',
    role: 'Postgres wire gateway, SQL bridge, copy protocol',
    status: 'Boundary',
    coverage: 57,
    tests: '74 passing',
    risks: ['COPY framing', 'error mapping', 'connection lifecycle'],
    smell: 'Gateway state machine should be more visible in tests.',
    docs: ['docs/pg-gateway.md', 'docs/copy-protocol.md'],
    unitSuites: ['pg_handshake', 'copy_protocol', 'error_mapping'],
    benchmarks: ['copy_ingest', 'pg_select_latency'],
  },
  {
    id: 'uni5db',
    name: 'uni5db',
    path: '/mnt/source/uni5db',
    language: 'Rust',
    role: 'WAL coordinator, client, proto, and write-ahead log runtime',
    status: 'Core',
    coverage: 48,
    tests: '219 passing',
    risks: ['WAL durability boundary', 'coordinator lifecycle', 'client retry semantics'],
    smell: 'WAL DB review docs should drive the next interface cleanup pass.',
    docs: ['docs/wal-db-review.html'],
    unitSuites: ['tablet_split', 'compaction_plan', 'metadata_contracts', 'lock_invariants'],
    benchmarks: ['put_fillrandom', 'wal_apply', 'tablet_scan', 'compaction_throughput'],
  },
  {
    id: 'kv_engine',
    name: 'kv_engine',
    path: '/home/coco/workspace/source/unidb/kv_engine',
    language: 'Rust',
    role: 'KV engine runtime, WAL apply, replication group worker',
    status: 'Critical',
    coverage: 43,
    tests: '735 tests / 59 suites',
    risks: ['WAL replay idempotency', 'leader handoff', 'async task leaks'],
    smell: 'Replay path needs a smaller deterministic harness.',
    docs: ['docs/kv-engine.md', 'docs/wal-replay.md', 'docs/replication-groups.md'],
    unitSuites: kvEngineUnitSuites,
    benchmarks: ['wal_replay_idempotent', 'replica_apply_throughput', 'lsn_lookup'],
  },
];

function ProjectManagementPage() {
  const [selectedModuleId, setSelectedModuleId] = useState('uni5db');
  const [kvUnitTestData, setKvUnitTestData] = useState(null);
  const [kvUnitTestLoading, setKvUnitTestLoading] = useState(false);
  const [kvUnitTestError, setKvUnitTestError] = useState('');
  const [selectedSuiteFile, setSelectedSuiteFile] = useState('');
  const [kvTestReviewOpen, setKvTestReviewOpen] = useState(false);
  const [llmReviews, setLlmReviews] = useState({});
  const [llmReviewLoading, setLlmReviewLoading] = useState({});
  const [reviewedTests, setReviewedTests] = useState(readReviewedTestMap);
  const [reviewedTestsSyncError, setReviewedTestsSyncError] = useState('');
  const [kvDocsData, setKvDocsData] = useState(null);
  const [kvDocsLoading, setKvDocsLoading] = useState(false);
  const [kvDocsError, setKvDocsError] = useState('');
  const [selectedKvDocPath, setSelectedKvDocPath] = useState('');
  const [kvDocReaderOpen, setKvDocReaderOpen] = useState(false);
  const [kvDocContent, setKvDocContent] = useState(null);
  const [kvDocContentLoading, setKvDocContentLoading] = useState(false);
  const [kvDocContentError, setKvDocContentError] = useState('');
  const selectedModule = projectModules.find((item) => item.id === selectedModuleId) || projectModules[0];
  const averageCoverage = Math.round(projectModules.reduce((sum, item) => sum + item.coverage, 0) / projectModules.length);
  const totalDocs = projectModules.reduce((sum, item) => sum + item.docs.length, 0);
  const totalBenchmarks = projectModules.reduce((sum, item) => sum + item.benchmarks.length, 0);
  const isKvEngine = selectedModule.id === 'kv_engine';
  const docsProjectKey = selectedModule.id === 'kv_engine' ? 'kv-engine' : selectedModule.id === 'uni5db' ? 'uni5db' : '';
  const isDocsProject = Boolean(docsProjectKey);
  const unitSuites = isKvEngine
    ? (kvUnitTestData?.suites?.length ? kvUnitTestData.suites.map((suite) => {
      const description = kvEngineUnitSuites.find((item) => item.file === suite.file);
      return {
        ...suite,
        purpose: description?.purpose || '真实测试 suite，目的待补充人工注释。',
        coverage: description?.coverage || `Covers ${suite.tags?.join(', ') || 'behavior'}`,
      };
    }) : [])
    : selectedModule.unitSuites;
  const selectedSuite = Array.isArray(unitSuites)
    ? unitSuites.find((suite) => typeof suite !== 'string' && suite.file === selectedSuiteFile)
    : null;

  useEffect(() => {
    if (!isKvEngine || kvUnitTestData) return;
    setKvUnitTestLoading(true);
    setKvUnitTestError('');
    api('/projects/kv-engine/unit-tests')
      .then((data) => {
        setKvUnitTestData(data);
        setSelectedSuiteFile(data.suites?.[0]?.file || '');
      })
      .catch((error) => setKvUnitTestError(error.message))
      .finally(() => setKvUnitTestLoading(false));
  }, [isKvEngine, kvUnitTestData]);

  const refreshKvDocs = useCallback(({ quiet = false } = {}) => {
    if (!docsProjectKey) return Promise.resolve();
    if (!quiet) setKvDocsLoading(true);
    setKvDocsError('');
    return api(`/projects/${docsProjectKey}/docs`)
      .then((data) => {
        setKvDocsData(data);
        setSelectedKvDocPath((current) => {
          if (kvDocsData?.project !== data.project) return data.docs?.[0]?.path || '';
          if (!current) return data.docs?.[0]?.path || '';
          return data.docs?.some((doc) => doc.path === current) ? current : data.docs?.[0]?.path || '';
        });
      })
      .catch((error) => setKvDocsError(error.message))
      .finally(() => {
        if (!quiet) setKvDocsLoading(false);
      });
  }, [docsProjectKey, kvDocsData?.project]);

  const refreshKvDocContent = useCallback((docPath, { quiet = false } = {}) => {
    if (!docsProjectKey || !docPath) {
      setKvDocContent(null);
      return Promise.resolve();
    }
    if (!quiet) setKvDocContentLoading(true);
    setKvDocContentError('');
    return api(`/projects/${docsProjectKey}/doc?path=${encodeURIComponent(docPath)}`)
      .then((data) => {
        setKvDocContent(data);
      })
      .catch((error) => setKvDocContentError(error.message))
      .finally(() => {
        if (!quiet) setKvDocContentLoading(false);
      });
  }, [docsProjectKey]);

  useEffect(() => {
    if (!isDocsProject) {
      setKvDocsData(null);
      setSelectedKvDocPath('');
      setKvDocReaderOpen(false);
      setKvDocContent(null);
      setKvDocContentError('');
      return;
    }
    if (kvDocsData?.project === docsProjectKey) return;
    refreshKvDocs();
  }, [isDocsProject, docsProjectKey, kvDocsData?.project, refreshKvDocs]);

  useEffect(() => {
    if (!isDocsProject) {
      setSelectedKvDocPath('');
      setKvDocReaderOpen(false);
      setKvDocContent(null);
      setKvDocContentError('');
      return;
    }
    refreshKvDocContent(selectedKvDocPath);
  }, [isDocsProject, selectedKvDocPath, refreshKvDocContent]);

  useEffect(() => {
    if (!isDocsProject) return undefined;
    const docsTimer = window.setInterval(() => refreshKvDocs({ quiet: true }), 10000);
    return () => window.clearInterval(docsTimer);
  }, [isDocsProject, refreshKvDocs]);

  useEffect(() => {
    if (!isDocsProject || !kvDocReaderOpen || !selectedKvDocPath) return undefined;
    const docTimer = window.setInterval(() => refreshKvDocContent(selectedKvDocPath, { quiet: true }), 5000);
    return () => window.clearInterval(docTimer);
  }, [isDocsProject, kvDocReaderOpen, selectedKvDocPath, refreshKvDocContent]);

  useEffect(() => {
    if (!isKvEngine) {
      setSelectedSuiteFile('');
      setKvTestReviewOpen(false);
      return;
    }
    const nextSuites = kvUnitTestData?.suites || [];
    if (nextSuites.length && !nextSuites.some((suite) => suite.file === selectedSuiteFile)) {
      setSelectedSuiteFile(nextSuites[0].file);
    }
  }, [isKvEngine, kvUnitTestData, selectedSuiteFile]);

  useEffect(() => {
    if (!isKvEngine) return;
    api('/projects/kv-engine/reviewed-tests')
      .then(async (data) => {
        const backendReviewed = data.reviewedTests || {};
        const localReviewed = readReviewedTestMap();
        const merged = { ...backendReviewed, ...localReviewed };
        setReviewedTests(merged);
        writeReviewedTestMap(merged);
        if (JSON.stringify(merged) !== JSON.stringify(backendReviewed)) {
          await api('/projects/kv-engine/reviewed-tests', {
            method: 'POST',
            body: JSON.stringify({ reviewedTests: merged }),
          });
        }
        setReviewedTestsSyncError('');
      })
      .catch((error) => {
        setReviewedTestsSyncError(error.message);
      });
  }, [isKvEngine]);

  const reviewKeyForTest = (suiteFile, testName) => `${suiteFile}::${testName}`;
  const isTestReviewed = (suiteFile, testName) => Boolean(reviewedTests[reviewKeyForTest(suiteFile, testName)]);
  const toggleTestReviewed = (suiteFile, testName) => {
    const reviewKey = reviewKeyForTest(suiteFile, testName);
    const nextReviewed = !reviewedTests[reviewKey];
    setReviewedTests((current) => {
      const next = { ...current };
      if (next[reviewKey]) delete next[reviewKey];
      else next[reviewKey] = { reviewedAt: new Date().toISOString(), file: suiteFile, name: testName };
      writeReviewedTestMap(next);
      return next;
    });
    api('/projects/kv-engine/reviewed-test', {
      method: 'POST',
      body: JSON.stringify({ file: suiteFile, name: testName, reviewed: nextReviewed }),
    }).then((data) => {
      setReviewedTests(data.reviewedTests || {});
      writeReviewedTestMap(data.reviewedTests || {});
      setReviewedTestsSyncError('');
    }).catch((error) => {
      setReviewedTestsSyncError(error.message);
    });
  };
  const testsForSuite = (suite) => (Array.isArray(suite?.tests) ? suite.tests : []);
  const reviewedCountForSuite = (suite) => (
    typeof suite === 'string' ? 0 : testsForSuite(suite).filter((test) => isTestReviewed(suite.file, test.name)).length
  );
  const openKvDoc = (docPath) => {
    setSelectedKvDocPath(docPath);
    setKvDocReaderOpen(true);
    setKvTestReviewOpen(false);
  };
  const openKvSuiteReview = (suiteFile) => {
    setSelectedSuiteFile(suiteFile);
    setKvTestReviewOpen(true);
    setKvDocReaderOpen(false);
  };
  const renderKvDocRows = (mode = 'panel') => (
    <>
      {kvDocsLoading && <span><strong>Loading {selectedModule.name} docs...</strong><small>Scanning {selectedModule.path}/docs</small></span>}
      {kvDocsError && <span><strong>Unable to load docs</strong><small>{kvDocsError}</small></span>}
      {!kvDocsLoading && !kvDocsError && kvDocsData?.docs?.length === 0 && (
        <span><strong>No documents found</strong><small>{kvDocsData?.root || `${selectedModule.path}/docs`}</small></span>
      )}
      {kvDocsData?.docs?.map((doc) => (
        <button
          type="button"
          key={doc.path}
          className={doc.path === selectedKvDocPath ? 'project-doc-row active' : 'project-doc-row'}
          onClick={() => openKvDoc(doc.path)}
        >
          <strong>{doc.title}</strong>
          <small>{doc.path}</small>
          <em>{doc.ext.toUpperCase()} · {Math.max(1, Math.round(doc.size / 1024))} KB{mode === 'reader' ? ` · ${new Date(doc.updatedAt).toLocaleDateString()}` : ''}</em>
        </button>
      ))}
    </>
  );
  const requestUnitTestLlmReview = async (suiteFile, testName) => {
    const reviewKey = reviewKeyForTest(suiteFile, testName);
    setLlmReviewLoading((current) => ({ ...current, [reviewKey]: true }));
    setLlmReviews((current) => ({ ...current, [reviewKey]: null }));
    try {
      const data = await api('/projects/kv-engine/unit-test-llm-review', {
        method: 'POST',
        body: JSON.stringify({ file: suiteFile, name: testName }),
      });
      setLlmReviews((current) => ({ ...current, [reviewKey]: data.review }));
    } catch (error) {
      setLlmReviews((current) => ({
        ...current,
        [reviewKey]: { error: error.message },
      }));
    } finally {
      setLlmReviewLoading((current) => ({ ...current, [reviewKey]: false }));
    }
  };

  return (
    <main className="project-page">
      <section className="project-header">
        <div>
          <span className="section-eyebrow">Taste Coding</span>
          <h1>Project Management</h1>
          <p>Project documents, architecture maps, unit tests, coverage, and benchmark status for unidb.</p>
        </div>
        <div className="project-header-stats">
          <span><strong>{projectModules.length}</strong> Projects</span>
          <span><strong>{averageCoverage}%</strong> Avg coverage</span>
          <span><strong>{totalDocs}</strong> Docs</span>
          <span><strong>{totalBenchmarks}</strong> Benchmarks</span>
        </div>
      </section>

      <section className="project-layout">
        <aside className="project-module-list" aria-label="Project modules">
          {projectModules.map((module) => (
            <button
              type="button"
              key={module.id}
              className={module.id === selectedModuleId ? 'project-module-card active' : 'project-module-card'}
              onClick={() => setSelectedModuleId(module.id)}
            >
              <span>
                <strong>{module.name}</strong>
                <small>{module.path}</small>
              </span>
              <em>{module.status}</em>
            </button>
          ))}
        </aside>

        <section className={(isDocsProject && kvDocReaderOpen) || (isKvEngine && kvTestReviewOpen) ? 'project-main kv-doc-reader-workspace' : 'project-main'}>
          {isDocsProject && kvDocReaderOpen ? (
            <article className="project-panel kv-doc-reader-panel expanded">
              <div className="project-panel-head kv-doc-reader-head">
                <span>{kvDocContent?.title || 'Document Reader'}</span>
                <div>
                  <strong>{kvDocContent?.path || kvDocsData?.root || 'unidb/docs'}</strong>
                  <button
                    type="button"
                    className="kv-doc-close-button"
                    onClick={() => setKvDocReaderOpen(false)}
                    aria-label="Close document reader"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              </div>
              <div className="kv-doc-reader-grid">
                <aside className="kv-doc-reader-index">
                  <div className="kv-doc-reader-index-title">
                    <strong>Documents</strong>
                    <small>{kvDocsData?.docs?.length || 0} files</small>
                  </div>
                  <div className="asset-list project-doc-list reader">
                    {renderKvDocRows('reader')}
                  </div>
                </aside>
                <section className="kv-doc-reader-content">
                  {kvDocContentLoading && (
                    <div className="kv-doc-reader-state">
                      <strong>Loading document...</strong>
                      <span>Converting markdown to HTML in the local API server.</span>
                    </div>
                  )}
                  {kvDocContentError && (
                    <div className="kv-doc-reader-state error">
                      <strong>Unable to load document</strong>
                      <span>{kvDocContentError}</span>
                    </div>
                  )}
                  {!kvDocContentLoading && !kvDocContentError && kvDocContent && (
                    <>
                      <div className="kv-doc-reader-meta">
                        <span>{kvDocContent.ext.toUpperCase()}</span>
                        <span>{Math.max(1, Math.round(kvDocContent.size / 1024))} KB</span>
                        <span>{new Date(kvDocContent.updatedAt).toLocaleString()}</span>
                      </div>
                      {kvDocContent.ext === 'html' ? (
                        <iframe
                          className="kv-doc-frame"
                          title={kvDocContent.title || kvDocContent.path}
                          sandbox=""
                          srcDoc={kvDocContent.html}
                        />
                      ) : (
                        <div
                          className="kv-doc-html"
                          dangerouslySetInnerHTML={{ __html: kvDocContent.html }}
                        />
                      )}
                    </>
                  )}
                </section>
              </div>
            </article>
          ) : isKvEngine && kvTestReviewOpen ? (
            <article className="project-panel kv-doc-reader-panel kv-test-review-panel expanded">
              <div className="project-panel-head kv-doc-reader-head">
                <span>{selectedSuite?.file || 'Unit Test Review'}</span>
                <div>
                  <strong>{selectedSuite ? `${selectedSuite.count} test methods` : `${unitSuites.length} suites`}</strong>
                  <button
                    type="button"
                    className="kv-doc-close-button"
                    onClick={() => setKvTestReviewOpen(false)}
                    aria-label="Close unit test review"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              </div>
              <div className="kv-doc-reader-grid">
                <aside className="kv-doc-reader-index">
                  <div className="kv-doc-reader-index-title">
                    <strong>Suites</strong>
                    <small>{unitSuites.length || 0} files</small>
                  </div>
                  {reviewedTestsSyncError && (
                    <div className="unit-review-sync-error">Review state sync failed: {reviewedTestsSyncError}</div>
                  )}
                  <div className="asset-list unit-test-list reader">
                    {kvUnitTestLoading && <span><strong>Loading kv_engine tests...</strong><small>Scanning real Rust test functions</small></span>}
                    {kvUnitTestError && <span><strong>Unable to load tests</strong><small>{kvUnitTestError}</small></span>}
                    {unitSuites.map((suite) => (
                      <button
                        type="button"
                        key={typeof suite === 'string' ? suite : suite.file}
                        className={typeof suite !== 'string' && suite.file === selectedSuiteFile ? 'unit-suite-row active' : 'unit-suite-row'}
                        onClick={() => {
                          if (typeof suite !== 'string') setSelectedSuiteFile(suite.file);
                        }}
                      >
                        <strong>
                          {typeof suite === 'string' ? suite : suite.file}
                          {typeof suite === 'string' ? '' : ` (${suite.count})`}
                        </strong>
                        <small>{typeof suite === 'string' ? selectedModule.tests : suite.purpose}</small>
                        {typeof suite !== 'string' && <em>{suite.coverage || `Covers ${suite.tags?.join(', ') || 'behavior'}`}</em>}
                        {typeof suite !== 'string' && testsForSuite(suite).length > 0 && (
                          <small className="unit-review-progress">{reviewedCountForSuite(suite)} / {suite.count || testsForSuite(suite).length} reviewed</small>
                        )}
                      </button>
                    ))}
                  </div>
                </aside>
                <section className="kv-doc-reader-content kv-test-review-content">
                  {selectedSuite ? (
                    <>
                      <div className="unit-detail-summary">
                        <span className={`coverage-status ${selectedSuite.status}`}>
                          {selectedSuite.status === 'strong' ? '覆盖较全' : selectedSuite.status === 'partial' ? '需要补充' : '覆盖偏窄'}
                        </span>
                        <span>Score {selectedSuite.score}%</span>
                        <span>Covered: {selectedSuite.tags?.join(', ') || '-'}</span>
                        <span>Expected: {selectedSuite.expected?.join(', ') || '-'}</span>
                      </div>
                      {selectedSuite.missing?.length ? (
                        <div className="unit-gap-row">
                          <strong>Potential gaps</strong>
                          <span>{selectedSuite.missing.join(', ')}</span>
                        </div>
                      ) : (
                        <div className="unit-gap-row covered">
                          <strong>Potential gaps</strong>
                          <span>No obvious gap from test names. Next step is checking assertions and fixture depth.</span>
                        </div>
                      )}
                      <div className="unit-method-grid review">
                        {testsForSuite(selectedSuite).map((test) => {
                          const reviewKey = reviewKeyForTest(selectedSuite.file, test.name);
                          const llmReview = llmReviews[reviewKey];
                          const llmLoading = llmReviewLoading[reviewKey];
                          const reviewed = isTestReviewed(selectedSuite.file, test.name);
                          return (
                            <div className={reviewed ? 'unit-method-card reviewed' : 'unit-method-card'} key={`${selectedSuite.file}:${test.name}`}>
                              <div className="unit-method-title">
                                <strong>{test.name}</strong>
                                <small>{reviewed ? 'reviewed' : 'not reviewed'} · line {test.line} · {test.assertions ?? 0} asserts</small>
                              </div>
                              <dl>
                                <dt>规则目的</dt>
                                <dd>{test.purpose || '待补充目的说明'}</dd>
                                <dt>规则覆盖</dt>
                                <dd>{test.coverage || test.tags.join(', ')}</dd>
                                <dt>关键操作</dt>
                                <dd>{test.operations?.length ? test.operations.join(', ') : '未识别出明显调用'}</dd>
                                <dt>初筛</dt>
                                <dd>{test.review?.join(' ') || '需要人工检查断言和 fixture 深度。'}</dd>
                              </dl>
                              <button
                                type="button"
                                className="llm-review-button"
                                disabled={llmLoading}
                                onClick={() => requestUnitTestLlmReview(selectedSuite.file, test.name)}
                              >
                                {llmLoading ? <LoadingOutlined /> : <ThunderboltOutlined />}
                                {llmLoading ? 'Reviewing' : 'LLM Review'}
                              </button>
                              <button
                                type="button"
                                className={reviewed ? 'mark-reviewed-button reviewed' : 'mark-reviewed-button'}
                                onClick={() => toggleTestReviewed(selectedSuite.file, test.name)}
                              >
                                <CheckOutlined />
                                {reviewed ? 'Reviewed' : 'Mark Reviewed'}
                              </button>
                              {llmReview && (
                                <div className={llmReview.error ? 'llm-review error' : 'llm-review'}>
                                  {llmReview.error ? (
                                    <span>{llmReview.error}</span>
                                  ) : (
                                    <>
                                      <strong>{llmReview.purpose || llmReview.summary || 'LLM semantic review'}</strong>
                                      {Array.isArray(llmReview.covers) && <span>覆盖：{llmReview.covers.join('；')}</span>}
                                      {llmReview.assertion_quality && <span>断言：{llmReview.assertion_quality}</span>}
                                      {Array.isArray(llmReview.missing_cases) && <span>缺口：{llmReview.missing_cases.join('；') || '未发现明显缺口'}</span>}
                                      {llmReview.review_note && <span>结论：{llmReview.review_note}</span>}
                                      {llmReview.risk && <em>Risk: {llmReview.risk}</em>}
                                    </>
                                  )}
                                </div>
                              )}
                              {test.sourcePreview && <pre>{test.sourcePreview}</pre>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="kv-doc-reader-state">
                      <strong>No suite selected</strong>
                      <span>Select a unit test suite from the left panel.</span>
                    </div>
                  )}
                </section>
              </div>
            </article>
          ) : (
            <>
          <div className="project-context-grid">
            <article className="project-panel project-summary-panel">
              <div className="project-panel-head">
                <span>Context</span>
                <TypeBadge type={selectedModule.id === 'uni5db' ? 'stream' : selectedModule.id === 'kv_engine' ? 'zset' : 'hash'} />
              </div>
              <h2>{selectedModule.name}</h2>
              <p>{selectedModule.role}</p>
              <div className="project-meta-grid">
                <span><strong>Path</strong>{selectedModule.path}</span>
                <span><strong>Language</strong>{selectedModule.language}</span>
                <span><strong>Tests</strong>{isKvEngine && kvUnitTestData ? `${kvUnitTestData.testCount} tests / ${kvUnitTestData.suiteCount} suites` : selectedModule.tests}</span>
                <span><strong>Coverage</strong>{selectedModule.coverage}%</span>
              </div>
            </article>

            <article className="project-panel">
              <div className="project-panel-head">
                <span>Quality Gate</span>
                <CheckOutlined />
              </div>
              <div className="coverage-ring" style={{ '--coverage': `${selectedModule.coverage}%` }}>
                <strong>{selectedModule.coverage}%</strong>
                <span>line coverage</span>
              </div>
              <p className="project-note">{selectedModule.smell}</p>
            </article>
          </div>

          <div className="project-assets-grid">
            <article className="project-panel asset-panel unit-test-panel">
              <div className="project-panel-head">
                <span>Project Documents</span>
                <TableOutlined />
              </div>
              <div className="asset-list project-doc-list">
                {isDocsProject ? (
                  <>
                    {renderKvDocRows()}
                  </>
                ) : (
                  selectedModule.docs.map((doc) => (
                    <span key={doc}>
                      <strong>{doc}</strong>
                      <small>tracked documentation</small>
                    </span>
                  ))
                )}
              </div>
            </article>

            <article className="project-panel asset-panel">
              <div className="project-panel-head">
                <span>Unit Tests</span>
                <CheckOutlined />
              </div>
              {reviewedTestsSyncError && (
                <div className="unit-review-sync-error">Review state sync failed: {reviewedTestsSyncError}</div>
              )}
              <div className="asset-list unit-test-list">
                {kvUnitTestLoading && <span><strong>Loading kv_engine tests...</strong><small>Scanning real Rust test functions</small></span>}
                {kvUnitTestError && <span><strong>Unable to load tests</strong><small>{kvUnitTestError}</small></span>}
                {unitSuites.map((suite) => (
                  <button
                    type="button"
                    key={typeof suite === 'string' ? suite : suite.file}
                    className={typeof suite !== 'string' && suite.file === selectedSuiteFile ? 'unit-suite-row active' : 'unit-suite-row'}
                    onClick={() => {
                      if (typeof suite !== 'string') openKvSuiteReview(suite.file);
                    }}
                  >
                    <strong>
                      {typeof suite === 'string' ? suite : suite.file}
                      {typeof suite === 'string' ? '' : ` (${suite.count})`}
                    </strong>
                    <small>{typeof suite === 'string' ? selectedModule.tests : suite.purpose}</small>
                    {typeof suite !== 'string' && <em>{suite.coverage || `Covers ${suite.tags?.join(', ') || 'behavior'}`}</em>}
                    {typeof suite !== 'string' && testsForSuite(suite).length > 0 && (
                      <small className="unit-review-progress">{reviewedCountForSuite(suite)} / {suite.count || testsForSuite(suite).length} reviewed</small>
                    )}
                  </button>
                ))}
              </div>
            </article>

            <article className="project-panel asset-panel">
              <div className="project-panel-head">
                <span>Benchmarks</span>
                <ThunderboltOutlined />
              </div>
              <div className="asset-list">
                {selectedModule.benchmarks.map((benchmark) => (
                  <span key={benchmark}>
                    <strong>{benchmark}</strong>
                    <small>latest run pending</small>
                  </span>
                ))}
              </div>
            </article>
          </div>

            </>
          )}
        </section>
      </section>
    </main>
  );
}

function Header({ connection, draft, status, stats, activeTab, onTabChange, onConnect, onDisconnect, onNewKey, onDatabaseChange, onRefreshMetrics, loading }) {
  const tabs = ['Browse', 'Search', 'Vector Search', 'Workbench', 'Wasm', 'Analyze', 'Pub/Sub'];
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
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab}
              className={tab === activeTab ? 'workspace-tab active' : 'workspace-tab'}
              onClick={() => onTabChange(tab)}
            >
              {tab}
            </button>
          ))}
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
        <option value="vector">Vector</option>
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
  const [pageSize, setPageSize] = useState(() => readStoredPageSize(keyBrowserPageSizeStorageKey));
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
  const updatePageSize = (nextPageSize) => {
    setPageSize(nextPageSize);
    writeStoredPageSize(keyBrowserPageSizeStorageKey, nextPageSize);
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
            onChange={(event) => updatePageSize(Number(event.target.value))}
            aria-label="Rows per page"
          >
            {paginationPageSizes.map((size) => <option value={size} key={size}>{size}</option>)}
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
          {paginationPageSizes.map((size) => <option value={size} key={size}>{size}</option>)}
        </select>
      </label>
    </div>
  );
}

function BinaryStringPreview({ value }) {
  const preview = formatBinaryPreview(value);
  return (
    <div className="binary-string-preview">
      <div className="binary-summary">
        <strong>Binary string</strong>
        <span>{preview.bytes.length} bytes</span>
      </div>
      <div className="binary-preview-grid">
        <span>HEX</span>
        <pre>{preview.hex || '-'}</pre>
        <span>ASCII</span>
        <pre>{preview.ascii || '-'}</pre>
      </div>
    </div>
  );
}

function ValueContent({ detail, onDeleteField, onDeleteSetMember, onDeleteStreamEntry, onUpdateListElement, onUpdateSetMember, onUpdateHashField, onUpdateZsetEntry, onUpdateVectorAttrs }) {
  const [editingListIndex, setEditingListIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingOriginalValue, setEditingOriginalValue] = useState('');
  const [editingVectorElement, setEditingVectorElement] = useState('');
  const [editingVectorAttrs, setEditingVectorAttrs] = useState('');
  const [streamTab, setStreamTab] = useState('data');
  const [valuePage, setValuePage] = useState(1);
  const [valuePageSize, setValuePageSize] = useState(() => readStoredPageSize(valueViewerPageSizeStorageKey));
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
  const updateValuePageSize = (nextPageSize) => {
    setValuePageSize(nextPageSize);
    writeStoredPageSize(valueViewerPageSizeStorageKey, nextPageSize);
  };

  if (!detail) return <div className="empty-value">Select a key to inspect its value.</div>;
  const value = detail.value;
  if (Array.isArray(value)) {
    const isHash = detail.type === 'hash';
    const isList = detail.type === 'list';
    const isSet = detail.type === 'set';
    const isStream = detail.type === 'stream';
    const isVector = detail.type === 'vector';
    if (isVector) {
      const vectorPageCount = Math.max(1, Math.ceil(value.length / valuePageSize));
      const vectorCurrentPage = Math.min(valuePage, vectorPageCount);
      const vectorStartIndex = (vectorCurrentPage - 1) * valuePageSize;
      const vectorEndIndex = Math.min(value.length, vectorStartIndex + valuePageSize);
      const pagedVectorRows = value.slice(vectorStartIndex, vectorEndIndex);
      const vectorInfo = detail.vectorInfo || {};
      const formatVector = (vector) => (
        Array.isArray(vector) && vector.length
          ? `[${vector.map((item) => Number(item).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')).join(', ')}]`
          : '-'
      );
      const startVectorAttrsEdit = (row) => {
        setEditingVectorElement(row.element);
        setEditingVectorAttrs(row.attrs || '');
      };
      const cancelVectorAttrsEdit = () => {
        setEditingVectorElement('');
        setEditingVectorAttrs('');
      };
      const saveVectorAttrs = async (row) => {
        if (!row?.element || !onUpdateVectorAttrs) return;
        await onUpdateVectorAttrs({ element: row.element, attrs: editingVectorAttrs });
        cancelVectorAttrsEdit();
      };
      return (
        <div className="vector-view">
          <div className="vector-info-strip">
            <span>Dim: <strong>{vectorInfo.dim ?? '-'}</strong></span>
            <span>Distance: <strong>{vectorInfo.distance ?? '-'}</strong></span>
            <span>Docs: <strong>{vectorInfo.doc_count ?? detail.length ?? value.length}</strong></span>
            <span>Nodes: <strong>{vectorInfo.hnsw_nodes ?? '-'}</strong></span>
          </div>
          <div className="value-table vector-value-table">
            <div className="value-table-head">
              <span>Element</span>
              <span>Embedding</span>
              <span>Attributes</span>
            </div>
            <div className="value-table-scroll">
              {pagedVectorRows.length ? pagedVectorRows.map((row, index) => (
                <div className="value-table-row" key={`${row.element}-${index}`}>
                  <span>{row.element}</span>
                  <span><code>{formatVector(row.vector)}</code></span>
                  <span className="vector-attrs-cell">
                    {editingVectorElement === row.element ? (
                      <div className="vector-attrs-editor">
                        <textarea
                          autoFocus
                          value={editingVectorAttrs}
                          onChange={(event) => setEditingVectorAttrs(event.target.value)}
                          placeholder='{"category":"phone"}'
                        />
                        <div>
                          <button type="button" className="ghost-button compact" onClick={cancelVectorAttrsEdit}>Cancel</button>
                          <button type="button" className="submit-key-button compact" onClick={() => saveVectorAttrs(row)}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="vector-attrs-display" onClick={() => startVectorAttrsEdit(row)}>
                        <code>{row.attrs || '-'}</code>
                        <EditOutlined />
                      </button>
                    )}
                  </span>
                </div>
              )) : (
                <div className="empty-state">No vector elements found.</div>
              )}
            </div>
            <PaginationBar
              total={value.length}
              page={vectorCurrentPage}
              pageSize={valuePageSize}
              onPageChange={(nextPage) => setClampedValuePage(nextPage, value.length)}
              onPageSizeChange={updateValuePageSize}
              className="value-pagination"
            />
          </div>
        </div>
      );
    }
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
            onPageSizeChange={updateValuePageSize}
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
    const getEditableCellKey = (row, column = 'value') => {
      if (isSet) return `set:value:${formatResult(row.value)}`;
      if (isList) return `list:value:${row.index}`;
      return `${detail.type}:${column}:${formatResult(row.index)}`;
    };
    const saveEditableValue = async (row, column = 'value') => {
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
        if (isHash && onUpdateHashField) {
          const originalField = formatResult(row.index);
          const nextField = column === 'field' ? nextValue.trim() : originalField;
          if (!nextField) return;
          await onUpdateHashField({
            oldField: originalField,
            field: nextField,
            value: column === 'value' ? nextValue : formatResult(row.value),
          });
        }
        if (detail.type === 'zset' && onUpdateZsetEntry) {
          const originalMember = formatResult(row.index);
          const nextMember = column === 'field' ? nextValue.trim() : originalMember;
          const nextScore = column === 'value' ? nextValue.trim() : formatResult(row.value).trim();
          if (!nextMember || nextScore === '' || !Number.isFinite(Number(nextScore))) return;
          await onUpdateZsetEntry({ oldMember: originalMember, member: nextMember, score: nextScore });
        }
      } finally {
        savingListEditRef.current = false;
      }
    };
    const startEditableValue = (row, column = 'value') => {
      if (!isList && !isSet && !isFieldValueTable) return;
      const currentValue = column === 'field' ? formatResult(row.index) : formatResult(row.value);
      setEditingListIndex(getEditableCellKey(row, column));
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
                <span>{detail.type === 'zset' ? 'Member' : isFieldValueTable ? 'Field' : 'Index'}</span>
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
              <span>{detail.type === 'zset' ? 'Score' : isFieldValueTable ? 'Value' : 'Element'}</span>
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
                {editingListIndex === getEditableCellKey(row) ? (
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
            <div className={isList ? 'value-table-row editable-list-row' : isFieldValueTable ? 'value-table-row editable-field-row' : 'value-table-row'} key={`${row.index}-${row.value}-${index}`}>
              <span
                className={isFieldValueTable ? 'editable-value-cell' : ''}
                onClick={isFieldValueTable ? () => startEditableValue(row, 'field') : undefined}
              >
                {!isFieldValueTable ? (
                  row.index
                ) : editingListIndex === getEditableCellKey(row, 'field') ? (
                  <input
                    autoFocus
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => saveEditableValue(row, 'field')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveEditableValue(row, 'field');
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
                    <span className="editable-value-text">{formatResult(row.index)}</span>
                    {isFieldValueTable && <EditOutlined className="edit-cell-icon" />}
                  </>
                )}
              </span>
              <span
                className={(isList || isFieldValueTable) ? 'editable-value-cell' : ''}
                onClick={() => startEditableValue(row)}
              >
                {(isList || isFieldValueTable) && editingListIndex === getEditableCellKey(row) ? (
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
                    {(isList || isFieldValueTable) && <EditOutlined className="edit-cell-icon" />}
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
          onPageSizeChange={updateValuePageSize}
          className="value-pagination"
        />
      </div>
    );
  }
  if (detail.type === 'string' && isBinaryStringValue(value)) {
    return <BinaryStringPreview value={value} />;
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

function ValueViewer({ detail, selectedKey, loading, lastRefreshAt, refreshSettings, onRefreshSettingsChange, onReload, onOpenAddValue, onUpdateListElement, onUpdateSetMember, onUpdateHashField, onUpdateZsetEntry, onUpdateVectorAttrs, onUpdateString, onUpdateStringBytes, onUpdateTtl, onDeleteKey, onDeleteField, onDeleteSetMember, onDeleteStreamEntry }) {
  const [viewMode, setViewMode] = useState('list');
  const [editingString, setEditingString] = useState(false);
  const [stringEditMode, setStringEditMode] = useState('text');
  const [editingTtl, setEditingTtl] = useState(false);
  const [stringDraft, setStringDraft] = useState('');
  const [ttlDraft, setTtlDraft] = useState('');
  const isHash = detail?.type === 'hash';
  const isList = detail?.type === 'list';
  const isSet = detail?.type === 'set';
  const isZset = detail?.type === 'zset';
  const isStream = detail?.type === 'stream';
  const isVector = detail?.type === 'vector';
  const isString = detail?.type === 'string';
  const isBinaryString = isString && isBinaryStringValue(detail?.value);
  const canAddValue = isHash || isList || isSet || isZset || isStream || isVector;
  const addLabel = isStream ? 'New Entry' : isVector ? 'Add Vector' : detail?.type === 'hash' ? 'Add Fields' : 'Add Elements';
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
    setStringEditMode('text');
    setEditingTtl(false);
    setStringDraft('');
    setTtlDraft('');
  }, [selectedKey]);

  const startStringEdit = () => {
    if (isBinaryString) {
      setStringEditMode('hex');
      setStringDraft(formatBinaryPreview(detail.value).hex);
    } else {
      setStringEditMode('text');
      setStringDraft(detail ? formatResult(detail.value) : '');
    }
    setEditingString(true);
  };

  const submitStringEdit = async (event) => {
    event.preventDefault();
    if (stringEditMode === 'hex') {
      if (!onUpdateStringBytes) return;
      const bytes = parseHexBytes(stringDraft);
      await onUpdateStringBytes(bytes);
      setEditingString(false);
      return;
    }
    if (onUpdateString) {
      await onUpdateString(stringDraft);
      setEditingString(false);
    }
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
            {stringEditMode === 'hex' && (
              <div className="binary-edit-note">
                <strong>HEX editor</strong>
                <span>This string contains binary bytes. Edit hexadecimal pairs to avoid text encoding corruption.</span>
              </div>
            )}
            <textarea
              value={stringDraft}
              onChange={(event) => setStringDraft(event.target.value)}
              autoFocus
              spellCheck={false}
              placeholder={stringEditMode === 'hex' ? '00 01 ff' : 'Enter string value'}
            />
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
            onUpdateHashField={onUpdateHashField}
            onUpdateZsetEntry={onUpdateZsetEntry}
            onUpdateVectorAttrs={onUpdateVectorAttrs}
          />
        )}
      </div>
    </section>
  );
}

function AddValuePanel({ detail, selectedKey, loading, onClose, onAddField, onAddElement, onAddStreamEntry, onAddVectorElement }) {
  const [fieldDraft, setFieldDraft] = useState({ field: '', value: '', ttl: '', listSide: 'tail' });
  const [hashFieldRows, setHashFieldRows] = useState([{ field: '', value: '', ttl: '' }]);
  const [hashInputMode, setHashInputMode] = useState('rows');
  const [hashJsonDraft, setHashJsonDraft] = useState('');
  const [streamFieldRows, setStreamFieldRows] = useState([{ field: '', value: '' }]);
  const [streamInputMode, setStreamInputMode] = useState('rows');
  const [streamJsonDraft, setStreamJsonDraft] = useState('');
  const [zsetRows, setZsetRows] = useState([{ score: '', member: '' }]);
  const [vectorDraft, setVectorDraft] = useState({ element: '', vector: '', attrs: '' });
  const [panelError, setPanelError] = useState('');
  const isHash = detail?.type === 'hash';
  const isList = detail?.type === 'list';
  const isSet = detail?.type === 'set';
  const isZset = detail?.type === 'zset';
  const isStream = detail?.type === 'stream';
  const isVector = detail?.type === 'vector';
  const panelTitle = isStream ? 'New Entry' : isVector ? 'Add Vector Element' : isHash ? 'Add Fields' : 'Add Elements';
  const parsedHashJson = useMemo(
    () => (isHash && hashInputMode === 'json' ? parseFieldJsonEntries(hashJsonDraft) : { fields: [], error: '' }),
    [hashInputMode, hashJsonDraft, isHash],
  );
  const parsedStreamJson = useMemo(
    () => (isStream && streamInputMode === 'json' ? parseFieldJsonEntries(streamJsonDraft) : { fields: [], error: '' }),
    [isStream, streamInputMode, streamJsonDraft],
  );
  const parsedListValues = isList ? parseElementValues(fieldDraft.value) : [];
  const parsedSetValues = isSet ? parseElementValues(fieldDraft.value) : [];
  const parsedVectorValues = isVector ? parseVectorValues(vectorDraft.vector) : [];
  const vectorAttrsValid = !vectorDraft.attrs.trim() || (() => {
    try {
      JSON.parse(vectorDraft.attrs);
      return true;
    } catch {
      return false;
    }
  })();
  const validHashRows = hashFieldRows
    .map((item) => ({ field: item.field.trim(), value: item.value, ttl: item.ttl.trim() }))
    .filter((item) => item.field);
  const validHashFields = hashInputMode === 'json' ? parsedHashJson.fields : validHashRows;
  const validStreamRows = streamFieldRows
    .map((item) => ({ field: item.field.trim(), value: item.value }))
    .filter((item) => item.field && String(item.value).trim());
  const validStreamFields = streamInputMode === 'json' ? parsedStreamJson.fields : validStreamRows;
  const validZsetRows = zsetRows
    .map((item) => ({ score: String(item.score).trim(), member: String(item.member).trim() }))
    .filter((item) => item.member && item.score !== '' && Number.isFinite(Number(item.score)));
  const canSave = isHash
    ? validHashFields.length > 0
    : isStream
      ? validStreamFields.length > 0
      : isZset
        ? validZsetRows.length > 0
        : isVector
          ? Boolean(vectorDraft.element.trim()) && parsedVectorValues.length > 0 && vectorAttrsValid
          : isList
            ? parsedListValues.length > 0
            : isSet
              ? parsedSetValues.length > 0
              : Boolean(fieldDraft.value.trim());

  useEffect(() => {
    setFieldDraft({ field: '', value: '', ttl: '', listSide: 'tail' });
    setHashFieldRows([{ field: '', value: '', ttl: '' }]);
    setHashInputMode('rows');
    setHashJsonDraft('');
    setStreamFieldRows([{ field: '', value: '' }]);
    setStreamInputMode('rows');
    setStreamJsonDraft('');
    setZsetRows([{ score: '', member: '' }]);
    setVectorDraft({ element: '', vector: '', attrs: '' });
    setPanelError('');
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

  const updateZsetRow = (index, patch) => {
    setZsetRows((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addZsetRow = () => {
    setZsetRows((rows) => [...rows, { score: '', member: '' }]);
  };

  const removeZsetRow = (index) => {
    setZsetRows((rows) => (rows.length === 1 ? [{ score: '', member: '' }] : rows.filter((_, itemIndex) => itemIndex !== index)));
  };

  const submitField = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (isHash) {
      if (!validHashFields.length || parsedHashJson.error || !onAddField) return;
      for (const item of validHashFields) {
        await onAddField(item);
      }
    } else if (isStream) {
      if (!validStreamFields.length || parsedStreamJson.error || !onAddStreamEntry) return;
      await onAddStreamEntry({ fields: validStreamFields });
    } else if (isList) {
      if (!parsedListValues.length || !onAddElement) return;
      await onAddElement({ values: parsedListValues, side: fieldDraft.listSide });
    } else if (isSet) {
      if (!parsedSetValues.length || !onAddElement) return;
      await onAddElement({ values: parsedSetValues });
    } else if (isZset) {
      if (!validZsetRows.length || !onAddElement) return;
      await onAddElement({ zsetEntries: validZsetRows });
    } else if (isVector) {
      if (!vectorDraft.element.trim() || !parsedVectorValues.length || !vectorAttrsValid || !onAddVectorElement) return;
      const result = await onAddVectorElement({
        element: vectorDraft.element.trim(),
        vector: parsedVectorValues,
        attrs: vectorDraft.attrs.trim(),
      });
      if (result?.ok === false) {
        setPanelError(result.error || 'onedis-server did not expose the saved vector element.');
        return;
      }
    }
    setFieldDraft({ field: '', value: '', ttl: '', listSide: 'tail' });
    setHashFieldRows([{ field: '', value: '', ttl: '' }]);
    setHashInputMode('rows');
    setHashJsonDraft('');
    setStreamFieldRows([{ field: '', value: '' }]);
    setStreamInputMode('rows');
    setStreamJsonDraft('');
    setZsetRows([{ score: '', member: '' }]);
    setVectorDraft({ element: '', vector: '', attrs: '' });
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
            <div className="field-add-mode-bar">
              <div className="field-add-mode-switch" role="group" aria-label="Hash add mode">
                <button
                  type="button"
                  className={hashInputMode === 'rows' ? 'active' : ''}
                  onClick={() => setHashInputMode('rows')}
                >
                  Fields
                </button>
                <button
                  type="button"
                  className={hashInputMode === 'json' ? 'active' : ''}
                  onClick={() => setHashInputMode('json')}
                >
                  JSON
                </button>
              </div>
              {hashInputMode === 'rows' && (
                <button type="button" className="add-fields-row-button" onClick={addHashFieldRow}>
                  <PlusOutlined /> Add Field
                </button>
              )}
            </div>
            {hashInputMode === 'json' ? (
              <div className="field-json-editor">
                <textarea
                  className="bulk-element-input field-json-input"
                  value={hashJsonDraft}
                  onChange={(event) => setHashJsonDraft(event.target.value)}
                  placeholder={'{"field1":"value1","field2":{"nested":true}}'}
                  aria-label="Hash fields JSON"
                />
                {parsedHashJson.error && <span className="field-json-error">{parsedHashJson.error}</span>}
              </div>
            ) : (
              hashFieldRows.map((item, index) => (
                <div className="hash-field-row" key={index}>
                  <input value={item.field} onChange={(event) => updateHashFieldRow(index, { field: event.target.value })} placeholder="Enter Field" />
                  <input value={item.value} onChange={(event) => updateHashFieldRow(index, { value: event.target.value })} placeholder="Enter Value" />
                  <input value={item.ttl} onChange={(event) => updateHashFieldRow(index, { ttl: event.target.value })} placeholder="Enter TTL" />
                  <button type="button" className="field-remove-button" onClick={() => removeHashFieldRow(index)} aria-label="Remove hash field">
                    <DeleteOutlined />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : isStream ? (
          <div className="stream-entry-field-rows">
            <div className="field-add-mode-bar">
              <div className="field-add-mode-switch" role="group" aria-label="Stream entry add mode">
                <button
                  type="button"
                  className={streamInputMode === 'rows' ? 'active' : ''}
                  onClick={() => setStreamInputMode('rows')}
                >
                  Fields
                </button>
                <button
                  type="button"
                  className={streamInputMode === 'json' ? 'active' : ''}
                  onClick={() => setStreamInputMode('json')}
                >
                  JSON
                </button>
              </div>
              {streamInputMode === 'rows' && (
                <button type="button" className="add-fields-row-button" onClick={addStreamFieldRow}>
                  <PlusOutlined /> Add Field
                </button>
              )}
            </div>
            {streamInputMode === 'json' ? (
              <div className="field-json-editor">
                <textarea
                  className="bulk-element-input field-json-input"
                  value={streamJsonDraft}
                  onChange={(event) => setStreamJsonDraft(event.target.value)}
                  placeholder={'{"field1":"value1","field2":{"nested":true}}'}
                  aria-label="Stream entry JSON"
                />
                {parsedStreamJson.error && <span className="field-json-error">{parsedStreamJson.error}</span>}
              </div>
            ) : (
              streamFieldRows.map((item, index) => (
                <div className="stream-entry-field-row" key={index}>
                  <input value={item.field} onChange={(event) => updateStreamFieldRow(index, { field: event.target.value })} placeholder="Field" />
                  <input value={item.value} onChange={(event) => updateStreamFieldRow(index, { value: event.target.value })} placeholder="Value" />
                  <button type="button" className="field-remove-button" onClick={() => removeStreamFieldRow(index)} aria-label="Remove stream field">
                    <DeleteOutlined />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : isZset ? (
          <div className="zset-entry-rows">
            <div className="stream-entry-add-row">
              <button type="button" className="add-fields-row-button" onClick={addZsetRow}>
                <PlusOutlined /> Add Member
              </button>
            </div>
            {zsetRows.map((item, index) => (
              <div className="zset-entry-row" key={index}>
                <input
                  value={item.score}
                  onChange={(event) => updateZsetRow(index, { score: event.target.value })}
                  placeholder="Score"
                  inputMode="decimal"
                />
                <input
                  value={item.member}
                  onChange={(event) => updateZsetRow(index, { member: event.target.value })}
                  placeholder="Member"
                />
                <button type="button" className="field-remove-button" onClick={() => removeZsetRow(index)} aria-label="Remove zset member">
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        ) : isVector ? (
          <div className="vector-entry-editor">
            <label>
              <span>Element</span>
              <input
                value={vectorDraft.element}
                onChange={(event) => setVectorDraft((current) => ({ ...current, element: event.target.value }))}
                placeholder="product:phone:3"
              />
            </label>
            <label>
              <span>Vector</span>
              <textarea
                className="bulk-element-input"
                value={vectorDraft.vector}
                onChange={(event) => setVectorDraft((current) => ({ ...current, vector: event.target.value }))}
                placeholder="0.91, 0.14, 0.07"
              />
            </label>
            <label>
              <span>Attributes JSON</span>
              <textarea
                className="bulk-element-input"
                value={vectorDraft.attrs}
                onChange={(event) => setVectorDraft((current) => ({ ...current, attrs: event.target.value }))}
                placeholder={'{"category":"phone","price":149,"title":"new phone"}'}
              />
            </label>
            {!vectorAttrsValid && <span className="field-json-error">Attributes must be valid JSON.</span>}
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
            {isList || isSet ? (
              <textarea
                className="bulk-element-input"
                value={fieldDraft.value}
                onChange={(event) => setFieldDraft({ ...fieldDraft, value: event.target.value })}
                placeholder={isList ? 'Enter one element per line or JSON array, e.g. ["1", "2"]' : 'Enter one member per line or JSON array, e.g. ["1", "2"]'}
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
        {panelError && <span className="field-json-error">{panelError}</span>}
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

function InsightsPanel({ detail, selectedKey }) {
  const keyName = selectedKey || 'your:key';
  const examples = useMemo(() => {
    if (!detail) {
      return [
        `SCAN 0 MATCH ${keyName}* COUNT 100`,
        `TYPE ${keyName}`,
        `TTL ${keyName}`,
      ];
    }
    if (detail.type === 'hash') return [`HGETALL ${keyName}`, `HGET ${keyName} field`, `HLEN ${keyName}`];
    if (detail.type === 'list') return [`LRANGE ${keyName} 0 20`, `LLEN ${keyName}`, `RPUSH ${keyName} value`];
    if (detail.type === 'set') return [`SMEMBERS ${keyName}`, `SCARD ${keyName}`, `SADD ${keyName} member`];
    if (detail.type === 'zset') return [`ZRANGE ${keyName} 0 20 WITHSCORES`, `ZCARD ${keyName}`, `ZADD ${keyName} 1 member`];
    if (detail.type === 'stream') return [`XRANGE ${keyName} - + COUNT 20`, `XLEN ${keyName}`, `XADD ${keyName} * field value`];
    return [`GET ${keyName}`, `SET ${keyName} value`, `TTL ${keyName}`];
  }, [detail, keyName]);

  return (
    <aside className="panel insights-panel">
      <div className="insights-head">
        <strong>Insights</strong>
        <span><InfoCircleOutlined /></span>
      </div>
      <div className="insight-tabs">
        <button type="button" className="active">Guide</button>
        <button type="button">Samples</button>
      </div>
      <div className="doc-title">
        <CodeOutlined />
        <div>
          <h2>How To Query Your Data</h2>
          <span>Use these commands in the CLI below or as a starting point for application code.</span>
        </div>
      </div>
      <div className="doc-section">
        <h3>{detail ? `${detail.type} commands` : 'Browser commands'}</h3>
        <pre>{examples.join('\n')}</pre>
        <p>
          The browser list uses SCAN under the hood so large databases stay responsive.
          Narrow the pattern first, then inspect values from the center panel.
        </p>
      </div>
      <div className="notice">
        <ThunderboltOutlined />
        <span>Mutating commands run against the active connection shown in the header.</span>
      </div>
    </aside>
  );
}

function parseWorkbenchCommands(script) {
  return String(script || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function isMutatingRedisCommand(command) {
  return /^(set|del|expire|persist|rename|hset|hdel|lpush|rpush|lpop|rpop|sadd|srem|zadd|zrem|xadd|xdel|publish|vadd|vsetattr|flushdb|flushall)\b/i.test(command.trim());
}

function Workbench({ connection, connected, onKeysChanged }) {
  const [script, setScript] = useState(workbenchTemplates[0].commands);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');

  const commands = useMemo(() => parseWorkbenchCommands(script), [script]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api('/redis/history');
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runCommands = async (event) => {
    event.preventDefault();
    if (!connected || !commands.length) return;
    setRunning(true);
    setStatus('');
    const nextResults = [];
    let mutating = false;
    for (const command of commands) {
      const started = performance.now();
      const row = {
        id: `${Date.now()}-${nextResults.length}-${command}`,
        command,
        ok: true,
        durationMs: 0,
        output: '',
      };
      try {
        const data = await api('/redis/command', {
          method: 'POST',
          body: JSON.stringify({ connection, command }),
        });
        row.durationMs = data.durationMs ?? Math.round(performance.now() - started);
        row.output = formatResult(data.result);
        mutating = mutating || isMutatingRedisCommand(command);
      } catch (error) {
        row.ok = false;
        row.durationMs = Math.round(performance.now() - started);
        row.output = error.message;
      }
      nextResults.push(row);
      setResults([...nextResults]);
    }
    if (mutating) onKeysChanged?.();
    await loadHistory();
    setStatus(`Executed ${nextResults.length} command(s).`);
    setRunning(false);
  };

  const insertTemplate = (template) => {
    setScript(template.commands);
    setStatus(`Loaded template: ${template.name}`);
  };

  const appendCommand = (command) => {
    setScript((current) => `${current.trimEnd()}${current.trim() ? '\n' : ''}${command}`);
  };

  return (
    <section className="workbench-page">
      <div className="workbench-header">
        <div>
          <h1>Workbench</h1>
          <span>{connected ? `${connection.host}:${connection.port} db${connection.db}` : 'Connect to Redis before running commands'}</span>
        </div>
        <div className="workbench-actions">
          <button type="button" className="secondary-action" onClick={() => setResults([])} disabled={!results.length || running}>
            <DeleteOutlined /> Clear Results
          </button>
          <button type="button" className="secondary-action" onClick={loadHistory} disabled={running}>
            <ReloadOutlined /> History
          </button>
        </div>
      </div>
      <div className="workbench-layout">
        <form className="workbench-editor-panel" onSubmit={runCommands}>
          <div className="workbench-panel-head">
            <strong>Command Script</strong>
            <span>{commands.length} command(s)</span>
          </div>
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            spellCheck={false}
            placeholder={'PING\nINFO keyspace\nSCAN 0 MATCH * COUNT 20'}
          />
          <div className="workbench-runbar">
            <span>{status || 'One Redis command per line. Lines starting with # are ignored.'}</span>
            <button className="primary-button" disabled={!connected || running || !commands.length}>
              <PlayCircleOutlined /> {running ? 'Running' : 'Run All'}
            </button>
          </div>
        </form>
        <aside className="workbench-side-panel">
          <div className="workbench-panel-head">
            <strong>Templates</strong>
            <span>{workbenchTemplates.length}</span>
          </div>
          <div className="workbench-template-list">
            {workbenchTemplates.map((template) => (
              <button type="button" key={template.name} onClick={() => insertTemplate(template)}>
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <div className="workbench-output-layout">
        <section className="workbench-results-panel">
          <div className="workbench-panel-head">
            <strong>Results</strong>
            <span>{results.length ? `${results.length} item(s)` : 'latest run'}</span>
          </div>
          <div className="workbench-results">
            {results.length ? results.map((row) => (
              <article className={row.ok ? 'workbench-result-row' : 'workbench-result-row error'} key={row.id}>
                <div>
                  <strong>{row.command}</strong>
                  <span>{row.ok ? `${row.durationMs} ms` : 'error'}</span>
                </div>
                <pre>{row.output}</pre>
              </article>
            )) : <div className="empty-state">Run commands to see results.</div>}
          </div>
        </section>
        <aside className="workbench-history-panel">
          <div className="workbench-panel-head">
            <strong>Recent History</strong>
            <span>{history.length}</span>
          </div>
          <div className="workbench-history-list">
            {history.length ? history.slice(0, 20).map((item, index) => (
              <button type="button" key={`${item.time}-${index}`} onClick={() => appendCommand(item.command || '')} disabled={!item.command}>
                <span>{item.command || item.error}</span>
                <small>{item.durationMs ? `${item.durationMs} ms` : new Date(item.time).toLocaleTimeString()}</small>
              </button>
            )) : <div className="empty-state">No command history yet.</div>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function parsePubSubTargets(input) {
  return String(input || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AnalyzeWorkbench({ connection, connected }) {
  const [pattern, setPattern] = useState('*');
  const [limit, setLimit] = useState('500');
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const loadAnalysis = useCallback(async () => {
    if (!connected) {
      setAnalysis(null);
      setStatus('');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const data = await api('/redis/analyze', {
        method: 'POST',
        body: JSON.stringify({
          connection,
          pattern: pattern.trim() || '*',
          limit: Number(limit) || 500,
        }),
      });
      setAnalysis(data);
      setStatus(`Analyzed ${data.sampled} key(s) in ${data.durationMs ?? '-'} ms${data.truncated ? ' from a truncated sample' : ''}.`);
    } catch (error) {
      setAnalysis(null);
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }, [connected, connection, limit, pattern]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  const topMemory = analysis?.topByMemory || [];
  const topLength = analysis?.topByLength || [];
  const ttl = analysis?.ttl || { persistent: 0, expiring: 0, missing: 0 };

  return (
    <section className="analyze-page">
      <div className="analyze-header">
        <div>
          <h1>Analyze</h1>
          <span>{connected ? `${connection.host}:${connection.port} db${connection.db}` : 'Connect to Redis before analyzing keyspace'}</span>
        </div>
        <button type="button" className="secondary-action" disabled={!connected || loading} onClick={loadAnalysis}>
          <ReloadOutlined /> {loading ? 'Analyzing' : 'Refresh'}
        </button>
      </div>
      <form className="analyze-form" onSubmit={(event) => { event.preventDefault(); loadAnalysis(); }}>
        <label>
          <span>Pattern</span>
          <input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="*" />
        </label>
        <label>
          <span>Sample Limit</span>
          <input value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="numeric" />
        </label>
        <button className="primary-button" disabled={!connected || loading}>
          <DashboardOutlined /> Analyze
        </button>
      </form>
      {status && <div className={status.includes('ERR') || status.includes('error') ? 'analyze-status error' : 'analyze-status'}>{status}</div>}
      <div className="analyze-cards">
        <article>
          <span>Sampled Keys</span>
          <strong>{analysis?.sampled ?? '-'}</strong>
          <small>{analysis?.truncated ? `truncated at ${analysis.limit}` : 'full scan for pattern'}</small>
        </article>
        <article>
          <span>Total Memory</span>
          <strong>{formatBytes(analysis?.totalMemory || 0)}</strong>
          <small>{analysis?.memoryKnown ?? 0} key(s) reported memory</small>
        </article>
        <article>
          <span>Expiring Keys</span>
          <strong>{ttl.expiring}</strong>
          <small>{ttl.persistent} persistent</small>
        </article>
        <article>
          <span>Types</span>
          <strong>{analysis?.byType?.length ?? '-'}</strong>
          <small>{analysis?.pattern || pattern} pattern</small>
        </article>
      </div>
      <div className="analyze-grid">
        <section className="analyze-panel">
          <div className="analyze-panel-head">
            <strong>Type Distribution</strong>
            <span>count / memory / length</span>
          </div>
          <div className="analyze-type-list">
            {analysis?.byType?.length ? analysis.byType.map((row) => (
              <div className="analyze-type-row" key={row.type}>
                <TypeBadge type={row.type} />
                <span>{row.count} keys</span>
                <span>{formatBytes(row.memory)}</span>
                <span>{row.length || 0} items</span>
              </div>
            )) : <div className="empty-state">No type data.</div>}
          </div>
        </section>
        <section className="analyze-panel">
          <div className="analyze-panel-head">
            <strong>TTL Distribution</strong>
            <span>persistent / expiring / missing</span>
          </div>
          <div className="analyze-ttl-list">
            <div><span>Persistent</span><strong>{ttl.persistent}</strong></div>
            <div><span>Expiring</span><strong>{ttl.expiring}</strong></div>
            <div><span>Missing During Scan</span><strong>{ttl.missing}</strong></div>
          </div>
        </section>
      </div>
      <div className="analyze-grid">
        <section className="analyze-panel">
          <div className="analyze-panel-head">
            <strong>Top Memory Keys</strong>
            <span>MEMORY USAGE</span>
          </div>
          <div className="analyze-key-table">
            <div className="analyze-key-row analyze-key-head"><span>Key</span><span>Type</span><span>Size</span></div>
            {topMemory.length ? topMemory.map((row) => (
              <div className="analyze-key-row" key={`memory-${row.key}`}>
                <span>{row.key}</span>
                <span>{row.type}</span>
                <span>{formatBytes(row.memory || 0)}</span>
              </div>
            )) : <div className="empty-state">No sampled keys.</div>}
          </div>
        </section>
        <section className="analyze-panel">
          <div className="analyze-panel-head">
            <strong>Top Length Keys</strong>
            <span>cardinality / length</span>
          </div>
          <div className="analyze-key-table">
            <div className="analyze-key-row analyze-key-head"><span>Key</span><span>Type</span><span>Length</span></div>
            {topLength.length ? topLength.map((row) => (
              <div className="analyze-key-row" key={`length-${row.key}`}>
                <span>{row.key}</span>
                <span>{row.type}</span>
                <span>{row.length ?? '-'}</span>
              </div>
            )) : <div className="empty-state">No sampled keys.</div>}
          </div>
        </section>
      </div>
    </section>
  );
}

function PubSubWorkbench({ connection, connected }) {
  const [channelsDraft, setChannelsDraft] = useState('demo:pubsub:orders\ndemo:pubsub:alerts');
  const [patternsDraft, setPatternsDraft] = useState('demo:pubsub:*');
  const [publishChannel, setPublishChannel] = useState('demo:pubsub:orders');
  const [publishMessage, setPublishMessage] = useState('{"event":"order.created","id":1001,"total":42.5}');
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const sourceRef = useRef(null);

  const disconnect = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setSubscribed(false);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const appendEvent = useCallback((event) => {
    setEvents((current) => [{ id: `${Date.now()}-${Math.random()}`, ...event }, ...current].slice(0, 200));
  }, []);

  const subscribe = useCallback(() => {
    if (!connected) return;
    const channels = parsePubSubTargets(channelsDraft);
    const patterns = parsePubSubTargets(patternsDraft);
    if (!channels.length && !patterns.length) {
      setStatus('Add at least one channel or pattern.');
      return;
    }
    disconnect();
    const params = new URLSearchParams();
    params.set('connection', JSON.stringify(connection));
    channels.forEach((channel) => params.append('channel', channel));
    patterns.forEach((pattern) => params.append('pattern', pattern));
    const source = new EventSource(`/api/redis/pubsub/stream?${params.toString()}`);
    sourceRef.current = source;
    setSubscribed(true);
    setStatus('Connecting subscription stream...');
    source.addEventListener('status', (event) => {
      const data = JSON.parse(event.data || '{}');
      setStatus(data.status === 'connected'
        ? `Subscribed to ${channels.length} channel(s), ${patterns.length} pattern(s).`
        : `${data.status}${data.target ? ` ${data.target}` : ''}${data.subscriptions != null ? ` (${data.subscriptions})` : ''}`);
    });
    source.addEventListener('message', (event) => {
      appendEvent(JSON.parse(event.data || '{}'));
    });
    source.addEventListener('pubsub-error', (event) => {
      const data = JSON.parse(event.data || '{}');
      setStatus(data.error || 'Pub/Sub stream error.');
    });
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        setSubscribed(false);
        setStatus('Subscription stream closed.');
      }
    };
  }, [appendEvent, channelsDraft, connected, connection, disconnect, patternsDraft]);

  const publish = async (event) => {
    event.preventDefault();
    if (!connected || !publishChannel.trim()) return;
    setPublishing(true);
    try {
      const data = await api('/redis/pubsub/publish', {
        method: 'POST',
        body: JSON.stringify({
          connection,
          channel: publishChannel.trim(),
          message: publishMessage,
        }),
      });
      setStatus(`Published to ${publishChannel.trim()}; ${data.subscribers} subscriber(s) received it.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="pubsub-page">
      <div className="pubsub-header">
        <div>
          <h1>Pub/Sub</h1>
          <span>{connected ? `${connection.host}:${connection.port} db${connection.db}` : 'Connect to Redis before using Pub/Sub'}</span>
        </div>
        <div className="pubsub-state">
          <span className={subscribed ? 'pubsub-live active' : 'pubsub-live'}>{subscribed ? 'Live' : 'Idle'}</span>
          <button type="button" className="secondary-action" disabled={!subscribed} onClick={disconnect}>
            <StopOutlined /> Unsubscribe
          </button>
        </div>
      </div>
      <div className="pubsub-controls">
        <section className="pubsub-panel">
          <div className="pubsub-panel-head">
            <strong>Subscribe</strong>
            <span>SUBSCRIBE / PSUBSCRIBE</span>
          </div>
          <label>
            <span>Channels</span>
            <textarea value={channelsDraft} onChange={(event) => setChannelsDraft(event.target.value)} />
          </label>
          <label>
            <span>Patterns</span>
            <textarea value={patternsDraft} onChange={(event) => setPatternsDraft(event.target.value)} />
          </label>
          <button type="button" className="primary-button" disabled={!connected || subscribed} onClick={subscribe}>
            <BellOutlined /> Subscribe
          </button>
        </section>
        <form className="pubsub-panel" onSubmit={publish}>
          <div className="pubsub-panel-head">
            <strong>Publish</strong>
            <span>PUBLISH</span>
          </div>
          <label>
            <span>Channel</span>
            <input value={publishChannel} onChange={(event) => setPublishChannel(event.target.value)} />
          </label>
          <label>
            <span>Message</span>
            <textarea value={publishMessage} onChange={(event) => setPublishMessage(event.target.value)} />
          </label>
          <button className="primary-button" disabled={!connected || publishing || !publishChannel.trim()}>
            <SendOutlined /> {publishing ? 'Publishing' : 'Publish'}
          </button>
        </form>
      </div>
      {status && <div className={status.includes('error') || status.includes('Add ') ? 'pubsub-status error' : 'pubsub-status'}>{status}</div>}
      <div className="pubsub-events">
        <div className="pubsub-event-row pubsub-event-head">
          <span>Time</span>
          <span>Type</span>
          <span>Channel</span>
          <span>Message</span>
        </div>
        {events.length ? events.map((event) => (
          <div className="pubsub-event-row" key={event.id}>
            <span>{event.time ? new Date(event.time).toLocaleTimeString() : '-'}</span>
            <span>{event.type || '-'}</span>
            <span>{event.pattern ? `${event.pattern} -> ${event.channel}` : event.channel || '-'}</span>
            <span className="pubsub-message">{event.message || ''}</span>
          </div>
        )) : (
          <div className="empty-state">No Pub/Sub messages received yet.</div>
        )}
      </div>
    </section>
  );
}

function FullTextSearchWorkbench({ connection, connected }) {
  const [indexes, setIndexes] = useState([]);
  const [indexName, setIndexName] = useState('');
  const [query, setQuery] = useState('*');
  const [offset, setOffset] = useState('0');
  const [count, setCount] = useState('10');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [durationMs, setDurationMs] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexLoading, setIndexLoading] = useState(false);

  const selectedIndex = useMemo(
    () => indexes.find((item) => item.name === indexName) || null,
    [indexName, indexes],
  );
  const pageSize = Math.max(1, Number(count) || 10);
  const currentOffset = Math.max(0, Number(offset) || 0);
  const currentPage = Math.floor(currentOffset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedQuery = query.trim() || '*';
  const previewQuery = /\s/.test(normalizedQuery)
    && !(normalizedQuery.startsWith('"') && normalizedQuery.endsWith('"'))
    ? JSON.stringify(normalizedQuery)
    : normalizedQuery;
  const queryCommand = `FT.SEARCH ${indexName || '<index>'} ${previewQuery} WITHSCORES LIMIT ${currentOffset} ${pageSize}`;
  const queryExamples = [
    { label: 'All documents', value: '*' },
    { label: 'Exact phrase', value: '"real time analytics"' },
    { label: 'Field match', value: '@title:redis' },
    { label: 'Either term', value: 'redis|database' },
    { label: 'Books tag', value: '@category:{books}' },
    { label: 'Price range', value: '@price:[50 80]' },
    { label: 'Prefix', value: 'resil*' },
    { label: 'Exclude', value: 'redis -@category:{books}' },
  ];

  const loadIndexes = useCallback(async () => {
    if (!connected) {
      setIndexes([]);
      setIndexName('');
      setResults([]);
      setTotal(0);
      setDurationMs(null);
      setHasSearched(false);
      setStatus('');
      setError('');
      return;
    }
    setIndexLoading(true);
    setError('');
    try {
      const data = await api('/redis/fulltext/indexes', {
        method: 'POST',
        body: JSON.stringify({ connection }),
      });
      const nextIndexes = data.indexes || [];
      setIndexes(nextIndexes);
      setResults([]);
      setTotal(0);
      setDurationMs(null);
      setHasSearched(false);
      setIndexName((current) => (
        current && nextIndexes.some((item) => item.name === current)
          ? current
          : nextIndexes[0]?.name || ''
      ));
      setStatus('');
    } catch (error) {
      setIndexes([]);
      setIndexName('');
      setError(error.message);
    } finally {
      setIndexLoading(false);
    }
  }, [connected, connection]);

  useEffect(() => {
    loadIndexes();
  }, [loadIndexes]);

  const runSearch = async (event, requestedOffset = null) => {
    event?.preventDefault();
    if (!connected || !indexName) return;
    const nextOffset = requestedOffset == null ? Math.max(0, Number(offset) || 0) : requestedOffset;
    setLoading(true);
    setStatus('');
    setError('');
    try {
      const data = await api('/redis/fulltext/search', {
        method: 'POST',
        body: JSON.stringify({
          connection,
          index: indexName,
          query: query.trim() || '*',
          offset: nextOffset,
          count: pageSize,
        }),
      });
      setResults(data.results || []);
      setTotal(Number(data.total || 0));
      setOffset(String(nextOffset));
      setDurationMs(data.durationMs ?? null);
      setHasSearched(true);
      setStatus(`${(data.results || []).length} documents loaded`);
    } catch (error) {
      setResults([]);
      setTotal(0);
      setDurationMs(null);
      setHasSearched(true);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const changeIndex = (event) => {
    setIndexName(event.target.value);
    setOffset('0');
    setResults([]);
    setTotal(0);
    setDurationMs(null);
    setHasSearched(false);
    setStatus('');
    setError('');
  };

  const applyExample = (value) => {
    setQuery(value);
    setOffset('0');
  };

  return (
    <section className="fulltext-search-page">
      <div className="fulltext-search-header">
        <div>
          <span className="fulltext-eyebrow">REDISEARCH WORKSPACE</span>
          <h1>Full Text Search</h1>
          <p>Explore an index, compose a query, and inspect ranked documents.</p>
        </div>
        <div className={connected ? 'fulltext-connection connected' : 'fulltext-connection'}>
          <span className="fulltext-connection-dot" />
          <div>
            <strong>{connected ? `${connection.host}:${connection.port}` : 'Not connected'}</strong>
            <span>{connected ? `Database ${connection.db}` : 'Connect to Redis to begin'}</span>
          </div>
          <button type="button" title="Refresh indexes" disabled={!connected || indexLoading} onClick={loadIndexes}>
            {indexLoading ? <LoadingOutlined /> : <ReloadOutlined />}
          </button>
        </div>
      </div>

      <div className="fulltext-search-layout">
        <aside className="fulltext-query-panel">
          <div className="fulltext-panel-heading">
            <div>
              <span>QUERY BUILDER</span>
              <strong>Search parameters</strong>
            </div>
            <SearchOutlined />
          </div>

          <form className="fulltext-search-form" onSubmit={runSearch}>
            <label className="fulltext-control">
              <span>Index</span>
              <select value={indexName} onChange={changeIndex} disabled={!connected || !indexes.length}>
                {indexes.length ? indexes.map((item) => (
                  <option value={item.name} key={item.name}>{item.name}</option>
                )) : <option value="">{indexLoading ? 'Loading indexes…' : 'No indexes available'}</option>}
              </select>
            </label>

            <label className="fulltext-control">
              <span>
                Query
                <small>RediSearch syntax</small>
              </span>
              <textarea
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOffset('0');
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') runSearch(event);
                }}
                placeholder="Search terms, filters, or *"
              />
            </label>

            <div className="fulltext-examples">
              <span>Try a query</span>
              <div>
                {queryExamples.map((example) => (
                  <button type="button" onClick={() => applyExample(example.value)} key={example.label}>
                    {example.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fulltext-paging-fields">
              <label className="fulltext-control">
                <span>Offset</span>
                <input
                  value={offset}
                  min="0"
                  type="number"
                  onChange={(event) => setOffset(event.target.value)}
                />
              </label>
              <label className="fulltext-control">
                <span>Page size</span>
                <select value={count} onChange={(event) => {
                  setCount(event.target.value);
                  setOffset('0');
                }}>
                  {[10, 20, 50, 100].map((size) => <option value={size} key={size}>{size}</option>)}
                </select>
              </label>
            </div>

            <div className="fulltext-command-preview">
              <span>Command preview</span>
              <code>{queryCommand}</code>
            </div>

            <button className="fulltext-run-button" disabled={!connected || !indexName || loading}>
              {loading ? <LoadingOutlined /> : <SearchOutlined />}
              {loading ? 'Searching index…' : 'Run search'}
              <kbd>⌘/Ctrl ↵</kbd>
            </button>
          </form>
        </aside>

        <div className="fulltext-search-content">
          {selectedIndex ? (
            <section className="fulltext-index-card">
              <div className="fulltext-index-identity">
                <div className="fulltext-index-icon"><DatabaseOutlined /></div>
                <div>
                  <span>ACTIVE INDEX</span>
                  <strong>{selectedIndex.name}</strong>
                  <small>{selectedIndex.prefixes?.length ? `Keys prefixed with ${selectedIndex.prefixes.join(', ')}` : 'No key prefix configured'}</small>
                </div>
              </div>
              <div className="fulltext-index-stats">
                <div><strong>{selectedIndex.numDocs.toLocaleString()}</strong><span>Documents</span></div>
                <div><strong>{selectedIndex.numRecords ? selectedIndex.numRecords.toLocaleString() : '—'}</strong><span>Records</span></div>
                <div><strong>{selectedIndex.fields?.length || 0}</strong><span>Fields</span></div>
                <div>
                  <strong className={selectedIndex.state ? 'is-ready' : ''}>{selectedIndex.state || 'Ready'}</strong>
                  <span>Status</span>
                </div>
              </div>
              <div className="fulltext-schema">
                <span>SCHEMA</span>
                <div>
                  {selectedIndex.fields?.length ? selectedIndex.fields.map((field) => (
                    <span className="fulltext-schema-field" key={`${field.identifier}-${field.type}`}>
                      <strong>{field.identifier}</strong>
                      <small>{field.type || 'TEXT'}{field.sortable ? ' · sortable' : ''}</small>
                    </span>
                  )) : <span className="fulltext-schema-empty">No field metadata reported</span>}
                </div>
              </div>
            </section>
          ) : (
            <section className="fulltext-index-card fulltext-index-empty">
              <DatabaseOutlined />
              <div>
                <strong>{connected ? 'No search indexes found' : 'Connect a Redis database'}</strong>
                <span>{connected ? 'Create an index with FT.CREATE, then refresh this workspace.' : 'Index metadata and search controls will appear here.'}</span>
              </div>
            </section>
          )}

          <section className="fulltext-results-panel">
            <div className="fulltext-results-toolbar">
              <div>
                <span>SEARCH RESULTS</span>
                <strong>
                  {hasSearched
                    ? `${total.toLocaleString()} ${total === 1 ? 'document' : 'documents'}`
                    : 'Ready to search'}
                </strong>
                {durationMs != null && <small>{durationMs} ms</small>}
              </div>
              <div className="fulltext-results-actions">
                {status && <span className="fulltext-search-status">{status}</span>}
                <button
                  type="button"
                  title="Previous page"
                  disabled={loading || currentOffset <= 0}
                  onClick={() => runSearch(null, Math.max(0, currentOffset - pageSize))}
                >
                  <LeftOutlined />
                </button>
                <span>Page {Math.min(currentPage, totalPages)} of {totalPages}</span>
                <button
                  type="button"
                  title="Next page"
                  disabled={loading || !hasSearched || currentOffset + pageSize >= total}
                  onClick={() => runSearch(null, currentOffset + pageSize)}
                >
                  <RightOutlined />
                </button>
              </div>
            </div>

            {error && (
              <div className="fulltext-error-message">
                <InfoCircleOutlined />
                <span>{error}</span>
              </div>
            )}

            <div className="fulltext-search-results">
              {results.length ? results.map((row, index) => {
                const fields = Object.entries(row.fields || {});
                const score = row.score == null
                  ? null
                  : Number(row.score).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
                return (
                  <article className="fulltext-result-card" key={`${row.key}-${index}`}>
                    <div className="fulltext-result-heading">
                      <div>
                        <span>DOCUMENT</span>
                        <strong title={row.key}>{row.key}</strong>
                      </div>
                      <span className="fulltext-score">
                        <small>SCORE</small>
                        <strong>{score ?? '—'}</strong>
                      </span>
                    </div>
                    {fields.length ? (
                      <dl className="fulltext-result-fields">
                        {fields.map(([field, value]) => (
                          <div key={field}>
                            <dt>{field}</dt>
                            <dd title={String(value)}>{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : <div className="fulltext-result-no-fields">No stored fields returned for this document.</div>}
                  </article>
                );
              }) : (
                <div className="fulltext-empty-state">
                  <div><SearchOutlined /></div>
                  <strong>
                    {!connected
                      ? 'Connect to Redis to search'
                      : !indexes.length
                        ? 'No searchable index is available'
                        : hasSearched
                          ? 'No documents matched this query'
                          : 'Compose your first query'}
                  </strong>
                  <span>
                    {hasSearched
                      ? 'Try broader terms, remove a field filter, or search all documents with *.'
                      : 'Choose an index and run a RediSearch query to see ranked results.'}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function VectorSearchWorkbench({ connection, connected, keys, selectedKey }) {
  const vectorKeys = useMemo(() => keys.filter((item) => item.type === 'vector'), [keys]);
  const [indexKey, setIndexKey] = useState('');
  const [queryVector, setQueryVector] = useState('0.9, 0.1, 0.1');
  const [count, setCount] = useState('10');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (indexKey && vectorKeys.some((item) => item.key === indexKey)) return;
    if (selectedKey && vectorKeys.some((item) => item.key === selectedKey)) {
      setIndexKey(selectedKey);
      return;
    }
    setIndexKey(vectorKeys[0]?.key || '');
  }, [indexKey, selectedKey, vectorKeys]);

  const runSearch = async (event) => {
    event.preventDefault();
    if (!connected || !indexKey) return;
    const vector = parseVectorValues(queryVector);
    if (!vector.length) {
      setStatus('Enter a valid query vector.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const data = await api('/redis/vector/search', {
        method: 'POST',
        body: JSON.stringify({
          connection,
          key: indexKey,
          vector,
          count: Number(count) || 10,
        }),
      });
      setResults(data.results || []);
      setStatus(`Returned ${(data.results || []).length} results in ${data.durationMs ?? '-'} ms.`);
    } catch (error) {
      setResults([]);
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="vector-search-page">
      <div className="vector-search-header">
        <div>
          <h1>Vector Search</h1>
          <span>{connected ? `${connection.host}:${connection.port} db${connection.db}` : 'Connect to Redis before searching vectors'}</span>
        </div>
        <TypeBadge type="vector" />
      </div>
      <form className="vector-search-form" onSubmit={runSearch}>
        <label>
          <span>Vector Key</span>
          <select value={indexKey} onChange={(event) => setIndexKey(event.target.value)} disabled={!connected || !vectorKeys.length}>
            {vectorKeys.length ? vectorKeys.map((item) => (
              <option value={item.key} key={item.key}>{item.key}</option>
            )) : <option value="">No vector keys loaded</option>}
          </select>
        </label>
        <label>
          <span>Query Vector</span>
          <textarea value={queryVector} onChange={(event) => setQueryVector(event.target.value)} placeholder="0.9, 0.1, 0.1" />
        </label>
        <label>
          <span>Top K</span>
          <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
        </label>
        <button className="primary-button" disabled={!connected || !indexKey || loading}>
          <SearchOutlined /> {loading ? 'Searching' : 'Search'}
        </button>
      </form>
      {status && <div className={status.includes('Enter') || status.includes('ERR') ? 'vector-search-status error' : 'vector-search-status'}>{status}</div>}
      <div className="vector-search-results">
        <div className="vector-search-row vector-search-head">
          <span>Element</span>
          <span>Attributes</span>
          <span>Score</span>
        </div>
        {results.length ? results.map((row, index) => (
          <div className="vector-search-row" key={`${row.element}-${index}`}>
            <span>{row.element}</span>
            <span className="vector-search-attrs">{row.attrs || '-'}</span>
            <span>{row.score == null ? '-' : Number(row.score).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}</span>
          </div>
        )) : (
          <div className="empty-state">No vector search results.</div>
        )}
      </div>
    </section>
  );
}

function WasmWorkbench({ connection, connected }) {
  const [templateId, setTemplateId] = useState(wasmTemplates[0].id);
  const selectedTemplate = useMemo(
    () => wasmTemplates.find((item) => item.id === templateId) || wasmTemplates[0],
    [templateId],
  );
  const [moduleName, setModuleName] = useState(selectedTemplate.name);
  const [functionName, setFunctionName] = useState(selectedTemplate.fn);
  const [source, setSource] = useState(selectedTemplate.source);
  const [callArgs, setCallArgs] = useState(selectedTemplate.args);
  const [generatedBytes, setGeneratedBytes] = useState(() => generateBinaryWasm(selectedTemplate));
  const [status, setStatus] = useState('Ready to generate a wasm module.');
  const [loading, setLoading] = useState(false);
  const [callResult, setCallResult] = useState('');
  const [moduleList, setModuleList] = useState([]);
  const [compatMode, setCompatMode] = useState(false);

  useEffect(() => {
    setModuleName(selectedTemplate.name);
    setFunctionName(selectedTemplate.fn);
    setSource(selectedTemplate.source);
    setCallArgs(selectedTemplate.args);
    setGeneratedBytes(generateBinaryWasm(selectedTemplate));
    setCallResult('');
    setStatus(`${selectedTemplate.language} template selected.`);
  }, [selectedTemplate]);

  const generate = () => {
    const bytes = generateBinaryWasm({ ...selectedTemplate, fn: functionName.trim() || selectedTemplate.fn });
    setGeneratedBytes(bytes);
    setStatus(`Generated ${formatWasmBytes(bytes)} for ${moduleName}.${functionName}.`);
  };

  const download = () => {
    const blob = new Blob([generatedBytes], { type: 'application/wasm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${moduleName || 'onedis-module'}.wasm`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadModule = async () => {
    if (!connected) {
      setStatus('Connect to onedis-server before loading wasm.');
      return;
    }
    setLoading(true);
    setStatus('Sending wasm module to onedis-server...');
    try {
      const data = await api('/redis/wasm/load', {
        method: 'POST',
        body: JSON.stringify({
          connection,
          name: moduleName.trim(),
          bytesBase64: bytesToBase64(generatedBytes),
          compatFunctionLoad: compatMode,
        }),
      });
      setStatus(`Loaded ${moduleName}: ${formatResult(data.result)} (${data.bytes} bytes, ${data.durationMs}ms).`);
    } catch (error) {
      setStatus(`Load failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const callModule = async () => {
    if (!connected) {
      setStatus('Connect to onedis-server before calling wasm.');
      return;
    }
    setLoading(true);
    setCallResult('Calling...');
    try {
      const data = await api('/redis/wasm/call', {
        method: 'POST',
        body: JSON.stringify({
          connection,
          name: moduleName.trim(),
          function: functionName.trim(),
          args: callArgs.trim() ? callArgs.trim().split(/\s+/) : [],
          compatFcall: compatMode,
          readOnly: true,
        }),
      });
      setCallResult(formatResult(data.result));
      setStatus(`Call finished in ${data.durationMs}ms.`);
    } catch (error) {
      setCallResult(`(error) ${error.message}`);
      setStatus(`Call failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const listModules = async () => {
    if (!connected) {
      setStatus('Connect to onedis-server before listing wasm modules.');
      return;
    }
    setLoading(true);
    try {
      const data = await api('/redis/wasm/list', {
        method: 'POST',
        body: JSON.stringify({ connection, compatFunctionList: compatMode }),
      });
      setModuleList(Array.isArray(data.result) ? data.result : []);
      setStatus(`Loaded module list in ${data.durationMs}ms.`);
    } catch (error) {
      setStatus(`List failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="wasm-workbench">
      <div className="wasm-toolbar">
        <div>
          <h1>Wasm Modules</h1>
          <span>{connected ? `${connection.host}:${connection.port} db${connection.db}` : 'Connect to onedis-server to send modules'}</span>
        </div>
        <div className="wasm-toolbar-actions">
          <button type="button" className="secondary-action strong-outline" onClick={listModules} disabled={loading || !connected}>
            <ReloadOutlined /> List
          </button>
          <button type="button" className="secondary-action strong-outline" onClick={download} disabled={!generatedBytes.length}>
            <CodeOutlined /> Download
          </button>
          <button type="button" className="primary-button" onClick={loadModule} disabled={loading || !connected || !generatedBytes.length}>
            <SendOutlined /> Send to onedis
          </button>
        </div>
      </div>

      <div className="wasm-grid">
        <aside className="panel wasm-sidebar-panel">
          <div className="wasm-panel-head">
            <strong>Language Template</strong>
            <span>{formatWasmBytes(generatedBytes)}</span>
          </div>
          <div className="wasm-template-list">
            {wasmTemplates.map((template) => (
              <button
                type="button"
                key={template.id}
                className={template.id === templateId ? 'active' : ''}
                onClick={() => setTemplateId(template.id)}
              >
                <strong>{template.language}</strong>
                <span>{template.name}.{template.fn}</span>
              </button>
            ))}
          </div>
          <label className="wasm-check-row">
            <input type="checkbox" checked={compatMode} onChange={(event) => setCompatMode(event.target.checked)} />
            <span>Use FUNCTION/FCALL compatibility commands</span>
          </label>
          <div className="wasm-status">{status}</div>
        </aside>

        <section className="panel wasm-editor-panel">
          <div className="wasm-panel-head">
            <strong>Source Preview</strong>
            <button type="button" className="columns-button" onClick={generate}>
              <ThunderboltOutlined /> Generate
            </button>
          </div>
          <div className="wasm-form-grid">
            <label>
              <span>Module name</span>
              <input value={moduleName} onChange={(event) => setModuleName(event.target.value)} />
            </label>
            <label>
              <span>Function</span>
              <input value={functionName} onChange={(event) => setFunctionName(event.target.value)} />
            </label>
            <label>
              <span>Call args</span>
              <input value={callArgs} onChange={(event) => setCallArgs(event.target.value)} />
            </label>
          </div>
          <textarea className="wasm-source-editor" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />
        </section>

        <section className="panel wasm-output-panel">
          <div className="wasm-panel-head">
            <strong>Binary & Runtime</strong>
            <button type="button" className="columns-button" onClick={callModule} disabled={loading || !connected}>
              <PlayCircleOutlined /> Call
            </button>
          </div>
          <div className="wasm-output-block">
            <span>Wasm binary hex</span>
            <pre>{formatHexPreview(generatedBytes)}</pre>
          </div>
          <div className="wasm-output-block">
            <span>Call result</span>
            <pre>{callResult || 'No call result yet.'}</pre>
          </div>
          <div className="wasm-output-block modules">
            <span>Loaded modules</span>
            {moduleList.length ? (
              moduleList.map((item) => <code key={item}>{item}</code>)
            ) : (
              <em>No module list loaded.</em>
            )}
          </div>
        </section>
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
  const [activeTab, setActiveTab] = useState('Browse');
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

  const addElement = useCallback(async ({ value, values, side, zsetEntries }) => {
    const nextZsetEntries = (zsetEntries || [])
      .map((item) => ({ score: String(item.score).trim(), member: String(item.member).trim() }))
      .filter((item) => item.member && item.score !== '' && Number.isFinite(Number(item.score)));
    if (detail?.type === 'zset') {
      if (!selectedKey || !nextZsetEntries.length) return;
      const args = ['ZADD', selectedKey, ...nextZsetEntries.flatMap((item) => [item.score, item.member])];
      try {
        await api('/redis/command', {
          method: 'POST',
          body: JSON.stringify({ connection: activeConnection, args }),
        });
        setDetail((current) => {
          if (!current || current.type !== 'zset' || !Array.isArray(current.value)) return current;
          const byMember = new Map(current.value.map((item) => [String(item.field), item]));
          nextZsetEntries.forEach((item) => {
            byMember.set(item.member, { field: item.member, value: item.score });
          });
          return { ...current, length: byMember.size, value: Array.from(byMember.values()) };
        });
      } catch (error) {
        setKeysError(error.message);
      } finally {
        loadHistory();
      }
      return;
    }
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

  const addVectorElement = useCallback(async ({ element, vector, attrs }) => {
    if (!selectedKey || !element || !vector?.length) return;
    try {
      const data = await api('/redis/vector/add', {
        method: 'POST',
        body: JSON.stringify({
          connection: activeConnection,
          key: selectedKey,
          element,
          vector,
          attrs,
        }),
      });
      if (data.data) {
        setDetail(data.data);
      }
      await loadKeys();
      if (!data.visible) {
        const message = `VADD returned ${String(data.result)}, but onedis-server did not expose "${element}" via VEMB/VRANDMEMBER after save.`;
        setKeysError(message);
        return { ok: false, error: message };
      }
      return { ok: true };
    } catch (error) {
      setKeysError(error.message);
      return { ok: false, error: error.message };
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, loadKeys, selectedKey]);

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
    try {
      if (oldValue !== nextValue) {
        await api('/redis/command', {
          method: 'POST',
          body: JSON.stringify({ connection: activeConnection, args: ['SREM', selectedKey, oldValue] }),
        });
      }
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args: ['SADD', selectedKey, nextValue] }),
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

  const updateHashField = useCallback(async ({ oldField, field, value }) => {
    const nextField = String(field || '').trim();
    if (!selectedKey || !oldField || !nextField) return;
    const nextValue = value;
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args: ['HSET', selectedKey, nextField, nextValue] }),
      });
      if (oldField !== nextField) {
        await api('/redis/command', {
          method: 'POST',
          body: JSON.stringify({ connection: activeConnection, args: ['HDEL', selectedKey, oldField] }),
        });
      }
      setDetail((current) => {
        if (!current || current.type !== 'hash' || !Array.isArray(current.value)) return current;
        const byField = new Map();
        current.value.forEach((item) => {
          if (item.field === oldField || item.field === nextField) return;
          byField.set(item.field, item);
        });
        byField.set(nextField, { field: nextField, value: nextValue });
        return { ...current, length: byField.size, value: Array.from(byField.values()) };
      });
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const updateZsetEntry = useCallback(async ({ oldMember, member, score }) => {
    const nextMember = String(member || '').trim();
    const nextScore = String(score || '').trim();
    if (!selectedKey || !oldMember || !nextMember || nextScore === '' || !Number.isFinite(Number(nextScore))) {
      setKeysError('ZSET score must be a valid number and member cannot be empty.');
      return;
    }
    try {
      await api('/redis/command', {
        method: 'POST',
        body: JSON.stringify({ connection: activeConnection, args: ['ZADD', selectedKey, nextScore, nextMember] }),
      });
      if (oldMember !== nextMember) {
        await api('/redis/command', {
          method: 'POST',
          body: JSON.stringify({ connection: activeConnection, args: ['ZREM', selectedKey, oldMember] }),
        });
      }
      setDetail((current) => {
        if (!current || current.type !== 'zset' || !Array.isArray(current.value)) return current;
        const byMember = new Map();
        current.value.forEach((item) => {
          if (item.field === oldMember || item.field === nextMember) return;
          byMember.set(item.field, item);
        });
        byMember.set(nextMember, { field: nextMember, value: nextScore });
        return { ...current, length: byMember.size, value: Array.from(byMember.values()) };
      });
    } catch (error) {
      setKeysError(error.message);
    } finally {
      loadHistory();
    }
  }, [activeConnection, loadHistory, selectedKey]);

  const updateVectorAttrs = useCallback(async ({ element, attrs }) => {
    if (!selectedKey || !element) return;
    try {
      await api('/redis/vector/setattr', {
        method: 'POST',
        body: JSON.stringify({
          connection: activeConnection,
          key: selectedKey,
          element,
          attrs,
        }),
      });
      setDetail((current) => {
        if (!current || current.type !== 'vector' || !Array.isArray(current.value)) return current;
        return {
          ...current,
          value: current.value.map((row) => (row.element === element ? { ...row, attrs } : row)),
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

  const updateStringBytesValue = useCallback(async (bytes) => {
    if (!selectedKey) return;
    try {
      await api('/redis/string/set-bytes', {
        method: 'POST',
        body: JSON.stringify({
          connection: activeConnection,
          key: selectedKey,
          bytesBase64: bytesToBase64(bytes),
        }),
      });
      setDetail((current) => (current?.type === 'string' ? { ...current, value: bytesToLatin1String(bytes), length: bytes.length } : current));
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
    if (id === localRedisConnection.id) {
      setConnection((current) => (current.id === id ? { ...current, ...next } : current));
      setDraft((current) => (current.id === id ? { ...current, ...next } : next));
      writeActiveConnection(next);
      if (status.connected && connection.id === id) {
        setStatus({ connected: false, error: 'Connection settings changed. Connect again to use the new endpoint.' });
        setStats({});
        setKeys([]);
        setSelectedKey('');
        setDetail(null);
      }
      return;
    }
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
  }, [connection.id, status.connected]);

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
              draft={draft}
              status={status}
              stats={stats}
              customConnections={customConnections}
              onOpenDatabase={openDatabaseConnection}
              onAddDatabase={addDatabaseConnection}
              onUpdateDatabase={updateDatabaseConnection}
              onDeleteDatabase={deleteDatabaseConnection}
            />
          ) : activeView === 'operations' ? (
            <OperationsPage />
          ) : activeView === 'projects' ? (
            <ProjectManagementPage />
          ) : activeView === 'benchmarks' ? (
            <BenchmarkPage />
          ) : (
            <>
              <Header
                connection={connection}
                draft={draft}
                status={status}
                stats={stats}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onConnect={connect}
                onDisconnect={disconnect}
                onNewKey={openNewKeyEditor}
                onDatabaseChange={switchDatabase}
                onRefreshMetrics={() => loadServerInfo()}
                loading={connectionLoading}
              />
              <main className="workspace" ref={workspaceRef}>
                {activeTab === 'Wasm' ? (
                  <WasmWorkbench connection={activeConnection} connected={status.connected} />
                ) : activeTab === 'Workbench' ? (
                  <Workbench
                    connection={activeConnection}
                    connected={status.connected}
                    onKeysChanged={() => loadKeys()}
                  />
                ) : activeTab === 'Analyze' ? (
                  <AnalyzeWorkbench
                    connection={activeConnection}
                    connected={status.connected}
                  />
                ) : activeTab === 'Pub/Sub' ? (
                  <PubSubWorkbench
                    connection={activeConnection}
                    connected={status.connected}
                  />
                ) : activeTab === 'Search' ? (
                  <FullTextSearchWorkbench
                    connection={activeConnection}
                    connected={status.connected}
                  />
                ) : activeTab === 'Vector Search' ? (
                  <VectorSearchWorkbench
                    connection={activeConnection}
                    connected={status.connected}
                    keys={keys}
                    selectedKey={selectedKey}
                  />
                ) : (
                  <>
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
                            onUpdateHashField={updateHashField}
                            onUpdateZsetEntry={updateZsetEntry}
                            onUpdateVectorAttrs={updateVectorAttrs}
                            onUpdateString={updateStringValue}
                            onUpdateStringBytes={updateStringBytesValue}
                            onUpdateTtl={updateKeyTtl}
                            onDeleteKey={deleteSelectedKey}
                            onDeleteField={deleteHashField}
                            onDeleteSetMember={deleteSetMember}
                            onDeleteStreamEntry={deleteStreamEntry}
                          />
                        )}
                        <InsightsPanel detail={detail} selectedKey={selectedKey} />
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
                            onAddVectorElement={addVectorElement}
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
                  </>
                )}
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
