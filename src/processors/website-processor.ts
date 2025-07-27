import { WebsiteSourceConfig, ProcessedContent, ContentItem } from '../types';
import { Logger } from '../utils/logger';
import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { URL } from 'url';

export class WebsiteProcessor {
  private turndownService = new TurndownService();
  private visitedUrls = new Set<string>();
  private baseUrl: string;

  constructor(
    private config: WebsiteSourceConfig,
    private logger: Logger
  ) {
    this.baseUrl = new URL(config.url).origin;
    
    // Configure turndown to preserve code blocks
    this.turndownService.addRule('codeBlock', {
      filter: ['pre'],
      replacement: function (content) {
        return `\`\`\`\n${content}\n\`\`\``;
      }
    });
  }

  async process(): Promise<ProcessedContent> {
    this.logger.debug(`Starting website crawl from: ${this.config.url}`);
    
    const items: ContentItem[] = [];
    await this.crawlPage(this.config.url, items, 0);

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

  private async crawlPage(url: string, items: ContentItem[], depth: number): Promise<void> {
    const maxDepth = this.config.options?.maxDepth || 5;
    
    if (depth >= maxDepth || this.visitedUrls.has(url)) {
      return;
    }

    this.visitedUrls.add(url);
    this.logger.debug(`Crawling: ${url} (depth: ${depth})`);

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MCP-Generate/1.0.0)',
        },
      });

      const $ = cheerio.load(response.data);
      
      // Extract content using selectors or default
      const contentSelector = this.config.options?.selectors?.content || 'main, .content, article, .documentation';
      const titleSelector = this.config.options?.selectors?.title || 'h1, title';
      
      const title = $(titleSelector).first().text().trim() || 'Untitled';
      const contentElement = $(contentSelector).first();
      
      if (contentElement.length === 0) {
        this.logger.debug(`No content found for ${url}`);
        return;
      }

      // Extract text content and convert to markdown
      const htmlContent = contentElement.html() || '';
      const markdownContent = this.turndownService.turndown(htmlContent);
      
      // Create content item
      const item: ContentItem = {
        id: this.generateId(url),
        title,
        content: markdownContent,
        url,
        path: new URL(url).pathname,
        type: 'webpage',
        source: this.config.name,
        metadata: {
          description: $('meta[name="description"]').attr('content') || '',
          lastModified: new Date(),
          section: this.extractSection(url),
        },
      };

      items.push(item);

      // Find links to crawl if we haven't reached max depth
      if (depth < maxDepth - 1) {
        const links = this.extractLinks($, url);
        for (const link of links) {
          await this.crawlPage(link, items, depth + 1);
        }
      }

    } catch (error) {
      this.logger.debug(`Failed to crawl ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractLinks($: cheerio.CheerioAPI, currentUrl: string): string[] {
    const links: string[] = [];
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, currentUrl).href;
        
        // Only include links from the same domain
        if (absoluteUrl.startsWith(this.baseUrl) && !this.visitedUrls.has(absoluteUrl)) {
          // Exclude certain file types and fragments
          if (!absoluteUrl.match(/\.(pdf|zip|tar|gz|jpg|png|gif|svg)$/i) && 
              !absoluteUrl.includes('#')) {
            links.push(absoluteUrl);
          }
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });

    return [...new Set(links)]; // Remove duplicates
  }

  private generateId(url: string): string {
    return Buffer.from(url).toString('base64').substring(0, 16);
  }

  private extractSection(url: string): string {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(s => s);
    return segments.length > 1 ? segments[segments.length - 2] : 'root';
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