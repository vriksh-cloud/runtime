import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Engine } from './engine';
import { stateStore } from './utils/db';
import { dockerManager } from './utils/docker';

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
  .description('Show logs for the last run')
  .action(() => {
    const lastRun = stateStore.getLastRun() as any;
    if (!lastRun) {
        console.log(chalk.yellow('No runs found.'));
        return;
    }
    console.log(chalk.blue(`Logs for Run ID: ${lastRun.id} (${lastRun.status})`));
    
    const events = stateStore.getEvents(lastRun.id);
    events.forEach((e: any) => {
        console.log(`[${e.timestamp}] [${e.type}] ${e.message}`);
    });
  });

program
  .command('teardown')
  .description('Destroy resources for the last run')
  .option('-i, --id <run-id>', 'Specific run ID')
  .action(async (options) => {
    const lastRun = stateStore.getLastRun() as any;
    const runId = options.id || lastRun?.id;
    
    if (!runId) {
        console.log(chalk.yellow('No active run found to teardown.'));
        return;
    }

    console.log(chalk.red(`Tearing down Run ID: ${runId}...`));
    
    // We need to reconstruct the teardown logic without the FSM if possible,
    // or just manually kill the resources found in the DB.
    
    const providers = stateStore.getProviders(runId);
    for (const p of providers) {
        if (p.resource_id) {
            console.log(`Stopping ${p.type} container ${p.resource_id}...`);
            await dockerManager.stopContainer(p.resource_id);
        }
    }
    
    await dockerManager.removeNetwork(runId);
    stateStore.updateRunStatus(runId, 'TEARDOWN_FORCED');
    console.log(chalk.green('Teardown complete.'));
  });

program.parse();