# http-mock-host - Shared Open Source Project - Open-Source Project

A lightweight, zero-dependency mock HTTP server written in Node.js. It lets you mock API endpoints by configuring simple matching rules in a JSON file, with support for route parameters, query parameters, header checks, body payload parsing, dynamic template injections, and configurable delays (latency simulation).

## Project Features

- **Zero dependencies**: Built entirely on top of the native Node.js `http` module.
- **Express-like Routing**: Supports path variables (e.g. `/api/users/:id/posts/:post_id`).
- **Dynamic Templating**: Double curly braces syntax (`{{ request.params.id }}`, `{{ request.query.sort }}`) parses variables directly from parameters, query strings, headers, or JSON body payloads.
- **Latency Simulation**: Simulate realistic backend network delays using the `delay` option (in milliseconds) per rule.
- **Auto rules initializer**: Creates a default `mock_rules.json` file on startup if none is found.

## Repository Layout

```text
http-mock-host/
├── package.json
├── src/
│   └── server.js
├── tests/
│   └── server.test.js
└── README.md
```

## Build instructions

Ensure Node.js (version 18 or later) is installed. No NPM dependencies are required.

## Running the Project

### 1. Run the server

```bash
# Run on default port 8080 with default 'mock_rules.json'
node src/server.js

# Run with custom rules file and port
node src/server.js /path/to/my_rules.json 9000
```

### 2. Configure mock rules

Create a `mock_rules.json` file. Each rule is defined as:

```json
[
  {
    "request": {
      "method": "GET",
      "path": "/users/:id"
    },
    "response": {
      "status": 200,
      "headers": {
        "Content-Type": "application/json",
        "X-Mock-Engine": "Mockingbird"
      },
      "body": {
        "id": "{{ request.params.id }}",
        "name": "Jane Doe",
        "search_query": "{{ request.query.q }}",
        "client_header": "{{ request.headers.user-agent }}"
      },
      "delay": 250
    }
  }
]
```

Variables you can interpolate in the response:
- `{{ request.params.<name> }}` - Route path parameters (from URL segments prefixed with `:`).
- `{{ request.query.<name> }}` - Query parameters.
- `{{ request.headers.<name> }}` - HTTP Request headers.
- `{{ request.body.<field> }}` - JSON body properties (for POST/PUT/PATCH requests).

## Testing

Run unit and integration tests using Node.js's built-in test runner:

```bash
npm test
```
This starts test assertions covering the route compiler, query-string parser, template engine, and live HTTP request matching.

## Contributing

Suggestions for adding support for XML parsing or more complex header validations are welcome.

---
*Released under the MIT License by Sassywow.*

---
*Released under the MIT License by AlexanderAM1231.*

---
*Released under the MIT License by nxtdy2020rr.*

---
*Released under the MIT License by jocck96.*
