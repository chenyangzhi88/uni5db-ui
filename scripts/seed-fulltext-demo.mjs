import { spawnSync } from 'node:child_process';
import net from 'node:net';

const host = process.env.REDIS_HOST || '192.168.0.103';
const port = process.env.REDIS_PORT || '6380';
const documentCount = Math.max(1, Number(process.env.DOCUMENT_COUNT || 420));
const indexName = process.env.FULLTEXT_INDEX || 'idx:demo:fts:20260723';
const keyPrefix = process.env.FULLTEXT_PREFIX || 'demo:fts:20260723:doc:';

const topics = [
  ['redis', 'Redis'],
  ['search', 'Search'],
  ['vector', 'Vector Search'],
  ['database', 'Database'],
  ['caching', 'Caching'],
  ['streaming', 'Event Streaming'],
  ['observability', 'Observability'],
  ['security', 'Security'],
  ['cloud', 'Cloud Platform'],
  ['ai', 'Applied AI'],
  ['analytics', 'Analytics'],
  ['performance', 'Performance'],
];
const adjectives = ['Practical', 'Modern', 'Reliable', 'Scalable', 'Advanced', 'Essential', 'Hands-on', 'Production', 'Efficient', 'Resilient'];
const audiences = ['developers', 'architects', 'platform teams', 'data engineers', 'operators'];
const categories = ['books', 'courses', 'tools', 'reports', 'workshops', 'templates', 'case-studies'];
const authors = [
  'Ava Chen',
  'Noah Williams',
  'Mia Rodriguez',
  'Liam Patel',
  'Emma Thompson',
  'Ethan Kim',
  'Olivia Martin',
  'Lucas Garcia',
  'Sophia Wilson',
  'Mason Brown',
  'Isabella Lee',
  'James Davis',
];
const places = [
  ['shanghai', 121.4737, 31.2304],
  ['beijing', 116.4074, 39.9042],
  ['singapore', 103.8198, 1.3521],
  ['tokyo', 139.6917, 35.6895],
  ['london', -0.1276, 51.5072],
  ['san-francisco', -122.4194, 37.7749],
];
const featurePhrases = [
  'real time analytics',
  'low latency architecture',
  'distributed systems',
  'semantic retrieval',
  'operational excellence',
  'zero downtime migration',
];

function redisCliArgs(...args) {
  return ['-h', host, '-p', String(port), ...args];
}

function runRedis(...args) {
  return spawnSync('redis-cli', redisCliArgs('--raw', ...args), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function encodeCommand(args) {
  const parts = [Buffer.from(`*${args.length}\r\n`)];
  for (const arg of args) {
    const value = Buffer.from(String(arg));
    parts.push(Buffer.from(`$${value.length}\r\n`), value, Buffer.from('\r\n'));
  }
  return Buffer.concat(parts);
}

function parseResponse(buffer, offset = 0) {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd === -1) return null;
  const line = buffer.toString('utf8', offset + 1, lineEnd);
  let cursor = lineEnd + 2;

  if (prefix === '+') return { value: line, offset: cursor };
  if (prefix === '-') throw new Error(line);
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
    const values = [];
    for (let index = 0; index < count; index += 1) {
      const parsed = parseResponse(buffer, cursor);
      if (!parsed) return null;
      values.push(parsed.value);
      cursor = parsed.offset;
    }
    return { value: values, offset: cursor };
  }
  throw new Error(`Unsupported Redis response prefix: ${prefix}`);
}

function ensureIndex() {
  const list = runRedis('FT._LIST');
  if (list.status !== 0) throw new Error(list.stderr.trim() || 'Unable to list full text indexes');
  const indexes = list.stdout.split(/\r?\n/).filter(Boolean);
  if (indexes.includes(indexName)) return;

  const created = runRedis(
    'FT.CREATE',
    indexName,
    'ON',
    'HASH',
    'PREFIX',
    '1',
    keyPrefix,
    'LANGUAGE',
    'english',
    'LANGUAGE_FIELD',
    'language',
    'SCORE_FIELD',
    'popularity',
    'SCHEMA',
    'title',
    'TEXT',
    'WEIGHT',
    '3.0',
    'SORTABLE',
    'body',
    'TEXT',
    'tags',
    'TAG',
    'SEPARATOR',
    '|',
    'SORTABLE',
    'category',
    'TAG',
    'SORTABLE',
    'author',
    'TAG',
    'SORTABLE',
    'price',
    'NUMERIC',
    'SORTABLE',
    'rating',
    'NUMERIC',
    'SORTABLE',
    'published_at',
    'NUMERIC',
    'SORTABLE',
    'location',
    'GEO',
  );
  if (created.status !== 0 || !created.stdout.includes('OK')) {
    throw new Error(created.stderr.trim() || created.stdout.trim() || 'Unable to create full text index');
  }
}

function createDocument(index) {
  const number = index + 1;
  const [topic, topicLabel] = topics[index % topics.length];
  const adjective = adjectives[(index * 3) % adjectives.length];
  const audience = audiences[(index * 7) % audiences.length];
  const category = categories[(index * 5) % categories.length];
  const author = authors[(index * 7) % authors.length];
  const [city, longitude, latitude] = places[(index * 5) % places.length];
  const phrase = featurePhrases[index % featurePhrases.length];
  const year = 2022 + (index % 5);
  const tier = index % 4 === 0 ? 'premium' : 'standard';
  const price = (9 + ((index * 17) % 150) + (index % 4) * 0.25).toFixed(2);
  const rating = (3.5 + (index % 16) / 10).toFixed(1);
  const publishedAt = Math.floor(Date.UTC(year, index % 12, 1 + (index % 27)) / 1000);
  const popularity = (0.5 + (index % 50) / 100).toFixed(2);

  return [
    'HSET',
    `${keyPrefix}${String(number).padStart(4, '0')}`,
    'title',
    `${adjective} ${topicLabel} guide for ${audience}`,
    'body',
    `Learn ${topicLabel.toLowerCase()} through ${phrase}. This ${category} resource covers indexing, query design, relevance, production operations, and measurable outcomes for ${audience}.`,
    'tags',
    `${topic}|${category}|${tier}|year-${year}`,
    'category',
    category,
    'author',
    author,
    'price',
    price,
    'rating',
    rating,
    'published_at',
    String(publishedAt),
    'location',
    `${longitude},${latitude}`,
    'city',
    city,
    'language',
    'english',
    'popularity',
    popularity,
    'sku',
    `FTS-${year}-${String(number).padStart(5, '0')}`,
  ];
}

async function seedDocuments() {
  const commands = Array.from({ length: documentCount }, (_, index) => createDocument(index));
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port: Number(port) });
    let buffer = Buffer.alloc(0);
    let commandIndex = 0;
    let settled = false;

    const finishWithError = (error) => {
      if (settled) return;
      settled = true;
      client.destroy();
      reject(error);
    };

    const sendNext = () => client.write(encodeCommand(commands[commandIndex]));

    client.setTimeout(10000, () => finishWithError(new Error('Redis seed command timed out')));
    client.on('error', finishWithError);
    client.on('connect', sendNext);
    client.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const parsed = parseResponse(buffer);
        if (!parsed) return;
        buffer = buffer.subarray(parsed.offset);
        commandIndex += 1;
        if (commandIndex >= commands.length) {
          settled = true;
          client.end();
          resolve(`errors: 0, replies: ${commands.length}`);
          return;
        }
        sendNext();
      } catch (error) {
        finishWithError(error);
      }
    });
  });
}

ensureIndex();
const pipelineResult = await seedDocuments();
const info = runRedis('FT.INFO', indexName);

console.log(`Seeded ${documentCount} documents into ${host}:${port}`);
console.log(`Index: ${indexName}`);
console.log(`Key prefix: ${keyPrefix}`);
console.log(pipelineResult);
if (info.status === 0) console.log(info.stdout.trim());
