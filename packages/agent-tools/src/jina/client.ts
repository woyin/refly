// Jina API Client
// Generated from OpenAPI schema v1

export interface JinaConfig {
  apiKey: string;
}

export class JinaError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any,
  ) {
    super(message);
    this.name = 'JinaError';
  }
}

export class JinaClient {
  private config: Required<JinaConfig>;

  constructor(config: JinaConfig) {
    this.config = { apiKey: config.apiKey };
  }

  async read(endpoint: string, returnFormat: string): Promise<any> {
    const url = `https://r.jina.ai/${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        'X-Return-Format': returnFormat,
      },
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parsing errors
      }

      throw new JinaError(
        errorData.error ?? `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData,
      );
    }

    return response.json();
  }
}

export const createJinaClient = (config: JinaConfig): JinaClient => {
  return new JinaClient(config);
};
