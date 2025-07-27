# MCP Server Generator Tool

A comprehensive CLI tool called `mcp-generate` that converts various documentation sources into production-ready MCP (Model Context Protocol) servers. Transform documentation websites, GitHub repositories, and local files into structured MCP servers that AI assistants can interact with.

## Features

- **Multi-Source Support**: Process websites, GitHub repositories, and local files
- **Smart Content Processing**: Preserves code blocks, document hierarchy, and metadata
- **Production-Ready Output**: Generates complete TypeScript MCP servers with proper error handling
- **Three Core MCP Tools**: search_content, get_content, and list_resources
- **Configuration File Support**: JSON configuration for batch processing
- **CLI Interface**: Complete command-line interface with comprehensive options

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
  "processing": {
    "maxConcurrency": 5,
    "timeout": 30000
  }
}
```

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

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Development mode
npm run dev
```

## License

MIT License - see LICENSE file for details.
