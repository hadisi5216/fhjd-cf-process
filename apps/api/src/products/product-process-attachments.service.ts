import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

@Injectable()
export class ProductProcessAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(productId: number) {
    const attachments = await this.prisma.productProcessAttachment.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    return attachments.map(toAttachmentResponse);
  }

  async create(productId: number, file?: Express.Multer.File) {
    await this.ensureProduct(productId);
    if (!file) {
      throw new BadRequestException('请选择工艺流程附件');
    }
    if (file.size === 0) {
      throw new BadRequestException('不能上传空文件');
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new BadRequestException('工艺流程附件不能超过 50 MB');
    }

    const originalName = basename(normalizeOriginalName(file.originalname));
    const extension = extname(originalName).toLowerCase();
    const storageExtension = /^\.[a-z0-9]{1,16}$/i.test(extension)
      ? extension
      : '';
    const storedName = `${randomUUID()}${storageExtension}`;
    const uploadDirectory = getUploadDirectory();
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(resolve(uploadDirectory, storedName), file.buffer);

    try {
      const attachment = await this.prisma.productProcessAttachment.create({
        data: {
          productId,
          originalName,
          storedName,
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
        },
      });
      return toAttachmentResponse(attachment);
    } catch (error) {
      await unlink(resolve(uploadDirectory, storedName)).catch(() => undefined);
      throw error;
    }
  }

  async open(productId: number, attachmentId: number) {
    const attachment = await this.findAttachment(productId, attachmentId);
    const filePath = resolve(getUploadDirectory(), attachment.storedName);
    await ensureFileExists(filePath);

    return {
      attachment,
      file: new StreamableFile(createReadStream(filePath)),
    };
  }

  async remove(productId: number, attachmentId: number) {
    const attachment = await this.findAttachment(productId, attachmentId);
    await this.prisma.productProcessAttachment.delete({
      where: { id: attachment.id },
    });
    await unlink(resolve(getUploadDirectory(), attachment.storedName)).catch(
      () => undefined,
    );
    return { success: true };
  }

  async getStoredNames(productId: number) {
    const attachments = await this.prisma.productProcessAttachment.findMany({
      where: { productId },
    });
    return attachments.map((attachment) => attachment.storedName);
  }

  async removeStoredFiles(storedNames: string[]) {
    await Promise.all(
      storedNames.map((storedName) =>
        unlink(resolve(getUploadDirectory(), storedName)).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          },
        ),
      ),
    );
  }

  private async findAttachment(productId: number, attachmentId: number) {
    const attachment = await this.prisma.productProcessAttachment.findFirst({
      where: { id: attachmentId, productId },
    });
    if (!attachment) {
      throw new NotFoundException('工艺流程附件不存在');
    }
    return {
      ...attachment,
      originalName: normalizeOriginalName(attachment.originalName),
    };
  }

  private async ensureProduct(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('产品不存在');
    }
  }
}

function getUploadDirectory() {
  return resolve(
    process.env.UPLOAD_DIR ?? resolve(process.cwd(), 'storage', 'uploads'),
  );
}

async function ensureFileExists(filePath: string) {
  await stat(filePath).catch(() => {
    throw new NotFoundException('工艺流程附件文件不存在');
  });
}

function toAttachmentResponse<
  T extends { storedName: string; originalName: string },
>(attachment: T) {
  const { storedName, ...response } = attachment;
  void storedName;
  return {
    ...response,
    originalName: normalizeOriginalName(attachment.originalName),
  };
}

function normalizeOriginalName(originalName: string) {
  let normalized = originalName.normalize('NFC');

  // Multer may expose UTF-8 header bytes as Latin-1 text. Repair both new
  // uploads and historical names that were accidentally encoded twice.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const mojibakeCount = countLatin1Characters(normalized);
    if (mojibakeCount === 0) break;

    const decoded = Buffer.from(normalized, 'latin1')
      .toString('utf8')
      .normalize('NFC');
    if (
      decoded.includes('\uFFFD') ||
      countLatin1Characters(decoded) >= mojibakeCount
    ) {
      break;
    }
    normalized = decoded;
  }

  return normalized;
}

function countLatin1Characters(value: string) {
  return value.match(/[\u0080-\u00ff]/g)?.length ?? 0;
}
