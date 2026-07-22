import { BadRequestException } from '@nestjs/common';
import { access, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ProductDrawingsService } from './product-drawings.service';

describe('ProductDrawingsService', () => {
  let uploadDirectory: string;
  let drawingRecord: Record<string, unknown> | undefined;
  let prisma: {
    product: { findUnique: jest.Mock };
    productDrawing: {
      create: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let service: ProductDrawingsService;

  beforeEach(async () => {
    uploadDirectory = await mkdtemp(join(tmpdir(), 'fhjd-drawings-'));
    process.env.UPLOAD_DIR = uploadDirectory;
    drawingRecord = undefined;
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 1 }),
      },
      productDrawing: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            drawingRecord = {
              id: 8,
              ...data,
              createdAt: new Date('2026-07-21T00:00:00.000Z'),
            };
            return drawingRecord;
          }),
        delete: jest.fn().mockResolvedValue({ id: 8 }),
        findFirst: jest.fn().mockImplementation(() => drawingRecord),
        findMany: jest
          .fn()
          .mockImplementation(() => (drawingRecord ? [drawingRecord] : [])),
      },
    };
    service = new ProductDrawingsService(prisma as unknown as PrismaService);
  });

  afterEach(async () => {
    delete process.env.UPLOAD_DIR;
    await rm(uploadDirectory, { recursive: true, force: true });
  });

  it('stores a PDF and removes the internal storage name from the response', async () => {
    const result = await service.create(
      1,
      makeFile('装配图纸.pdf', 'application/pdf'),
    );

    expect(result.originalName).toBe('装配图纸.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result).not.toHaveProperty('storedName');
    expect(drawingRecord?.storedName).toMatch(/\.pdf$/);
    await expect(
      access(join(uploadDirectory, String(drawingRecord?.storedName))),
    ).resolves.toBeUndefined();
  });

  it('restores a UTF-8 filename decoded as latin1 by multipart parsing', async () => {
    const mojibakeName = Buffer.from('装配图纸.pdf', 'utf8').toString('latin1');

    const result = await service.create(
      1,
      makeFile(mojibakeName, 'application/pdf'),
    );

    expect(result.originalName).toBe('装配图纸.pdf');
    expect(drawingRecord?.originalName).toBe('装配图纸.pdf');
  });

  it('rejects unsupported file extensions before writing a file', async () => {
    await expect(
      service.create(1, makeFile('运行程序.exe', 'application/octet-stream')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productDrawing.create).not.toHaveBeenCalled();
  });

  it('deletes metadata and the stored file', async () => {
    await service.create(1, makeFile('产品图纸.pdf', 'application/pdf'));
    const storedName = String(drawingRecord?.storedName);

    await expect(service.remove(1, 8)).resolves.toEqual({ success: true });
    expect(prisma.productDrawing.delete).toHaveBeenCalledWith({
      where: { id: 8 },
    });
    await expect(
      access(join(uploadDirectory, storedName)),
    ).rejects.toBeDefined();
  });
});

function makeFile(originalname: string, mimetype: string): Express.Multer.File {
  const buffer = Buffer.from('drawing-content');
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: undefined as never,
  };
}
