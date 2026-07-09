import { Errors } from '../common/errors';
import type { PasswordHasher } from '../auth/domain/password-hasher';
import { validatePasswordStrength } from '../auth/domain/password-policy';
import type { LearnerTokenService } from './domain/learner-token';
import type { LearnerRepository } from './ports';

export interface LearnerSession {
  learnerId: string;
  accessToken: string;
}

export interface PublicLearner {
  id: string;
  email: string;
  name: string;
}

/**
 * Autenticação "conta leve" do aprendiz (RF-04/RF-05): sem MFA, sem
 * verificação de e-mail obrigatória, sem refresh rotativo — ADR-0036.
 */
export class LearnerAuthService {
  constructor(
    private readonly learners: LearnerRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: LearnerTokenService,
  ) {}

  /** Cadastra; se o e-mail já existir com a mesma senha, apenas autentica (reduz fricção). */
  async signup(input: { email: string; name: string; password: string }): Promise<LearnerSession> {
    const policy = validatePasswordStrength(input.password);
    if (!policy.ok) throw Errors.weakPassword(policy.errors);

    const email = input.email.toLowerCase();
    const existing = await this.learners.findByEmail(email);
    if (existing) {
      const matches =
        existing.passwordHash != null && (await this.hasher.verify(existing.passwordHash, input.password));
      if (matches) return { learnerId: existing.id, accessToken: this.tokens.sign(existing.id) };
      throw Errors.emailInUse();
    }

    const passwordHash = await this.hasher.hash(input.password);
    const learner = await this.learners.create({ email, name: input.name, passwordHash });
    return { learnerId: learner.id, accessToken: this.tokens.sign(learner.id) };
  }

  async login(input: { email: string; password: string }): Promise<LearnerSession> {
    const learner = await this.learners.findByEmail(input.email.toLowerCase());
    const ok =
      learner?.passwordHash != null && (await this.hasher.verify(learner.passwordHash, input.password));
    if (!learner || !ok) throw Errors.invalidCredentials();
    return { learnerId: learner.id, accessToken: this.tokens.sign(learner.id) };
  }

  async me(learnerId: string): Promise<PublicLearner> {
    const learner = await this.learners.findById(learnerId);
    if (!learner) throw Errors.unauthorized();
    return { id: learner.id, email: learner.email, name: learner.name };
  }
}
