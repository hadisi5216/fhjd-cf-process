import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import * as mammoth from 'mammoth';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const MAX_WORD_PREVIEW_CHARACTERS = 100_000;
const MAX_EXCEL_PREVIEW_SHEETS = 10;
const MAX_EXCEL_PREVIEW_ROWS = 300;
const MAX_EXCEL_PREVIEW_COLUMNS = 30;
const ALLOWED_EXTENSIONS = new Set(['.docx', '.xlsx']);
const MIME_TYPES: Record<string, string> = {
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

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
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('仅支持 DOCX、XLSX 格式的工艺流程附件');
    }

    const storedName = `${randomUUID()}${extension}`;
    const uploadDirectory = getUploadDirectory();
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(resolve(uploadDirectory, storedName), file.buffer);

    try {
      const attachment = await this.prisma.productProcessAttachment.create({
        data: {
          productId,
          originalName,
          storedName,
          mimeType: MIME_TYPES[extension],
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

  async preview(productId: number, attachmentId: number) {
    const attachment = await this.findAttachment(productId, attachmentId);
    const filePath = resolve(getUploadDirectory(), attachment.storedName);
    await ensureFileExists(filePath);
    const file = await readFile(filePath);
    const extension = extname(attachment.originalName).toLowerCase();

    if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer: file });
      const truncated = result.value.length > MAX_WORD_PREVIEW_CHARACTERS;
      return {
        kind: 'word' as const,
        text: result.value.slice(0, MAX_WORD_PREVIEW_CHARACTERS),
        truncated,
      };
    }

    if (extension === '.xlsx') {
      return this.previewWorkbook(file);
    }

    throw new BadRequestException('该文件不支持在线查看');
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

  private async previewWorkbook(file: Buffer) {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = new ArrayBuffer(file.byteLength);
    new Uint8Array(arrayBuffer).set(file);
    await workbook.xlsx.load(arrayBuffer);
    let truncated = workbook.worksheets.length > MAX_EXCEL_PREVIEW_SHEETS;
    const sheets = workbook.worksheets
      .slice(0, MAX_EXCEL_PREVIEW_SHEETS)
      .map((worksheet) => {
        const rowCount = Math.min(
          worksheet.actualRowCount,
          MAX_EXCEL_PREVIEW_ROWS,
        );
        const columnCount = Math.min(
          worksheet.actualColumnCount,
          MAX_EXCEL_PREVIEW_COLUMNS,
        );
        truncated ||=
          worksheet.actualRowCount > rowCount ||
          worksheet.actualColumnCount > columnCount;

        return {
          name: worksheet.name,
          rows: Array.from({ length: rowCount }, (_, rowIndex) =>
            Array.from({ length: columnCount }, (_, columnIndex) =>
              formatCellValue(
                worksheet.getRow(rowIndex + 1).getCell(columnIndex + 1).value,
              ),
            ),
          ),
        };
      });

    return { kind: 'excel' as const, sheets, truncated };
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
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? originalName : decoded;
}

function formatCellValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value !== 'object') return String(value);

  const objectValue = value as unknown as Record<string, unknown>;
  if (Array.isArray(objectValue.richText)) {
    return objectValue.richText
      .map((part) =>
        typeof part === 'object' && part && 'text' in part
          ? String((part as { text: unknown }).text)
          : '',
      )
      .join('');
  }
  if ('result' in objectValue) {
    return formatCellValue(objectValue.result as ExcelJS.CellValue);
  }
  if (typeof objectValue.text === 'string') return objectValue.text;
  if (typeof objectValue.error === 'string') return objectValue.error;
  return '';
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}
