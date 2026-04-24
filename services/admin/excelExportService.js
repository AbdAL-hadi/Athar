import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  EXPORTS_DIRECTORY,
  SALES_EXPORT_PATH,
} from './constants.js';
import {
  buildCustomerSummaries,
  buildDailySummaries,
  buildOrderRows,
  buildProductSummaries,
  loadReportingSnapshot,
} from './reportingService.js';

let workbookWriteQueue = Promise.resolve();

// Ensures the exports directory exists before any workbook write starts.
const ensureExportsDirectory = async () => {
  await fs.mkdir(EXPORTS_DIRECTORY, { recursive: true });
};

// Applies the shared header row and light formatting for a worksheet.
const styleWorksheet = (worksheet) => {
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3E5E0' },
  };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
};

// Adds a worksheet with headers and rows in one place so the workbook stays consistent.
const addSheet = (workbook, sheetName, columns, rows) => {
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns;
  worksheet.addRows(rows);
  styleWorksheet(worksheet);
  worksheet.columns.forEach((column) => {
    const longestRowWidth = Math.max(
      String(column.header || '').length,
      ...rows.map((row) => String(row[column.key] ?? '').length),
      14,
    );

    column.width = Math.min(Math.max(longestRowWidth + 2, 14), 34);
  });
};

// Builds the full workbook content from the MongoDB source of truth.
const buildWorkbook = ({ orderRows, customerSummaries, productSummaries, dailySummaries }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Athar Admin Dashboard';
  workbook.created = new Date();
  workbook.modified = new Date();

  addSheet(
    workbook,
    'Orders',
    [
      { header: 'Order ID', key: 'orderId' },
      { header: 'Customer Name', key: 'customerName' },
      { header: 'Customer Email', key: 'customerEmail' },
      { header: 'Customer Phone', key: 'customerPhone' },
      { header: 'Product Name', key: 'productName' },
      { header: 'Category', key: 'category' },
      { header: 'Quantity', key: 'quantity' },
      { header: 'Unit Price', key: 'unitPrice' },
      { header: 'Total Price', key: 'totalPrice' },
      { header: 'Order Status', key: 'orderStatus' },
      { header: 'Payment Method', key: 'paymentMethod' },
      { header: 'Order Date', key: 'orderDate' },
      { header: 'Delivery Date', key: 'deliveryDate' },
    ],
    orderRows,
  );

  addSheet(
    workbook,
    'Customers',
    [
      { header: 'Customer ID', key: 'customerId' },
      { header: 'Full Name', key: 'fullName' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'Total Orders', key: 'totalOrders' },
      { header: 'Total Spent', key: 'totalSpent' },
      { header: 'First Purchase Date', key: 'firstPurchaseDate' },
      { header: 'Last Purchase Date', key: 'lastPurchaseDate' },
      { header: 'Top Category', key: 'topCategory' },
      { header: 'Customer Segment', key: 'customerSegment' },
    ],
    customerSummaries,
  );

  addSheet(
    workbook,
    'Products',
    [
      { header: 'Product ID', key: 'productId' },
      { header: 'Product Name', key: 'productName' },
      { header: 'Category', key: 'category' },
      { header: 'Current Stock', key: 'currentStock' },
      { header: 'Units Sold', key: 'unitsSold' },
      { header: 'Revenue Generated', key: 'revenueGenerated' },
      { header: 'Last Restock Date', key: 'lastRestockDate' },
      { header: 'Stock Status', key: 'inventoryStatus' },
    ],
    productSummaries,
  );

  addSheet(
    workbook,
    'Summary',
    [
      { header: 'Date', key: 'date' },
      { header: 'Total Revenue', key: 'totalRevenue' },
      { header: 'Total Orders', key: 'totalOrders' },
      { header: 'New Customers', key: 'newCustomers' },
      { header: 'Top Product', key: 'topProduct' },
      { header: 'Top Category', key: 'topCategory' },
      { header: 'Average Order Value', key: 'averageOrderValue' },
    ],
    dailySummaries,
  );

  return workbook;
};

// Writes the workbook to disk through a temp file so concurrent writes cannot corrupt it.
const writeWorkbookToDisk = async (workbook) => {
  const tempPath = path.join(EXPORTS_DIRECTORY, `sales_data.${Date.now()}.tmp.xlsx`);
  await workbook.xlsx.writeFile(tempPath);
  await fs.rm(SALES_EXPORT_PATH, { force: true });
  await fs.rename(tempPath, SALES_EXPORT_PATH);
};

// Rebuilds the sales export workbook entirely from database records.
export const refreshSalesExportWorkbook = async () => {
  await ensureExportsDirectory();

  const snapshot = await loadReportingSnapshot();
  const customerSummaries = buildCustomerSummaries(snapshot);
  const productSummaries = buildProductSummaries(snapshot);
  const dailySummaries = buildDailySummaries({
    ...snapshot,
    customerSummaries,
  });
  const orderRows = buildOrderRows(snapshot);
  const workbook = buildWorkbook({
    orderRows,
    customerSummaries,
    productSummaries,
    dailySummaries,
  });

  await writeWorkbookToDisk(workbook);
  return SALES_EXPORT_PATH;
};

// Serializes workbook writes so multiple confirmations cannot corrupt the XLSX file.
export const queueSalesExportRefresh = () => {
  const queuedTask = workbookWriteQueue.then(() => refreshSalesExportWorkbook(), () => refreshSalesExportWorkbook());
  workbookWriteQueue = queuedTask.catch(() => undefined);
  return queuedTask;
};

// Queues a workbook refresh and retries once later if the write fails.
export const queueSalesExportRefreshWithRetry = async ({ retryDelayMs = 2500 } = {}) => {
  try {
    return await queueSalesExportRefresh();
  } catch (error) {
    console.error('[Athar exports] Workbook refresh failed. Retrying once...', error.message);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return queueSalesExportRefresh();
  }
};

// Ensures there is a current sales workbook before the download endpoint serves it.
export const ensureSalesExportWorkbook = async () => {
  try {
    await fs.access(SALES_EXPORT_PATH);
    return SALES_EXPORT_PATH;
  } catch (_error) {
    return queueSalesExportRefresh();
  }
};

// Returns the last file update timestamp for the dashboard export CTA.
export const getSalesExportMetadata = async () => {
  try {
    const stats = await fs.stat(SALES_EXPORT_PATH);
    return {
      path: SALES_EXPORT_PATH,
      exists: true,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (_error) {
    return {
      path: SALES_EXPORT_PATH,
      exists: false,
      updatedAt: null,
    };
  }
};
