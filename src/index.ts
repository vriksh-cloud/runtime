import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Engine } from './engine';

const program = new Command();
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const engine = new Engine();

program
  .name('vriksh')
  .description('Vriksh Cloud - Self-Hosted Node CLI')
  .version(packageJson.version);

program
  .command('run')
  .description('Execute a lab end-to-end locally')
  .argument('<lab-file>', 'Path to lab.yml')
  .action(async (labFile) => {
    console.log(chalk.blue(`Starting lab execution for: ${labFile}`));
    await engine.execute(labFile);
  });

program
  .command('validate')
  .description('Validate Lab YAML against v2 schema')
  .argument('<lab-file>', 'Path to lab.yml')
  .action(async (labFile) => {
    await engine.validate(labFile);
  });

program
  .command('logs')
  .description('Show or tail logs for the last run')
  .action(() => {
    console.log('Fetching logs...');
    // TODO: Implement Engine.logs
  });

program
  .command('teardown')
  .description('Destroy resources for the last (or specified) run')
  .option('-i, --id <run-id>', 'Specific run ID')
  .action((options) => {
    console.log(chalk.red('Tearing down resources...'));
    // TODO: Implement Engine.teardown
  });

program.parse();
