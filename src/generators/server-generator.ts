import { Config, ProcessedContent } from '../types';
import { Logger } from '../utils/logger';
import * as fs from 'fs-extra';
import { join } from 'path';
import chalk from 'chalk';

export class ServerGenerator {
  constructor(
    private config: Config,
    private logger: Logger
  ) {}

  async generate(content: ProcessedContent): Promise<void> {
    const outputDir = this.config.output.directory;
    
    this.logger.progress('Creating server directory structure...');
    await this.createDirectoryStructure(outputDir);
    
    this.logger.progress('Generating server files...');
    await this.generateServerFiles(outputDir, content);
    
    this.logger.progress('Writing content data...');
    await this.writeContentData(outputDir, content);
    
    this.logger.progress('Generating package.json...');
    await this.generatePackageJson(outputDir);
    
    this.logger.progress('Generating configuration files...');
    await this.generateConfigFiles(outputDir);
    
    this.logger.success(chalk.green(`✅ Server generated in ${outputDir}`));
  }

  private async createDirectoryStructure(outputDir: string): Promise<void> {
    const dirs = [
      'src',
      'src/tools',
      'src/data',
      'src/types',
      'src/utils',
    ];

    for (const dir of dirs) {
      await fs.ensureDir(join(outputDir, dir));
    }
  }

  private async generateServerFiles(outputDir: string, content: ProcessedContent): Promise<void> {
    // Generate main server file
    await this.generateMainServer(outputDir, content);
    
    // Generate tool implementations
    await this.generateSearchTool(outputDir);
    await this.generateContentTool(outputDir);
    await this.generateResourcesTool(outputDir);
    
    // Generate utility files
    await this.generateUtils(outputDir);
    await this.generateTypes(outputDir);
  }

  private async generateMainServer(outputDir: string, content: ProcessedContent): Promise<void> {
    const serverName = this.getServerName();
    const transport = this.config.server?.transport || 'stdio';
    const port = this.config.server?.port || 3000;
    
    const serverCode = `#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as http from 'http';

import { searchContent } from './tools/search.js';
import { getContent } from './tools/content.js';
import { listResources } from './tools/resources.js';
import { loadContentData } from './utils/data-loader.js';

class DocumentationServer {
  private server: Server;
  private contentData: any;
  private httpServer?: http.Server;

  constructor() {
    this.server = new Server({
      name: '${serverName}',
      version: '1.0.0',
    });

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_content',
            description: 'Search through documentation content with semantic matching',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results (default: 10)',
                  default: 10,
                },
                source: {
                  type: 'string',
                  description: 'Filter by source name',
                },
                type: {
                  type: 'string',
                  description: 'Filter by content type',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_content',
            description: 'Retrieve specific content by ID or path',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Content ID',
                },
                path: {
                  type: 'string',
                  description: 'Content path',
                },
                includeRelated: {
                  type: 'boolean',
                  description: 'Include related content suggestions',
                  default: false,
                },
              },
              oneOf: [
                { required: ['id'] },
                { required: ['path'] },
              ],
            },
          },
          {
            name: 'list_resources',
            description: 'Browse available documentation resources',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Path to browse (default: root)',
                  default: '',
                },
                type: {
                  type: 'string',
                  description: 'Filter by resource type',
                },
                source: {
                  type: 'string',
                  description: 'Filter by source name',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_content':
            return await searchContent(args as any, this.contentData);

          case 'get_content':
            return await getContent(args as any, this.contentData);

          case 'list_resources':
            return await listResources(args as any, this.contentData);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              'Unknown tool: ' + name
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          'Tool execution failed: ' + (error instanceof Error ? error.message : 'Unknown error')
        );
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      // Only log errors for HTTP transport to avoid corrupting stdio JSON-RPC
      if ('${transport}' === 'http') {
        console.error('[MCP Error]', error);
      }
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      if (this.httpServer) {
        this.httpServer.close();
      }
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    // Load content data
    this.contentData = await loadContentData();
    
    const transport = '${transport}';
    const port = ${port};
    
    if (transport === 'http') {
      console.error('${serverName} MCP Server starting on HTTP transport (port ' + port + ')');
      console.error('Available at: http://localhost:' + port + '/sse');
      
      await this.startHttpServer(port);
    } else {
      // For stdio transport, no console output to avoid corrupting JSON-RPC messages
      const stdioTransport = new StdioServerTransport();
      await this.server.connect(stdioTransport);
    }
  }

  private async startHttpServer(port: number): Promise<void> {
    this.httpServer = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/sse') {
        // Start SSE connection
        const transport = new SSEServerTransport('/message', res);
        this.server.connect(transport); // This calls start() automatically
      } else if (req.method === 'POST' && req.url?.startsWith('/message')) {
        // Handle POST messages for existing SSE connections
        const transport = new SSEServerTransport('/message', res);
        transport.handlePostMessage(req, res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.httpServer.listen(port);
  }
}

const server = new DocumentationServer();
server.start().catch((error) => {
  // Only log startup errors for HTTP transport to avoid corrupting stdio JSON-RPC
  if ('${transport}' === 'http') {
    console.error('Failed to start server:', error);
  }
  process.exit(1);
});
`;

    await fs.writeFile(join(outputDir, 'src/index.ts'), serverCode);
  }

  private async generateSearchTool(outputDir: string): Promise<void> {
    const searchCode = `import Fuse from 'fuse.js';

export interface SearchArgs {
  query: string;
  limit?: number;
  source?: string;
  type?: string;
}

export async function searchContent(args: SearchArgs, contentData: any) {
  const { query, limit = 10, source, type } = args;
  
  let items = contentData.items || [];
  
  // Apply filters
  if (source) {
    items = items.filter((item: any) => item.source === source);
  }
  
  if (type) {
    items = items.filter((item: any) => item.type === type);
  }
  
  // Configure Fuse.js for fuzzy search
  const fuse = new Fuse(items, {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'content', weight: 0.3 },
      { name: 'metadata.description', weight: 0.2 },
      { name: 'metadata.tags', weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true,
  });
  
  const results = fuse.search(query).slice(0, limit);
  
  const resultsText = results.map((result, index) => {
    const item = result.item as any;
    const score = Math.round((1 - (result.score || 0)) * 100);
    
    const lines = [
      \`\${index + 1}. **\${item.title}** (Match: \${score}%)\`,
      \`   Source: \${item.source}\`,
      \`   Type: \${item.type}\`,
      \`   Path: \${item.path}\`
    ];
    
    if (item.metadata?.description) {
      lines.push(\`   Description: \${item.metadata.description}\`);
    }
    if (item.url) {
      lines.push(\`   URL: \${item.url}\`);
    }
    
    lines.push('');
    lines.push(\`   Preview: \${item.content.substring(0, 200)}...\`);
    
    return lines.join('\\n');
  }).join('\\n\\n');
  
  return {
    content: [
      {
        type: 'text',
        text: \`Found \${results.length} results for "\${query}\":\\n\\n\` + resultsText,
      },
    ],
  };
}`;

    await fs.writeFile(join(outputDir, 'src/tools/search.ts'), searchCode);
  }

  private async generateContentTool(outputDir: string): Promise<void> {
    const contentCode = `export interface GetContentArgs {
  id?: string;
  path?: string;
  includeRelated?: boolean;
}

export async function getContent(args: GetContentArgs, contentData: any) {
  const { id, path, includeRelated = false } = args;
  
  const items = contentData.items || [];
  
  // Find the content item
  let item;
  if (id) {
    item = items.find((i: any) => i.id === id);
  } else if (path) {
    item = items.find((i: any) => i.path === path);
  }
  
  if (!item) {
    const identifier = id ? 'ID: ' + id : 'path: ' + path;
    return {
      content: [
        {
          type: 'text',
          text: 'Content not found for ' + identifier,
        },
      ],
    };
  }
  
  const lines = [
    '# ' + item.title,
    '',
    '**Source:** ' + item.source,
    '**Type:** ' + item.type,
    '**Path:** ' + item.path
  ];
  
  if (item.url) {
    lines.push('**URL:** ' + item.url);
  }
  if (item.metadata?.lastModified) {
    lines.push('**Last Modified:** ' + new Date(item.metadata.lastModified).toLocaleDateString());
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(item.content);
  
  // Add related content if requested
  if (includeRelated) {
    const related = findRelatedContent(item, items);
    if (related.length > 0) {
      lines.push('');
      lines.push('## Related Content');
      lines.push('');
      
      related.forEach((relatedItem: any, index: number) => {
        let relatedLine = \`\${index + 1}. [\${relatedItem.title}](\${relatedItem.path})\`;
        if (relatedItem.metadata?.description) {
          relatedLine += ' - ' + relatedItem.metadata.description;
        }
        lines.push(relatedLine);
      });
    }
  }
  
  return {
    content: [
      {
        type: 'text',
        text: lines.join('\\n'),
      },
    ],
  };
}

function findRelatedContent(item: any, allItems: any[]): any[] {
  // Simple related content algorithm - find items with similar keywords or from same section
  const related = allItems
    .filter((otherItem: any) => 
      otherItem.id !== item.id && 
      (otherItem.source === item.source || 
       otherItem.metadata?.section === item.metadata?.section)
    )
    .slice(0, 5);
    
  return related;
}`;

    await fs.writeFile(join(outputDir, 'src/tools/content.ts'), contentCode);
  }

  private async generateResourcesTool(outputDir: string): Promise<void> {
    const resourcesCode = `export interface ListResourcesArgs {
  path?: string;
  type?: string;
  source?: string;
}

export async function listResources(args: ListResourcesArgs, contentData: any) {
  const { path = '', type, source } = args;
  
  let items = contentData.items || [];
  
  // Apply filters
  if (source) {
    items = items.filter((item: any) => item.source === source);
  }
  
  if (type) {
    items = items.filter((item: any) => item.type === type);
  }
  
  // Filter by path if specified
  if (path) {
    items = items.filter((item: any) => 
      item.path.startsWith(path) && item.path !== path
    );
  }
  
  // Group by section for better organization
  const sections: { [key: string]: any[] } = {};
  
  items.forEach((item: any) => {
    const section = item.metadata?.section || 'root';
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(item);
  });
  
  const lines = ['# Documentation Resources', ''];
  
  if (path) {
    lines.push('Browsing path: ' + path);
    lines.push('');
  }
  
  // Add summary
  lines.push('**Total Items:** ' + items.length);
  lines.push('**Sections:** ' + Object.keys(sections).length);
  if (contentData.metadata?.sources) {
    lines.push('**Sources:** ' + contentData.metadata.sources.join(', '));
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // List sections and their contents
  Object.entries(sections)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([sectionName, sectionItems]) => {
      lines.push('## ' + sectionName);
      lines.push('');
      
      sectionItems
        .sort((a: any, b: any) => a.title.localeCompare(b.title))
        .forEach((item: any) => {
          lines.push(\`- **\${item.title}** (\${item.type})\`);
          lines.push('  - Path: ' + item.path);
          lines.push('  - Source: ' + item.source);
          if (item.metadata?.description) {
            lines.push('  - Description: ' + item.metadata.description);
          }
          if (item.url) {
            lines.push('  - URL: ' + item.url);
          }
          lines.push('');
        });
    });
  
  return {
    content: [
      {
        type: 'text',
        text: lines.join('\\n'),
      },
    ],
  };
}`;

    await fs.writeFile(join(outputDir, 'src/tools/resources.ts'), resourcesCode);
  }

  private async generateUtils(outputDir: string): Promise<void> {
    const dataLoaderCode = `import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadContentData() {
  try {
    const contentPath = join(__dirname, '../data/content.json');
    const indexPath = join(__dirname, '../data/index.json');
    
    const content = JSON.parse(readFileSync(contentPath, 'utf8'));
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    
    return {
      ...content,
      index,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error('Failed to load content data: ' + message);
  }
}`;

    await fs.writeFile(join(outputDir, 'src/utils/data-loader.ts'), dataLoaderCode);
  }

  private async generateTypes(outputDir: string): Promise<void> {
    const typesCode = `export interface ContentItem {
  id: string;
  title: string;
  content: string;
  url?: string;
  path: string;
  type: string;
  source: string;
  metadata: {
    description?: string;
    tags?: string[];
    lastModified?: Date;
    author?: string;
    section?: string;
  };
  parent?: string;
  children?: string[];
}

export interface SearchIndex {
  [key: string]: {
    content: string;
    title: string;
    keywords: string[];
  };
}

export interface ContentData {
  items: ContentItem[];
  index: SearchIndex;
  metadata: {
    totalItems: number;
    sources: string[];
    lastProcessed: Date;
  };
}`;

    await fs.writeFile(join(outputDir, 'src/types/index.ts'), typesCode);
  }

  private async writeContentData(outputDir: string, content: ProcessedContent): Promise<void> {
    const dataDir = join(outputDir, 'src/data');
    
    // Write content data
    await fs.writeFile(
      join(dataDir, 'content.json'),
      JSON.stringify(content, null, 2)
    );
    
    // Write search index
    await fs.writeFile(
      join(dataDir, 'index.json'),
      JSON.stringify(content.index, null, 2)
    );
  }

  private async generatePackageJson(outputDir: string): Promise<void> {
    const packageJson = {
      name: this.getServerName().toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: 'Generated MCP server for documentation',
      main: 'dist/index.js',
      type: 'module',
      scripts: {
        build: 'tsc && cp -r src/data dist/',
        start: 'node dist/index.js',
        dev: 'ts-node --esm src/index.ts',
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^0.4.0',
        'fuse.js': '^7.0.0',
      },
      devDependencies: {
        '@types/node': '^20.9.0',
        'typescript': '^5.2.2',
        'ts-node': '^10.9.1',
      },
      engines: {
        node: '>=18.0.0',
      },
    };

    await fs.writeFile(
      join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  private async generateConfigFiles(outputDir: string): Promise<void> {
    // Generate TypeScript config
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        outDir: './dist',
        rootDir: './src',
        resolveJsonModule: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    };

    await fs.writeFile(
      join(outputDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );

    // Generate MCP config
    const transport = this.config.server?.transport || 'http';
    const port = this.config.server?.port || 3000;
    
    const mcpConfig = {
      mcpServers: {
        [this.getServerName().toLowerCase().replace(/\s+/g, '-')]: transport === 'stdio' ? {
          command: 'node',
          args: ['dist/index.js'],
          env: {},
        } : {
          command: 'node',
          args: ['dist/index.js'],
          env: {},
          transport: 'http',
          url: `http://localhost:${port}/sse`,
        },
      },
    };

    await fs.writeFile(
      join(outputDir, 'mcp-config.json'),
      JSON.stringify(mcpConfig, null, 2)
    );

    // Generate README
    const serverName = this.getServerName();
    const serverSlug = serverName.toLowerCase().replace(/\s+/g, '-');
    
    const readmeLines = [
      '# ' + serverName + ' MCP Server',
      '',
      'Generated MCP server for documentation access.',
      '',
      `## Transport Mode: ${transport.toUpperCase()}`,
      '',
      transport === 'http' ? `This server runs on HTTP transport at \`http://localhost:${port}/sse\`.` : 'This server runs on stdio transport.',
      '',
      '## Installation',
      '',
      '```bash',
      'npm install',
      'npm run build',
      '```',
      '',
      '## Usage',
      '',
      '```bash',
      'npm start',
      '```',
      '',
      '## Available Tools',
      '',
      '- **search_content**: Search through documentation content',
      '- **get_content**: Retrieve specific content by ID or path',  
      '- **list_resources**: Browse available documentation resources',
      '',
      '## Configuration',
      '',
      'Add to your MCP client configuration:',
      '',
      '```json',
      '{',
      '  "mcpServers": {',
      '    "' + serverSlug + '": ' + (transport === 'stdio' ? '{' : '{'),
      '      "command": "node",',
      '      "args": ["path/to/this/server/dist/index.js"]' + (transport === 'stdio' ? '' : ','),
      ...(transport === 'http' ? [
        '      "transport": "http",',
        `      "url": "http://localhost:${port}/sse"`
      ] : []),
      '    }',
      '  }',
      '}',
      '```'
    ];

    await fs.writeFile(join(outputDir, 'README.md'), readmeLines.join('\n'));
  }

  private getServerName(): string {
    const sources = this.config.sources.map(s => s.name).join('-');
    return `${sources}-docs`;
  }
}