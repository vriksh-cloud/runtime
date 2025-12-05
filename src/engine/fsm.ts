import { setup, assign, fromPromise } from 'xstate';
import { LabSpec } from '../types/lab-spec';
import { providerRegistry } from '../providers';

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
            return event.error?.message || event.message || 'Unknown error';
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
    prepareRuntime: fromPromise(async () => {
      console.log('Checking Docker availability...');
      // Generate Run ID
      const runId = `run-${Math.floor(Math.random() * 10000)}`;
      return { runId };
    }),
    provisionResources: fromPromise(async ({ input }: { input: { context: RunContext } }) => {
      const { context } = input;
      if (!context.labSpec) throw new Error('No Lab Spec found');
      
      console.log(`Provisioning for Run ID: ${context.runId}`);
      
      const providers = context.labSpec.spec.topology.providers;
      for (const pConfig of providers) {
          const provider = providerRegistry.createProvider(pConfig.type);
          await provider.init(pConfig, context);
      }
    }),
    runInitScripts: fromPromise(async () => {
      console.log('Running init scripts...');
      await new Promise(r => setTimeout(r, 500));
    }),
    runScoring: fromPromise(async () => {
      console.log('Scoring...');
      await new Promise(r => setTimeout(r, 800));
    }),
    teardownResources: fromPromise(async ({ input }: { input: { context: RunContext } }) => {
      const { context } = input;
       if (!context.labSpec) return; // Nothing to teardown
       
       const providers = context.labSpec.spec.topology.providers;
       // Teardown in reverse order might be better, but simple loop for now
       for (const pConfig of providers) {
           try {
               const provider = providerRegistry.createProvider(pConfig.type);
               await provider.teardown(context);
           } catch (e) {
               console.error(`Failed to teardown ${pConfig.id}`, e);
           }
       }
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