import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildValidInteraction,
  canonicalize,
  manifestSchema,
  type ContentMapTree,
  type InteractionType,
  type Manifest,
} from '@eduforge/schemas';
import { TEMPLATE_TOKENS } from '@eduforge/ui';

export const DEMO_APP_SLUG = 'biologia-viva-demo';

/**
 * App publicado determinístico (M5): cobre os 9 tipos de interação em um
 * único projeto, com slug fixo — fixture para o E2E do runtime (Playwright)
 * sem depender do worker/pipeline de IA em tempo de teste.
 */
export async function seedDemoApp(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.project.findUnique({ where: { slug: DEMO_APP_SLUG } });
  if (existing) {
    console.log('  · app demo já existe, pulando');
    return;
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'marina@exemplo.com' } });
  const template = await prisma.template.findUniqueOrThrow({ where: { key: 'modern' } });
  const palette = await prisma.palette.findUniqueOrThrow({ where: { key: 'oceano' } });

  const project = await prisma.project.create({
    data: {
      ownerUserId: owner.id,
      title: 'Biologia Viva Demo',
      slug: DEMO_APP_SLUG,
      status: 'draft',
      accessMode: 'public',
    },
  });

  const contentMap = await prisma.contentMap.create({
    data: { projectId: project.id, revision: 1, approvedAt: new Date(), structureConfidence: 0.93, tree: {} },
  });

  const blockMembrana = await prisma.contentBlock.create({
    data: {
      contentMapId: contentMap.id,
      position: 0,
      kind: 'concept',
      confidence: 0.95,
      contentMd:
        'A membrana plasmática é uma bicamada lipídica que delimita a célula e controla a entrada e saída de substâncias.',
    },
  });
  const blockNucleo = await prisma.contentBlock.create({
    data: {
      contentMapId: contentMap.id,
      position: 1,
      kind: 'concept',
      confidence: 0.92,
      contentMd: 'O núcleo contém o material genético (DNA) e coordena as atividades da célula.',
    },
  });

  const tree: ContentMapTree = {
    chapters: [
      {
        id: 'c1',
        title: 'A Célula',
        confidence: 0.93,
        children: [
          { id: 's1', title: 'Membrana Celular', confidence: 0.95, kind: 'concept', blockId: blockMembrana.id },
          { id: 's2', title: 'Núcleo e Organelas', confidence: 0.92, kind: 'concept', blockId: blockNucleo.id },
        ],
      },
    ],
  };
  await prisma.contentMap.update({
    where: { id: contentMap.id },
    data: { tree: tree as unknown as Prisma.InputJsonValue },
  });

  // Uma interação de cada um dos 9 tipos (RF-02 / Parte 6.A), distribuídas nos 2 blocos.
  const specs: { type: InteractionType; blockId: string }[] = [
    { type: 'quiz', blockId: blockMembrana.id },
    { type: 'flashcard_deck', blockId: blockMembrana.id },
    { type: 'cloze', blockId: blockMembrana.id },
    { type: 'dragdrop', blockId: blockMembrana.id },
    { type: 'hotspot', blockId: blockMembrana.id },
    { type: 'timeline', blockId: blockNucleo.id },
    { type: 'scenario', blockId: blockNucleo.id },
    { type: 'audio', blockId: blockNucleo.id },
    { type: 'mindmap', blockId: blockNucleo.id },
  ];

  const interactionRows: {
    id: string;
    contentBlockId: string | null;
    type: string;
    payload: Prisma.JsonValue;
    difficulty: string;
    position: number;
  }[] = [];
  for (let i = 0; i < specs.length; i++) {
    const { type, blockId } = specs[i]!;
    const payload = buildValidInteraction(type, blockId, i);
    const row = await prisma.interaction.create({
      data: {
        projectId: project.id,
        contentBlockId: blockId,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
        difficulty: (payload as { difficulty: 'easy' | 'medium' | 'hard' }).difficulty,
        origin: 'ai_generated',
        position: i,
      },
    });
    interactionRows.push(row);
  }

  const themeData = {
    typography: { heading: 'Inter', body: 'Inter', scale: 1.25 },
    effects: { confetti: true, flip3d: true, parallax: false },
  };
  const theme = await prisma.theme.create({
    data: {
      templateId: template.id,
      projectId: project.id,
      palette: palette.colors as Prisma.InputJsonValue,
      typography: themeData.typography as unknown as Prisma.InputJsonValue,
      effects: themeData.effects as unknown as Prisma.InputJsonValue,
    },
  });

  const manifest: Manifest = {
    schemaVersion: 1,
    slug: DEMO_APP_SLUG,
    title: 'Biologia Viva Demo',
    version: 1,
    publishedAt: new Date().toISOString(),
    access: { mode: 'public' },
    theme: {
      template: template.key,
      tokens: TEMPLATE_TOKENS[template.key] as unknown as Record<string, unknown>,
      palette: palette.colors as unknown as Manifest['theme']['palette'],
      typography: themeData.typography,
      effects: themeData.effects,
    },
    content: tree,
    interactions: interactionRows.map((r) => ({
      id: r.id,
      contentBlockId: r.contentBlockId,
      type: r.type,
      payload: r.payload,
      difficulty: r.difficulty,
      position: r.position,
    })),
  };
  manifestSchema.parse(manifest); // garante que o seed produz um manifesto válido de verdade

  const canonical = canonicalize(manifest);
  const bundleSha512 = createHash('sha512').update(canonical).digest('hex');

  const appVersion = await prisma.appVersion.create({
    data: {
      projectId: project.id,
      versionNumber: 1,
      themeId: theme.id,
      manifest: manifest as unknown as Prisma.InputJsonValue,
      manifestS3Key: `apps/${DEMO_APP_SLUG}/v1/manifest.json`,
      bundleSha512,
      status: 'published',
      publishedAt: new Date(),
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { status: 'published', activeAppVersionId: appVersion.id },
  });

  console.log(
    `  ✓ app demo publicado em /${DEMO_APP_SLUG} (9 tipos de interação, hash ${bundleSha512.slice(0, 12)}…)`,
  );
}
