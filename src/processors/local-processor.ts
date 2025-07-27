import { LocalSourceConfig, ProcessedContent, ContentItem } from '../types';
import { Logger } from '../utils/logger';
import { readFileSync, existsSync, statSync } from 'fs';
import { glob } from 'glob';
import { join, relative, basename } from 'path';

export class LocalProcessor {
  constructor(
    private config: LocalSourceConfig,
    private logger: Logger
  ) {}

  async process(): Promise<ProcessedContent> {
    this.logger.debug(`Processing local files from: ${this.config.path}`);
    
    const items: ContentItem[] = [];
    
    if (!existsSync(this.config.path)) {
      throw new Error(`Path does not exist: ${this.config.path}`);
    }

    const stats = statSync(this.config.path);
    
    if (stats.isFile()) {
      await this.processFile(this.config.path, items);
    } else if (stats.isDirectory()) {
      await this.processDirectory(items);
    }

    // Create search index
    const index: any = {};
    for (const item of items) {
      index[item.id] = {
        content: item.content,
        title: item.title,
        keywords: this.extractKeywords(item.content + ' ' + item.title),
      };
    }

    return {
      items,
      index,
      metadata: {
        totalItems: items.length,
        sources: [this.config.name],
        lastProcessed: new Date(),
      },
    };
  }

  private async processDirectory(items: ContentItem[]): Promise<void> {
    const includePatterns = this.config.options?.include || [
      '**/*.md',
      '**/*.txt',
      '**/*.rst',
      '**/*.mdx',
    ];
    
    const excludePatterns = this.config.options?.exclude || [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '**/.DS_Store',
    ];

    for (const pattern of includePatterns) {
      const files = await glob(pattern, {
        cwd: this.config.path,
        ignore: excludePatterns,
      });

      for (const file of files) {
        const fullPath = join(this.config.path, file);
        await this.processFile(fullPath, items, file);
      }
    }
  }

  private async processFile(filePath: string, items: ContentItem[], relativePath?: string): Promise<void> {
    try {
      if (!existsSync(filePath)) return;

      const stats = statSync(filePath);
      if (stats.isDirectory()) return;

      // Skip files that are too large (> 1MB)
      if (stats.size > 1024 * 1024) {
        this.logger.debug(`Skipping large file: ${filePath} (${stats.size} bytes)`);
        return;
      }

      const content = readFileSync(filePath, 'utf8');
      const fileName = basename(filePath);
      const title = this.extractTitleFromContent(content) || fileName;

      const pathForId = relativePath || relative(process.cwd(), filePath);

      const item: ContentItem = {
        id: this.generateId(pathForId),
        title,
        content,
        path: pathForId,
        type: this.getFileType(filePath),
        source: this.config.name,
        metadata: {
          lastModified: stats.mtime,
          section: this.extractSection(pathForId),
        },
      };

      items.push(item);
      this.logger.debug(`Processed file: ${pathForId}`);

    } catch (error) {
      this.logger.debug(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractTitleFromContent(content: string): string | null {
    const format = this.config.options?.format || 'auto';
    
    if (format === 'markdown' || format === 'auto') {
      // Try to extract title from markdown
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
      
      // Try to extract from front matter
      const frontMatterMatch = content.match(/^---\n[\s\S]*?\ntitle:\s*(.+)\n[\s\S]*?\n---/);
      if (frontMatterMatch) {
        return frontMatterMatch[1].trim().replace(/['"]/g, '');
      }
    }
    
    // Try to extract from first line if it looks like a title
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.match(/^[A-Z][^.!?]*$/) && firstLine.length < 100) {
      return firstLine;
    }
    
    return null;
  }

  private getFileType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'md':
      case 'mdx':
        return 'markdown';
      case 'txt':
        return 'text';
      case 'rst':
        return 'restructuredtext';
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        return 'document';
    }
  }

  private extractSection(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length > 1) {
      return parts[parts.length - 2];
    }
    return 'root';
  }

  private generateId(path: string): string {
    return Buffer.from(`local:${path}`).toString('base64').substring(0, 16);
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 20);
  }
}