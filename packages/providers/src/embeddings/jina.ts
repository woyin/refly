import { Embeddings } from '@langchain/core/embeddings';

export interface JinaEmbeddingsConfig {
  model: string;
  batchSize: number;
  maxRetries: number;
  dimensions: number;
  apiKey: string;
}

// Utility function to split text by maximum length
function splitTextByLength(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

// Utility function to average embeddings
function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('No embeddings to average');
  }

  const embeddingLength = embeddings[0].length;
  const averaged = new Array(embeddingLength).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < embeddingLength; i++) {
      averaged[i] += embedding[i] / embeddings.length;
    }
  }

  return averaged;
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
    const maxLength = 2048;
    const results: number[][] = [];

    for (const document of documents) {
      if (document.length <= maxLength) {
        // Document is within limit, process directly
        const body = await this.fetch([document]);
        results.push(body.data[0].embedding);
      } else {
        // Document exceeds limit, split into chunks and process sequentially
        const chunks = splitTextByLength(document, maxLength);
        const chunkEmbeddings: number[][] = [];

        for (const chunk of chunks) {
          const body = await this.fetch([chunk]);
          chunkEmbeddings.push(body.data[0].embedding);
        }

        // Average all chunk embeddings to represent the document
        const averagedEmbedding = averageEmbeddings(chunkEmbeddings);
        results.push(averagedEmbedding);
      }
    }

    return results;
  }

  async embedQuery(query: string): Promise<number[]> {
    const maxLength = 2048;

    if (query.length <= maxLength) {
      // Query is within limit, process directly
      const body = await this.fetch([query]);
      if (body.data.length === 0) {
        throw new Error('No embedding returned');
      }
      return body.data[0].embedding;
    } else {
      // Query exceeds limit, split into chunks and process sequentially
      const chunks = splitTextByLength(query, maxLength);
      const chunkEmbeddings: number[][] = [];

      for (const chunk of chunks) {
        const body = await this.fetch([chunk]);
        chunkEmbeddings.push(body.data[0].embedding);
      }

      // Average all chunk embeddings to represent the query
      return averageEmbeddings(chunkEmbeddings);
    }
  }
}
