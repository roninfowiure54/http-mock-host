import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { compileRoute, interpolate, parseQueryParams, createServerInstance } from '../src/server.js';

test('compileRoute matching and param key extraction', () => {
  // Simple static route
  const route1 = compileRoute('/health');
  assert.strictEqual(route1.regex.test('/health'), true);
  assert.strictEqual(route1.regex.test('/health/'), true);
  assert.strictEqual(route1.regex.test('/health-check'), false);
  assert.deepStrictEqual(route1.keys, []);

  // Parametric route
  const route2 = compileRoute('/users/:id/posts/:postId');
  assert.strictEqual(route2.regex.test('/users/123/posts/456'), true);
  assert.strictEqual(route2.regex.test('/users/123/posts'), false);
  assert.deepStrictEqual(route2.keys, ['id', 'postId']);

  // Extract params
  const match = '/users/alice/posts/my-first-post'.match(route2.regex);
  assert.ok(match);
  assert.strictEqual(match[1], 'alice');
  assert.strictEqual(match[2], 'my-first-post');
});

test('interpolate replacements from context', () => {
  const context = {
    request: {
      params: { id: '101' },
      query: { mode: 'dark' },
      headers: { host: 'localhost:8080' }
    }
  };

  // Simple string template
  const tmpl1 = 'User ID is {{ request.params.id }} in mode {{ request.query.mode }}';
  const out1 = interpolate(tmpl1, context);
  assert.strictEqual(out1, 'User ID is 101 in mode dark');

  // Object templates
  const tmplObj = {
    userId: 'ID-{{ request.params.id }}',
    meta: {
      host: '{{ request.headers.host }}',
      missing: '{{ request.query.unknown }}'
    }
  };
  const outObj = interpolate(tmplObj, context);
  assert.deepStrictEqual(outObj, {
    userId: 'ID-101',
    meta: {
      host: 'localhost:8080',
      missing: ''
    }
  });
});

test('parseQueryParams utility', () => {
  assert.deepStrictEqual(parseQueryParams('/path?q=node&limit=10'), { q: 'node', limit: '10' });
  assert.deepStrictEqual(parseQueryParams('/path'), {});
  assert.deepStrictEqual(parseQueryParams('/path?flag'), { flag: '' });
});

test('Mock Server response matching and body injection', async () => {
  const rules = [
    {
      request: { method: 'GET', path: '/users/:id' },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { id: '{{ request.params.id }}', flag: '{{ request.query.flag }}', ok: true }
      }
    }
  ];

  const server = createServerInstance(rules);
  
  // Find an available port dynamically by listening on port 0
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/users/999?flag=yes`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/json');

    const json = await res.json();
    assert.deepStrictEqual(json, { id: '999', flag: 'yes', ok: true });

    // Test 404
    const res404 = await fetch(`http://localhost:${port}/unknown-path`);
    assert.strictEqual(res404.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
