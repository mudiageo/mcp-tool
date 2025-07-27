export interface SourceConfig {
  type: 'website' | 'github' | 'local';
  name: string;
  options?: Record<string, any>;
}

export interface WebsiteSourceConfig extends SourceConfig {
  type: 'website';
  url: string;
  options?: {
    maxDepth?: number;
    includeCode?: boolean;
    selectors?: {
      content?: string;
      navigation?: string;
      title?: string;
    };
    exclude?: string[];
  };
}

export interface GitHubSourceConfig extends SourceConfig {
  type: 'github';
  repo: string; // owner/repo format
  options?: {
    includeReadme?: boolean;
    includeWiki?: boolean;
    includeIssues?: boolean;
    branch?: string;
    token?: string;
    exclude?: string[];
  };
}

export interface LocalSourceConfig extends SourceConfig {
  type: 'local';
  path: string;
  options?: {
    format?: 'markdown' | 'text' | 'auto';
    recursive?: boolean;
    exclude?: string[];
    include?: string[];
  };
}

export interface Config {
  sources: SourceConfig[];
  output: {
    directory: string;
    template?: string;
    features?: string[];
  };
  processing?: {
    maxConcurrency?: number;
    timeout?: number;
  };
}

export interface ContentItem {
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

export interface ProcessedContent {
  items: ContentItem[];
  index: SearchIndex;
  metadata: {
    totalItems: number;
    sources: string[];
    lastProcessed: Date;
  };
}

export interface SearchIndex {
  [key: string]: {
    content: string;
    title: string;
    keywords: string[];
  };
}

export interface CLIOptions {
  source?: 'website' | 'github' | 'local';
  url?: string;
  repo?: string;
  path?: string;
  output?: string;
  config?: string;
  template?: string;
  includeCode?: boolean;
  maxDepth?: number;
  filter?: string;
  format?: string;
  verbose?: boolean;
  dryRun?: boolean;
  run?: boolean;
}