import { getSalesExportMetadata } from './excelExportService.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from './constants.js';
import { buildCustomerSummaries, buildDailySummaries, buildProductSummaries, loadReportingSnapshot } from './reportingService.js';

// Returns month boundaries used by the KPI comparison cards.
const getMonthRange = (referenceDate, monthOffset = 0) => {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + monthOffset, 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + monthOffset + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

// Tests whether a date sits inside the requested range.
const isDateInRange = (value, start, end) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date <= end;
};

// Returns a human-readable delta for KPI cards.
const buildDelta = (currentValue, previousValue, suffix = '') => {
  const safeCurrent = Number(currentValue || 0);
  const safePrevious = Number(previousValue || 0);

  if (safePrevious === 0) {
    return {
      value: safeCurrent > 0 ? '+100%' : '0%',
      direction: safeCurrent > 0 ? 'up' : 'flat',
      suffix,
    };
  }

  const percentChange = ((safeCurrent - safePrevious) / safePrevious) * 100;
  return {
    value: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
    direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'flat',
    suffix,
  };
};

// Produces a gap-free sales series for the last N days.
const buildSalesSeries = (dailySummaries, days) => {
  const now = new Date();
  const summaryLookup = new Map(dailySummaries.map((entry) => [entry.date, entry]));
  const series = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    const summary = summaryLookup.get(key);

    series.push({
      date: key,
      label: key.slice(5),
      revenue: Number(summary?.totalRevenue || 0),
      orders: Number(summary?.totalOrders || 0),
    });
  }

  return series;
};

// Builds the category revenue split shown in the donut chart.
const buildCategoryBreakdown = (productSummaries) => {
  const categoryTotals = new Map();

  productSummaries.forEach((product) => {
    categoryTotals.set(product.category, (categoryTotals.get(product.category) || 0) + Number(product.revenueGenerated || 0));
  });

  return Array.from(categoryTotals.entries())
    .map(([category, revenue]) => ({ category, revenue: Number(revenue.toFixed(2)) }))
    .sort((left, right) => right.revenue - left.revenue);
};

// Detects a weekly sales spike that should surface as the top AI insight.
const getWeeklyTrendInsight = (productSummaries, orders, products) => {
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - 6);
  currentWeekStart.setHours(0, 0, 0, 0);

  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(currentWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(currentWeekStart);
  previousWeekEnd.setMilliseconds(-1);

  const revenueByProductThisWeek = new Map();
  const revenueByProductPreviousWeek = new Map();
  const productLookup = new Map(products.map((product) => [product._id.toString(), product]));

  orders.forEach((order) => {
    const saleDate = new Date(order.confirmedAt || order.createdAt);

    if (Number.isNaN(saleDate.getTime())) {
      return;
    }

    const targetMap =
      saleDate >= currentWeekStart
        ? revenueByProductThisWeek
        : saleDate >= previousWeekStart && saleDate <= previousWeekEnd
          ? revenueByProductPreviousWeek
          : null;

    if (!targetMap) {
      return;
    }

    order.items.forEach((item) => {
      const productId = item?.product?._id?.toString?.() || item?.product?.toString?.() || '';
      const itemRevenue = Number(item.price || 0) * Number(item.quantity || 0);
      targetMap.set(productId, (targetMap.get(productId) || 0) + itemRevenue);
    });
  });

  let bestInsight = null;

  productSummaries.forEach((productSummary) => {
    const productId = productSummary.productId;
    const thisWeek = revenueByProductThisWeek.get(productId) || 0;
    const previousWeek = revenueByProductPreviousWeek.get(productId) || 0;

    if (thisWeek <= 0 || previousWeek <= 0) {
      return;
    }

    const increase = ((thisWeek - previousWeek) / previousWeek) * 100;

    if (increase <= 20) {
      return;
    }

    const product = productLookup.get(productId);
    const lowThreshold = product?.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;

    bestInsight = {
      severity: 'success',
      title: `${productSummary.productName} is accelerating this week`,
      message: `Revenue is up ${increase.toFixed(1)}% versus last week. Stock is ${productSummary.currentStock}, so a restock check is recommended before demand outpaces supply.`,
      sortScore: increase + (lowThreshold - Math.min(productSummary.currentStock, lowThreshold)),
    };
  });

  return bestInsight;
};

// Builds a prioritized alert list for stock, sales momentum, and customer inactivity.
const buildSmartAlerts = (productSummaries, customerSummaries, categoryBreakdown) => {
  const alerts = [];

  productSummaries.forEach((product) => {
    if (product.inventoryStatus === 'Out of Stock' || product.inventoryStatus === 'Critical') {
      alerts.push({
        level: 'critical',
        sortWeight: 100 + product.unitsSold,
        title: `${product.productName} needs immediate attention`,
        message: `Stock is ${product.currentStock} and the product already generated ${product.revenueGenerated.toFixed(2)}JD in tracked sales.`,
      });
      return;
    }

    if (product.inventoryStatus === 'Low') {
      alerts.push({
        level: 'warning',
        sortWeight: 70 + product.unitsSold,
        title: `${product.productName} is running low`,
        message: `Only ${product.currentStock} units remain. Consider scheduling a restock soon.`,
      });
    }
  });

  customerSummaries.forEach((customer) => {
    if (!customer.lastPurchaseDate) {
      return;
    }

    const daysSinceLastPurchase = Math.floor((Date.now() - new Date(customer.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastPurchase >= 30 && customer.totalOrders > 0) {
      alerts.push({
        level: 'info',
        sortWeight: 40 + Math.min(daysSinceLastPurchase, 90),
        title: `${customer.fullName} has gone quiet`,
        message: `Their last purchase was ${daysSinceLastPurchase} days ago. A re-engagement campaign could bring them back.`,
      });
    }
  });

  if (categoryBreakdown[0]) {
    alerts.push({
      level: 'success',
      sortWeight: 20 + categoryBreakdown[0].revenue,
      title: `${categoryBreakdown[0].category} is leading revenue`,
      message: `This category currently contributes ${categoryBreakdown[0].revenue.toFixed(2)}JD and should stay prominent in promotions.`,
    });
  }

  return alerts.sort((left, right) => right.sortWeight - left.sortWeight).slice(0, 8);
};

// Chooses the single banner insight shown at the top of the admin dashboard.
const buildPrimaryInsight = (productSummaries, orders, products, alerts) => {
  const criticalTopSeller = productSummaries.find(
    (product) =>
      (product.inventoryStatus === 'Critical' || product.inventoryStatus === 'Out of Stock') &&
      product.revenueGenerated > 0,
  );

  if (criticalTopSeller) {
    return {
      severity: 'critical',
      title: `${criticalTopSeller.productName} is a top seller with critical stock`,
      message: `It has generated ${criticalTopSeller.revenueGenerated.toFixed(2)}JD while only ${criticalTopSeller.currentStock} units remain. Prioritize restocking this item first.`,
    };
  }

  const weeklyTrendInsight = getWeeklyTrendInsight(productSummaries, orders, products);

  if (weeklyTrendInsight) {
    return weeklyTrendInsight;
  }

  if (alerts[0]) {
    return {
      severity: alerts[0].level,
      title: alerts[0].title,
      message: alerts[0].message,
    };
  }

  return {
    severity: 'info',
    title: 'Athar dashboard is up to date',
    message: 'No urgent operational issues were detected in the current sales and stock data.',
  };
};

// Produces the complete dashboard payload consumed by the new /admin/dashboard page.
export const getAdminDashboardSnapshot = async () => {
  const snapshot = await loadReportingSnapshot();
  const customerSummaries = buildCustomerSummaries(snapshot);
  const productSummaries = buildProductSummaries(snapshot);
  const dailySummaries = buildDailySummaries({
    ...snapshot,
    customerSummaries,
  });
  const categoryBreakdown = buildCategoryBreakdown(productSummaries);
  const exportMeta = await getSalesExportMetadata();
  const confirmedOrders = snapshot.orders.filter((order) => ['Confirmed', 'Shipped', 'Delivered'].includes(order.status));
  const currentDate = new Date();
  const currentMonth = getMonthRange(currentDate, 0);
  const previousMonth = getMonthRange(currentDate, -1);

  const currentMonthOrders = confirmedOrders.filter((order) => isDateInRange(order.confirmedAt || order.createdAt, currentMonth.start, currentMonth.end));
  const previousMonthOrders = confirmedOrders.filter((order) => isDateInRange(order.confirmedAt || order.createdAt, previousMonth.start, previousMonth.end));
  const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const previousMonthRevenue = previousMonthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const currentAverageOrderValue = currentMonthOrders.length > 0 ? currentMonthRevenue / currentMonthOrders.length : 0;
  const previousAverageOrderValue = previousMonthOrders.length > 0 ? previousMonthRevenue / previousMonthOrders.length : 0;
  const repeatCustomerRate =
    customerSummaries.filter((customer) => customer.totalOrders > 1).length /
    Math.max(customerSummaries.filter((customer) => customer.totalOrders > 0).length, 1);

  const alerts = buildSmartAlerts(productSummaries, customerSummaries, categoryBreakdown);
  const insight = buildPrimaryInsight(productSummaries, confirmedOrders, snapshot.products, alerts);

  return {
    insight,
    kpis: [
      {
        id: 'revenue',
        label: 'Total Revenue This Month',
        value: Number(currentMonthRevenue.toFixed(2)),
        suffix: 'JD',
        delta: buildDelta(currentMonthRevenue, previousMonthRevenue),
      },
      {
        id: 'orders',
        label: 'Total Orders This Month',
        value: currentMonthOrders.length,
        suffix: '',
        delta: buildDelta(currentMonthOrders.length, previousMonthOrders.length),
      },
      {
        id: 'aov',
        label: 'Average Order Value',
        value: Number(currentAverageOrderValue.toFixed(2)),
        suffix: 'JD',
        delta: buildDelta(currentAverageOrderValue, previousAverageOrderValue),
      },
      {
        id: 'repeat-rate',
        label: 'Repeat Customer Rate',
        value: Number((repeatCustomerRate * 100).toFixed(1)),
        suffix: '%',
        delta: buildDelta(
          repeatCustomerRate,
          previousMonthOrders.length > 0
            ? previousMonthOrders.filter((order, index, array) => array.findIndex((candidate) => String(candidate.user?._id || candidate.user || '') === String(order.user?._id || order.user || '')) !== index).length /
              Math.max(previousMonthOrders.filter((order) => order.user).length, 1)
            : 0,
        ),
      },
    ],
    charts: {
      sales7Days: buildSalesSeries(dailySummaries, 7),
      sales30Days: buildSalesSeries(dailySummaries, 30),
      categoryBreakdown,
    },
    topProducts: productSummaries.slice(0, 8),
    alerts,
    export: {
      downloadPath: '/api/admin/dashboard/export',
      lastUpdatedAt: exportMeta.updatedAt,
      exists: exportMeta.exists,
    },
  };
};
