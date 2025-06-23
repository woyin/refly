import { CommunityProviderResponse } from '../components/settings/model-providers/provider-store-types';

// Mock data for community providers - matching real Provider structure
export const mockCommunityProviders: CommunityProviderResponse = {
  providers: [
    {
      id: 'openai-gpt',
      name: 'OpenAI',
      providerKey: 'openai',
      description: {
        en: 'Industry-leading language models including GPT-4, GPT-3.5, and more.',
        'zh-CN': '业界领先的语言模型，包括 GPT-4、GPT-3.5 等。',
      },
      categories: ['llm', 'embedding'],
      pricing: 'paid',
      popularity: 100,
      author: 'OpenAI',
      config: {
        apiKey: {
          required: true,
          placeholder: 'sk-...',
          description: 'Your OpenAI API key',
        },
        baseUrl: {
          required: false,
          defaultValue: 'https://api.openai.com/v1',
          placeholder: 'https://api.openai.com/v1',
        },
      },
      tags: ['official', 'popular'],
    },
    {
      id: 'anthropic-claude',
      name: 'Anthropic',
      providerKey: 'anthropic',
      description: {
        en: 'Advanced AI assistant built by Anthropic. Claude excels at analysis, writing, math, coding, and creative tasks.',
        'zh-CN':
          'Anthropic 开发的先进 AI 助手。Claude 在分析、写作、数学、编程和创意任务方面表现出色。',
      },
      categories: ['llm'],
      pricing: 'paid',
      popularity: 95,
      author: 'Anthropic',
      config: {
        apiKey: {
          required: true,
          placeholder: 'sk-ant-...',
          description: 'Your Anthropic API key',
        },
        baseUrl: {
          required: false,
          defaultValue: 'https://api.anthropic.com',
          placeholder: 'https://api.anthropic.com',
        },
      },
      tags: ['official', 'popular'],
    },
    {
      id: 'google-gemini',
      name: 'Google',
      providerKey: 'google',
      description: {
        en: "Google's most capable AI model with multimodal capabilities.",
        'zh-CN': 'Google 最强大的 AI 模型，具有多模态能力。',
      },
      categories: ['llm'],
      pricing: 'freemium',
      popularity: 90,
      author: 'Google',
      config: {
        apiKey: {
          required: true,
          placeholder: 'AIza...',
          description: 'Your Google AI API key',
        },
        baseUrl: {
          required: false,
          defaultValue: 'https://generativelanguage.googleapis.com/v1beta',
          placeholder: 'https://generativelanguage.googleapis.com/v1beta',
        },
      },
      tags: ['official', 'popular'],
    },
    {
      id: 'azure-openai',
      name: 'Azure OpenAI',
      providerKey: 'azure-openai',
      description: {
        en: 'OpenAI models hosted on Microsoft Azure with enterprise-grade security.',
        'zh-CN': '托管在 Microsoft Azure 上的 OpenAI 模型，具有企业级安全性。',
      },
      categories: ['llm', 'embedding'],
      pricing: 'paid',
      popularity: 85,
      author: 'Microsoft',
      config: {
        apiKey: {
          required: true,
          placeholder: 'your-api-key',
          description: 'Your Azure OpenAI API key',
        },
        baseUrl: {
          required: true,
          placeholder: 'https://your-resource.openai.azure.com',
        },
      },
      tags: ['official'],
    },
    {
      id: 'cohere',
      name: 'Cohere',
      providerKey: 'cohere',
      description: {
        en: 'Enterprise-focused language models with strong multilingual capabilities.',
        'zh-CN': '专注于企业的语言模型，具有强大的多语言能力。',
      },
      categories: ['llm', 'embedding', 'reranker'],
      pricing: 'freemium',
      popularity: 75,
      author: 'Cohere',
      config: {
        apiKey: {
          required: true,
          placeholder: 'your-api-key',
          description: 'Your Cohere API key',
        },
      },
      tags: ['official'],
    },
    {
      id: 'ollama',
      name: 'Ollama',
      providerKey: 'ollama',
      description: {
        en: 'Run large language models locally on your machine.',
        'zh-CN': '在您的机器上本地运行大型语言模型。',
      },
      categories: ['llm', 'embedding', 'reranker'],
      pricing: 'free',
      popularity: 80,
      author: 'Ollama',
      config: {
        apiKey: {
          required: false,
          placeholder: 'optional',
          description: 'API key (optional)',
        },
        baseUrl: {
          required: true,
          defaultValue: 'http://localhost:11434/v1',
          placeholder: 'http://localhost:11434/v1',
        },
      },
      tags: ['popular'],
    },
    {
      id: 'jina',
      name: 'Jina',
      providerKey: 'jina',
      description: {
        en: 'Multimodal AI for search, recommendation, and generative tasks.',
        'zh-CN': '用于搜索、推荐和生成任务的多模态 AI。',
      },
      categories: ['embedding', 'reranker'],
      pricing: 'freemium',
      popularity: 70,
      author: 'Jina AI',
      config: {
        apiKey: {
          required: true,
          placeholder: 'jina_...',
          description: 'Your Jina API key',
        },
      },
      tags: [],
    },
    {
      id: 'fireworks',
      name: 'Fireworks',
      providerKey: 'fireworks',
      description: {
        en: 'Fast inference for open source LLMs and custom models.',
        'zh-CN': '为开源 LLM 和定制模型提供快速推理。',
      },
      categories: ['llm', 'embedding'],
      pricing: 'freemium',
      popularity: 65,
      author: 'Fireworks AI',
      config: {
        apiKey: {
          required: true,
          placeholder: 'fw_...',
          description: 'Your Fireworks API key',
        },
      },
      tags: [],
    },
    {
      id: 'moonshot',
      name: 'Moonshot AI',
      providerKey: 'moonshot',
      description: {
        en: 'Chinese AI company offering advanced language models.',
        'zh-CN': '中国 AI 公司，提供先进的语言模型。',
      },
      categories: ['llm'],
      pricing: 'freemium',
      popularity: 60,
      author: 'Moonshot AI',
      config: {
        apiKey: {
          required: true,
          placeholder: 'sk-...',
          description: 'Your Moonshot API key',
        },
        baseUrl: {
          required: false,
          defaultValue: 'https://api.moonshot.cn/v1',
          placeholder: 'https://api.moonshot.cn/v1',
        },
      },
      tags: [],
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      providerKey: 'deepseek',
      description: {
        en: 'Advanced reasoning models with strong coding capabilities.',
        'zh-CN': '具有强大编程能力的先进推理模型。',
      },
      categories: ['llm'],
      pricing: 'freemium',
      popularity: 70,
      author: 'DeepSeek',
      config: {
        apiKey: {
          required: true,
          placeholder: 'sk-...',
          description: 'Your DeepSeek API key',
        },
        baseUrl: {
          required: false,
          defaultValue: 'https://api.deepseek.com/v1',
          placeholder: 'https://api.deepseek.com/v1',
        },
      },
      tags: ['popular'],
    },
  ],
};
