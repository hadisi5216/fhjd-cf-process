import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

export type ProductExportRow = {
  productName: string;
  productModel: string;
  serialNo: string | null;
  quantity: number;
  unit: string;
  remark: string | null;
  processAttachments: Array<{ originalName: string }>;
  status: string;
  currentEnteredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  currentProcess: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待扫码',
  IN_PROGRESS: '加工中',
  FINISHED: '已完工',
  OVERDUE: '已超时',
};

@Injectable()
export class ProductExportService {
  async createWorkbook(products: ProductExportRow[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '产品加工流程管理系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('产品列表', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    worksheet.columns = [
      { header: '产品名称', key: 'productName', width: 22 },
      { header: '产品型号', key: 'productModel', width: 28 },
      { header: '流水号', key: 'serialNo', width: 16 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '单位', key: 'unit', width: 10 },
      { header: '当前工序', key: 'currentProcess', width: 14 },
      { header: '状态', key: 'status', width: 12 },
      { header: '工艺流程附件', key: 'processAttachments', width: 38 },
      { header: '备注', key: 'remark', width: 24 },
      { header: '当前工序进入时间', key: 'currentEnteredAt', width: 21 },
      { header: '录入时间', key: 'createdAt', width: 21 },
      { header: '更新时间', key: 'updatedAt', width: 21 },
    ];

    worksheet.addRows(
      products.map((product) => ({
        productName: product.productName,
        productModel: product.productModel,
        serialNo: product.serialNo ?? '',
        quantity: product.quantity,
        unit: product.unit,
        currentProcess: product.currentProcess?.name ?? '待扫码',
        status: STATUS_LABELS[product.status] ?? product.status,
        processAttachments: product.processAttachments
          .map((attachment) => attachment.originalName)
          .join('\n'),
        remark: product.remark ?? '',
        currentEnteredAt: formatDateTime(product.currentEnteredAt),
        createdAt: formatDateTime(product.createdAt),
        updatedAt: formatDateTime(product.updatedAt),
      })),
    );

    const header = worksheet.getRow(1);
    header.height = 26;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF126E78' },
    };
    header.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.autoFilter = {
      from: 'A1',
      to: `L${Math.max(products.length + 1, 1)}`,
    };
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: 'top', wrapText: true };
      row.height = 24;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

function formatDateTime(value?: Date | null) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
}
