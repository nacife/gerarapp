import type { AiProvider } from './provider';
import { MockAiProvider } from './mock';
import { AnthropicAiProvider } from './anthropic';
import { OpenAiProvider } from './openai';
import { DeepSeekProvider } from './deepseek';
import { MultiProvider } from './multi';

export interface ProviderEntry {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'mock';
  apiKey?: string;
  model?: string;
}

export interface AiProviderConfig {
  /** Lista de providers na ordem de fallback. Ex: ['anthropic', 'deepseek', 'openai'] */
  providers?: ProviderEntry[];
  /** Fallback final: se true, MockAiProvider é usado quando todos falham */
  mockFallback?: boolean;
  // ─────── Legacy (compatibilidade) ───────
  provider?: 'mock' | 'anthropic';
  apiKey?: string;
  models?: { structure?: string; interactions?: string; tutor?: string };
}

function createSingle(config: ProviderEntry): AiProvider {
  switch (config.provider) {
    case 'mock': return new MockAiProvider();
    case 'anthropic':
      if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY é obrigatória');
      return new AnthropicAiProvider(config.apiKey, config.model ?? 'claude-sonnet-4-6');
    case 'openai':
      if (!config.apiKey) throw new Error('OPENAI_API_KEY é obrigatória');
      return new OpenAiProvider(config.apiKey, config.model ?? 'gpt-4o');
    case 'deepseek':
      if (!config.apiKey) throw new Error('DEEPSEEK_API_KEY é obrigatória');
      return new DeepSeekProvider(config.apiKey, config.model ?? 'deepseek-chat');
    default:
      throw new Error(`Provider desconhecido: ${(config as any).provider}`);
  }
}

/**
 * Fábrica de `AiProvider` com suporte a multi-provider e fallback.
 *
 * Modo simples (legacy):
 *   createAiProvider({ provider: 'mock' })
 *   createAiProvider({ provider: 'anthropic', apiKey: '...' })
 *
 * Modo multi-provider com fallback:
 *   createAiProvider({
 *     providers: [
 *       { provider: 'anthropic', apiKey: '...' },
 *       { provider: 'deepseek', apiKey: '...' },
 *       { provider: 'openai', apiKey: '...' },
 *     ],
 *     mockFallback: true,
 *   })
 */
export function createAiProvider(config: AiProviderConfig): AiProvider {
  // Modo multi-provider
  if (config.providers && config.providers.length > 0) {
    const providers = config.providers.map(p => createSingle(p));
    const mock = config.mockFallback !== false ? new MockAiProvider() : null;
    return new MultiProvider(providers, mock);
  }

  // Modo legacy (single provider)
  return createSingle({
    provider: config.provider ?? 'mock',
    apiKey: config.apiKey,
  });
}
