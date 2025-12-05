export interface LabMetadata {
  id: string;
  slug: string;
  title: string;
  version: string;
  locale: string;
  labels?: Record<string, any>;
  owners: Array<{
    name: string;
    email: string;
    org?: string;
    role?: string;
  }>;
}

export interface ProviderConfig {
  id: string;
  type: string;
  profile?: string;
  config: Record<string, any>;
}

export interface LabTopology {
  providers: ProviderConfig[];
}

export interface LabTask {
  id: string;
  title: string;
  description: string;
  weight?: number;
  checks?: string[];
  depends_on?: string[];
}

export interface AutomaticCheck {
  id: string;
  type: string;
  provider_id: string;
  description?: string;
  config: Record<string, any>;
}

export interface LabScoring {
  total_score: number;
  automatic_checks: AutomaticCheck[];
  pass_criteria?: {
    min_score: number;
  };
}

export interface LabSpec {
  apiVersion: string;
  kind: 'Lab';
  metadata: LabMetadata;
  spec: {
    topology: LabTopology;
    tasks: LabTask[];
    scoring?: LabScoring;
    [key: string]: any; // Allow other flexible fields for now
  };
}
