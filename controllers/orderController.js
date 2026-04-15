import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { sendOrderWhatsAppMessage } from '../utils/notifications.js';

const normalizeAddress = (body = {}) => {
  const nestedAddress = body.address && typeof body.address === 'object' ? body.address : null;

  return {
    fullName: nestedAddress?.fullName ?? body.fullName ?? '',
    line1: nestedAddress?.line1 ?? body.address ?? '',
    city: nestedAddress?.city ?? body.city ?? '',
    postalCode: nestedAddress?.postalCode ?? body.postalCode ?? '',
    country: nestedAddress?.country ?? body.country ?? 'Palestine',
  };
};

const generateOrderNumber = () => {
  return `ATH${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
};

const ensureOrderNumber = async (order) => {
  if (order.orderNumber) {
    return order;
  }

  order.orderNumber = generateOrderNumber();
  await order.save();
  return order;
};

const canAccessOrder = (order, user) => {
  if (user?.role === 'admin') {
    return true;
  }

  const orderUserId =
    order.user?._id?.toString?.() ??
    order.user?.id?.toString?.() ??
    order.user?.toString?.() ??
    '';

  if (!user) {
    return !orderUserId;
  }

  return Boolean(orderUserId) && orderUserId === user._id.toString();
};

export const createOrder = async (req, res) => {
  try {
    const { items = [], shippingFee = 0, paymentMethod = 'Cash on Delivery', phone = '' } = req.body ?? {};
    const address = normalizeAddress(req.body ?? {});

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required.',
      });
    }

    if (paymentMethod !== 'Cash on Delivery') {
      return res.status(400).json({
        success: false,
        message: 'Only Cash on Delivery is supported right now.',
      });
    }

    if (!address.fullName || !address.line1 || !address.city || !address.postalCode || !address.country || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Shipping details are incomplete.',
      });
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId ?? item.product,
      quantity: Number(item.quantity ?? 0),
    }));

    if (normalizedItems.some((item) => !item.productId || item.quantity < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Each order item must include a product reference and quantity.',
      });
    }

    const productIds = normalizedItems.map((item) => item.productId).filter((value) => mongoose.isValidObjectId(value));
    const products = await Product.find({ _id: { $in: productIds } });
    const productLookup = new Map(products.map((product) => [product._id.toString(), product]));

    const orderItems = normalizedItems.map((item) => {
      const product = productLookup.get(String(item.productId));

      if (!product) {
        throw new Error(`Product ${item.productId} could not be found.`);
      }

      return {
        product: product._id,
        title: product.title,
        image: product.images[0],
        quantity: item.quantity,
        price: product.price,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const normalizedShippingFee = Number(shippingFee) || 0;
    const total = subtotal + normalizedShippingFee;

    const order = await Order.create({
      user: req.user?._id ?? null,
      orderNumber: generateOrderNumber(),
      items: orderItems,
      subtotal,
      shippingFee: normalizedShippingFee,
      total,
      status: 'Pending',
      paymentMethod,
      address,
      phone,
    });

    const populatedOrder = await Order.findById(order._id).populate('items.product').populate('user', 'name email role');
    let whatsappNotification = {
      delivered: false,
      channel: 'skipped',
    };

    try {
      whatsappNotification = await sendOrderWhatsAppMessage({
        phone,
        customerName: address.fullName,
        orderNumber: order.orderNumber,
        total,
      });
    } catch (notificationError) {
      console.error('[Athar WhatsApp] Failed to send order message:', notificationError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: populatedOrder,
      notifications: {
        whatsapp: whatsappNotification,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order.',
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    console.log('getMyOrders called - User:', {
      _id: req.user?._id,
      role: req.user?.role,
      email: req.user?.email,
    });

    // Employees and delivery personnel can see all orders, customers can only see their own
    const query = (req.user.role === 'employee' || req.user.role === 'delivery') ? {} : { user: req.user._id };
    
    console.log('Query for orders:', query);
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('items.product')
      .populate('user', 'name email phone');

    console.log('Orders found:', orders.length);

    for (const order of orders) {
      await ensureOrderNumber(order);
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error('getMyOrders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders.',
      error: error.message,
    });
  }
};

export const getConfirmedOrdersForDelivery = async (req, res) => {
  try {
    console.log('getConfirmedOrdersForDelivery called - User:', {
      _id: req.user?._id,
      role: req.user?.role,
      email: req.user?.email,
    });

    if (req.user?.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        message: 'Only delivery personnel can access this endpoint',
      });
    }

    console.log('Fetching all orders from database...');
    
    // Get ALL orders first to debug
    const allOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate('items.product')
      .populate('user', 'name email phone');

    console.log('Total orders in database:', allOrders.length);

    // Orders ready to be handed to delivery
    const confirmedOrders = allOrders.filter((order) => order.status === 'Confirmed');

    // Temporary issue reports sent by customers after shipment
    const reportedIssueOrders = allOrders.filter(
      (order) =>
        order.status === 'Shipped' &&
        !order.deliveryConfirmedByCustomer &&
        Boolean(order.deliveryConfirmedAt) &&
        Boolean(order.deliveryConfirmationMessage),
    );

    console.log('Confirmed orders:', confirmedOrders.length);
    console.log('Customer issue reports:', reportedIssueOrders.length);

    for (const order of confirmedOrders) {
      await ensureOrderNumber(order);
    }

    for (const order of reportedIssueOrders) {
      await ensureOrderNumber(order);
    }

    return res.status(200).json({
      success: true,
      count: confirmedOrders.length,
      totalOrdersInSystem: allOrders.length,
      data: confirmedOrders,
      issueReports: reportedIssueOrders,
    });
  } catch (error) {
    console.error('getConfirmedOrdersForDelivery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch confirmed orders',
      error: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'my') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      return getMyOrders(req, res);
    }

    const query = mongoose.isValidObjectId(id) ? { _id: id } : { orderNumber: id };

    const order = await Order.findOne(query)
      .populate('user', 'name email role')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    await ensureOrderNumber(order);

    if (!canAccessOrder(order, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this order',
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order.',
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body ?? {};

    if (!['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status.',
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    )
      .populate('user', 'name email role')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    await ensureOrderNumber(order);

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully.',
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status.',
    });
  }
};

export const confirmDeliveryByCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmed = false, message = '' } = req.body ?? {};

    if (!['true', 'false', true, false].includes(confirmed)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation value.',
      });
    }

    const query = mongoose.isValidObjectId(id) ? { _id: id } : { orderNumber: id };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!canAccessOrder(order, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this order',
      });
    }

    if (order.status !== 'Shipped') {
      return res.status(400).json({
        success: false,
        message: 'Order must be in Shipped status to confirm delivery',
      });
    }

    const confirmationMessage = confirmed
      ? `✓ Customer confirmed delivery received at ${new Date().toLocaleString()}`
      : `✗ Customer reported delivery issue: ${message || 'Order not received'}`;

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      {
        deliveryConfirmedByCustomer: confirmed,
        deliveryConfirmedAt: new Date(),
        deliveryConfirmationMessage: confirmationMessage,
        status: confirmed ? 'Delivered' : 'Shipped',
      },
      { new: true, runValidators: true },
    )
      .populate('user', 'name email role')
      .populate('items.product');

    return res.status(200).json({
      success: true,
      message: confirmed ? 'Delivery confirmed successfully.' : 'Delivery issue reported.',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm delivery.',
    });
  }
};
