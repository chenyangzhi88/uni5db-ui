import http from 'node:http';
import net from 'node:net';
import { URL } from 'node:url';

const PORT = Number(process.env.REDIS_API_PORT || 3001);
const DEFAULT_HOST = process.env.REDIS_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.REDIS_PORT || 6379);
const DEFAULT_DB = Number(process.env.REDIS_DB || 0);
const DEFAULT_PASSWORD = process.env.REDIS_PASSWORD || '';
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
      socket.write(encodeCommand(commands[index]));
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
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

    sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    const formatted = formatError(error);
    pushHistory({ command: req.url, level: 'error', error: formatted.message });
    sendJson(res, formatted.statusCode, { ok: false, error: formatted.message, code: error?.code });
  }
});

server.listen(PORT, () => {
  console.log(`Redis API server listening on http://localhost:${PORT}`);
  console.log(`Default Redis target ${DEFAULT_HOST}:${DEFAULT_PORT} db${DEFAULT_DB}`);
});
