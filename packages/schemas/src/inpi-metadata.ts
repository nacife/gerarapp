/**
 * Campos sugeridos do formulário e-Software (RF-16.3, "Ficha de Registro").
 * Puro: nenhuma chamada externa, apenas formatação/derivação de dados já
 * conhecidos do projeto — o preenchimento real no e-Software é do usuário.
 * Compartilhado entre `apps/worker` (monta METADATA.json do pacote) e
 * `apps/api` (exibe a Ficha de Registro na tela, sem regenerar o pacote).
 */

/** Linguagens declaradas por todo app gerado pela EduForge (stack fixa do runtime). */
export const DECLARED_LANGUAGES = ['HTML', 'CSS', 'JAVA SCRIPT', 'JSON'] as const;

export const APPLICATION_FIELD = 'Educação — ensino e aprendizagem à distância (e-learning)';
export const PROGRAM_TYPE = 'Aplicativo educacional interativo (PWA)';

export function buildDerivationText(slug: string): string {
  return (
    `Este programa deriva do motor de execução ("runtime") licenciado pela EduForge Tecnologia ` +
    `Educacional Ltda., conforme os Termos de Uso aceitos pelo titular no momento da publicação ` +
    `do aplicativo "${slug}". O conteúdo, a estrutura pedagógica, o tema visual e as interações ` +
    `deste aplicativo específico são de autoria do titular; o motor de execução é reutilizado ` +
    `sob licença, comum a todos os aplicativos publicados na plataforma.`
  );
}

export interface FichaRegistroInput {
  title: string;
  slug: string;
  versionNumber: number;
  createdAt: Date;
  publishedAt: Date;
  holderName: string;
  algorithm: string;
}

export interface FichaRegistro {
  suggestedTitle: string;
  creationDate: string;
  publicationDate: string;
  languages: readonly string[];
  applicationField: string;
  programType: string;
  derivationText: string;
  algorithm: string;
  holderName: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Deriva os campos sugeridos para o formulário e-Software a partir dos dados do projeto. */
export function buildFichaRegistro(input: FichaRegistroInput): FichaRegistro {
  return {
    suggestedTitle: `${input.title} (v${input.versionNumber})`,
    creationDate: isoDate(input.createdAt),
    publicationDate: isoDate(input.publishedAt),
    languages: DECLARED_LANGUAGES,
    applicationField: APPLICATION_FIELD,
    programType: PROGRAM_TYPE,
    derivationText: buildDerivationText(input.slug),
    algorithm: input.algorithm,
    holderName: input.holderName,
  };
}

export interface InpiMetadataInput extends FichaRegistroInput {
  authors: string[];
}

export interface InpiMetadata {
  packageFormatVersion: 1;
  title: string;
  slug: string;
  versionNumber: number;
  holderDeclared: string;
  authors: string[];
  createdAt: string;
  publishedAt: string;
  languages: readonly string[];
  applicationField: string;
  programType: string;
  algorithm: string;
}

/** METADATA.json do pacote canônico (RF-16.1). */
export function buildMetadata(input: InpiMetadataInput): InpiMetadata {
  return {
    packageFormatVersion: 1,
    title: input.title,
    slug: input.slug,
    versionNumber: input.versionNumber,
    holderDeclared: input.holderName,
    authors: input.authors,
    createdAt: isoDate(input.createdAt),
    publishedAt: isoDate(input.publishedAt),
    languages: DECLARED_LANGUAGES,
    applicationField: APPLICATION_FIELD,
    programType: PROGRAM_TYPE,
    algorithm: input.algorithm,
  };
}
