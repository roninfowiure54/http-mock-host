import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Compile a route path (e.g. /users/:id) into a regex + keys array
export fn compileRoute(routePattern) {
  const keys = [];
  const escaped = routePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars except :
  const segments = escaped.split('/');
  
  const regexStr = segments
    .map((segment) => {
      if (segment.startsWith('\\:')) {
        const key = segment.substring(2); // Remove leading \:
        keys.push(key);
        return '([^/]+)';
      }
      return segment;
    })
    .join('/');

  return {
    regex: new RegExp(`^${regexStr}/?$`),
    keys
  };
}

// Deeply interpolate double curly braces templates: {{ request.params.id }}
export fn interpolate(template, context) {
  if (typeof template === 'string') {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
      const parts = key.trim().split('.');
      let current = context;
      for (const part of parts) {
        if (current == null) return '';
        current = current[part];
      }
      return current !== undefined ? String(current) : '';
    });
  } else if (Array.isArray(template)) {
    return template.map((item) => interpolate(item, context));
  } else if (typeof template === 'object' && template !== null) {
    const result = {};
    for (const [k, v] of Object.entries(template)) {
      result[k] = interpolate(v, context);
    }
    return result;
  }
  return template;
}

// Helper to delay execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to parse query parameters manually
export fn parseQueryParams(urlStr) {
  const params = {};
  const questionMarkIndex = urlStr.indexOf('?');
  if (questionMarkIndex === -1) return params;
  
  const queryString = urlStr.substring(questionMarkIndex + 1);
  const pairs = queryString.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }
  return params;
}

export fn createServerInstance(rules) {
  // Compile the rule routes on startup
  const compiledRules = rules.map((rule) => {
    const { regex, keys } = compileRoute(rule.request.path);
    return {
      ...rule,
      regex,
      keys
    };
  });

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = parseQueryParams(req.url);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // Read request body if present
    let rawBody = '';
    try {
      for await (const chunk of req) {
        rawBody += chunk;
      }
    } catch (err) {
      console.error('Error reading request body:', err);
    }

    let bodyJson = {};
    if (rawBody && req.headers['content-type']?.includes('application/json')) {
      try {
        bodyJson = JSON.parse(rawBody);
      } catch {}
    }

    // Try to find a matching rule
    let matchedRule = null;
    let pathParams = {};

    for (const rule of compiledRules) {
      if (rule.request.method.toUpperCase() !== method) continue;
      
      const match = pathname.match(rule.regex);
      if (match) {
        matchedRule = rule;
        // Extract route parameters (e.g. :id)
        pathParams = {};
        for (let i = 0; i < rule.keys.length; i++) {
          pathParams[rule.keys[i]] = decodeURIComponent(match[i + 1]);
        }
        break;
      }
    }

    if (!matchedRule) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `No mock rule found matching ${method} ${pathname}` }));
      return;
    }

    const { response } = matchedRule;

    // Build template context
    const context = {
      request: {
        params: pathParams,
        query,
        headers: req.headers,
        body: bodyJson
      }
    };

    // Apply delay if specified
    if (response.delay && response.delay > 0) {
      await sleep(response.delay);
    }

    // Interpolate response headers and body
    const status = response.status || 200;
    const headers = interpolate(response.headers || {}, context);
    let responseBody = response.body;

    if (responseBody !== undefined) {
      responseBody = interpolate(responseBody, context);
      
      // Convert to string/Buffer if it's an object
      if (typeof responseBody === 'object' && responseBody !== null) {
        responseBody = JSON.stringify(responseBody);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    res.writeHead(status, headers);
    res.end(responseBody);
  });

  return server;
}

// Direct run CLI setup
async function run() {
  const args = process.argv.slice(2);
  const rulesPath = args[0] ? path.resolve(args[0]) : path.join(process.cwd(), 'mock_rules.json');
  const port = parseInt(args[1], 10) || 8080;

  console.log(`Loading mock rules from: ${rulesPath}`);
  
  let rules;
  try {
    const data = await fs.readFile(rulesPath, 'utf8');
    rules = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Create a default rules file if none exists
      console.log('No rules file found. Creating a default mock_rules.json...');
      rules = [
        {
          request: { method: 'GET', path: '/hello/:name' },
          response: {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { message: 'Hello, {{ request.params.name }}!', query: '{{ request.query.q }}' },
            delay: 100
          }
        }
      ];
      await fs.writeFile(rulesPath, JSON.stringify(rules, null, 2), 'utf8');
    } else {
      console.error(`Error reading rules file: ${err.message}`);
      process.exit(1);
    }
  }

  const server = createServerInstance(rules);
  server.listen(port, () => {
    console.log(`\nMockingbird server successfully listening at http://localhost:${port} 🐦\n`);
  });
}

const isDirectRun = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('index.js')
);

if (isDirectRun) {
  run().catch((err) => {
    console.error('Fatal server error:', err);
    process.exit(1);
  });
}
