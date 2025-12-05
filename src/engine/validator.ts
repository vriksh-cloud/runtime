import * as fs from 'fs';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import { LabSpec } from '../types/lab-spec';

// Basic schema definition - can be expanded
const labSchema = {
  type: 'object',
  required: ['apiVersion', 'kind', 'metadata', 'spec'],
  properties: {
    apiVersion: { type: 'string' },
    kind: { const: 'Lab' },
    metadata: {
      type: 'object',
      required: ['id', 'title', 'version'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        version: { type: 'string' },
      },
    },
    spec: {
      type: 'object',
      required: ['topology', 'tasks'],
      properties: {
        topology: {
          type: 'object',
          required: ['providers'],
          properties: {
            providers: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['id', 'type'],
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                },
              },
            },
          },
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'title'],
          },
        },
      },
    },
  },
};

export class LabValidator {
  private ajv: Ajv;
  private validateFn: any;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.validateFn = this.ajv.compile(labSchema);
  }

  loadAndValidate(filePath: string): LabSpec {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let data: any;
    try {
      data = yaml.load(content);
    } catch (e) {
      throw new Error(`Invalid YAML: ${(e as Error).message}`);
    }

    const valid = this.validateFn(data);
    if (!valid) {
      const errors = this.validateFn.errors
        .map((err: any) => `${err.instancePath} ${err.message}`)
        .join('\n');
      throw new Error(`Validation failed:\n${errors}`);
    }

    return data as LabSpec;
  }
}
