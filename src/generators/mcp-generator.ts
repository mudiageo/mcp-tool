import { Config, ProcessedContent } from '../types';
import { Logger } from '../utils/logger';
import { WebsiteProcessor } from '../processors/website-processor';
import { GitHubProcessor } from '../processors/github-processor';
import { LocalProcessor } from '../processors/local-processor';
import { ServerGenerator } from './server-generator';
import { InMemoryMcpServer } from './in-memory-server';
import ora from 'ora';
import chalk from 'chalk';

export class McpGenerator {
  constructor(
    private config: Config,
    private logger: Logger
  ) {}

  async generate(): Promise<void> {
    this.logger.info(chalk.blue('📋 Processing sources...'));
    
    const processedContent = await this.processAllSources();
    
    this.logger.info(chalk.blue('🏗️ Generating MCP server...'));
    
    const serverGenerator = new ServerGenerator(this.config, this.logger);
    await serverGenerator.generate(processedContent);
  }

  async preview(): Promise<void> {
    this.logger.info(chalk.yellow('📋 Analyzing sources...'));
    
    for (const source of this.config.sources) {
      this.logger.info(chalk.gray(`  - ${source.type}: ${source.name}`));
      
      switch (source.type) {
        case 'website':
          this.logger.info(chalk.gray(`    URL: ${(source as any).url}`));
          break;
        case 'github':
          this.logger.info(chalk.gray(`    Repository: ${(source as any).repo}`));
          break;
        case 'local':
          this.logger.info(chalk.gray(`    Path: ${(source as any).path}`));
          break;
      }
    }
    
    this.logger.info(chalk.yellow(`\n🏗️ Would generate server to: ${this.config.output.directory}`));
    this.logger.info(chalk.gray(`Template: ${this.config.output.template || 'typescript-standard'}`));
    this.logger.info(chalk.gray(`Features: ${this.config.output.features?.join(', ') || 'search, browse, retrieve'}`));
  }

  private async processAllSources(): Promise<ProcessedContent> {
    const allItems: any[] = [];
    const sources: string[] = [];

    for (const source of this.config.sources) {
      const spinner = ora(`Processing ${source.type} source: ${source.name}`).start();
      
      try {
        let processor;
        
        switch (source.type) {
          case 'website':
            processor = new WebsiteProcessor(source as any, this.logger);
            break;
          case 'github':
            processor = new GitHubProcessor(source as any, this.logger);
            break;
          case 'local':
            processor = new LocalProcessor(source as any, this.logger);
            break;
          default:
            throw new Error(`Unsupported source type: ${source.type}`);
        }

        const result = await processor.process();
        allItems.push(...result.items);
        sources.push(source.name);
        
        spinner.succeed(`Processed ${result.items.length} items from ${source.name}`);
      } catch (error) {
        spinner.fail(`Failed to process ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }

    // Create search index
    const index: any = {};
    for (const item of allItems) {
      index[item.id] = {
        content: item.content,
        title: item.title,
        keywords: this.extractKeywords(item.content + ' ' + item.title),
      };
    }

    return {
      items: allItems,
      index,
      metadata: {
        totalItems: allItems.length,
        sources,
        lastProcessed: new Date(),
      },
    };
  }

  async run(): Promise<void> {
    this.logger.info(chalk.blue('📋 Processing sources for direct execution...'));
    
    const processedContent = await this.processAllSources();
    
    this.logger.info(chalk.blue('🏃 Starting MCP server directly...'));
    
    const serverName = this.config.sources.length === 1 
      ? `${this.config.sources[0].name}-server`
      : 'multi-source-server';
    
    const server = new InMemoryMcpServer(serverName, processedContent, this.logger);
    await server.run();
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - split by spaces and filter
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 20); // Limit to 20 keywords
  }
}