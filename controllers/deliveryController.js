import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { getCityLabel, isKnownCityValue, normalizeCityValue } from '../constants/palestinianCities.js';
import { transitionOrderStatusWithInventory } from '../services/admin/inventoryService.js';

const DELIVERY_ACCOUNT_EMAIL = 'delivery@athar.com';
const DELIVERY_ORDER_STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

const sanitizeDeliveryUser = (userDocument) => ({
  id: userDocument._id?.toString?.() ?? String(userDocument._id ?? ''),
  name: userDocument.name,
  email: userDocument.email,
  phone: userDocument.phone,
  role: userDocument.role,
  deliveryCity: userDocument.deliveryCity ?? '',
  deliveryCityLabel: getCityLabel(userDocument.deliveryCity ?? ''),
  address: userDocument.address,
  profilePicture: userDocument.profilePicture ?? '',
  createdAt: userDocument.createdAt,
  updatedAt: userDocument.updatedAt,
});

const getOrderCity = (order) => order?.shippingAddress?.city ?? order?.address?.city ?? order?.city ?? '';

const populateOrderQuery = (query) =>
  query
    .sort({ createdAt: -1 })
    .populate('items.product')
    .populate('user', 'name email phone role');

const getPersistentDeliveryUser = async (authenticatedUser) => {
  if (authenticatedUser?.role === 'admin') {
    return User.findOne({ email: DELIVERY_ACCOUNT_EMAIL }).select('-password');
  }

  if (authenticatedUser?.role !== 'delivery') {
    return null;
  }

  if (mongoose.isValidObjectId(authenticatedUser._id)) {
    const deliveryUser = await User.findById(authenticatedUser._id).select('-password');
    if (deliveryUser) return deliveryUser;
  }

  return User.findOne({ email: DELIVERY_ACCOUNT_EMAIL }).select('-password');
};

export const getDeliveryProfile = async (req, res) => {
  try {
    const deliveryUser = await getPersistentDeliveryUser(req.user);

    if (!deliveryUser) {
      return res.status(404).json({
        success: false,
        message: 'Delivery profile was not found. Please log in as the delivery account first.',
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeDeliveryUser(deliveryUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load delivery profile.',
      error: error.message,
    });
  }
};

export const updateDeliveryProfile = async (req, res) => {
  try {
    const deliveryUser = await getPersistentDeliveryUser(req.user);

    if (!deliveryUser) {
      return res.status(404).json({
        success: false,
        message: 'Delivery profile was not found. Please log in as the delivery account first.',
      });
    }

    const name = String(req.body?.name ?? deliveryUser.name ?? '').trim();
    const phone = String(req.body?.phone ?? deliveryUser.phone ?? '').trim();
    const deliveryCity = normalizeCityValue(req.body?.deliveryCity ?? deliveryUser.deliveryCity ?? '');

    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.',
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required.',
      });
    }

    if (deliveryCity && !isKnownCityValue(deliveryCity)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a valid Palestinian city.',
      });
    }

    deliveryUser.name = name;
    deliveryUser.phone = phone;
    deliveryUser.deliveryCity = deliveryCity;
    deliveryUser.role = 'delivery';

    await deliveryUser.save();

    return res.status(200).json({
      success: true,
      message: 'Delivery profile updated successfully.',
      data: sanitizeDeliveryUser(deliveryUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery profile.',
      error: error.message,
    });
  }
};

export const getDeliveryOrders = async (_req, res) => {
  try {
    const orders = await populateOrderQuery(Order.find({ status: { $in: DELIVERY_ORDER_STATUSES } }));

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery orders.',
      error: error.message,
    });
  }
};

export const getMyCityDeliveryOrders = async (req, res) => {
  try {
    const deliveryUser = await getPersistentDeliveryUser(req.user);
    const deliveryCity = normalizeCityValue(deliveryUser?.deliveryCity ?? req.user?.deliveryCity ?? '');

    if (!deliveryCity) {
      return res.status(200).json({
        success: true,
        count: 0,
        deliveryCity: '',
        deliveryCityLabel: '',
        data: [],
        requiresDeliveryCity: true,
        message: 'Please set your delivery city in your profile to view city-specific orders.',
      });
    }

    const orders = await populateOrderQuery(Order.find({ status: { $in: DELIVERY_ORDER_STATUSES } }));
    const cityOrders = orders.filter((order) => normalizeCityValue(getOrderCity(order)) === deliveryCity);

    return res.status(200).json({
      success: true,
      count: cityOrders.length,
      deliveryCity,
      deliveryCityLabel: getCityLabel(deliveryCity),
      data: cityOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch city delivery orders.',
      error: error.message,
    });
  }
};

export const markDeliveryOrderShipped = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Delivered orders cannot be marked as shipped again.',
      });
    }

    if (!['Pending', 'Confirmed', 'Shipped'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or confirmed orders can be marked as shipped.',
      });
    }

    const updatedOrder = await transitionOrderStatusWithInventory({
      orderId: order._id,
      nextStatus: 'Shipped',
      extraUpdates: {
        deliveryConfirmationMessage: order.deliveryConfirmationMessage || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: order.inventoryApplied
        ? 'Order was already shipped. Stock was not decremented again.'
        : 'Order marked as shipped and stock updated.',
      data: updatedOrder,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to mark order as shipped.',
    });
  }
};

export const markDeliveryOrderDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (order.status === 'Delivered') {
      const populatedOrder = await Order.findById(order._id).populate('user', 'name email role').populate('items.product');
      return res.status(200).json({
        success: true,
        message: 'Order is already delivered.',
        data: populatedOrder,
      });
    }

    if (order.status !== 'Shipped') {
      return res.status(400).json({
        success: false,
        message: 'Only shipped orders can be marked as delivered.',
      });
    }

    const updatedOrder = await transitionOrderStatusWithInventory({
      orderId: order._id,
      nextStatus: 'Delivered',
      extraUpdates: {
        deliveryConfirmedByCustomer: true,
        deliveryConfirmedAt: new Date(),
        deliveryConfirmationMessage: order.deliveryConfirmationMessage || 'Delivery team marked this order as delivered.',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Order marked as delivered.',
      data: updatedOrder,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to mark order as delivered.',
    });
  }
};
