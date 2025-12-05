import { LabValidator } from './validator';
import { createActor } from 'xstate';
import { labMachine } from './fsm';
import chalk from 'chalk';
import ora from 'ora';

export class Engine {
  private validator: LabValidator;

  constructor() {
    this.validator = new LabValidator();
  }

  async validate(filePath: string): Promise<boolean> {
    try {
      console.log(chalk.blue('Reading and validating spec...'));
      const spec = this.validator.loadAndValidate(filePath);
      console.log(chalk.green(`\u2714 Valid Lab Spec: ${spec.metadata.title} (${spec.metadata.version})`));
      return true;
    } catch (error) {
      console.error(chalk.red(`\u2718 Validation Error: ${(error as Error).message}`));
      return false;
    }
  }

  async execute(filePath: string): Promise<void> {
    // 1. Validate first
    let spec;
    try {
      spec = this.validator.loadAndValidate(filePath);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }

    console.log(chalk.blue(`Initializing Lab: ${spec.metadata.title}`));

    // 2. Start FSM
    const actor = createActor(labMachine);

    // 3. UI / Logging
    const spinner = ora('Starting engine...').start();

    actor.subscribe((snapshot) => {
      const state = snapshot.value;
      const context = snapshot.context;
      
      if (snapshot.status === 'done') {
        spinner.succeed('Lab workflow finished.');
        return;
      }
      
      if (context.error) {
        spinner.fail(`Error: ${context.error}`);
        process.exit(1);
      }

      switch (state) {
        case 'parsing':
          spinner.text = 'Parsing spec...';
          break;
        case 'validation':
          spinner.text = 'Validating logic...';
          break;
        case 'prepare':
          spinner.text = 'Preparing runtime environment...';
          break;
        case 'provision':
          spinner.text = 'Provisioning resources (Docker)...';
          break;
        case 'init':
          spinner.text = 'Running initialization scripts...';
          break;
        case 'ready':
          spinner.succeed('Lab is READY!');
          console.log(chalk.green('\nAccess your lab environments:'));
          console.log('  - GitLab: http://localhost:8923 (User: root / Pass: vriksh123)'); // Stub
          console.log(chalk.gray('\nPress Enter to finish the lab and run scoring...'));
          
          // Pause spinner to wait for user input
          // In a real CLI, we'd hook stdin here. 
          // For this MVP, we'll just simulate a user wait or auto-proceed after a timeout for testing.
          
          // Simulating user interaction for now:
          setTimeout(() => {
             actor.send({ type: 'USER_FINISHED' });
          }, 3000); 
          break;
        case 'scoring':
          spinner.start('Running scoring checks...');
          break;
        case 'teardown':
          spinner.text = 'Tearing down resources...';
          break;
      }
    });

    actor.start();
    actor.send({ type: 'LOAD_SPEC', spec });

    // Keep process alive until done
    return new Promise((resolve) => {
      actor.subscribe((snapshot) => {
        if (snapshot.status === 'done') {
            resolve();
        }
      });
    });
  }
}