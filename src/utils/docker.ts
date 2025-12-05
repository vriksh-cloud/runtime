import Docker from 'dockerode';
import winston from 'winston';

export class DockerManager {
  private docker: Docker;
  private logger: winston.Logger;

  constructor() {
    this.docker = new Docker();
    this.logger = winston.createLogger({
        transports: [
            new winston.transports.Console({ format: winston.format.simple() })
        ]
    });
  }

  async checkConnection(): Promise<boolean> {
      try {
          await this.docker.ping();
          return true;
      } catch (e) {
          return false;
      }
  }

  async createNetwork(runId: string): Promise<string> {
    const networkName = `vriksh-net-${runId}`;
    try {
        // Idempotency: Check if exists
        const nets = await this.docker.listNetworks({ filters: { name: [networkName] } });
        if (nets.length > 0) return nets[0].Id;

        const network = await this.docker.createNetwork({
            Name: networkName,
            Driver: 'bridge'
        });
        return network.id;
    } catch (error) {
        throw new Error(`Failed to create network: ${(error as Error).message}`);
    }
  }

  async removeNetwork(runId: string): Promise<void> {
      const networkName = `vriksh-net-${runId}`;
      try {
          const nets = await this.docker.listNetworks({ filters: { name: [networkName] } });
          if (nets.length > 0) {
              const network = this.docker.getNetwork(nets[0].Id);
              await network.remove();
          }
      } catch (e) {
          console.warn(`Warning: Could not remove network ${networkName}`);
      }
  }

  async runContainer(
      runId: string, 
      image: string, 
      name: string, 
      env: string[] = [], 
      ports: Record<string, string> = {} // host:container
  ): Promise<{ containerId: string; portMappings: any }> {
      const containerName = `vriksh-${runId}-${name}`;
      const networkName = `vriksh-net-${runId}`;

      // Pull image (basic implementation)
      // Note: In a real CLI we'd stream the pull output to the user.
      // For now, we assume image might exist or we auto-pull silently (Docker default behavior requires explicit pull usually).
      
      try {
        await this.ensureImage(image);
        
        const exposedPorts: any = {};
        const portBindings: any = {};
        
        // Map ports
        for (const [hostPort, containerPort] of Object.entries(ports)) {
            exposedPorts[`${containerPort}/tcp`] = {};
            portBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
        }

        const container = await this.docker.createContainer({
            Image: image,
            name: containerName,
            Env: env,
            ExposedPorts: exposedPorts,
            HostConfig: {
                PortBindings: portBindings,
                NetworkMode: networkName,
                AutoRemove: true // Clean up easily for now, though we might want to keep for logs
            }
        });

        await container.start();
        return { containerId: container.id, portMappings: ports };

      } catch (error) {
          throw new Error(`Failed to start container ${name}: ${(error as Error).message}`);
      }
  }

  private async ensureImage(image: string): Promise<void> {
      // Check if image exists locally
      try {
          const imageObj = this.docker.getImage(image);
          await imageObj.inspect();
      } catch (e) {
          // Pull if not exists
          console.log(`Pulling image ${image}... (this may take a while)`);
          await new Promise((resolve, reject) => {
              this.docker.pull(image, (err: any, stream: any) => {
                  if (err) return reject(err);
                  this.docker.modem.followProgress(stream, onFinished, onProgress);

                  function onFinished(err: any, output: any) {
                      if (err) return reject(err);
                      resolve(output);
                  }
                  function onProgress(event: any) {
                      // Optional: console.log(event.status);
                  }
              });
          });
      }
  }

  async stopContainer(containerId: string): Promise<void> {
      try {
          const container = this.docker.getContainer(containerId);
          await container.stop();
          // AutoRemove is set, so we don't strictly need to remove, but safe to try/catch
          try { await container.remove(); } catch {}
      } catch (e) {
          // Ignore if already stopped/removed
      }
  }
}

export const dockerManager = new DockerManager();
