import OpenAI from 'openai';

export class NebiusClient {
  private static instance: NebiusClient;
  private client: OpenAI | null = null;
  private isConfigured: boolean = false;

  private constructor() {
    const apiKey = process.env.NEBIUS_API_KEY;
    const baseURL = process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.us-central1.nebius.com/v1/';

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL,
      });
      this.isConfigured = true;
    }
  }

  public static getInstance(): NebiusClient {
    if (!NebiusClient.instance) {
      NebiusClient.instance = new NebiusClient();
    }
    return NebiusClient.instance;
  }

  public getClient(): OpenAI | null {
    // Re-check env in case it was updated dynamically
    if (!this.client && process.env.NEBIUS_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.NEBIUS_API_KEY,
        baseURL: process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.us-central1.nebius.com/v1/',
      });
      this.isConfigured = true;
    }
    return this.client;
  }

  public hasApiKey(): boolean {
    return Boolean(process.env.NEBIUS_API_KEY);
  }

  public getUltraModel(): string {
    return process.env.NEBIUS_MODEL_ULTRA || 'nvidia/nemotron-3-super-120b-a12b';
  }

  public getNanoModel(): string {
    return process.env.NEBIUS_MODEL_NANO || 'nvidia/nemotron-3-nano';
  }
}

export const nebiusClient = NebiusClient.getInstance();
