import { McpGenerator } from '../generators/mcp-generator';
import { Config } from '../types';
import { Logger } from '../utils/logger';
import * as fs from 'fs-extra';
import { join } from 'path';

describe('McpGenerator', () => {
  let testDir: string;
  let logger: Logger;
  
  beforeEach(() => {
    testDir = join(__dirname, '../../tmp/test');
    logger = new Logger(false);
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  test('should generate MCP server for local source', async () => {
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
    };

    const generator = new McpGenerator(config, logger);
    await generator.generate();

    // Verify server was generated
    expect(await fs.pathExists(join(testDir, 'output/src/index.ts'))).toBe(true);
    expect(await fs.pathExists(join(testDir, 'output/package.json'))).toBe(true);
    expect(await fs.pathExists(join(testDir, 'output/src/data/content.json'))).toBe(true);
    
    // Verify content was processed
    const contentData = await fs.readJson(join(testDir, 'output/src/data/content.json'));
    expect(contentData.items).toHaveLength(1);
    expect(contentData.items[0].title).toBe('Test');
  });

  test('should preview generation without creating files', async () => {
    const config: Config = {
      sources: [{
        type: 'local',
        name: 'test-source',
        path: '/tmp/nonexistent',
      } as any],
      output: {
        directory: join(testDir, 'output'),
      },
    };

    const generator = new McpGenerator(config, logger);
    
    // Should not throw and not create files
    await expect(generator.preview()).resolves.not.toThrow();
    expect(await fs.pathExists(join(testDir, 'output'))).toBe(false);
  });
});