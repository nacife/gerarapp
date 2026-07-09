/**
 * Erro de aplicação mapeável para Problem Details (RFC 9457, Parte 6.B.5).
 * `slug` compõe o campo `type`: https://docs.eduforge.app/errors/<slug>.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly slug: string,
    readonly title: string,
    readonly detail?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(detail ?? title);
    this.name = 'AppError';
  }
}

export const Errors = {
  emailInUse: () =>
    new AppError(409, 'email-in-use', 'E-mail já cadastrado', 'Este e-mail já possui conta.'),

  weakPassword: (errors: string[]) =>
    new AppError(422, 'weak-password', 'Senha fraca', errors.join(' '), { errors }),

  invalidCredentials: (captchaRequired = false) =>
    new AppError(401, 'invalid-credentials', 'Credenciais inválidas', 'E-mail ou senha incorretos.', {
      captchaRequired,
    }),

  accountLocked: (retryAfterSec: number) =>
    new AppError(
      429,
      'account-locked',
      'Conta temporariamente bloqueada',
      'Muitas tentativas. Tente novamente mais tarde.',
      { retryAfterSec },
    ),

  emailNotVerified: () =>
    new AppError(403, 'email-not-verified', 'E-mail não verificado', 'Confirme seu e-mail para continuar.'),

  invalidToken: () =>
    new AppError(400, 'invalid-token', 'Token inválido ou expirado', 'O link não é mais válido.'),

  invalidMfaCode: () =>
    new AppError(401, 'invalid-mfa-code', 'Código MFA inválido', 'O código informado não confere.'),

  mfaSetupRequired: () =>
    new AppError(
      403,
      'mfa-setup-required',
      'MFA obrigatório',
      'Configure a autenticação em duas etapas antes de continuar.',
    ),

  accountSuspended: () =>
    new AppError(403, 'account-suspended', 'Conta suspensa', 'Sua conta está suspensa.'),

  unauthorized: () => new AppError(401, 'unauthorized', 'Não autenticado', 'Autenticação necessária.'),

  forbidden: () =>
    new AppError(403, 'forbidden', 'Acesso negado', 'Você não tem permissão para esta ação.'),

  notFound: (what = 'Recurso') =>
    new AppError(404, 'not-found', `${what} não encontrado`, `${what} não encontrado.`),

  fileTooLarge: () =>
    new AppError(413, 'file-too-large', 'Arquivo muito grande', 'Limite de 200 MB por arquivo.'),

  unsupportedFormat: () =>
    new AppError(
      415,
      'unsupported-format',
      'Formato não suportado',
      'Formatos aceitos: PDF, EPUB, DOCX, Markdown.',
    ),

  mapNotApproved: () =>
    new AppError(
      409,
      'map-not-approved',
      'Mapa não aprovado',
      'Aprove o Mapa de Conteúdo antes de continuar.',
    ),

  conflict: (detail: string) => new AppError(409, 'conflict', 'Conflito', detail),

  insufficientCredits: (balance: number, needed?: number) =>
    new AppError(
      402,
      'insufficient-credits',
      'Créditos de IA insuficientes',
      `Saldo atual: ${balance}.${needed != null ? ` Necessário: ${needed}.` : ''}`,
      { balance, needed },
    ),

  invalidInteraction: (errors: string[]) =>
    new AppError(422, 'invalid-interaction', 'Interação inválida', errors.join(' '), { errors }),

  appLocked: () =>
    new AppError(401, 'app-locked', 'Acesso restrito', 'Este app exige senha ou convite.'),

  notInvited: () =>
    new AppError(403, 'not-invited', 'Convite necessário', 'Seu e-mail não está na lista de convidados.'),

  appNotPublished: () =>
    new AppError(404, 'app-not-published', 'App não publicado', 'Este app ainda não tem versão publicada.'),

  gradingRejected: (reason: string) =>
    new AppError(422, 'grading-rejected', 'Envio inválido', reason),

  idempotencyKeyRequired: () =>
    new AppError(
      400,
      'idempotency-key-required',
      'Idempotency-Key obrigatório',
      'Esta rota exige o cabeçalho Idempotency-Key (Parte 6.B.1).',
    ),

  rateLimitExceeded: (retryAfterSec: number) =>
    new AppError(
      429,
      'rate-limit-exceeded',
      'Limite de requisições excedido',
      `Limite de 120 req/min por chave. Tente novamente em ${retryAfterSec}s.`,
      { retryAfterSec },
    ),

  senseiNotIndexed: () =>
    new AppError(
      409,
      'sensei-not-indexed',
      'Conteúdo não indexado',
      'O conteúdo deste app ainda não foi indexado. Publique o app para habilitar o Sensei.',
    ),
};
