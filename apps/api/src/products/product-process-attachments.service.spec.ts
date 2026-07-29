import { access, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ProductProcessAttachmentsService } from './product-process-attachments.service';

describe('ProductProcessAttachmentsService', () => {
  let uploadDirectory: string;
  let attachmentRecord: Record<string, unknown> | undefined;
  let prisma: {
    product: { findUnique: jest.Mock };
    productProcessAttachment: {
      create: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let service: ProductProcessAttachmentsService;

  beforeEach(async () => {
    uploadDirectory = await mkdtemp(join(tmpdir(), 'fhjd-process-files-'));
    process.env.UPLOAD_DIR = uploadDirectory;
    attachmentRecord = undefined;
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 1 }),
      },
      productProcessAttachment: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            attachmentRecord = {
              id: 12,
              ...data,
              createdAt: new Date('2026-07-22T00:00:00.000Z'),
            };
            return attachmentRecord;
          }),
        delete: jest.fn().mockResolvedValue({ id: 12 }),
        findFirst: jest.fn().mockImplementation(() => attachmentRecord),
        findMany: jest
          .fn()
          .mockImplementation(() =>
            attachmentRecord ? [attachmentRecord] : [],
          ),
      },
    };
    service = new ProductProcessAttachmentsService(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(async () => {
    delete process.env.UPLOAD_DIR;
    await rm(uploadDirectory, { recursive: true, force: true });
  });

  it('stores a DOCX attachment and keeps the Chinese original filename', async () => {
    const result = await service.create(
      1,
      makeFile(
        '装配工艺.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        Buffer.from('docx-content'),
      ),
    );

    expect(result.originalName).toBe('装配工艺.docx');
    expect(result).not.toHaveProperty('storedName');
    expect(attachmentRecord?.storedName).toMatch(/\.docx$/);
    await expect(
      access(join(uploadDirectory, String(attachmentRecord?.storedName))),
    ).resolves.toBeUndefined();
  });

  it('accepts attachments in any file format', async () => {
    const result = await service.create(
      1,
      makeFile('工艺说明.pdf', 'application/pdf', Buffer.from('pdf')),
    );

    expect(result.originalName).toBe('工艺说明.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(attachmentRecord?.storedName).toMatch(/\.pdf$/);
  });

  it('repairs UTF-8 filenames exposed as Latin-1 text', async () => {
    const mojibakeName = Buffer.from('装配工艺.xlsx', 'utf8').toString(
      'latin1',
    );

    const result = await service.create(
      1,
      makeFile(
        mojibakeName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        Buffer.from('xlsx-content'),
      ),
    );

    expect(result.originalName).toBe('装配工艺.xlsx');
    expect(attachmentRecord?.originalName).toBe('装配工艺.xlsx');
  });

  it('repairs historical filenames that were encoded twice', async () => {
    const encodedOnce = Buffer.from('装配工艺.docx', 'utf8').toString(
      'latin1',
    );
    attachmentRecord = {
      id: 12,
      productId: 1,
      originalName: Buffer.from(encodedOnce, 'utf8').toString('latin1'),
      storedName: 'stored.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 12,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
    };

    await expect(service.list(1)).resolves.toEqual([
      expect.objectContaining({ originalName: '装配工艺.docx' }),
    ]);
  });

  it('deletes metadata and the stored attachment', async () => {
    await service.create(
      1,
      makeFile(
        '装配工艺.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        Buffer.from('docx-content'),
      ),
    );
    const storedName = String(attachmentRecord?.storedName);

    await expect(service.remove(1, 12)).resolves.toEqual({ success: true });
    expect(prisma.productProcessAttachment.delete).toHaveBeenCalledWith({
      where: { id: 12 },
    });
    await expect(
      access(join(uploadDirectory, storedName)),
    ).rejects.toBeDefined();
  });
});

function makeFile(
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File {
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
