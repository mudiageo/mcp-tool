import chalk from 'chalk';

export class Logger {
  constructor(private verbose: boolean = false) {}

  info(message: string): void {
    console.log(message);
  }

  success(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }

  warn(message: string): void {
    console.warn(chalk.yellow(message));
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  progress(message: string): void {
    console.log(chalk.blue(`⏳ ${message}`));
  }
}