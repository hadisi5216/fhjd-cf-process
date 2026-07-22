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

const MAX_DRAWING_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.dwg',
  '.dxf',
  '.step',
  '.stp',
  '.iges',
  '.igs',
  '.prt',
  '.asm',
  '.x_t',
  '.x_b',
  '.jpg',
  '.jpeg',
  '.png',
  '.tif',
  '.tiff',
  '.bmp',
]);

@Injectable()
export class ProductDrawingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(productId: number) {
    const drawings = await this.prisma.productDrawing.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    return drawings.map(toDrawingResponse);
  }

  async create(productId: number, file?: Express.Multer.File) {
    await this.ensureProduct(productId);
    if (!file) {
      throw new BadRequestException('请选择产品图纸');
    }
    if (file.size === 0) {
      throw new BadRequestException('不能上传空文件');
    }
    if (file.size > MAX_DRAWING_SIZE) {
      throw new BadRequestException('图纸文件不能超过 50 MB');
    }

    const originalName = basename(normalizeOriginalName(file.originalname));
    const extension = extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('不支持该图纸文件格式');
    }

    const storedName = `${randomUUID()}${extension}`;
    const uploadDirectory = getUploadDirectory();
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(resolve(uploadDirectory, storedName), file.buffer);

    try {
      const drawing = await this.prisma.productDrawing.create({
        data: {
          productId,
          originalName,
          storedName,
          mimeType:
            extension === '.pdf'
              ? 'application/pdf'
              : file.mimetype || 'application/octet-stream',
          size: file.size,
        },
      });
      return toDrawingResponse(drawing);
    } catch (error) {
      await unlink(resolve(uploadDirectory, storedName)).catch(() => undefined);
      throw error;
    }
  }

  async open(productId: number, drawingId: number) {
    const drawing = await this.findDrawing(productId, drawingId);
    const filePath = resolve(getUploadDirectory(), drawing.storedName);
    await stat(filePath).catch(() => {
      throw new NotFoundException('产品图纸文件不存在');
    });

    return {
      drawing,
      file: new StreamableFile(createReadStream(filePath)),
    };
  }

  async remove(productId: number, drawingId: number) {
    const drawing = await this.findDrawing(productId, drawingId);
    await this.prisma.productDrawing.delete({ where: { id: drawing.id } });
    await unlink(resolve(getUploadDirectory(), drawing.storedName)).catch(
      () => undefined,
    );
    return { success: true };
  }

  async getStoredNames(productId: number) {
    const drawings = await this.prisma.productDrawing.findMany({
      where: { productId },
    });
    return drawings.map((drawing) => drawing.storedName);
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

  private async findDrawing(productId: number, drawingId: number) {
    const drawing = await this.prisma.productDrawing.findFirst({
      where: { id: drawingId, productId },
    });
    if (!drawing) {
      throw new NotFoundException('产品图纸不存在');
    }
    return {
      ...drawing,
      originalName: normalizeOriginalName(drawing.originalName),
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

function toDrawingResponse<
  T extends { storedName: string; originalName: string },
>(drawing: T) {
  const { storedName, ...response } = drawing;
  void storedName;
  return {
    ...response,
    originalName: normalizeOriginalName(drawing.originalName),
  };
}

function normalizeOriginalName(originalName: string) {
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? originalName : decoded;
}
