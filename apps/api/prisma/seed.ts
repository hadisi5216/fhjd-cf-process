import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminPassword = await bcrypt.hash('admin123456', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      displayName: '系统管理员',
      role: UserRole.ADMIN,
      enabled: true,
    },
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      displayName: '系统管理员',
      role: UserRole.ADMIN,
    },
  });

  const steps = [
    { name: '打磨', timeoutHours: 72 },
    { name: '装配', timeoutHours: 72 },
    { name: '喷漆', timeoutHours: 72 },
    { name: '包覆', timeoutHours: 72 },
    { name: '完工', timeoutHours: 0 },
  ];

  for (const [index, step] of steps.entries()) {
    await prisma.processStep.upsert({
      where: { name: step.name },
      update: {
        sortOrder: index + 1,
        timeoutHours: step.timeoutHours,
        enabled: true,
      },
      create: {
        name: step.name,
        sortOrder: index + 1,
        timeoutHours: step.timeoutHours,
      },
    });
  }

  const processSteps = await prisma.processStep.findMany();
  const processStepMap = new Map(processSteps.map((step) => [step.name, step.id]));
  const scanners = [
    { code: 'SCAN-DM-01', name: '打磨扫码枪', processName: '打磨', location: '打磨工序' },
    { code: 'SCAN-ZP-01', name: '装配扫码枪', processName: '装配', location: '装配工序' },
    { code: 'SCAN-PQ-01', name: '喷漆扫码枪', processName: '喷漆', location: '喷漆工序' },
    { code: 'SCAN-BF-01', name: '包覆扫码枪', processName: '包覆', location: '包覆工序' },
  ];

  for (const scanner of scanners) {
    const processStepId = processStepMap.get(scanner.processName);
    if (!processStepId) {
      throw new Error(`Process step ${scanner.processName} is missing`);
    }

    await prisma.scanner.upsert({
      where: { code: scanner.code },
      update: {
        name: scanner.name,
        processStepId,
        location: scanner.location,
        enabled: true,
      },
      create: {
        code: scanner.code,
        name: scanner.name,
        processStepId,
        location: scanner.location,
        enabled: true,
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: 'screenPreviewDataEnabled' },
    update: {},
    create: {
      key: 'screenPreviewDataEnabled',
      value: 'true',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
