#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CLIOptions, Config } from './types';
import { McpGenerator } from './generators/mcp-generator';
import { Logger } from './utils/logger';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('mcp-generate')
  .description('Generate production-ready MCP servers from documentation sources')
  .version(packageJson.version);

program
  .option('-s, --source <type>', 'Source type: website, github, local')
  .option('-u, --url <url>', 'Website URL for scraping')
  .option('-r, --repo <owner/repo>', 'GitHub repository')
  .option('-p, --path <path>', 'Local file path')
  .option('-o, --output <dir>', 'Output directory for generated server')
  .option('-c, --config <file>', 'Configuration file path')
  .option('-t, --template <name>', 'Server template to use')
  .option('--include-code', 'Include code examples', false)
  .option('--max-depth <num>', 'Maximum crawling depth', parseInt)
  .option('--filter <pattern>', 'Content filtering pattern')
  .option('--format <type>', 'Output format preferences')
  .option('--verbose', 'Verbose logging', false)
  .option('--dry-run', 'Preview without generation', false);

program.action(async (options: CLIOptions) => {
  const logger = new Logger(options.verbose);
  
  try {
    logger.info(chalk.blue('🚀 MCP Server Generator'));
    logger.info(chalk.gray(`Version ${packageJson.version}\n`));

    // Validate input
    if (!options.config && !options.source) {
      logger.error('Either --config or --source must be specified');
      process.exit(1);
    }

    if (!options.config && !options.output) {
      logger.error('Output directory (--output) is required when not using config file');
      process.exit(1);
    }

    // Load configuration
    let config: Config;
    if (options.config) {
      config = await loadConfig(options.config, logger);
    } else {
      config = await createConfigFromOptions(options, logger);
    }

    // Initialize generator
    const generator = new McpGenerator(config, logger);

    // Generate MCP server
    if (options.dryRun) {
      logger.info(chalk.yellow('🔍 Dry run mode - previewing generation...'));
      await generator.preview();
    } else {
      await generator.generate();
      logger.success(chalk.green('✅ MCP server generated successfully!'));
    }

  } catch (error) {
    logger.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    if (options.verbose && error instanceof Error) {
      logger.error(error.stack || '');
    }
    process.exit(1);
  }
});

async function loadConfig(configPath: string, logger: Logger): Promise<Config> {
  try {
    logger.info(`📁 Loading configuration from ${configPath}`);
    const configData = readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function createConfigFromOptions(options: CLIOptions, logger: Logger): Promise<Config> {
  logger.info('⚙️ Creating configuration from CLI options');
  
  if (!options.source || !options.output) {
    throw new Error('Source type and output directory are required');
  }

  const sourceConfig: any = {
    type: options.source,
    name: `${options.source}-source`,
  };

  switch (options.source) {
    case 'website':
      if (!options.url) {
        throw new Error('URL is required for website source');
      }
      sourceConfig.url = options.url;
      sourceConfig.options = {
        maxDepth: options.maxDepth || 5,
        includeCode: options.includeCode || false,
      };
      break;

    case 'github':
      if (!options.repo) {
        throw new Error('Repository is required for GitHub source');
      }
      sourceConfig.repo = options.repo;
      sourceConfig.options = {
        includeReadme: true,
        includeWiki: false,
      };
      break;

    case 'local':
      if (!options.path) {
        throw new Error('Path is required for local source');
      }
      sourceConfig.path = options.path;
      sourceConfig.options = {
        format: options.format || 'auto',
        recursive: true,
      };
      break;

    default:
      throw new Error(`Unsupported source type: ${options.source}`);
  }

  return {
    sources: [sourceConfig],
    output: {
      directory: options.output,
      template: options.template || 'typescript-standard',
      features: ['search', 'browse', 'retrieve'],
    },
  };
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('❌ Unhandled Rejection:'), reason);
  process.exit(1);
});

program.parse();