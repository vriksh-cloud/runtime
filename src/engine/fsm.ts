import { setup, assign, fromPromise } from 'xstate';
import { LabSpec } from '../types/lab-spec';
import { providerRegistry } from '../providers';
import { stateStore } from '../utils/db';
import { dockerManager } from '../utils/docker';
import { scoringEngine } from './scoring';

export interface RunContext {
  runId: string;
  labSpec?: LabSpec;
  error?: string;
  providers: Map<string, any>;
}

export type RunEvent =
  | { type: 'LOAD_SPEC'; spec: LabSpec }
  | { type: 'VALIDATED' }
  | { type: 'PREPARED' }
  | { type: 'PROVISIONED' }
  | { type: 'INITIALIZED' }
  | { type: 'USER_FINISHED' }
  | { type: 'SCORING_COMPLETE'; score: number }
  | { type: 'TEARDOWN_COMPLETE' }
  | { type: 'ERROR'; message: string };

export const labMachine = setup({
  types: {
    context: {} as RunContext,
    events: {} as RunEvent,
  },
  actions: {
    setError: assign({
        error: ({ event }: { event: any }) => {
            const msg = event.error?.message || event.message || 'Unknown error';
            // We can't easily access runId here if context isn't fully updated, 
            // but the services log errors themselves usually.
            return msg;
        }
    }),
    setSpec: assign({
        labSpec: ({ event }) => {
            if (event.type === 'LOAD_SPEC') return event.spec;
            return undefined;
        }
    }),
    setRunId: assign({
        runId: ({ event }: { event: any }) => event.output.runId
    })
  },
  actors: {
    validateSpec: fromPromise(async () => true),
    prepareRuntime: fromPromise(async ({ input }: { input: { spec: LabSpec } }) => {
      // 1. Check Docker
      const dockerOk = await dockerManager.checkConnection();
      if (!dockerOk) throw new Error('Docker is not available. Please start Docker Daemon.');

      // 2. Generate Run ID
      const runId = `run-${Date.now().toString().slice(-6)}`;
      
      // 3. Persist Run
      stateStore.createRun(runId, input.spec.metadata.id);
      stateStore.logEvent(runId, 'PREPARE', 'Runtime environment checked.');
      
      return { runId };
    }),
    provisionResources: fromPromise(async ({ input }: { input: { context: RunContext } }) => {
      const { context } = input;
      if (!context.labSpec) throw new Error('No Lab Spec found');
      
      stateStore.updateRunStatus(context.runId, 'PROVISIONING');
      
      const providers = context.labSpec.spec.topology.providers;
      for (const pConfig of providers) {
          const provider = providerRegistry.createProvider(pConfig.type);
          await provider.init(pConfig, context);
      }
      
      stateStore.updateRunStatus(context.runId, 'RUNNING');
    }),
    runInitScripts: fromPromise(async ({ input }: { input: { context: RunContext } }) => {
      stateStore.logEvent(input.context.runId, 'INIT', 'Running initialization scripts...');
      await new Promise(r => setTimeout(r, 500));
    }),
    runScoring: fromPromise(async ({ input }: { input: { context: RunContext } }) => {
      stateStore.updateRunStatus(input.context.runId, 'SCORING');
      const score = await scoringEngine.evaluate(input.context.runId);
      return score;
    }),
    teardownResources: fromPromise(async ({ input }: { input: { context: RunContext } }) => {
       const { context } = input;
       stateStore.updateRunStatus(context.runId, 'TEARDOWN');
       
       if (context.labSpec) {
           const providers = context.labSpec.spec.topology.providers;
           for (const pConfig of providers) {
               try {
                   const provider = providerRegistry.createProvider(pConfig.type);
                   await provider.teardown(context);
               } catch (e) {
                   console.error(`Failed to teardown ${pConfig.id}`, e);
               }
           }
       }
       
       // Clean up network
       await dockerManager.removeNetwork(context.runId);
       
       stateStore.updateRunStatus(context.runId, 'COMPLETED');
       stateStore.logEvent(context.runId, 'COMPLETED', 'Lab execution finished.');
    }),
  },
}).createMachine({
  id: 'labRuntime',
  initial: 'parsing',
  context: {
    runId: '',
    providers: new Map(),
  },
  states: {
    parsing: {
      on: {
        LOAD_SPEC: {
          target: 'validation',
          actions: 'setSpec',
        },
        ERROR: 'failed',
      },
    },
    validation: {
      invoke: {
        src: 'validateSpec',
        onDone: { target: 'prepare' },
        onError: { target: 'failed', actions: 'setError' },
      },
    },
    prepare: {
      invoke: {
        src: 'prepareRuntime',
        input: ({ context }) => ({ spec: context.labSpec! }),
        onDone: { 
            target: 'provision',
            actions: 'setRunId'
        },
        onError: { target: 'failed', actions: 'setError' },
      },
    },
    provision: {
      invoke: {
        src: 'provisionResources',
        input: ({ context }) => ({ context }),
        onDone: { target: 'init' },
        onError: { target: 'teardown', actions: 'setError' },
      },
    },
    init: {
      invoke: {
        src: 'runInitScripts',
        input: ({ context }) => ({ context }),
        onDone: { target: 'ready' },
        onError: { target: 'teardown', actions: 'setError' },
      },
    },
    ready: {
      on: {
        USER_FINISHED: 'scoring',
        ERROR: 'teardown',
      },
    },
    scoring: {
      invoke: {
        src: 'runScoring',
        input: ({ context }) => ({ context }),
        onDone: { target: 'teardown' },
        onError: { target: 'teardown', actions: 'setError' },
      },
    },
    teardown: {
      invoke: {
        src: 'teardownResources',
        input: ({ context }) => ({ context }),
        onDone: 'completed',
        onError: 'failed',
      },
    },
    completed: {
      type: 'final',
    },
    failed: {
      type: 'final',
    },
  },
});
