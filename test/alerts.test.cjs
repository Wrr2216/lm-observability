const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { createSocket } = require('node:dgram');
const { PushoverClient, sendWazuh, formatAlert } = require('../dist');
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });
const event = { app: 'test-app', title: 'test', message: 'hello\n世界', priority: 1 };

test('Pushover posts valid priorities, emergency parameters, and bounded Unicode bodies', async () => {
  delete process.env.WAZUH_HOST;
  let body;
  global.fetch = async (url, opts) => {
    assert.equal(url, 'https://api.pushover.net/1/messages.json');
    assert.ok(opts.signal);
    body = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ status: 1 }) };
  };
  const client = new PushoverClient({ enabled: true, token: 'test-token', user: 'test-user' }, 'test-app');
  for (const [priority, number] of [['min', -2], ['low', -1], ['default', 0], ['high', 1], ['max', 2]]) {
    await client.send({ message: 'a'.repeat(1500), title: 'b'.repeat(300), priority, url: 'https://example.com' });
    assert.equal(body.priority, number);
    assert.equal(body.message.length, 1024);
    assert.equal(body.title.length, 250);
    assert.equal(body.url, 'https://example.com');
    assert.equal(body.retry, number === 2 ? 60 : undefined);
    assert.equal(body.expire, number === 2 ? 3600 : undefined);
  }
});

test('Wazuh receives TCP JSON even with Pushover disabled', async () => {
  const frames = [];
  const server = createServer(socket => { socket.on('data', data => frames.push(data.toString())); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.WAZUH_HOST = '127.0.0.1';
    process.env.WAZUH_PORT = String(server.address().port);
    process.env.WAZUH_PROTOCOL = 'tcp';
    delete process.env.WAZUH_ENABLED;
    global.fetch = async () => { throw new Error('Pushover must remain disabled'); };
    const client = new PushoverClient({ enabled: false, token: '', user: '' }, event.app);
    await client.send({ title: event.title, message: event.message, priority: 'high' });
    await new Promise(resolve => setTimeout(resolve, 30));
    const frame = frames.join('');
    assert.match(frame, /^<131>\w{3} [ \d]\d \d\d:\d\d:\d\d \S+ mct-alert: /);
    assert.equal(frame.split('\n').length, 2);
    const data = JSON.parse(frame.slice(frame.indexOf('{')));
    assert.equal(data.app, event.app);
    assert.equal(data.event, 'notification');
    assert.equal(data.message, event.message);
    assert.equal(data.priority, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Wazuh UDP uses the same parseable event schema', async () => {
  const server = createSocket('udp4');
  await new Promise(resolve => server.bind(0, '127.0.0.1', resolve));
  try {
    process.env.WAZUH_HOST = '127.0.0.1';
    process.env.WAZUH_PORT = String(server.address().port);
    process.env.WAZUH_PROTOCOL = 'udp';
    delete process.env.WAZUH_ENABLED;
    const received = new Promise(resolve => server.once('message', data => resolve(data.toString())));
    assert.equal(await sendWazuh(event), true);
    const frame = await received;
    assert.equal(JSON.parse(frame.slice(frame.indexOf('{'))).app, 'test-app');
  } finally { server.close(); }
});

test('transport failures are isolated and do not throw', async () => {
  process.env.WAZUH_HOST = '127.0.0.1';
  process.env.WAZUH_PORT = 'invalid';
  global.fetch = async () => { throw new Error('offline'); };
  const client = new PushoverClient({ enabled: true, token: 'test', user: 'test' }, 'test-app');
  await assert.doesNotReject(() => client.send({ message: 'failure' }));
  assert.equal(await sendWazuh(event), false);
});

test('disabled transports make no network request and JSON escapes injected newlines', async () => {
  process.env.WAZUH_ENABLED = 'false';
  global.fetch = async () => { throw new Error('must not fetch'); };
  const client = new PushoverClient({ enabled: false, token: '', user: '' }, 'test-app');
  await client.send({ message: 'disabled' });
  assert.equal(await sendWazuh(event), false);
  const line = formatAlert({ ...event, title: 'hello\nforged' }, new Date('2026-09-08T01:02:03Z'));
  assert.match(line, /^<131>Sep  8 01:02:03 /);
  assert.equal(line.includes('\n'), false);
});
