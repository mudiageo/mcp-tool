import { McpGenerator } from '../generators/mcp-generator';
import { Config } from '../types';
import { Logger } from '../utils/logger';
import * as fs from 'fs-extra';
import { join } from 'path';

describe('Transport Configuration', () => {
  let testDir: string;
  let logger: Logger;
  
  beforeEach(() => {
    testDir = join(__dirname, '../../tmp/transport-test');
    logger = new Logger(false);
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  test('should default to HTTP transport when server config is not provided', async () => {
    // Create test documentation
    const docsDir = join(testDir, 'docs');
    await fs.ensureDir(docsDir);
    await fs.writeFile(join(docsDir, 'test.md'), '# Test\n\nThis is a test document.');
    
    const config: Config = {
      sources: [{
        type: 'local',
        name: 'test-source',
        path: docsDir,
        options: {
          format: 'markdown',
          recursive: true,
        },
      } as any],
      output: {
        directory: join(testDir, 'output'),
        template: 'typescript-standard',
        features: ['search', 'browse', 'retrieve'],
      },
      // No server config - should default to HTTP
    };

    const generator = new McpGenerator(config, logger);
    await generator.generate();

    // Verify server was generated with HTTP transport
    const serverCode = await fs.readFile(join(testDir, 'output/src/index.ts'), 'utf8');
    expect(serverCode).toContain("const transport = 'http'");
    expect(serverCode).toContain("const port = 3000");
    expect(serverCode).toContain('SSEServerTransport');
  });

  test('should use stdio transport when explicitly configured', async () => {
    // Create test documentation
    const docsDir = join(testDir, 'docs');
    await fs.ensureDir(docsDir);
    await fs.writeFile(join(docsDir, 'test.md'), '# Test\n\nThis is a test document.');
    
    const config: Config = {
      sources: [{
        type: 'local',
        name: 'test-source',
        path: docsDir,
        options: {
          format: 'markdown',
          recursive: true,
        },
      } as any],
      output: {
        directory: join(testDir, 'output'),
        template: 'typescript-standard',
        features: ['search', 'browse', 'retrieve'],
      },
      server: {
        transport: 'stdio',
      },
    };

    const generator = new McpGenerator(config, logger);
    await generator.generate();

    // Verify server was generated with stdio transport
    const serverCode = await fs.readFile(join(testDir, 'output/src/index.ts'), 'utf8');
    expect(serverCode).toContain("const transport = 'stdio'");
    expect(serverCode).toContain('StdioServerTransport');
  });

  test('should use HTTP transport with custom port when configured', async () => {
    // Create test documentation
    const docsDir = join(testDir, 'docs');
    await fs.ensureDir(docsDir);
    await fs.writeFile(join(docsDir, 'test.md'), '# Test\n\nThis is a test document.');
    
    const config: Config = {
      sources: [{
        type: 'local',
        name: 'test-source',
        path: docsDir,
        options: {
          format: 'markdown',
          recursive: true,
        },
      } as any],
      output: {
        directory: join(testDir, 'output'),
        template: 'typescript-standard',
        features: ['search', 'browse', 'retrieve'],
      },
      server: {
        transport: 'http',
        port: 4000,
      },
    };

    const generator = new McpGenerator(config, logger);
    await generator.generate();

    // Verify server was generated with HTTP transport and custom port
    const serverCode = await fs.readFile(join(testDir, 'output/src/index.ts'), 'utf8');
    expect(serverCode).toContain("const transport = 'http'");
    expect(serverCode).toContain("const port = 4000");
    expect(serverCode).toContain('SSEServerTransport');
  });

  test('should generate correct MCP config for stdio transport', async () => {
    // Create test documentation
    const docsDir = join(testDir, 'docs');
    await fs.ensureDir(docsDir);
    await fs.writeFile(join(docsDir, 'test.md'), '# Test\n\nThis is a test document.');
    
    const config: Config = {
      sources: [{
        type: 'local',
        name: 'test-source',
        path: docsDir,
        options: {
          format: 'markdown',
          recursive: true,
        },
      } as any],
      output: {
        directory: join(testDir, 'output'),
        template: 'typescript-standard',
        features: ['search', 'browse', 'retrieve'],
      },
      server: {
        transport: 'stdio',
      },
    };

    const generator = new McpGenerator(config, logger);
    await generator.generate();

    // Verify MCP config for stdio transport
    const mcpConfig = await fs.readJson(join(testDir, 'output/mcp-config.json'));
    const serverName = Object.keys(mcpConfig.mcpServers)[0];
    expect(mcpConfig.mcpServers[serverName]).toEqual({
      command: 'node',
      args: ['dist/index.js'],
      env: {},
    });
  });

  test('should generate correct MCP config for HTTP transport', async () => {
    // Create test documentation
    const docsDir = join(testDir, 'docs');
    await fs.ensureDir(docsDir);
    await fs.writeFile(join(docsDir, 'test.md'), '# Test\n\nThis is a test document.');
    
    const config: Config = {
      sources: [{
        type: 'local',
        name: 'test-source',
        path: docsDir,
        options: {
          format: 'markdown',
          recursive: true,
        },
      } as any],
      output: {
        directory: join(testDir, 'output'),
        template: 'typescript-standard',
        features: ['search', 'browse', 'retrieve'],
      },
      server: {
        transport: 'http',
        port: 5000,
      },
    };

    const generator = new McpGenerator(config, logger);
    await generator.generate();

    // Verify MCP config for HTTP transport
    const mcpConfig = await fs.readJson(join(testDir, 'output/mcp-config.json'));
    const serverName = Object.keys(mcpConfig.mcpServers)[0];
    expect(mcpConfig.mcpServers[serverName]).toEqual({
      command: 'node',
      args: ['dist/index.js'],
      env: {},
      transport: 'http',
      url: 'http://localhost:5000/sse',
    });
  });
});