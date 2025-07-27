import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ProcessedContent, ContentItem } from '../types';
import { Logger } from '../utils/logger';
import Fuse from 'fuse.js';

export class InMemoryMcpServer {
  private server: Server;
  private content: ProcessedContent;
  private searchEngine: Fuse<ContentItem>;

  constructor(
    private name: string,
    content: ProcessedContent,
    private logger: Logger
  ) {
    this.content = content;
    this.server = new Server(
      {
        name: this.name,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize search engine
    this.searchEngine = new Fuse(content.items, {
      keys: ['title', 'content', 'metadata.description', 'metadata.tags'],
      threshold: 0.6,
      includeScore: true,
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_content',
          description: 'Search through documentation content',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 10,
              },
              source: {
                type: 'string',
                description: 'Filter by source name',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_content',
          description: 'Retrieve specific content by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Content ID',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'list_resources',
          description: 'List available documentation resources',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Filter by source name',
              },
              type: {
                type: 'string',
                description: 'Filter by content type',
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'search_content':
          return this.handleSearchContent(args);
        case 'get_content':
          return this.handleGetContent(args);
        case 'list_resources':
          return this.handleListResources(args);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    });
  }

  private async handleSearchContent(args: any) {
    const { query, limit = 10, source } = args;

    if (!query || typeof query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Query is required and must be a string');
    }

    let items = this.content.items;
    if (source) {
      items = items.filter((item) => item.source === source);
    }

    const searchResults = this.searchEngine.search(query, { limit });
    const results = searchResults.map((result) => ({
      id: result.item.id,
      title: result.item.title,
      snippet: result.item.content.substring(0, 200) + (result.item.content.length > 200 ? '...' : ''),
      url: result.item.url,
      source: result.item.source,
      type: result.item.type,
      score: result.score,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query,
            results,
            total: results.length,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetContent(args: any) {
    const { id } = args;

    if (!id || typeof id !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'ID is required and must be a string');
    }

    const item = this.content.items.find((item) => item.id === id);
    if (!item) {
      throw new McpError(ErrorCode.InvalidParams, `Content not found: ${id}`);
    }

    // Find related content
    const related = this.content.items
      .filter((other) => other.id !== id && other.source === item.source)
      .slice(0, 5)
      .map((other) => ({
        id: other.id,
        title: other.title,
        type: other.type,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: item.id,
            title: item.title,
            content: item.content,
            url: item.url,
            path: item.path,
            type: item.type,
            source: item.source,
            metadata: item.metadata,
            related,
          }, null, 2),
        },
      ],
    };
  }

  private async handleListResources(args: any) {
    const { source, type } = args;

    let items = this.content.items;
    if (source) {
      items = items.filter((item) => item.source === source);
    }
    if (type) {
      items = items.filter((item) => item.type === type);
    }

    const resources = items.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      source: item.source,
      path: item.path,
      url: item.url,
      description: item.metadata.description,
      lastModified: item.metadata.lastModified,
    }));

    // Group by source
    const bySource = resources.reduce((acc, item) => {
      if (!acc[item.source]) {
        acc[item.source] = [];
      }
      acc[item.source].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: resources.length,
            sources: Object.keys(bySource),
            resources: bySource,
            metadata: this.content.metadata,
          }, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    this.logger.info('🚀 Starting MCP server...');
    this.logger.info(`📊 Loaded ${this.content.items.length} documentation items`);
    this.logger.info('💡 Available tools: search_content, get_content, list_resources');
    this.logger.info('🔌 Server listening on stdio transport');
    this.logger.info('⏹️  Press Ctrl+C to stop the server\n');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Keep the process running
    process.on('SIGINT', () => {
      this.logger.info('\n🛑 Stopping MCP server...');
      process.exit(0);
    });
  }
}