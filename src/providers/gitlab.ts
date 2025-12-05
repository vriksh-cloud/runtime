import { ProviderConfig } from '../types/lab-spec';
import { RunContext } from '../engine/fsm';
import { dockerManager } from '../utils/docker';
import { stateStore } from '../utils/db';

export class GitLabProvider {
  async init(config: ProviderConfig, context: RunContext): Promise<void> {
    const { runId } = context;
    const providerId = config.id;
    
    // 1. Ensure Network Exists (Idempotent in DockerManager)
    await dockerManager.createNetwork(runId);

    // 2. Prepare Config
    const image = config.config.image || 'gitlab/gitlab-ee:latest';
    // Using a lighter image for demonstration if the user didn't strictly lock it, 
    // but the spec says "gitlab/gitlab-ee". 
    // We will stick to the requested image but map ports.
    
    // In a real local setup, 80 and 443 conflicts are common.
    // We need dynamic port allocation or fixed from spec.
    // Spec implies "http://localhost:8923", so we map to that.
    
    const ports = {
        '8923': '80', // Map host 8923 to container 80
        '2222': '22'
    };

    const env = [
        'GITLAB_OMNIBUS_CONFIG=external_url "http://localhost:8923"; gitlab_rails["initial_root_password"] = "vriksh123";'
    ];

    console.log(`[GitLab] Starting container (Image: ${image})...`);
    stateStore.logEvent(runId, 'PROVIDER_INIT', `Starting GitLab container ${providerId}`);

    const { containerId, portMappings } = await dockerManager.runContainer(
        runId, 
        image, 
        providerId, 
        env, 
        ports
    );

    // 3. Update State
    const metadata = {
        url: 'http://localhost:8923',
        username: 'root',
        password: 'vriksh123', // Hardcoded for this demo based on env
        containerId,
        portMappings
    };

    context.providers.set(providerId, metadata);
    stateStore.addProvider(runId, providerId, 'gitlab', containerId, metadata);
    stateStore.logEvent(runId, 'PROVIDER_READY', `GitLab ready at ${metadata.url}`);
  }

  async teardown(context: RunContext): Promise<void> {
      // Find provider info
      // In a fresh run, context has it. 
      // If we are running "teardown" command separately, we rely on DB.
      // Here we assume context is populated or we look up by runId.
      
      const providers = stateStore.getProviders(context.runId);
      const gitlabProvider = providers.find(p => p.type === 'gitlab');

      if (gitlabProvider && gitlabProvider.resource_id) {
          console.log(`[GitLab] Stopping container ${gitlabProvider.resource_id}...`);
          await dockerManager.stopContainer(gitlabProvider.resource_id);
      }
  }
}