import type { AiProvider } from './provider';
import { MockAiProvider } from './mock';
import { AnthropicAiProvider } from './anthropic';

export interface AiProviderConfig {
  provider: 'mock' | 'anthropic';
  apiKey?: string;
  models?: { structure?: string; interactions?: string; tutor?: string };
}

/**
 * Fábrica única de `AiProvider` (PRD §0.2).
 * - `mock`: respostas determinísticas para dev/testes.
 * - `anthropic`: API Anthropic real para tarefas textuais; embedding/TTS/ilustração usam mock.
 */
export function createAiProvider(config: AiProviderConfig): AiProvider {
  switch (config.provider) {
    case 'mock':
      return new MockAiProvider();
    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('ANTHROPIC_API_KEY é obrigatória quando AI_PROVIDER=anthropic');
      }
      return new AnthropicAiProvider(config.apiKey, config.models?.tutor ?? 'claude-sonnet-4-6');
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`AiProvider desconhecido: ${String(exhaustive)}`);
    }
  }
}
