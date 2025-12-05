import { stateStore } from '../utils/db';
import axios from 'axios';

export interface CheckResult {
    passed: boolean;
    score: number;
    details: string;
}

export class ScoringEngine {
    async evaluate(runId: string): Promise<number> {
        const providers = stateStore.getProviders(runId);
        const gitlab = providers.find(p => p.type === 'gitlab');
        
        if (!gitlab) {
            stateStore.logEvent(runId, 'SCORING_ERROR', 'No GitLab provider found to score');
            return 0;
        }

        // Hardcoded check logic for "gitlab-ci-basics" lab
        // In a real generic engine, this would be a Strategy pattern dispatching by check ID.
        
        let score = 0;
        const totalPossible = 100;
        
        console.log('  > Checking connectivity to GitLab...');
        const alive = await this.checkGitLabAlive(gitlab.metadata.url);
        if (alive) {
            console.log('  \u2714 GitLab is reachable (+10)');
            score += 10;
        } else {
            console.log('  \u2718 GitLab is unreachable');
            return 0; // Can't score the rest
        }

        // For the sake of this CLI demo, we can't easily script a full Selenium user flow 
        // inside the "provider" without more dependencies. 
        // We will simulate the "Check Pipeline Success" by querying the API.
        
        // Simulating the API check:
        // We would call: GET /api/v4/projects/ci-demo/pipelines
        
        // Since we didn't actually CREATE the "ci-demo" project in init (we just booted GitLab), 
        // this check would fail in reality unless we seed data.
        // For the "Real Features" request, I will implement the HTTP call, but gracefully handle 404.

        console.log('  > Verifying pipeline status...');
        const pipelineStatus = await this.checkPipeline(gitlab.metadata.url, gitlab.metadata.metadata?.token || 'private-token');
        if (pipelineStatus) {
            score += 90;
            console.log('  \u2714 Pipeline Success (+90)');
        } else {
            console.log('  \u26A0 Pipeline not found (Expected in empty env)');
            // For demo purposes, we don't want to always fail the user if they didn't manually do the work yet.
            // But strict scoring means 0.
        }

        stateStore.logEvent(runId, 'SCORING_COMPLETE', `Final Score: ${score}`);
        return score;
    }

    private async checkGitLabAlive(url: string): Promise<boolean> {
        try {
            await axios.get(`${url}/users/sign_in`, { timeout: 2000 });
            return true;
        } catch (e) {
            return false;
        }
    }

    private async checkPipeline(baseUrl: string, token: string): Promise<boolean> {
        // Implementation of a real check
        // url: http://localhost:8923/api/v4/projects/root%2Fci-demo/pipelines
        try {
            const res = await axios.get(`${baseUrl}/api/v4/projects/root%2Fci-demo/pipelines`, {
                headers: { 'PRIVATE-TOKEN': token },
                timeout: 3000,
                validateStatus: () => true // don't throw on 404
            });
            
            const data = res.data as any;
            if (res.status === 200 && Array.isArray(data) && data.length > 0 && data[0].status === 'success') {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }
}

export const scoringEngine = new ScoringEngine();
