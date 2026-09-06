import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = Number(process.env.REDIS_API_PORT || 3001);
const DEFAULT_HOST = process.env.REDIS_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.REDIS_PORT || 6379);
const DEFAULT_DB = Number(process.env.REDIS_DB || 0);
const DEFAULT_PASSWORD = process.env.REDIS_PASSWORD || '';
const OPERATIONS_BASE_URL = process.env.OPERATIONS_BASE_URL || 'http://192.168.0.103:17201';
const KV_ENGINE_ROOT = process.env.KV_ENGINE_ROOT || path.resolve(process.cwd(), '../../unidb/kv_engine');
const UNIDB_ROOT = process.env.UNIDB_ROOT || path.resolve(process.cwd(), '../../rust/unidb');
const KV_ENGINE_DOC_ROOT = process.env.KV_ENGINE_DOC_ROOT || path.join(UNIDB_ROOT, 'docs');
const KV_ENGINE_DOC_ROOT_CANDIDATES = [
  KV_ENGINE_DOC_ROOT,
  path.resolve(process.cwd(), '../../unidb/docs'),
  path.resolve(KV_ENGINE_ROOT, '../docs'),
  path.resolve(KV_ENGINE_ROOT, '../doc'),
];
const UNI5DB_ROOT = process.env.UNI5DB_ROOT || '/mnt/source/uni5db';
const UNI5DB_DOC_ROOT = process.env.UNI5DB_DOC_ROOT || path.join(UNI5DB_ROOT, 'docs');
const PROJECT_DOC_ROOT_CANDIDATES = {
  'kv-engine': KV_ENGINE_DOC_ROOT_CANDIDATES,
  uni5db: [UNI5DB_DOC_ROOT],
};
const REVIEW_STATE_FILE = process.env.REVIEW_STATE_FILE || path.resolve(process.cwd(), '.taste-coding/kv-engine-reviewed-tests.json');
const BENCHMARK_STATE_FILE = process.env.BENCHMARK_STATE_FILE || path.resolve(process.cwd(), '.taste-coding/benchmark-runs.json');
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_API_BASE = (process.env.LLM_API_BASE || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4.1-mini';
const MAX_KEYS = 120;
const MAX_ITEMS = 200;
const history = [];

function pushHistory(entry) {
  history.unshift({
    time: new Date().toISOString(),
    ...entry,
  });
  history.splice(200);
}

function encodeCommand(args) {
  return `*${args.length}\r\n${args.map((arg) => {
    const value = String(arg);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`;
}

function encodeCommandParts(args) {
  const parts = [Buffer.from(`*${args.length}\r\n`)];
  for (const arg of args) {
    const value = Buffer.isBuffer(arg) ? arg : Buffer.from(String(arg));
    parts.push(Buffer.from(`$${value.length}\r\n`), value, Buffer.from('\r\n'));
  }
  return Buffer.concat(parts);
}

function parseResp(buffer, offset = 0) {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd === -1) return null;
  const line = buffer.toString('utf8', offset + 1, lineEnd);
  let cursor = lineEnd + 2;

  if (prefix === '+') return { value: line, offset: cursor };
  if (prefix === '-') {
    const err = new Error(line);
    err.redis = true;
    throw err;
  }
  if (prefix === ':') return { value: Number(line), offset: cursor };
  if (prefix === '$') {
    const length = Number(line);
    if (length === -1) return { value: null, offset: cursor };
    const end = cursor + length;
    if (buffer.length < end + 2) return null;
    return { value: buffer.toString('utf8', cursor, end), offset: end + 2 };
  }
  if (prefix === '*') {
    const count = Number(line);
    if (count === -1) return { value: null, offset: cursor };
    const value = [];
    for (let index = 0; index < count; index += 1) {
      const parsed = parseResp(buffer, cursor);
      if (!parsed) return null;
      value.push(parsed.value);
      cursor = parsed.offset;
    }
    return { value, offset: cursor };
  }
  throw new Error(`Unsupported Redis protocol prefix: ${prefix}`);
}

function normalizeConnection(input = {}) {
  return {
    host: input.host || DEFAULT_HOST,
    port: Number(input.port || DEFAULT_PORT),
    password: input.password ?? DEFAULT_PASSWORD,
    db: Number(input.db ?? DEFAULT_DB),
  };
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function parseJsonParam(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function startPubSubStream(req, res, url) {
  const connection = normalizeConnection(parseJsonParam(url.searchParams.get('connection'), {}));
  const channels = url.searchParams.getAll('channel').map((item) => item.trim()).filter(Boolean);
  const patterns = url.searchParams.getAll('pattern').map((item) => item.trim()).filter(Boolean);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  if (!channels.length && !patterns.length) {
    writeSse(res, 'pubsub-error', { error: 'Add at least one channel or pattern.' });
    res.end();
    return;
  }

  const socket = net.createConnection({ host: connection.host, port: connection.port });
  let buffer = Buffer.alloc(0);
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    socket.destroy();
    res.end();
  };

  const heartbeat = setInterval(() => {
    if (!closed) res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    close();
  });

  socket.setTimeout(0);
  socket.on('error', (error) => {
    writeSse(res, 'pubsub-error', { error: error.message });
    clearInterval(heartbeat);
    close();
  });
  socket.on('connect', () => {
    const commands = [];
    if (connection.password) commands.push(['AUTH', connection.password]);
    if (Number.isFinite(connection.db) && connection.db > 0) commands.push(['SELECT', connection.db]);
    if (channels.length) commands.push(['SUBSCRIBE', ...channels]);
    if (patterns.length) commands.push(['PSUBSCRIBE', ...patterns]);
    commands.forEach((command) => socket.write(encodeCommandParts(command)));
    pushHistory({
      host: connection.host,
      port: connection.port,
      db: connection.db,
      command: `${channels.length ? `SUBSCRIBE ${channels.join(' ')}` : ''}${channels.length && patterns.length ? ' | ' : ''}${patterns.length ? `PSUBSCRIBE ${patterns.join(' ')}` : ''}`,
      level: 'info',
      durationMs: 0,
    });
    writeSse(res, 'status', { status: 'connected', channels, patterns });
  });
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    try {
      while (buffer.length) {
        const parsed = parseResp(buffer);
        if (!parsed) return;
        buffer = buffer.subarray(parsed.offset);
        const value = parsed.value;
        if (!Array.isArray(value)) {
          writeSse(res, 'status', { status: String(value) });
          continue;
        }
        const [kind, first, second, third] = value;
        if (kind === 'message') {
          writeSse(res, 'message', { type: 'message', channel: first, message: second, time: new Date().toISOString() });
        } else if (kind === 'pmessage') {
          writeSse(res, 'message', { type: 'pmessage', pattern: first, channel: second, message: third, time: new Date().toISOString() });
        } else if (kind === 'subscribe' || kind === 'psubscribe') {
          writeSse(res, 'status', { status: kind, target: first, subscriptions: second });
        } else {
          writeSse(res, 'status', { status: kind, value });
        }
      }
    } catch (error) {
      writeSse(res, 'pubsub-error', { error: error.message });
    }
  });
}

function runRawCommand(connectionInput, args) {
  const connection = normalizeConnection(connectionInput);
  const started = performance.now();
  const commands = [];
  if (connection.password) commands.push(['AUTH', connection.password]);
  if (Number.isFinite(connection.db) && connection.db > 0) commands.push(['SELECT', connection.db]);
  commands.push(args);

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: connection.host, port: connection.port });
    let buffer = Buffer.alloc(0);
    let index = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };

    const sendNext = () => {
      socket.write(encodeCommandParts(commands[index]));
    };

    socket.setTimeout(10000, () => fail(new Error('Redis command timed out after 10s')));
    socket.on('error', fail);
    socket.on('connect', sendNext);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const parsed = parseResp(buffer);
        if (!parsed) return;
        buffer = buffer.subarray(parsed.offset);
        if (index < commands.length - 1) {
          index += 1;
          sendNext();
          return;
        }
        settled = true;
        socket.end();
        resolve({
          result: parsed.value,
          durationMs: Math.max(1, Math.round((performance.now() - started) * 100) / 100),
          connection,
        });
      } catch (error) {
        fail(error);
      }
    });
  });
}

async function redis(connection, args) {
  const response = await runRawCommand(connection, args);
  pushHistory({
    host: response.connection.host,
    port: response.connection.port,
    db: response.connection.db,
    command: args.join(' '),
    level: 'info',
    durationMs: response.durationMs,
  });
  return response.result;
}

function parseCommandLine(input) {
  const args = [];
  let current = '';
  let quote = null;
  let escaped = false;
  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) args.push(current);
  if (quote) throw new Error('Unclosed quote in command');
  return args;
}

function toPairs(values) {
  const pairs = [];
  for (let index = 0; index < values.length; index += 2) {
    pairs.push({ field: values[index], value: values[index + 1] });
  }
  return pairs;
}

function toStreamEntries(values = []) {
  return values.map(([id, fields = []]) => ({
    id,
    fields: Object.fromEntries(toPairs(fields).map((item) => [item.field, item.value])),
  }));
}

function toConsumerGroups(values = []) {
  return values.map((group) => Object.fromEntries(toPairs(group).map((item) => [item.field, item.value])));
}

function float32Buffer(values = []) {
  const vector = values.map(Number);
  if (!vector.length || vector.some((value) => !Number.isFinite(value))) {
    throw new Error('Vector must contain one or more finite numbers');
  }
  const buffer = Buffer.alloc(vector.length * 4);
  vector.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

function toObject(values = []) {
  return Object.fromEntries(toPairs(values).map((item) => [item.field, item.value]));
}

function toVectorSearchResults(values = [], withScores = true) {
  if (!Array.isArray(values)) return [];
  if (!withScores) return values.filter(Boolean).map((element) => ({ element, score: null }));
  const rows = [];
  for (let index = 0; index < values.length; index += 2) {
    rows.push({
      element: values[index],
      score: values[index + 1] == null ? null : Number(values[index + 1]),
    });
  }
  return rows.filter((row) => row.element);
}

function toFullTextIndexInfo(name, values = []) {
  const info = toObject(values);
  const definition = toObject(info.index_definition || []);
  const fields = Array.isArray(info.attributes)
    ? info.attributes.map((attribute) => {
      const field = toObject(attribute || []);
      return {
        identifier: field.identifier || '',
        attribute: field.attribute || field.identifier || '',
        type: field.type || '',
        sortable: field.sortable === 1 || field.sortable === '1',
        noindex: field.noindex === 1 || field.noindex === '1',
      };
    }).filter((field) => field.identifier || field.attribute)
    : [];
  return {
    name,
    state: info.state || '',
    keyType: definition.key_type || '',
    prefixes: Array.isArray(definition.prefixes) ? definition.prefixes : [],
    numDocs: Number(info.num_docs || 0),
    numRecords: Number(info.num_records || 0),
    fields,
  };
}

function toFullTextSearchResults(values = []) {
  if (!Array.isArray(values) || !values.length) return { total: 0, rows: [] };
  const total = Number(values[0] || 0);
  const rows = [];
  for (let index = 1; index < values.length;) {
    const key = values[index++];
    if (!key) break;
    const score = values[index++];
    const fields = values[index++];
    rows.push({
      key,
      score: score == null ? null : Number(score),
      fields: toObject(Array.isArray(fields) ? fields : []),
    });
  }
  return { total, rows };
}

async function enrichVectorSearchResults(connection, key, rows = []) {
  return Promise.all(rows.map(async (row) => ({
    ...row,
    attrs: await redis(connection, ['VGETATTR', key, row.element]).catch(() => null) || '',
  })));
}

async function readVectorSet(connection, key) {
  const info = toObject(await redis(connection, ['VINFO', key]).catch(() => []));
  const elements = await redis(connection, ['VRANDMEMBER', key, String(MAX_ITEMS)]).catch(() => []);
  const rows = await Promise.all((Array.isArray(elements) ? elements : [elements]).filter(Boolean).map(async (element) => {
    const [vector, attrs] = await Promise.all([
      redis(connection, ['VEMB', key, element]).catch(() => []),
      redis(connection, ['VGETATTR', key, element]).catch(() => null),
    ]);
    return {
      element,
      vector: Array.isArray(vector) ? vector.map((value) => Number(value)) : [],
      attrs: attrs || '',
    };
  }));
  return { info, rows };
}

async function describeKey(connection, key) {
  const [type, ttl, memory] = await Promise.all([
    redis(connection, ['TYPE', key]),
    redis(connection, ['TTL', key]),
    redis(connection, ['MEMORY', 'USAGE', key]).catch(() => null),
  ]);
  let length = null;
  if (type === 'list') length = await redis(connection, ['LLEN', key]);
  if (type === 'set') length = await redis(connection, ['SCARD', key]);
  if (type === 'zset') length = await redis(connection, ['ZCARD', key]);
  if (type === 'hash') length = await redis(connection, ['HLEN', key]);
  if (type === 'stream') length = await redis(connection, ['XLEN', key]);
  if (type === 'string') length = await redis(connection, ['STRLEN', key]);
  if (type === 'vector') length = await redis(connection, ['VCARD', key]).catch(() => null);
  return { key, type, ttl, memory, length };
}

async function listKeys(connection, pattern = '*', type = 'all') {
  let cursor = '0';
  const described = [];
  let scanned = 0;
  do {
    const response = await redis(connection, ['SCAN', cursor, 'MATCH', pattern || '*', 'COUNT', '100']);
    cursor = String(response[0]);
    for (const key of response[1]) {
      scanned += 1;
      const info = await describeKey(connection, key);
      if (type === 'all' || info.type === type) described.push(info);
      if (described.length >= MAX_KEYS) break;
    }
  } while (cursor !== '0' && described.length < MAX_KEYS);

  return { cursor, keys: described, truncated: cursor !== '0', scanned };
}

async function analyzeKeyspace(connection, pattern = '*', limit = 500) {
  let cursor = '0';
  const keys = [];
  let scanned = 0;
  const maxKeys = Math.max(1, Math.min(5000, Number(limit || 500)));
  do {
    const response = await redis(connection, ['SCAN', cursor, 'MATCH', pattern || '*', 'COUNT', '200']);
    cursor = String(response[0]);
    for (const key of response[1] || []) {
      scanned += 1;
      keys.push(await describeKey(connection, key));
      if (keys.length >= maxKeys) break;
    }
  } while (cursor !== '0' && keys.length < maxKeys);

  const byType = {};
  const ttl = { persistent: 0, expiring: 0, missing: 0 };
  let totalMemory = 0;
  let memoryKnown = 0;
  for (const key of keys) {
    const typeStats = byType[key.type] || { type: key.type, count: 0, memory: 0, length: 0 };
    typeStats.count += 1;
    typeStats.memory += Number(key.memory || 0);
    typeStats.length += Number(key.length || 0);
    byType[key.type] = typeStats;
    if (key.ttl === -2) ttl.missing += 1;
    else if (key.ttl === -1) ttl.persistent += 1;
    else ttl.expiring += 1;
    if (Number.isFinite(Number(key.memory))) {
      totalMemory += Number(key.memory);
      memoryKnown += 1;
    }
  }

  const topByMemory = [...keys]
    .sort((left, right) => Number(right.memory || 0) - Number(left.memory || 0))
    .slice(0, 20);
  const topByLength = [...keys]
    .sort((left, right) => Number(right.length || 0) - Number(left.length || 0))
    .slice(0, 20);

  return {
    cursor,
    scanned,
    sampled: keys.length,
    truncated: cursor !== '0',
    pattern,
    limit: maxKeys,
    totalMemory,
    memoryKnown,
    ttl,
    byType: Object.values(byType).sort((left, right) => right.count - left.count),
    topByMemory,
    topByLength,
  };
}

async function readKey(connection, key) {
  const info = await describeKey(connection, key);
  let value = null;
  let consumerGroups = null;
  if (info.type === 'string') value = await redis(connection, ['GET', key]);
  if (info.type === 'list') value = await redis(connection, ['LRANGE', key, '0', String(MAX_ITEMS - 1)]);
  if (info.type === 'set') value = await redis(connection, ['SMEMBERS', key]);
  if (info.type === 'zset') value = toPairs(await redis(connection, ['ZRANGE', key, '0', String(MAX_ITEMS - 1), 'WITHSCORES']));
  if (info.type === 'hash') value = toPairs(await redis(connection, ['HGETALL', key]));
  if (info.type === 'stream') {
    value = toStreamEntries(await redis(connection, ['XRANGE', key, '-', '+', 'COUNT', String(MAX_ITEMS)]));
    consumerGroups = toConsumerGroups(await redis(connection, ['XINFO', 'GROUPS', key]).catch(() => []));
  }
  if (info.type === 'vector') {
    const vectorSet = await readVectorSet(connection, key);
    value = vectorSet.rows;
    info.vectorInfo = vectorSet.info;
  }
  return { ...info, value, consumerGroups };
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(json);
}

function formatError(error) {
  if (error?.code === 'ECONNREFUSED') {
    const address = error.address || DEFAULT_HOST;
    const port = error.port || DEFAULT_PORT;
    return {
      statusCode: 503,
      message: `Connection refused: unable to connect to Redis at ${address}:${port}. Check that redis-server is running and the port is open.`,
    };
  }
  if (error?.code === 'ETIMEDOUT' || error?.code === 'EHOSTUNREACH' || error?.code === 'ENETUNREACH') {
    const address = error.address || DEFAULT_HOST;
    const port = error.port || DEFAULT_PORT;
    return {
      statusCode: 503,
      message: `Unable to reach Redis at ${address}:${port} (${error.code}).`,
    };
  }
  return {
    statusCode: error?.redis ? 400 : 500,
    message: error?.message || 'Unknown Redis API error',
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) resolve({});
      else resolve(JSON.parse(body));
    });
    req.on('error', reject);
  });
}

async function readReviewedTests() {
  try {
    const text = await fs.readFile(REVIEW_STATE_FILE, 'utf8');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeReviewedTests(reviewedTests) {
  await fs.mkdir(path.dirname(REVIEW_STATE_FILE), { recursive: true });
  await fs.writeFile(REVIEW_STATE_FILE, JSON.stringify(reviewedTests || {}, null, 2), 'utf8');
}

function createBenchmarkSeedState() {
  const versions = [
    { version: 'e6a592d', label: 'range refactor', recordedAt: '2026-06-18T09:20:00.000Z' },
    { version: '48f1e1d', label: 'write refactor', recordedAt: '2026-06-29T14:15:00.000Z' },
    { version: '338a107', label: 'async baseline', recordedAt: '2026-07-12T11:40:00.000Z' },
    { version: '41fe1ac', label: 'current HEAD', recordedAt: '2026-07-23T12:00:00.000Z' },
  ];
  const projects = [
    {
      id: 'onedis',
      name: 'onedis',
      description: 'Redis protocol, command execution, write path, and client-facing latency.',
      accent: '#e34b52',
      expectedSuites: 18,
      collectedSuites: [12, 14, 17, 17],
      hotPaths: [
        { id: 'protocol', name: 'RESP parse & dispatch', coverage: 100 },
        { id: 'string', name: 'String SET / GET', coverage: 100 },
        { id: 'pipeline', name: 'Pipeline batching', coverage: 83 },
        { id: 'list', name: 'List LPUSH / LRANGE', coverage: 94 },
        { id: 'ttl', name: 'TTL expiration', coverage: 78 },
        { id: 'search', name: 'Full-text search', coverage: 72 },
      ],
      metrics: [
        { id: 'set_rps', name: 'SET throughput', shortName: 'SET RPS', unit: 'ops/s', direction: 'higher', category: 'Throughput', hotPath: 'String write', values: [164200, 193800, 218400, 226100] },
        { id: 'get_p99_us', name: 'GET p99 latency', shortName: 'GET p99', unit: 'µs', direction: 'lower', category: 'Latency', hotPath: 'String read', values: [126, 103, 88, 82] },
        { id: 'pipeline_rps', name: 'Pipeline throughput', shortName: 'Pipeline', unit: 'ops/s', direction: 'higher', category: 'Throughput', hotPath: 'RESP pipeline', values: [522000, 638000, 742000, 704500] },
        { id: 'lpush_avg_us', name: 'LPUSH average latency', shortName: 'LPUSH avg', unit: 'µs', direction: 'lower', category: 'Latency', hotPath: 'List mutation', values: [12.8, 10.4, 8.7, 8.1] },
        { id: 'rss_mb', name: 'Peak resident memory', shortName: 'Peak RSS', unit: 'MB', direction: 'lower', category: 'Resources', hotPath: 'Process memory', values: [688, 642, 612, 598] },
        { id: 'error_pct', name: 'Command error rate', shortName: 'Errors', unit: '%', direction: 'lower', category: 'Correctness', hotPath: 'Command execution', values: [0.08, 0.04, 0.02, 0.03] },
      ],
    },
    {
      id: 'kv_engine',
      name: 'kv_engine',
      description: 'Memtable, WAL, point reads, scans, compaction, and transactional hot paths.',
      accent: '#3ba477',
      expectedSuites: 26,
      collectedSuites: [16, 20, 24, 23],
      hotPaths: [
        { id: 'memtable', name: 'Memtable put / get', coverage: 100 },
        { id: 'wal', name: 'WAL append / replay', coverage: 96 },
        { id: 'scan', name: 'Iterator & range scan', coverage: 92 },
        { id: 'compaction', name: 'Flush & compaction', coverage: 85 },
        { id: 'txn', name: 'OCC transaction', coverage: 88 },
        { id: 'recovery', name: 'Crash recovery', coverage: 65 },
      ],
      metrics: [
        { id: 'fillrandom_rps', name: 'fillrandom throughput', shortName: 'fillrandom', unit: 'ops/s', direction: 'higher', category: 'Throughput', hotPath: 'Write path', values: [121000, 149500, 168200, 176300] },
        { id: 'readrandom_p99_us', name: 'readrandom p99 latency', shortName: 'read p99', unit: 'µs', direction: 'lower', category: 'Latency', hotPath: 'Point read', values: [68, 51, 42, 38] },
        { id: 'wal_mb_s', name: 'WAL append bandwidth', shortName: 'WAL append', unit: 'MB/s', direction: 'higher', category: 'I/O', hotPath: 'WAL writer', values: [318, 402, 480, 465] },
        { id: 'scan_entries_s', name: 'Range scan throughput', shortName: 'Range scan', unit: 'entries/s', direction: 'higher', category: 'Throughput', hotPath: 'Iterator', values: [1520000, 1980000, 2310000, 2450000] },
        { id: 'compaction_mb_s', name: 'Compaction throughput', shortName: 'Compaction', unit: 'MB/s', direction: 'higher', category: 'I/O', hotPath: 'Compaction merge', values: [248, 292, 330, 296] },
        { id: 'write_amp', name: 'Write amplification', shortName: 'Write amp', unit: 'x', direction: 'lower', category: 'Resources', hotPath: 'Flush & compaction', values: [1.42, 1.31, 1.18, 1.16] },
        { id: 'txn_conflict_pct', name: 'OCC conflict rate', shortName: 'Txn conflicts', unit: '%', direction: 'lower', category: 'Transactions', hotPath: 'OCC commit', values: [2.3, 1.8, 1.4, 1.2] },
      ],
    },
    {
      id: 'pg_gateway',
      name: 'pg_gateway',
      description: 'PostgreSQL protocol, SQL planning, execution, and KV adapter overhead.',
      accent: '#4c8bdc',
      expectedSuites: 16,
      collectedSuites: [9, 12, 14, 15],
      hotPaths: [
        { id: 'wire', name: 'PostgreSQL wire protocol', coverage: 100 },
        { id: 'planner', name: 'Parser & planner', coverage: 94 },
        { id: 'point', name: 'Primary-key lookup', coverage: 100 },
        { id: 'scan', name: 'Filter, sort & LIMIT', coverage: 88 },
        { id: 'write', name: 'INSERT / UPDATE', coverage: 81 },
        { id: 'compat', name: 'SQL compatibility', coverage: 92 },
      ],
      metrics: [
        { id: 'pk_select_tps', name: 'Primary-key SELECT', shortName: 'PK SELECT', unit: 'tps', direction: 'higher', category: 'Throughput', hotPath: 'PK lookup', values: [188, 236, 275.15, 289.2] },
        { id: 'pk_select_p99_ms', name: 'Primary-key SELECT p99', shortName: 'SELECT p99', unit: 'ms', direction: 'lower', category: 'Latency', hotPath: 'PK lookup', values: [8.4, 6.7, 5.2, 5.5] },
        { id: 'insert_tps', name: 'INSERT throughput', shortName: 'INSERT', unit: 'tps', direction: 'higher', category: 'Throughput', hotPath: 'Write adapter', values: [21400, 28600, 34000, 35200] },
        { id: 'gateway_overhead_us', name: 'Gateway overhead', shortName: 'Gateway cost', unit: 'µs', direction: 'lower', category: 'Latency', hotPath: 'Protocol + plan', values: [74, 58, 46, 42] },
        { id: 'offset_100k_ms', name: 'OFFSET 100k latency', shortName: 'OFFSET 100k', unit: 'ms', direction: 'lower', category: 'Latency', hotPath: 'Scan + LIMIT', values: [932, 711, 573.84, 520] },
        { id: 'compat_pct', name: 'SQL compatibility coverage', shortName: 'SQL coverage', unit: '%', direction: 'higher', category: 'Completeness', hotPath: 'SQL surface', values: [71, 80, 88, 92] },
        { id: 'error_pct', name: 'Protocol error rate', shortName: 'Errors', unit: '%', direction: 'lower', category: 'Correctness', hotPath: 'Wire protocol', values: [0.12, 0.05, 0.02, 0.01] },
      ],
    },
  ];

  const runs = projects.flatMap((project) => versions.map((version, versionIndex) => ({
    id: `${project.id}-${version.version}`,
    project: project.id,
    version: version.version,
    versionLabel: version.label,
    branch: versionIndex === versions.length - 1 ? 'simply_and_aysnc' : 'baseline',
    recordedAt: version.recordedAt,
    status: 'completed',
    source: 'bootstrap',
    durationSeconds: 480 + versionIndex * 37 + project.metrics.length * 4,
    environment: {
      fingerprint: 'linux-x86_64-16c-64g-release',
      cpu: '16 vCPU',
      memory: '64 GB',
      profile: 'release + target-cpu=native',
      dataset: project.id === 'kv_engine' ? '10M keys / 128B values' : project.id === 'onedis' ? '1M keys / 64 clients' : '1M rows / pgbench',
    },
    completeness: Math.round(project.collectedSuites[versionIndex] / project.expectedSuites * 100),
    suites: {
      expected: project.expectedSuites,
      collected: project.collectedSuites[versionIndex],
    },
    metrics: project.metrics.map((metric) => ({
      metricId: metric.id,
      value: metric.values[versionIndex],
      samples: 30,
      variancePct: Number((0.7 + ((versionIndex + metric.id.length) % 5) * 0.35).toFixed(2)),
    })),
  })));

  return {
    schemaVersion: 1,
    source: 'bootstrap',
    thresholds: {
      regressionPct: 5,
      criticalPct: 10,
      maxVariancePct: 5,
      minCompletenessPct: 90,
    },
    projects: projects.map(({ metrics, ...project }) => ({
      ...project,
      metrics: metrics.map(({ values, ...metric }) => metric),
    })),
    runs,
    updatedAt: new Date().toISOString(),
  };
}

async function writeBenchmarkState(state) {
  await fs.mkdir(path.dirname(BENCHMARK_STATE_FILE), { recursive: true });
  await fs.writeFile(BENCHMARK_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function readBenchmarkState() {
  try {
    const text = await fs.readFile(BENCHMARK_STATE_FILE, 'utf8');
    return JSON.parse(text);
  } catch {
    const state = createBenchmarkSeedState();
    await writeBenchmarkState(state);
    return state;
  }
}

function normalizeBenchmarkRun(input, state) {
  const project = String(input?.project || '').trim();
  const version = String(input?.version || input?.commit || '').trim();
  const projectDefinition = state.projects.find((item) => item.id === project);
  if (!projectDefinition) throw new Error(`Unknown benchmark project: ${project || '(empty)'}`);
  if (!version) throw new Error('Benchmark run requires a version or commit');
  if (!Array.isArray(input?.metrics) || !input.metrics.length) throw new Error('Benchmark run requires metrics');

  const knownMetricIds = new Set(projectDefinition.metrics.map((metric) => metric.id));
  const metrics = input.metrics.map((metric) => ({
    metricId: String(metric.metricId || '').trim(),
    value: Number(metric.value),
    samples: Math.max(1, Number(metric.samples || 1)),
    variancePct: Math.max(0, Number(metric.variancePct || 0)),
  })).filter((metric) => knownMetricIds.has(metric.metricId) && Number.isFinite(metric.value));
  if (!metrics.length) throw new Error('Benchmark run contains no recognized metrics');

  const expected = Math.max(1, Number(input?.suites?.expected || projectDefinition.expectedSuites || metrics.length));
  const collected = Math.max(0, Number(input?.suites?.collected || metrics.length));
  return {
    id: String(input.id || `${project}-${version}-${Date.now()}`),
    project,
    version,
    versionLabel: String(input.versionLabel || 'imported run'),
    branch: String(input.branch || 'unknown'),
    recordedAt: input.recordedAt || new Date().toISOString(),
    status: input.status === 'failed' ? 'failed' : 'completed',
    source: String(input.source || 'imported'),
    durationSeconds: Math.max(0, Number(input.durationSeconds || 0)),
    environment: {
      fingerprint: String(input?.environment?.fingerprint || 'unknown'),
      cpu: String(input?.environment?.cpu || 'unknown'),
      memory: String(input?.environment?.memory || 'unknown'),
      profile: String(input?.environment?.profile || 'release'),
      dataset: String(input?.environment?.dataset || 'unspecified'),
    },
    completeness: Math.round(collected / expected * 100),
    suites: { expected, collected },
    metrics,
  };
}

function testReviewKey(file, name) {
  return `${String(file || '')}::${String(name || '')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyHeading(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[`*_~#[\](){}:;,.!?/\\]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function renderMarkdownInline(value) {
  const codeSpans = [];
  let text = String(value || '').replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });
  text = escapeHtml(text);
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, href) => {
    const safeHref = String(href || '');
    const isSafe = /^(https?:|mailto:|#|\.{0,2}\/|[^:]+$)/i.test(safeHref);
    return `<a href="${escapeHtml(isSafe ? safeHref : '#')}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
  codeSpans.forEach((html, index) => {
    text = text.replace(`\u0000CODE${index}\u0000`, html);
  });
  return text;
}

function isMarkdownTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || '');
}

function parseMarkdownTableRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderMarkdownTable(lines, startIndex) {
  const header = parseMarkdownTableRow(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;
  while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim()) {
    rows.push(parseMarkdownTableRow(lines[index]));
    index += 1;
  }
  const html = [
    '<table>',
    '<thead><tr>',
    ...header.map((cell) => `<th>${renderMarkdownInline(cell)}</th>`),
    '</tr></thead>',
    '<tbody>',
    ...rows.map((row) => `<tr>${row.map((cell) => `<td>${renderMarkdownInline(cell)}</td>`).join('')}</tr>`),
    '</tbody>',
    '</table>',
  ].join('');
  return { html, nextIndex: index };
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;
  let blockquote = [];
  let codeFence = null;
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderMarkdownInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    html.push(`<${list.type}>${list.items.map((item) => `<li>${renderMarkdownInline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushBlockquote = () => {
    if (!blockquote.length) return;
    html.push(`<blockquote>${blockquote.map((item) => `<p>${renderMarkdownInline(item)}</p>`).join('')}</blockquote>`);
    blockquote = [];
  };
  const flushFlow = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (codeFence) {
      if (trimmed.startsWith('```')) {
        html.push(`<pre><code class="language-${escapeHtml(codeFence)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeFence = null;
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushFlow();
      codeFence = trimmed.slice(3).trim() || 'text';
      codeLines = [];
      continue;
    }

    if (!trimmed) {
      flushFlow();
      continue;
    }

    if (/^\s*\|?.+\|.+$/.test(line) && isMarkdownTableDivider(lines[index + 1])) {
      flushFlow();
      const table = renderMarkdownTable(lines, index);
      html.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushFlow();
      const level = heading[1].length;
      const content = heading[2].replace(/\s+#+$/, '');
      html.push(`<h${level} id="${escapeHtml(slugifyHeading(content))}">${renderMarkdownInline(content)}</h${level}>`);
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushFlow();
      html.push('<hr>');
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blockquote.push(quote[1]);
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      flushBlockquote();
      const type = ordered ? 'ol' : 'ul';
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
      continue;
    }

    flushList();
    flushBlockquote();
    paragraph.push(trimmed);
  }

  if (codeFence) html.push(`<pre><code class="language-${escapeHtml(codeFence)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  flushFlow();
  return html.join('\n');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveProjectDocRoot(projectId) {
  const candidates = PROJECT_DOC_ROOT_CANDIDATES[projectId];
  if (!candidates) throw new Error(`Unsupported project docs: ${projectId}`);
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return candidates[0];
}

async function walkDocFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.')) files.push(...await walkDocFiles(fullPath));
    } else if (entry.isFile() && /\.(md|html)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function safeRelativePath(input) {
  const normalized = path.normalize(String(input || '')).replace(/^(\.\.[/\\])+/, '');
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid document path');
  }
  return normalized;
}

function titleFromMarkdown(text, fallback) {
  const heading = String(text || '').match(/^\s*#\s+(.+)$/m);
  return heading ? heading[1].trim().replace(/\s+#+$/, '') : fallback;
}

function sanitizeHtmlDocument(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\shref\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, ' href="#"');
}

function titleFromHtml(text, fallback) {
  const title = String(text || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? title[1].replace(/\s+/g, ' ').trim() : fallback;
}

function prepareHtmlDocumentForReader(html) {
  const safeHtml = sanitizeHtmlDocument(html);
  const readerStyle = `
<style id="taste-coding-html-reader-style">
  :root {
    color-scheme: dark;
    --bg: #101010;
    --panel: #171717;
    --panel-soft: #141414;
    --text: #e8e8e8;
    --muted: #a9a9a9;
    --line: #343434;
    --head: #10202a;
    --accent: #8adeff;
    --code-bg: #0b0b0b;
  }
  html, body {
    min-width: 0 !important;
    background: var(--bg) !important;
    color: var(--text) !important;
  }
  body {
    margin: 0 !important;
    font-family: Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif !important;
    line-height: 1.62 !important;
  }
  header {
    background: #10202a !important;
    color: #f2fbff !important;
    border-bottom: 1px solid var(--line) !important;
    padding: 26px 30px !important;
  }
  header p,
  .small {
    color: var(--muted) !important;
  }
  main {
    width: auto !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 24px !important;
  }
  nav,
  section {
    overflow-x: auto !important;
    background: var(--panel) !important;
    border: 1px solid var(--line) !important;
    border-radius: 6px !important;
    box-shadow: none !important;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #f3f3f3 !important;
    letter-spacing: 0 !important;
  }
  a {
    color: var(--accent) !important;
  }
  code {
    color: #d9f7ed !important;
    background: var(--code-bg) !important;
    border: 1px solid #2b2b2b !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: anywhere !important;
  }
  pre {
    overflow: auto !important;
    background: var(--code-bg) !important;
    border: 1px solid #2b2b2b !important;
    border-radius: 6px !important;
  }
  table {
    width: max-content !important;
    min-width: 1040px !important;
    max-width: none !important;
    table-layout: auto !important;
    border-collapse: collapse !important;
    margin: 12px 0 16px !important;
  }
  th,
  td {
    border: 1px solid var(--line) !important;
    padding: 9px 11px !important;
    vertical-align: top !important;
    color: var(--text) !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    white-space: normal !important;
  }
  th {
    background: var(--head) !important;
    color: #d6f5ff !important;
  }
  td {
    background: var(--panel-soft) !important;
  }
  td:nth-child(1), th:nth-child(1) { min-width: 220px !important; }
  td:nth-child(2), th:nth-child(2) { min-width: 120px !important; }
  td:nth-child(3), th:nth-child(3) { min-width: 420px !important; }
  td:nth-child(4), th:nth-child(4) { min-width: 260px !important; }
  td:nth-child(5), th:nth-child(5) { min-width: 240px !important; }
  .tag {
    background: #10202a !important;
    border-color: #31586a !important;
    color: #d6f5ff !important;
  }
  .tag-main {
    background: #143121 !important;
    border-color: #1f7a46 !important;
    color: #8ff0b5 !important;
  }
  .tag-review {
    background: #352712 !important;
    border-color: #6b501e !important;
    color: #ffd28a !important;
  }
</style>`;
  if (/<\/head>/i.test(safeHtml)) return safeHtml.replace(/<\/head>/i, `${readerStyle}\n</head>`);
  return `<!doctype html><html><head>${readerStyle}</head><body>${safeHtml}</body></html>`;
}

async function listProjectDocs(projectId) {
  const root = await resolveProjectDocRoot(projectId);
  if (!await pathExists(root)) return { root, docs: [] };
  const files = await walkDocFiles(root);
  const docs = await Promise.all(files.map(async (filePath) => {
    const stat = await fs.stat(filePath);
    const relativePath = path.relative(root, filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    let title = path.basename(filePath);
    if (ext === 'md') {
      const text = await fs.readFile(filePath, 'utf8');
      title = titleFromMarkdown(text, title);
    } else if (ext === 'html') {
      const text = await fs.readFile(filePath, 'utf8');
      title = titleFromHtml(text, title);
    }
    return {
      path: relativePath,
      title,
      ext,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  }));
  docs.sort((left, right) => left.path.localeCompare(right.path));
  return { root, docs };
}

async function readProjectDoc(projectId, relativeInput) {
  const root = await resolveProjectDocRoot(projectId);
  const relativePath = safeRelativePath(relativeInput);
  const filePath = path.join(root, relativePath);
  const normalizedRoot = path.resolve(root);
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(`${normalizedRoot}${path.sep}`) && normalizedFile !== normalizedRoot) {
    throw new Error('Document path escapes doc root');
  }
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('Document not found');
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const text = await fs.readFile(filePath, 'utf8');
  const isMarkdown = ext === 'md';
  return {
    root,
    path: relativePath,
    title: isMarkdown ? titleFromMarkdown(text, path.basename(filePath)) : titleFromHtml(text, path.basename(filePath)),
    ext,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
    html: isMarkdown ? renderMarkdown(text) : prepareHtmlDocumentForReader(text),
  };
}

function fetchText(targetUrl) {
  return new Promise((resolve, reject) => {
    const request = http.get(targetUrl, { timeout: 10000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 5 * 1024 * 1024) {
          request.destroy(new Error('Operations response too large'));
        }
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Operations target returned HTTP ${response.statusCode}`));
          return;
        }
        resolve(body);
      });
    });
    request.on('timeout', () => request.destroy(new Error('Operations target timed out after 10s')));
    request.on('error', reject);
  });
}

async function walkRustFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkRustFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.rs')) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineForOffset(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function classifyTestName(name) {
  const value = String(name || '').toLowerCase();
  const tags = [];
  if (/recover|recovery|wal|manifest|reopen|sync/.test(value)) tags.push('recovery');
  if (/snapshot|seq|version|visible|mvcc|isolation/.test(value)) tags.push('visibility');
  if (/range|tombstone|delete|filter/.test(value)) tags.push('delete/range');
  if (/merge|compaction|flush|publish|split|promot/.test(value)) tags.push('compaction');
  if (/iter|scan|seek|prefix|bound/.test(value)) tags.push('iterator');
  if (/concurrent|lock|deadlock|transaction|txn|conflict|timeout|pipeline|intent/.test(value)) tags.push('concurrency');
  if (/corrupt|invalid|truncated|error|fail|reject|panic|checksum/.test(value)) tags.push('error-path');
  if (/cache|memory|evict|gc|reclaim|retire|ref/.test(value)) tags.push('resource');
  if (/put|get|write|read|basic|roundtrip|insert|remove/.test(value)) tags.push('basic-io');
  return [...new Set(tags.length ? tags : ['behavior'])];
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function compactSourcePreview(source, maxLines = 38) {
  const lines = String(source || '')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''));
  const nonEmpty = lines.filter((line) => line.trim());
  const selected = nonEmpty.slice(0, maxLines);
  return selected.join('\n') + (nonEmpty.length > maxLines ? '\n...' : '');
}

function extractCalls(body) {
  const calls = new Set();
  const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:::<[^>]+>)?\s*\(/g;
  let match;
  const ignored = new Set(['assert', 'assert_eq', 'assert_ne', 'vec', 'format', 'println', 'Some', 'None', 'Ok', 'Err', 'String', 'Vec']);
  while ((match = callPattern.exec(body)) !== null) {
    const name = match[1];
    if (!ignored.has(name) && !name.startsWith('test_')) calls.add(name);
  }
  return [...calls].slice(0, 14);
}

function describeTestIntent(name, file, tags) {
  const value = `${file} ${name}`.toLowerCase();
  if (value.includes('recover') || value.includes('reopen')) return '验证崩溃/重启恢复后数据、元数据或 WAL 状态是否保持正确。';
  if (value.includes('snapshot') || value.includes('isolation')) return '验证快照读或事务隔离能否看到正确历史版本，并屏蔽后续写入。';
  if (value.includes('range') && value.includes('tombstone')) return '验证范围删除 tombstone 对点查、扫描或 flush/compaction 后读取的影响。';
  if (value.includes('merge')) return '验证 merge operand、merge operator 或 block 合并过程是否保持正确值和版本顺序。';
  if (value.includes('flush')) return '验证 memtable flush 到持久化层后数据、元数据和边界条件是否正确。';
  if (value.includes('compaction') || value.includes('publish') || value.includes('split')) return '验证 compaction/split/publish 后 tablet 或 level block 元数据与可见数据是否一致。';
  if (value.includes('iterator') || value.includes('iter') || value.includes('scan') || value.includes('seek')) return '验证迭代器扫描、seek、边界和多版本可见性。';
  if (value.includes('lock') || value.includes('deadlock') || value.includes('conflict')) return '验证并发事务锁、冲突检测或死锁处理是否符合预期。';
  if (value.includes('wal')) return '验证 WAL 写入、轮转、读取、损坏处理或恢复链路。';
  if (value.includes('cache')) return '验证缓存命中、淘汰、版本过滤或维护任务。';
  if (value.includes('invalid') || value.includes('corrupt') || value.includes('truncated') || value.includes('error')) return '验证异常输入、损坏数据或错误路径不会产生错误行为。';
  if (tags.includes('basic-io')) return '验证基础读写路径和结果断言。';
  return '验证该模块的一个具体行为分支。';
}

function describeCoverageFromBody(name, body, tags, calls) {
  const points = [];
  const text = `${name}\n${body}`.toLowerCase();
  if (/put|write|insert|append/.test(text)) points.push('写入路径');
  if (/get|read|lookup|contains/.test(text)) points.push('读取/查询路径');
  if (/delete|tombstone|range_delete/.test(text)) points.push('删除与 tombstone 可见性');
  if (/flush|compaction|compact|publish|split|merge/.test(text)) points.push('flush/compaction/merge 后状态');
  if (/recover|reopen|wal|manifest/.test(text)) points.push('持久化恢复链路');
  if (/snapshot|seq|version|visible|mvcc/.test(text)) points.push('快照/版本可见性');
  if (/iter|scan|seek|range|bound/.test(text)) points.push('迭代器和范围边界');
  if (/concurrent|thread|spawn|lock|deadlock|timeout|conflict/.test(text)) points.push('并发、锁或冲突路径');
  if (/invalid|corrupt|truncated|error|reject|panic|checksum/.test(text)) points.push('异常/错误路径');
  if (/cache|evict|memory|gc|reclaim|retire/.test(text)) points.push('缓存、内存或回收路径');
  if (!points.length && calls.length) points.push(`关键调用: ${calls.slice(0, 5).join(', ')}`);
  if (!points.length) points.push(tags.join(', '));
  return [...new Set(points)].join('；');
}

function reviewGapForTest(test) {
  const tags = test.tags || [];
  const assertionCount = test.assertions || 0;
  const source = String(test.sourcePreview || '').toLowerCase();
  const gaps = [];
  if (assertionCount === 0) gaps.push('未检测到显式 assert，需要确认是否只依赖 panic。');
  if (tags.includes('basic-io') && !/delete|overwrite|missing|none|err|invalid/.test(source)) gaps.push('基础路径为主，建议补充 missing/overwrite/delete 类负例。');
  if (tags.includes('recovery') && !/reopen|drop|recover|restart|corrupt/.test(source)) gaps.push('恢复标签存在，但恢复动作不明显，建议确认是否真的跨 reopen/recover。');
  if (tags.includes('concurrency') && !/thread|spawn|concurrent|join|timeout/.test(source)) gaps.push('并发标签存在，但并发执行形态不明显。');
  if (tags.includes('iterator') && !/bound|seek|first|next|prefix|range/.test(source)) gaps.push('迭代器测试缺少边界/seek/prefix 维度。');
  return gaps.length ? gaps : ['从名称和函数体看覆盖点明确；下一步需要人工检查 fixture 是否足够接近真实负载。'];
}

function analyzeTest(file, name, line, body) {
  const tags = classifyTestName(name);
  const assertions = (body.match(/\bassert(?:_eq|_ne|_matches)?!\s*\(/g) || []).length;
  const operations = extractCalls(body);
  const test = {
    name,
    line,
    tags,
    assertions,
    operations,
    purpose: describeTestIntent(name, file, tags),
    coverage: describeCoverageFromBody(name, body, tags, operations),
    sourcePreview: compactSourcePreview(body),
  };
  test.review = reviewGapForTest(test);
  return test;
}

function expectedCoverageTags(file) {
  const value = String(file || '').toLowerCase();
  if (value.includes('db_impl')) return ['basic-io', 'recovery', 'visibility', 'delete/range', 'iterator', 'compaction', 'resource'];
  if (value.includes('transaction') || value.includes('lock_manager') || value.includes('occ') || value.includes('mvcc')) return ['basic-io', 'visibility', 'concurrency', 'delete/range', 'error-path'];
  if (value.includes('wal')) return ['basic-io', 'recovery', 'error-path', 'concurrency'];
  if (value.includes('compaction') || value.includes('level_block/merge') || value.includes('publish') || value.includes('flush')) return ['compaction', 'delete/range', 'iterator', 'resource', 'error-path'];
  if (value.includes('iterator') || value.includes('iter.rs') || value.includes('query')) return ['basic-io', 'iterator', 'visibility', 'delete/range', 'error-path'];
  if (value.includes('cache')) return ['basic-io', 'resource', 'delete/range', 'error-path'];
  if (value.includes('memtable')) return ['basic-io', 'visibility', 'iterator', 'delete/range'];
  if (value.includes('skip')) return ['basic-io', 'iterator', 'concurrency', 'resource'];
  if (value.includes('version_manager')) return ['basic-io', 'visibility', 'recovery', 'resource', 'error-path'];
  return ['basic-io', 'error-path'];
}

function summarizeSuite(file, tests) {
  const tags = [...new Set(tests.flatMap((test) => test.tags))];
  const expected = expectedCoverageTags(file);
  const missing = expected.filter((tag) => !tags.includes(tag));
  const score = Math.max(0, Math.round(((expected.length - missing.length) / expected.length) * 100));
  const status = score >= 80 ? 'strong' : score >= 55 ? 'partial' : 'thin';
  return { tags, expected, missing, score, status };
}

async function scanKvEngineUnitTests() {
  const files = await walkRustFiles(KV_ENGINE_ROOT);
  const suites = [];
  for (const filePath of files) {
    const text = await fs.readFile(filePath, 'utf8');
    const tests = [];
    const testPattern = /#\[(?:tokio::test|test)\][\s\S]*?fn\s+([A-Za-z0-9_]+)/g;
    let match;
    while ((match = testPattern.exec(text)) !== null) {
      const openBrace = text.indexOf('{', testPattern.lastIndex);
      const closeBrace = openBrace === -1 ? -1 : findMatchingBrace(text, openBrace);
      const body = openBrace === -1 || closeBrace === -1 ? '' : text.slice(openBrace + 1, closeBrace);
      const relativeFile = path.relative(KV_ENGINE_ROOT, filePath);
      tests.push(analyzeTest(relativeFile, match[1], lineForOffset(text, match.index), body));
    }
    if (tests.length) {
      const file = path.relative(KV_ENGINE_ROOT, filePath);
      suites.push({
        file,
        count: tests.length,
        tests,
        ...summarizeSuite(file, tests),
      });
    }
  }
  suites.sort((left, right) => right.count - left.count || left.file.localeCompare(right.file));
  return {
    root: KV_ENGINE_ROOT,
    suiteCount: suites.length,
    testCount: suites.reduce((sum, suite) => sum + suite.count, 0),
    suites,
  };
}

async function findKvEngineTest(file, testName) {
  const safeFile = path.normalize(String(file || ''));
  if (!safeFile || safeFile.startsWith('..') || path.isAbsolute(safeFile)) {
    throw new Error('Invalid test file path');
  }
  const filePath = path.join(KV_ENGINE_ROOT, safeFile);
  const text = await fs.readFile(filePath, 'utf8');
  const escapedName = String(testName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const testPattern = new RegExp(`#\\[(?:tokio::test|test)\\][\\s\\S]*?fn\\s+(${escapedName})\\b`, 'g');
  const match = testPattern.exec(text);
  if (!match) throw new Error(`Test not found: ${testName}`);
  const openBrace = text.indexOf('{', testPattern.lastIndex);
  const closeBrace = openBrace === -1 ? -1 : findMatchingBrace(text, openBrace);
  if (openBrace === -1 || closeBrace === -1) throw new Error(`Unable to parse test body: ${testName}`);
  const body = text.slice(openBrace + 1, closeBrace);
  return {
    file: safeFile,
    name: match[1],
    line: lineForOffset(text, match.index),
    body,
    analysis: analyzeTest(safeFile, match[1], lineForOffset(text, match.index), body),
  };
}

function normalizeLlmReview(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return { summary: 'LLM returned an empty review.' };
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return { summary: text };
      }
    }
    return { summary: text };
  }
}

async function requestLlmUnitTestReview(test) {
  if (!LLM_API_KEY) {
    const error = new Error('Missing LLM_API_KEY or OPENAI_API_KEY. Configure one in the API server environment to enable LLM semantic review.');
    error.statusCode = 503;
    throw error;
  }
  const prompt = [
    '你是 Rust 底层存储引擎的 unit test review 专家。',
    '请评审下面这个测试函数到底在测什么、覆盖是否充分、还缺哪些边界。',
    '只返回 JSON，不要 markdown。JSON 字段：',
    '{',
    '  "purpose": "一句话说明测试目的",',
    '  "covers": ["覆盖点1", "覆盖点2"],',
    '  "assertion_quality": "评价断言是否足够具体",',
    '  "missing_cases": ["缺口1", "缺口2"],',
    '  "risk": "low|medium|high",',
    '  "review_note": "给人类 reviewer 的简短结论"',
    '}',
    '',
    `文件: ${test.file}`,
    `测试方法: ${test.name}`,
    `行号: ${test.line}`,
    `规则初筛目的: ${test.analysis.purpose}`,
    `规则初筛覆盖点: ${test.analysis.coverage}`,
    `断言数量: ${test.analysis.assertions}`,
    `关键调用: ${test.analysis.operations.join(', ') || '-'}`,
    '',
    '测试源码:',
    '```rust',
    test.body,
    '```',
  ].join('\n');

  const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${LLM_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你只做测试评审，不提代码修改 diff，不输出 markdown。' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`LLM provider returned non-JSON response: ${text.slice(0, 180)}`);
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `LLM provider returned HTTP ${response.status}`);
  }
  const content = data?.choices?.[0]?.message?.content || '';
  return normalizeLlmReview(content);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && url.pathname === '/redis/pubsub/stream') {
      startPubSubStream(req, res, url);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/redis/ping') {
      const connection = normalizeConnection(Object.fromEntries(url.searchParams));
      const pong = await redis(connection, ['PING']);
      const info = await redis(connection, ['INFO']).catch(() => '');
      return sendJson(res, 200, { ok: true, pong, connection: { ...connection, password: Boolean(connection.password) }, info });
    }

    if (req.method === 'GET' && url.pathname === '/redis/info') {
      const connection = normalizeConnection(Object.fromEntries(url.searchParams));
      const info = await redis(connection, ['INFO']);
      return sendJson(res, 200, { ok: true, info });
    }

    if (req.method === 'GET' && url.pathname === '/redis/keys') {
      const connection = normalizeConnection(Object.fromEntries(url.searchParams));
      const pattern = url.searchParams.get('pattern') || '*';
      const type = url.searchParams.get('type') || 'all';
      return sendJson(res, 200, { ok: true, ...(await listKeys(connection, pattern, type)) });
    }

    if (req.method === 'GET' && url.pathname === '/redis/key') {
      const connection = normalizeConnection(Object.fromEntries(url.searchParams));
      const key = url.searchParams.get('key');
      if (!key) return sendJson(res, 400, { ok: false, error: 'Missing key' });
      return sendJson(res, 200, { ok: true, data: await readKey(connection, key) });
    }

    if (req.method === 'GET' && url.pathname === '/redis/history') {
      return sendJson(res, 200, { ok: true, history });
    }

    if (req.method === 'POST' && url.pathname === '/redis/analyze') {
      const body = await readBody(req);
      const pattern = String(body.pattern || '*');
      const limit = Number(body.limit || 500);
      const started = performance.now();
      const analysis = await analyzeKeyspace(body.connection, pattern, limit);
      return sendJson(res, 200, {
        ok: true,
        ...analysis,
        durationMs: Math.max(1, Math.round((performance.now() - started) * 100) / 100),
      });
    }

    if (req.method === 'GET' && url.pathname === '/operations/dashboard') {
      const target = new URL('/ui/dashboard', OPERATIONS_BASE_URL);
      for (const [key, value] of url.searchParams) {
        if (value !== '') target.searchParams.append(key, value);
      }
      const html = await fetchText(target);
      return sendJson(res, 200, { ok: true, html, target: target.toString(), baseUrl: OPERATIONS_BASE_URL });
    }

    if (req.method === 'GET' && url.pathname === '/benchmarks/dashboard') {
      const state = await readBenchmarkState();
      return sendJson(res, 200, { ok: true, ...state, file: BENCHMARK_STATE_FILE });
    }

    if (req.method === 'POST' && url.pathname === '/benchmarks/runs') {
      const body = await readBody(req);
      const state = await readBenchmarkState();
      const run = normalizeBenchmarkRun(body.run || body, state);
      state.runs = [run, ...state.runs.filter((item) => item.id !== run.id)].slice(0, 500);
      state.source = state.runs.some((item) => item.source !== 'bootstrap') ? 'mixed' : 'bootstrap';
      state.updatedAt = new Date().toISOString();
      await writeBenchmarkState(state);
      return sendJson(res, 201, { ok: true, run, updatedAt: state.updatedAt, file: BENCHMARK_STATE_FILE });
    }

    if (req.method === 'GET' && url.pathname === '/projects/kv-engine/unit-tests') {
      return sendJson(res, 200, { ok: true, ...(await scanKvEngineUnitTests()) });
    }

    const docsRoute = url.pathname.match(/^\/projects\/(kv-engine|uni5db)\/docs$/);
    if (req.method === 'GET' && docsRoute) {
      return sendJson(res, 200, { ok: true, project: docsRoute[1], ...(await listProjectDocs(docsRoute[1])) });
    }

    const docRoute = url.pathname.match(/^\/projects\/(kv-engine|uni5db)\/doc$/);
    if (req.method === 'GET' && docRoute) {
      const docPath = url.searchParams.get('path');
      if (!docPath) return sendJson(res, 400, { ok: false, error: 'Missing document path' });
      return sendJson(res, 200, { ok: true, project: docRoute[1], ...(await readProjectDoc(docRoute[1], docPath)) });
    }

    if (req.method === 'GET' && url.pathname === '/projects/kv-engine/reviewed-tests') {
      return sendJson(res, 200, { ok: true, reviewedTests: await readReviewedTests(), file: REVIEW_STATE_FILE });
    }

    if (req.method === 'POST' && url.pathname === '/projects/kv-engine/reviewed-tests') {
      const body = await readBody(req);
      const reviewedTests = body.reviewedTests && typeof body.reviewedTests === 'object' ? body.reviewedTests : {};
      await writeReviewedTests(reviewedTests);
      return sendJson(res, 200, { ok: true, reviewedTests, file: REVIEW_STATE_FILE });
    }

    if (req.method === 'POST' && url.pathname === '/projects/kv-engine/reviewed-test') {
      const body = await readBody(req);
      const file = String(body.file || '');
      const name = String(body.name || '');
      if (!file || !name) return sendJson(res, 400, { ok: false, error: 'Missing file or test name' });
      const reviewedTests = await readReviewedTests();
      const key = testReviewKey(file, name);
      if (body.reviewed) reviewedTests[key] = { reviewedAt: new Date().toISOString(), file, name };
      else delete reviewedTests[key];
      await writeReviewedTests(reviewedTests);
      return sendJson(res, 200, { ok: true, key, reviewed: Boolean(body.reviewed), reviewedTests, file: REVIEW_STATE_FILE });
    }

    if (req.method === 'POST' && url.pathname === '/projects/kv-engine/unit-test-llm-review') {
      const body = await readBody(req);
      const test = await findKvEngineTest(body.file, body.name);
      const review = await requestLlmUnitTestReview(test);
      return sendJson(res, 200, {
        ok: true,
        model: LLM_MODEL,
        file: test.file,
        name: test.name,
        line: test.line,
        review,
      });
    }

    if (req.method === 'POST' && url.pathname === '/redis/command') {
      const body = await readBody(req);
      const args = Array.isArray(body.args) ? body.args : parseCommandLine(body.command || '');
      if (!args.length) return sendJson(res, 400, { ok: false, error: 'Empty command' });
      const response = await runRawCommand(body.connection, args);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: args.join(' '),
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, { ok: true, result: response.result, durationMs: response.durationMs });
    }

    if (req.method === 'POST' && url.pathname === '/redis/pubsub/publish') {
      const body = await readBody(req);
      const channel = String(body.channel || '').trim();
      const message = String(body.message ?? '');
      if (!channel) return sendJson(res, 400, { ok: false, error: 'Missing publish channel' });
      const response = await runRawCommand(body.connection, ['PUBLISH', channel, message]);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: `PUBLISH ${channel} <${Buffer.byteLength(message)} bytes>`,
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, {
        ok: true,
        subscribers: Number(response.result || 0),
        durationMs: response.durationMs,
      });
    }

    if (req.method === 'POST' && url.pathname === '/redis/string/set-bytes') {
      const body = await readBody(req);
      const key = String(body.key || '');
      const bytesBase64 = String(body.bytesBase64 || '');
      if (!key) return sendJson(res, 400, { ok: false, error: 'Missing key' });
      if (!bytesBase64) return sendJson(res, 400, { ok: false, error: 'Missing bytes' });
      const bytes = Buffer.from(bytesBase64, 'base64');
      const response = await runRawCommand(body.connection, ['SET', key, bytes]);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: `SET ${key} <${bytes.length} bytes>`,
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, { ok: true, result: response.result, durationMs: response.durationMs, bytes: bytes.length });
    }

    if (req.method === 'POST' && url.pathname === '/redis/vector/add') {
      const body = await readBody(req);
      const key = String(body.key || '').trim();
      const element = String(body.element || '').trim();
      const vector = Array.isArray(body.vector) ? body.vector : [];
      const attrs = String(body.attrs || '').trim();
      if (!key) return sendJson(res, 400, { ok: false, error: 'Missing vector key' });
      if (!element) return sendJson(res, 400, { ok: false, error: 'Missing vector element' });
      const vectorBytes = float32Buffer(vector);
      const response = await runRawCommand(body.connection, ['VADD', key, 'FP32', vectorBytes, element]);
      if (attrs) {
        await runRawCommand(body.connection, ['VSETATTR', key, element, attrs]);
      }
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: `VADD ${key} FP32 <${vectorBytes.length} bytes> ${element}${attrs ? ' SETATTR <json>' : ''}`,
        level: 'info',
        durationMs: response.durationMs,
      });
      const data = await readKey(body.connection, key);
      const visible = data?.type === 'vector'
        && Array.isArray(data.value)
        && data.value.some((row) => row.element === element);
      return sendJson(res, 200, {
        ok: true,
        result: response.result,
        durationMs: response.durationMs,
        added: { element, vector: vector.map(Number), attrs },
        visible,
        data,
      });
    }

    if (req.method === 'POST' && url.pathname === '/redis/fulltext/indexes') {
      const body = await readBody(req);
      const response = await runRawCommand(body.connection, ['FT._LIST']);
      const indexNames = Array.isArray(response.result) ? response.result.filter(Boolean) : [];
      const indexes = await Promise.all(indexNames.map(async (name) => {
        const [info, countResult] = await Promise.all([
          redis(body.connection, ['FT.INFO', name]).catch(() => []),
          redis(body.connection, ['FT.SEARCH', name, '*', 'NOCONTENT', 'LIMIT', '0', '1']).catch(() => []),
        ]);
        const indexInfo = toFullTextIndexInfo(name, info);
        const searchedDocumentCount = Array.isArray(countResult) ? Number(countResult[0]) : Number.NaN;
        return {
          ...indexInfo,
          numDocs: Number.isFinite(searchedDocumentCount) ? searchedDocumentCount : indexInfo.numDocs,
        };
      }));
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: 'FT._LIST',
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, { ok: true, indexes, durationMs: response.durationMs });
    }

    if (req.method === 'POST' && url.pathname === '/redis/fulltext/search') {
      const body = await readBody(req);
      const index = String(body.index || '').trim();
      const query = String(body.query || '').trim() || '*';
      const offset = Math.max(0, Number(body.offset || 0));
      const count = Math.max(1, Math.min(100, Number(body.count || 10)));
      if (!index) return sendJson(res, 400, { ok: false, error: 'Missing full text index' });
      const args = ['FT.SEARCH', index, query, 'WITHSCORES', 'LIMIT', String(offset), String(count)];
      const response = await runRawCommand(body.connection, args);
      const parsed = toFullTextSearchResults(response.result);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: `FT.SEARCH ${index} ${query} WITHSCORES LIMIT ${offset} ${count}`,
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, {
        ok: true,
        total: parsed.total,
        results: parsed.rows,
        durationMs: response.durationMs,
      });
    }

    if (req.method === 'POST' && url.pathname === '/redis/vector/setattr') {
      const body = await readBody(req);
      const key = String(body.key || '').trim();
      const element = String(body.element || '').trim();
      const attrs = String(body.attrs || '').trim();
      if (!key) return sendJson(res, 400, { ok: false, error: 'Missing vector key' });
      if (!element) return sendJson(res, 400, { ok: false, error: 'Missing vector element' });
      const response = await runRawCommand(body.connection, ['VSETATTR', key, element, attrs]);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: `VSETATTR ${key} ${element} ${attrs ? '<json>' : '<empty>'}`,
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, { ok: true, result: response.result, durationMs: response.durationMs, attrs });
    }

    if (req.method === 'POST' && url.pathname === '/redis/vector/search') {
      const body = await readBody(req);
      const key = String(body.key || '').trim();
      const vector = Array.isArray(body.vector) ? body.vector : [];
      const count = Math.max(1, Math.min(100, Number(body.count || 10)));
      if (!key) return sendJson(res, 400, { ok: false, error: 'Missing vector key' });
      const vectorBytes = float32Buffer(vector);
      const response = await runRawCommand(body.connection, ['VSIM', key, 'FP32', vectorBytes, 'WITHSCORES', 'COUNT', String(count)]);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: `VSIM ${key} FP32 <${vectorBytes.length} bytes> WITHSCORES COUNT ${count}`,
        level: 'info',
        durationMs: response.durationMs,
      });
      const results = await enrichVectorSearchResults(body.connection, key, toVectorSearchResults(response.result, true));
      return sendJson(res, 200, {
        ok: true,
        results,
        durationMs: response.durationMs,
      });
    }

    if (req.method === 'POST' && url.pathname === '/redis/wasm/load') {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const bytesBase64 = String(body.bytesBase64 || '').trim();
      if (!name) return sendJson(res, 400, { ok: false, error: 'Missing wasm module name' });
      if (!bytesBase64) return sendJson(res, 400, { ok: false, error: 'Missing wasm module bytes' });
      const bytes = Buffer.from(bytesBase64, 'base64');
      if (!bytes.length) return sendJson(res, 400, { ok: false, error: 'Empty wasm module bytes' });
      const command = body.compatFunctionLoad
        ? ['FUNCTION', 'LOAD', name, bytes]
        : ['WASM.LOAD', name, bytes];
      const response = await runRawCommand(body.connection, command);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: `${command.slice(0, -1).join(' ')} <${bytes.length} bytes>`,
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, { ok: true, result: response.result, durationMs: response.durationMs, bytes: bytes.length });
    }

    if (req.method === 'POST' && url.pathname === '/redis/wasm/call') {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const fn = String(body.function || '').trim();
      const args = Array.isArray(body.args) ? body.args.map(String) : [];
      if (!name) return sendJson(res, 400, { ok: false, error: 'Missing wasm module name' });
      if (!fn) return sendJson(res, 400, { ok: false, error: 'Missing wasm function name' });
      const command = body.compatFcall
        ? [body.readOnly ? 'FCALL_RO' : 'FCALL', `${name}.${fn}`, '0', ...args]
        : [body.readOnly ? 'WASM.CALL_RO' : 'WASM.CALL', name, fn, ...args];
      const response = await runRawCommand(body.connection, command);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: command.join(' '),
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, { ok: true, result: response.result, durationMs: response.durationMs });
    }

    if (req.method === 'POST' && url.pathname === '/redis/wasm/list') {
      const body = await readBody(req);
      const command = body.compatFunctionList ? ['FUNCTION', 'LIST'] : ['WASM.LIST'];
      const response = await runRawCommand(body.connection, command);
      pushHistory({
        host: response.connection.host,
        port: response.connection.port,
        db: response.connection.db,
        command: command.join(' '),
        level: 'info',
        durationMs: response.durationMs,
      });
      return sendJson(res, 200, { ok: true, result: response.result, durationMs: response.durationMs });
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    const formatted = formatError(error);
    pushHistory({ command: req.url, level: 'error', error: formatted.message });
    sendJson(res, formatted.statusCode, { ok: false, error: formatted.message, code: error?.code });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Redis API server listening on http://localhost:${PORT}`);
  console.log(`Default Redis target ${DEFAULT_HOST}:${DEFAULT_PORT} db${DEFAULT_DB}`);
});
