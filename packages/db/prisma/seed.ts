import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { PLANS } from './data/plans';
import { TEMPLATES } from './data/templates';
import { PALETTES } from './data/palettes';
import { seedDemoApp } from './seedDemoApp';

const prisma = new PrismaClient();

// Senhas de desenvolvimento para as contas seed (RF-07). Trocar em produção.
const DEV_ADMIN_PASSWORD = 'EduForge!Admin1';
const DEV_CREATOR_PASSWORD = 'EduForge!2026';

async function seedPlans() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { name: plan.name, priceCentsMonth: plan.priceCentsMonth, limits: plan.limits },
      create: {
        key: plan.key,
        name: plan.name,
        priceCentsMonth: plan.priceCentsMonth,
        limits: plan.limits,
      },
    });
  }
  console.log(`  ✓ ${PLANS.length} planos`);
}

async function seedTemplates() {
  for (const tpl of TEMPLATES) {
    await prisma.template.upsert({
      where: { key: tpl.key },
      update: { name: tpl.name, tokens: tpl.tokens, minPlanTier: tpl.minPlanTier },
      create: { key: tpl.key, name: tpl.name, tokens: tpl.tokens, minPlanTier: tpl.minPlanTier },
    });
  }
  console.log(`  ✓ ${TEMPLATES.length} templates`);
}

async function seedPalettes() {
  for (const pal of PALETTES) {
    await prisma.palette.upsert({
      where: { key: pal.key },
      update: { name: pal.name, colors: pal.colors },
      create: { key: pal.key, name: pal.name, colors: pal.colors, wcagAa: true },
    });
  }
  console.log(`  ✓ ${PALETTES.length} paletas`);
}

async function seedUsers() {
  const [adminHash, creatorHash] = await Promise.all([
    hash(DEV_ADMIN_PASSWORD),
    hash(DEV_CREATOR_PASSWORD),
  ]);
  const now = new Date();

  const admin = await prisma.user.upsert({
    where: { email: 'admin@eduforge.app' },
    update: { passwordHash: adminHash, emailVerifiedAt: now },
    create: {
      email: 'admin@eduforge.app',
      name: 'Admin EduForge',
      role: 'admin',
      locale: 'pt-BR',
      passwordHash: adminHash,
      emailVerifiedAt: now,
    },
  });

  const creator = await prisma.user.upsert({
    where: { email: 'marina@exemplo.com' },
    update: { passwordHash: creatorHash, emailVerifiedAt: now },
    create: {
      email: 'marina@exemplo.com',
      name: 'Marina (criadora)',
      role: 'creator',
      locale: 'pt-BR',
      passwordHash: creatorHash,
      emailVerifiedAt: now,
    },
  });

  // Assinatura Free + concessão inicial de créditos para a criadora de exemplo.
  const freePlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'free' } });
  const hasSubscription = await prisma.subscription.findFirst({
    where: { userId: creator.id },
  });
  if (!hasSubscription) {
    await prisma.subscription.create({
      data: { userId: creator.id, planId: freePlan.id, status: 'active' },
    });
  }

  const hasCredits = await prisma.aiCreditLedger.findFirst({ where: { userId: creator.id } });
  if (!hasCredits) {
    await prisma.aiCreditLedger.create({
      data: { userId: creator.id, delta: 500, reason: 'grant' },
    });
  }

  console.log(
    `  ✓ 2 usuários (admin/${DEV_ADMIN_PASSWORD}, marina/${DEV_CREATOR_PASSWORD}) + assinatura free + 500 créditos`,
  );
}

async function main() {
  console.log('🌱 Semeando EduForge...');
  await seedPlans();
  await seedTemplates();
  await seedPalettes();
  await seedUsers();
  await seedDemoApp(prisma);
  console.log('✅ Seed concluído.');
}

main()
  .catch((err) => {
    console.error('❌ Seed falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
