import { Provider, ProviderFactory } from './types';
import { GitLabProvider } from './gitlab';

export class Registry implements ProviderFactory {
    createProvider(type: string): Provider {
        switch (type) {
            case 'gitlab':
                return new GitLabProvider();
            default:
                throw new Error(`Unknown provider type: ${type}`);
        }
    }
}

export const providerRegistry = new Registry();
