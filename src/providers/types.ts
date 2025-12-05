import { ProviderConfig } from '../types/lab-spec';
import { RunContext } from '../engine/fsm';

export interface Provider {
  init(config: ProviderConfig, context: RunContext): Promise<void>;
  teardown(context: RunContext): Promise<void>;
}

export interface ProviderFactory {
    createProvider(type: string): Provider;
}
