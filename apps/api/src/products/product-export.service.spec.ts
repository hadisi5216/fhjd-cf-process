import ExcelJS from 'exceljs';
import { ProductExportService } from './product-export.service';

describe('ProductExportService', () => {
  it('creates an Excel workbook with product details and Chinese status labels', async () => {
    const service = new ProductExportService();
    const file = await service.createWorkbook([
      {
        productName: '12号舵舱体',
        productModel: 'J/CLL9-12A-101S1.1',
        serialNo: '2606003',
        quantity: 1,
        unit: '件',
        remark: '重点件',
        manufacturingProcess: '下料\n打磨\n检验',
        status: 'IN_PROGRESS',
        currentEnteredAt: new Date('2026-07-22T00:00:00.000Z'),
        createdAt: new Date('2026-07-21T00:00:00.000Z'),
        updatedAt: new Date('2026-07-22T01:00:00.000Z'),
        currentProcess: { name: '打磨' },
      },
    ]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    const worksheet = workbook.getWorksheet('产品列表');

    expect(worksheet?.rowCount).toBe(2);
    expect(worksheet?.getCell('A2').value).toBe('12号舵舱体');
    expect(worksheet?.getCell('B2').value).toBe('J/CLL9-12A-101S1.1');
    expect(worksheet?.getCell('G2').value).toBe('加工中');
    expect(worksheet?.getCell('H2').value).toBe('下料\n打磨\n检验');
  });
});
