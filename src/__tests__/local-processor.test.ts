import { LocalProcessor } from '../processors/local-processor';
import { LocalSourceConfig } from '../types';
import { Logger } from '../utils/logger';
import * as fs from 'fs-extra';
import { join } from 'path';

describe('LocalProcessor', () => {
  let testDir: string;
  let logger: Logger;
  
  beforeEach(() => {
    testDir = join(__dirname, '../../tmp/test-local');
    logger = new Logger(false);
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  test('should process markdown files', async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(join(testDir, 'test.md'), `# Test Document

This is a test document with some content.

## Section 1

Some content here.`);

    const config: LocalSourceConfig = {
      type: 'local',
      name: 'test-local',
      path: testDir,
      options: {
        format: 'markdown',
        recursive: true,
      },
    };

    const processor = new LocalProcessor(config, logger);
    const result = await processor.process();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Test Document');
    expect(result.items[0].type).toBe('markdown');
    expect(result.items[0].content).toContain('This is a test document');
  });

  test('should handle empty directory', async () => {
    await fs.ensureDir(testDir);

    const config: LocalSourceConfig = {
      type: 'local',
      name: 'test-empty',
      path: testDir,
    };

    const processor = new LocalProcessor(config, logger);
    const result = await processor.process();

    expect(result.items).toHaveLength(0);
    expect(result.metadata.totalItems).toBe(0);
  });

  test('should throw error for non-existent path', async () => {
    const config: LocalSourceConfig = {
      type: 'local',
      name: 'test-nonexistent',
      path: '/path/that/does/not/exist',
    };

    const processor = new LocalProcessor(config, logger);
    
    await expect(processor.process()).rejects.toThrow('Path does not exist');
  });
});