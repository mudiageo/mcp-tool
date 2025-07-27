import { GitHubSourceConfig, ProcessedContent, ContentItem } from '../types';
import { Logger } from '../utils/logger';
import { simpleGit } from 'simple-git';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import * as fs from 'fs-extra';
import { tmpdir } from 'os';

export class GitHubProcessor {
  private apiBase = 'https://api.github.com';
  private tempDir: string;

  constructor(
    private config: GitHubSourceConfig,
    private logger: Logger
  ) {
    this.tempDir = join(tmpdir(), `mcp-generate-${Date.now()}`);
  }

  async process(): Promise<ProcessedContent> {
    this.logger.debug(`Processing GitHub repository: ${this.config.repo}`);
    
    const items: ContentItem[] = [];
    
    try {
      // Clone repository to temp directory
      await this.cloneRepository();
      
      // Process files
      await this.processFiles(items);
      
      // Process README if requested
      if (this.config.options?.includeReadme !== false) {
        await this.processReadme(items);
      }
      
      // Process wiki if requested
      if (this.config.options?.includeWiki) {
        await this.processWiki(items);
      }

    } finally {
      // Cleanup temp directory
      if (existsSync(this.tempDir)) {
        await fs.remove(this.tempDir);
      }
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

  private async cloneRepository(): Promise<void> {
    this.logger.debug(`Cloning repository to ${this.tempDir}`);
    
    const git = simpleGit();
    const repoUrl = `https://github.com/${this.config.repo}.git`;
    
    const branch = this.config.options?.branch || 'main';
    
    try {
      await git.clone(repoUrl, this.tempDir, ['--depth', '1', '--branch', branch]);
    } catch (error) {
      // Try with 'master' branch if 'main' fails
      if (branch === 'main') {
        await git.clone(repoUrl, this.tempDir, ['--depth', '1', '--branch', 'master']);
      } else {
        throw error;
      }
    }
  }

  private async processFiles(items: ContentItem[]): Promise<void> {
    const patterns = [
      '**/*.md',
      '**/*.txt',
      '**/*.rst',
      '**/docs/**/*',
      '**/documentation/**/*',
    ];

    const exclude = this.config.options?.exclude || [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.tempDir,
        ignore: exclude,
      });

      for (const file of files) {
        await this.processFile(file, items);
      }
    }
  }

  private async processFile(filePath: string, items: ContentItem[]): Promise<void> {
    const fullPath = join(this.tempDir, filePath);
    
    try {
      if (!existsSync(fullPath)) return;

      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) return;

      const content = readFileSync(fullPath, 'utf8');
      const title = this.extractTitleFromContent(content) || filePath;

      const item: ContentItem = {
        id: this.generateId(filePath),
        title,
        content,
        path: filePath,
        type: this.getFileType(filePath),
        source: this.config.name,
        metadata: {
          lastModified: stats.mtime,
          section: this.extractSection(filePath),
        },
      };

      items.push(item);
      this.logger.debug(`Processed file: ${filePath}`);

    } catch (error) {
      this.logger.debug(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processReadme(items: ContentItem[]): Promise<void> {
    const readmeFiles = ['README.md', 'README.txt', 'README.rst', 'readme.md'];
    
    for (const readmeFile of readmeFiles) {
      const readmePath = join(this.tempDir, readmeFile);
      if (existsSync(readmePath)) {
        await this.processFile(readmeFile, items);
        break;
      }
    }
  }

  private async processWiki(items: ContentItem[]): Promise<void> {
    try {
      // GitHub wiki is a separate repository
      const wikiUrl = `https://github.com/${this.config.repo}.wiki.git`;
      const wikiDir = join(this.tempDir, 'wiki');
      
      const git = simpleGit();
      await git.clone(wikiUrl, wikiDir, ['--depth', '1']);
      
      const wikiFiles = await glob('*.md', { cwd: wikiDir });
      
      for (const file of wikiFiles) {
        const fullPath = join(wikiDir, file);
        const content = readFileSync(fullPath, 'utf8');
        const title = this.extractTitleFromContent(content) || file.replace('.md', '');

        const item: ContentItem = {
          id: this.generateId(`wiki/${file}`),
          title,
          content,
          path: `wiki/${file}`,
          type: 'wiki',
          source: this.config.name,
          metadata: {
            section: 'wiki',
          },
        };

        items.push(item);
      }
      
    } catch (error) {
      this.logger.debug(`Failed to process wiki: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractTitleFromContent(content: string): string | null {
    // Try to extract title from markdown
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    
    // Try to extract from front matter
    const frontMatterMatch = content.match(/^---\n[\s\S]*?\ntitle:\s*(.+)\n[\s\S]*?\n---/);
    if (frontMatterMatch) {
      return frontMatterMatch[1].trim();
    }
    
    return null;
  }

  private getFileType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'md':
        return 'markdown';
      case 'txt':
        return 'text';
      case 'rst':
        return 'restructuredtext';
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
    return Buffer.from(`${this.config.repo}:${path}`).toString('base64').substring(0, 16);
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