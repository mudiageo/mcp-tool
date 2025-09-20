# MCP Server Generator Tool

A comprehensive CLI tool called `mcp-generate` that converts various documentation sources into production-ready MCP (Model Context Protocol) servers. Transform documentation websites, GitHub repositories, and local files into structured MCP servers that AI assistants can interact with.

## Features

- **Multi-Source Support**: Process websites, GitHub repositories, and local files
- **Smart Content Processing**: Preserves code blocks, document hierarchy, and metadata
- **Production-Ready Output**: Generates complete TypeScript MCP servers with proper error handling
- **Three Core MCP Tools**: search_content, get_content, and list_resources
- **Configuration File Support**: JSON configuration for batch processing
- **CLI Interface**: Complete command-line interface with comprehensive options
- **Direct Server Execution**: Run MCP servers directly without generating files (--run mode)
- **Modern Build Tools**: Uses tsdown for fast TypeScript compilation and vitest for tests

## Installation

```bash
npm install -g mcp-generate
```

Or use locally:

```bash
npm install
npm run build
```

## Quick Start

### Generate from Local Documentation
```bash
mcp-generate --source local --path ./docs --output ./my-server
```

### Generate from Website (Threlte Example)
```bash
mcp-generate --source website --url https://threlte.xyz/docs --output ./threlte-server
```

### Generate from GitHub Repository
```bash
mcp-generate --source github --repo facebook/react --output ./react-server --include-readme
```

### Run Server Directly (No File Generation)
```bash
# Run an MCP server directly from local docs (stdio transport by default)
mcp-generate --source local --path ./docs --run

# Run server from website documentation with HTTP transport
mcp-generate --source website --url https://threlte.xyz/docs --run --transport http

# Run server with custom HTTP port
mcp-generate --source local --path ./docs --run --transport http --port 4000
```

### Transport Options

The tool supports two transport modes for MCP servers:

- **Stdio Transport** (default): Uses stdin/stdout for communication - ideal for production MCP deployments
- **HTTP Transport**: Uses Server-Sent Events (SSE) for communication - better for debugging and development

Stdio transport is the default as it's the standard for MCP servers. Use HTTP transport for development and debugging when you need to inspect the communication.

### Use Configuration File
```bash
mcp-generate --config ./examples/threlte-config.json
```

## CLI Usage

```bash
mcp-generate [options]

Options:
  -s, --source <type>       Source type: website, github, local
  -u, --url <url>          Website URL for scraping
  -r, --repo <owner/repo>  GitHub repository
  -p, --path <path>        Local file path
  -o, --output <dir>       Output directory for generated server
  -c, --config <file>      Configuration file path
  -t, --template <name>    Server template to use
  --include-code           Include code examples
  --max-depth <num>        Maximum crawling depth
  --filter <pattern>       Content filtering pattern
  --format <type>          Output format preferences
  --verbose                Verbose logging
  --dry-run               Preview without generation
  --run                   Create and run the server directly without generating files
  --transport <type>       Transport type: stdio or http (default: stdio)
  --port <number>          Port for HTTP transport (default: 3000)
  -h, --help              Display help for command
```

## Configuration File Format

```json
{
  "sources": [
    {
      "type": "website",
      "name": "docs-site",
      "url": "https://example.com/docs",
      "options": {
        "maxDepth": 5,
        "includeCode": true,
        "selectors": {
          "content": ".content",
          "navigation": ".nav",
          "title": "h1"
        },
        "exclude": ["**/node_modules/**"]
      }
    }
  ],
  "output": {
    "directory": "./generated-server",
    "template": "typescript-standard",
    "features": ["search", "browse", "retrieve"]
  },
  "server": {
    "transport": "stdio"
  },
  "processing": {
    "maxConcurrency": 5,
    "timeout": 30000
  }
}
```

### Configuration Options

#### Server Configuration
- **transport**: Transport protocol for the MCP server
  - `"stdio"` (default): Uses stdin/stdout for communication. Standard for production MCP deployments.
  - `"http"`: Uses Server-Sent Events for communication. Recommended for development and debugging.
- **port**: Port number for HTTP transport (default: 3000). Only used when transport is "http".

#### Source Types
See the `examples/` directory for complete configuration examples for each source type.

## Generated MCP Server

The generated server includes:

### MCP Tools

1. **search_content**: Semantic search through documentation
   - Query parameter for search terms
   - Optional filters by source and type
   - Fuzzy matching with relevance scoring

2. **get_content**: Retrieve specific content
   - Access by ID or path
   - Optional related content suggestions
   - Full metadata and formatting

3. **list_resources**: Browse documentation hierarchy
   - Hierarchical resource listing
   - Filter and sort capabilities
   - Section-based organization

### Server Structure

```
generated-server/
├── src/
│   ├── index.ts           # Main MCP server entry point
│   ├── tools/
│   │   ├── search.ts      # search_content implementation
│   │   ├── content.ts     # get_content implementation
│   │   └── resources.ts   # list_resources implementation
│   ├── data/
│   │   ├── content.json   # Processed content data
│   │   └── index.json     # Search index
│   ├── types/
│   │   └── index.ts       # Type definitions
│   └── utils/
│       └── data-loader.ts # Content loading utilities
├── package.json           # Node.js package configuration
├── tsconfig.json          # TypeScript configuration
├── README.md              # Server documentation
└── mcp-config.json        # MCP server configuration
```

## Examples

See the `examples/` directory for complete configuration examples:

- `threlte-config.json` - Threlte documentation website
- `github-config.json` - GitHub repository processing
- `local-config.json` - Local documentation files  
- `multi-source-config.json` - Multiple sources combined

## Source Types

### Website Sources
- Supports Threlte, GitBook, Docusaurus, VitePress, and generic websites
- Configurable CSS selectors for content extraction
- Depth-limited crawling with link following
- Preserves code blocks and formatting

### GitHub Repositories
- Clone and process repository contents
- Include README, wiki, and documentation files
- Filter by file patterns and directories
- Extract metadata from markdown frontmatter

### Local Files
- Process local documentation directories
- Support for Markdown, text, and other formats
- Recursive directory traversal
- File type detection and processing

## Development

This project uses modern tooling for development:

- **tsdown**: Fast TypeScript compilation powered by rolldown
- **vitest**: Fast unit testing framework
- **ESLint**: Code linting and style enforcement

```bash
# Install dependencies
npm install

# Build the project (uses tsdown)
npm run build

# Run tests (uses vitest)
npm run test:run

# Run tests in watch mode
npm run test

# Lint code
npm run lint

# Development mode (uses tsx)
npm run dev
```

## License

MIT License - see LICENSE file for details.
