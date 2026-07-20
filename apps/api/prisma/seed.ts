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
    { code: 'DM', legacyCode: 'SCAN-DM-01', name: '打磨扫码枪', processName: '打磨', location: '打磨工序', ipAddress: '192.168.1.11' },
    { code: 'ZP', legacyCode: 'SCAN-ZP-01', name: '装配扫码枪', processName: '装配', location: '装配工序', ipAddress: '192.168.1.12' },
    { code: 'PQ', legacyCode: 'SCAN-PQ-01', name: '喷漆扫码枪', processName: '喷漆', location: '喷漆工序', ipAddress: '192.168.1.13' },
    { code: 'BF', legacyCode: 'SCAN-BF-01', name: '包覆扫码枪', processName: '包覆', location: '包覆工序', ipAddress: '192.168.1.14' },
    { code: 'WG', legacyCode: 'SCAN-WG-01', name: '完工扫码枪', processName: '完工', location: '完工工序', ipAddress: '192.168.1.15' },
  ];

  for (const scanner of scanners) {
    const processStepId = processStepMap.get(scanner.processName);
    if (!processStepId) {
      throw new Error(`Process step ${scanner.processName} is missing`);
    }

    const existingScanner = await prisma.scanner.findFirst({
      where: {
        OR: [{ code: scanner.code }, { code: scanner.legacyCode }, { name: scanner.name }],
      },
    });

    if (existingScanner) {
      await prisma.scanner.update({
        where: { id: existingScanner.id },
        data: {
          code: scanner.code,
          name: scanner.name,
          processStepId,
          location: scanner.location,
          ipAddress: scanner.ipAddress,
          enabled: true,
        },
      });
      continue;
    }

    await prisma.scanner.create({
      data: {
        code: scanner.code,
        name: scanner.name,
        processStepId,
        location: scanner.location,
        ipAddress: scanner.ipAddress,
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
