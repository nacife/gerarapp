import { createAiProvider, type AiProvider, type ProviderEntry } from '@eduforge/ai';
import { getEnv } from '@eduforge/config';

/**
 * Cria a instância de `AiProvider` configurada para o ambiente atual.
 * Suporta fallback inteligente multi-provider, provedores individuais (Anthropic, OpenAI, DeepSeek) e Mock.
 */
export function createAppAiProvider(): AiProvider {
  const env = getEnv();

  if (env.AI_PROVIDER === 'multi') {
    const providers: ProviderEntry[] = [];
    if (env.ANTHROPIC_API_KEY) {
      providers.push({ provider: 'anthropic', apiKey: env.ANTHROPIC_API_KEY });
    }
    if (env.DEEPSEEK_API_KEY) {
      providers.push({ provider: 'deepseek', apiKey: env.DEEPSEEK_API_KEY });
    }
    if (env.OPENAI_API_KEY) {
      providers.push({ provider: 'openai', apiKey: env.OPENAI_API_KEY });
    }
    if (providers.length === 0) {
      providers.push({ provider: 'mock' });
    }
    return createAiProvider({
      providers,
      mockFallback: env.AI_FALLBACK_TO_MOCK,
    });
  }

  if (env.AI_PROVIDER === 'openai') {
    return createAiProvider({
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
    });
  }

  if (env.AI_PROVIDER === 'deepseek') {
    return createAiProvider({
      provider: 'deepseek',
      apiKey: env.DEEPSEEK_API_KEY,
    });
  }

  if (env.AI_PROVIDER === 'anthropic') {
    return createAiProvider({
      provider: 'anthropic',
      apiKey: env.ANTHROPIC_API_KEY,
      models: {
        structure: env.AI_MODEL_STRUCTURE,
        interactions: env.AI_MODEL_INTERACTIONS,
      },
    });
  }

  return createAiProvider({ provider: 'mock' });
}
