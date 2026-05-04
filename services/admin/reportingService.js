import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import User from '../../models/User.js';
import { DEFAULT_LOW_STOCK_THRESHOLD, SALE_STATUSES } from './constants.js';
import { getInventoryState } from './inventoryState.js';

// Converts any stored date into a stable YYYY-MM-DD key used by charts and exports.
const toDateKey = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

// Formats a date value into an Excel-friendly ISO timestamp string.
const toIsoStringOrEmpty = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

// Picks the date that best represents a confirmed sale for analytics.
export const getSaleEventDate = (order) => {
  return order?.confirmedAt || order?.createdAt || null;
};

// Returns true when an order should count toward revenue and confirmed sales analytics.
export const isConfirmedSaleOrder = (order) => SALE_STATUSES.includes(order?.status);

// Normalizes a customer grouping key so both registered and guest orders can be aggregated.
const getCustomerKey = (order) => {
  if (order?.user?._id) {
    return `user:${order.user._id.toString()}`;
  }

  if (order?.user) {
    return `user:${String(order.user)}`;
  }

  if (order?.phone) {
    return `guest:${String(order.phone).trim()}`;
  }

  return `guest-order:${String(order?._id ?? Math.random())}`;
};

// Builds a friendly customer label for guests when there is no registered account.
const getGuestCustomerDisplayName = (order) => {
  return order?.address?.fullName || 'Guest customer';
};

// Loads the core Mongo collections used by exports and dashboard analytics.
export const loadReportingSnapshot = async () => {
  const [users, products, orders] = await Promise.all([
    User.find().lean(),
    Product.find().lean(),
    Order.find().populate('user', 'name email phone role').lean(),
  ]);

  return {
    users,
    products,
    orders,
  };
};

// Aggregates users and guest orders into dashboard/export customer summaries.
export const buildCustomerSummaries = ({ users, orders, products }) => {
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const customerMap = new Map();

  users
    .filter((user) => user.role === 'customer')
    .forEach((user) => {
      customerMap.set(`user:${user._id.toString()}`, {
        customerId: user._id.toString(),
        fullName: user.name,
        email: user.email,
        phone: user.phone,
        totalOrders: 0,
        totalSpent: 0,
        firstPurchaseDate: '',
        lastPurchaseDate: '',
        topCategory: '',
        categoryRevenue: new Map(),
        customerSegment: 'New',
      });
    });

  orders
    .filter(isConfirmedSaleOrder)
    .forEach((order) => {
      const customerKey = getCustomerKey(order);
      const saleDate = getSaleEventDate(order);
      const saleDateKey = toIsoStringOrEmpty(saleDate);
      const existingCustomer =
        customerMap.get(customerKey) ||
        {
          customerId: order?.user?._id?.toString?.() || customerKey.replace(/^guest:/, ''),
          fullName: order?.user?.name || getGuestCustomerDisplayName(order),
          email: order?.user?.email || '',
          phone: order?.user?.phone || order?.phone || '',
          totalOrders: 0,
          totalSpent: 0,
          firstPurchaseDate: '',
          lastPurchaseDate: '',
          topCategory: '',
          categoryRevenue: new Map(),
          customerSegment: 'New',
        };

      existingCustomer.totalOrders += 1;
      existingCustomer.totalSpent += Number(order.total || 0);
      existingCustomer.firstPurchaseDate =
        !existingCustomer.firstPurchaseDate || saleDateKey < existingCustomer.firstPurchaseDate
          ? saleDateKey
          : existingCustomer.firstPurchaseDate;
      existingCustomer.lastPurchaseDate =
        !existingCustomer.lastPurchaseDate || saleDateKey > existingCustomer.lastPurchaseDate
          ? saleDateKey
          : existingCustomer.lastPurchaseDate;

      order.items.forEach((item) => {
        const product =
          productMap.get(item?.product?._id?.toString?.() || item?.product?.toString?.() || '') || null;
        const category = product?.category || 'Accessories';
        const categoryRevenue = existingCustomer.categoryRevenue.get(category) || 0;
        existingCustomer.categoryRevenue.set(category, categoryRevenue + Number(item.price || 0) * Number(item.quantity || 0));
      });

      customerMap.set(customerKey, existingCustomer);
    });

  return Array.from(customerMap.values())
    .map((customer) => {
      const topCategoryEntry = Array.from(customer.categoryRevenue.entries()).sort((left, right) => right[1] - left[1])[0];
      const customerSegment =
        customer.totalSpent >= 500 || customer.totalOrders >= 5
          ? 'VIP'
          : customer.totalOrders > 1
            ? 'Regular'
            : 'New';

      return {
        ...customer,
        totalSpent: Number(customer.totalSpent.toFixed(2)),
        topCategory: topCategoryEntry?.[0] || '',
        customerSegment,
      };
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
};

// Aggregates per-product sales, stock state, and revenue for tables and exports.
export const buildProductSummaries = ({ products, orders }) => {
  const productSummaryMap = new Map(
    products.map((product) => [
      product._id.toString(),
      {
        productId: product._id.toString(),
        productName: product.title,
        category: product.category,
        currentStock: Number(product.stock || 0),
        unitsSold: 0,
        revenueGenerated: 0,
        lastRestockDate: toIsoStringOrEmpty(product.lastRestockDate),
        ...getInventoryState(product.stock, product.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD),
      },
    ]),
  );

  orders
    .filter(isConfirmedSaleOrder)
    .forEach((order) => {
      order.items.forEach((item) => {
        const productId = item?.product?._id?.toString?.() || item?.product?.toString?.() || '';
        const summary = productSummaryMap.get(productId);

        if (!summary) {
          return;
        }

        summary.unitsSold += Number(item.quantity || 0);
        summary.revenueGenerated += Number(item.price || 0) * Number(item.quantity || 0);
      });
    });

  return Array.from(productSummaryMap.values())
    .map((summary) => ({
      ...summary,
      revenueGenerated: Number(summary.revenueGenerated.toFixed(2)),
    }))
    .sort((left, right) => right.revenueGenerated - left.revenueGenerated);
};

// Aggregates day-level totals that feed both the Summary sheet and dashboard charts.
export const buildDailySummaries = ({ orders, products, customerSummaries }) => {
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const dayMap = new Map();
  const firstPurchaseDateMap = new Map();

  customerSummaries.forEach((customer) => {
    if (customer.firstPurchaseDate) {
      firstPurchaseDateMap.set(customer.firstPurchaseDate.slice(0, 10), (firstPurchaseDateMap.get(customer.firstPurchaseDate.slice(0, 10)) || 0) + 1);
    }
  });

  orders
    .filter(isConfirmedSaleOrder)
    .forEach((order) => {
      const saleDateKey = toDateKey(getSaleEventDate(order));

      if (!saleDateKey) {
        return;
      }

      const existingDay =
        dayMap.get(saleDateKey) ||
        {
          date: saleDateKey,
          totalRevenue: 0,
          totalOrders: 0,
          newCustomers: firstPurchaseDateMap.get(saleDateKey) || 0,
          productRevenue: new Map(),
          categoryRevenue: new Map(),
          averageOrderValue: 0,
        };

      existingDay.totalRevenue += Number(order.total || 0);
      existingDay.totalOrders += 1;

      order.items.forEach((item) => {
        const productId = item?.product?._id?.toString?.() || item?.product?.toString?.() || '';
        const product = productMap.get(productId);
        const productName = item.title || product?.title || 'Unknown product';
        const categoryName = product?.category || 'Accessories';
        const itemRevenue = Number(item.price || 0) * Number(item.quantity || 0);

        existingDay.productRevenue.set(productName, (existingDay.productRevenue.get(productName) || 0) + itemRevenue);
        existingDay.categoryRevenue.set(categoryName, (existingDay.categoryRevenue.get(categoryName) || 0) + itemRevenue);
      });

      dayMap.set(saleDateKey, existingDay);
    });

  return Array.from(dayMap.values())
    .map((day) => {
      const topProduct = Array.from(day.productRevenue.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || '';
      const topCategory = Array.from(day.categoryRevenue.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || '';

      return {
        date: day.date,
        totalRevenue: Number(day.totalRevenue.toFixed(2)),
        totalOrders: day.totalOrders,
        newCustomers: day.newCustomers,
        topProduct,
        topCategory,
        averageOrderValue: day.totalOrders > 0 ? Number((day.totalRevenue / day.totalOrders).toFixed(2)) : 0,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
};

// Creates Orders sheet rows with one row per ordered product line.
export const buildOrderRows = ({ orders, products }) => {
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  return orders
    .filter(isConfirmedSaleOrder)
    .flatMap((order) =>
      order.items.map((item) => {
        const product = productMap.get(item?.product?._id?.toString?.() || item?.product?.toString?.() || '');
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.price || 0);
        const lineTotal = quantity * unitPrice;

        return {
          orderId: order.orderNumber || order._id.toString(),
          customerName: order?.user?.name || order?.address?.fullName || 'Guest customer',
          customerEmail: order?.user?.email || '',
          customerPhone: order?.user?.phone || order?.phone || '',
          productName: item.title || product?.title || 'Unknown product',
          category: product?.category || 'Accessories',
          quantity,
          unitPrice,
          totalPrice: Number(lineTotal.toFixed(2)),
          orderStatus: order.status,
          paymentMethod: order.paymentMethod,
          orderDate: toIsoStringOrEmpty(order.createdAt),
          deliveryDate: toIsoStringOrEmpty(order.deliveryConfirmedAt || (order.status === 'Delivered' ? order.updatedAt : null)),
        };
      }),
    );
};
