import { ensureSalesExportWorkbook, queueSalesExportRefreshWithRetry } from '../services/admin/excelExportService.js';
import { getAdminDashboardSnapshot } from '../services/admin/dashboardService.js';
import { transitionOrderStatusWithInventory } from '../services/admin/inventoryService.js';

// Returns the full admin dashboard payload used by the frontend page.
export const getAdminDashboard = async (_req, res) => {
  try {
    const dashboard = await getAdminDashboardSnapshot();

    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('[Athar admin] Failed to load dashboard:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load admin dashboard data.',
      error: error.message,
    });
  }
};

// Forces the latest workbook to exist and streams it to the dashboard download button.
export const downloadSalesExport = async (_req, res) => {
  try {
    const workbookPath = await ensureSalesExportWorkbook();

    return res.download(workbookPath, 'sales_data.xlsx');
  } catch (error) {
    console.error('[Athar admin] Failed to download workbook:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to prepare the sales export.',
      error: error.message,
    });
  }
};

// Marks an order as refunded, restores stock, and refreshes the Excel export asynchronously.
export const refundOrder = async (req, res) => {
  try {
    const order = await transitionOrderStatusWithInventory({
      orderId: req.params.id,
      nextStatus: 'Refunded',
      extraUpdates: {
        refundedAt: new Date(),
      },
    });

    void queueSalesExportRefreshWithRetry().catch((error) => {
      console.error('[Athar admin] Refund export refresh failed:', error.message);
    });

    return res.status(200).json({
      success: true,
      message: 'Order refunded and stock restored successfully.',
      data: order,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to refund the order.',
    });
  }
};
