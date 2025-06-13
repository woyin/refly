import { Embeddings } from '@langchain/core/embeddings';

export interface JinaEmbeddingsConfig {
  model: string;
  batchSize: number;
  maxRetries: number;
  dimensions: number;
  apiKey: string;
}

export class JinaEmbeddings extends Embeddings {
  private config: JinaEmbeddingsConfig;

  constructor(config: JinaEmbeddingsConfig) {
    super(config);
    this.config = config;
  }

  private async fetch(input: string[]) {
    const payload = {
      model: this.config.model,
      task: 'retrieval.passage',
      dimensions: this.config.dimensions,
      late_chunking: false,
      input,
    };

    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
      throw new Error(
        `call embeddings failed: ${response.status} ${response.statusText} ${response.text}`,
      );
    }

    const data = await response.json();

    return data;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const maxLen = 2048;
    const results: number[][] = [];

    for (const doc of documents) {
      if (doc.length <= maxLen) {
        // no split
        const body = await this.fetch([doc]);
        results.push(body.data[0].embedding);
      } else {
        // split by max length
        const chunks = splitByMaxLength(doc, maxLen);
        const body = await this.fetch(chunks);
        // merge all chunks embedding (use average)
        const embeddings = body.data.map((point: { embedding: number[] }) => point.embedding);
        const merged = embeddings[0].map(
          (_, i) => embeddings.reduce((sum, emb) => sum + emb[i], 0) / embeddings.length,
        );
        results.push(merged);
      }
    }
    return results;
  }

  async embedQuery(query: string): Promise<number[]> {
    const maxLen = 2048;
    if (query.length <= maxLen) {
      const body = await this.fetch([query]);
      if (body.data.length === 0) {
        throw new Error('No embedding returned');
      }
      return body.data[0].embedding;
    } else {
      const chunks = splitByMaxLength(query, maxLen);
      const body = await this.fetch(chunks);
      const embeddings = body.data.map((point: { embedding: number[] }) => point.embedding);
      // merge all chunks embedding (use average)
      return embeddings[0].map(
        (_, i) => embeddings.reduce((sum, emb) => sum + emb[i], 0) / embeddings.length,
      );
    }
  }
}

function splitByMaxLength(text: string, maxLen: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    result.push(text.slice(i, i + maxLen));
  }
  return result;
}
