import path from 'node:path';

export const CRITICAL_STOCK_THRESHOLD = 5;
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
export const EXPORTS_DIRECTORY = path.join(process.cwd(), 'exports');
export const SALES_EXPORT_PATH = path.join(EXPORTS_DIRECTORY, 'sales_data.xlsx');
export const SALE_STATUSES = ['Confirmed', 'Shipped', 'Delivered'];
export const RESTORABLE_STATUSES = ['Cancelled', 'Refunded'];
