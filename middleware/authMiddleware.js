import User from '../models/User.js';
import { verifyAuthToken } from '../utils/auth.js';

const getTokenFromHeader = (authorizationHeader = '') => {
  if (!authorizationHeader.startsWith('Bearer ')) {
    return '';
  }

  return authorizationHeader.slice(7).trim();
};

export const attachUserIfPresent = async (req, _res, next) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization ?? '');

    if (!token) {
      console.log('No token provided');
      req.user = null;
      next();
      return;
    }

    const payload = verifyAuthToken(token);

    if (!payload?.userId) {
      console.log('Invalid token payload');
      req.user = null;
      next();
      return;
    }

    console.log('Token payload:', { userId: payload.userId, role: payload.role });

    // Handle mock employee user
    if (payload.userId === 'employee-001' && payload.role === 'employee') {
      console.log('Setting employee user');
      req.user = {
        _id: 'employee-001',
        name: 'Employee',
        email: 'employee@athar.com',
        phone: '+970000000000',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        role: 'employee',
        address: {
          line1: '',
          city: '',
          postalCode: '',
          country: 'Palestine',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      next();
      return;
    }

    // Handle mock delivery user
    if (payload.userId === 'delivery-001' && payload.role === 'delivery') {
      console.log('Setting delivery user');
      req.user = {
        _id: 'delivery-001',
        name: 'Delivery',
        email: 'delivery@athar.com',
        phone: '+970000000000',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        role: 'delivery',
        address: {
          line1: '',
          city: '',
          postalCode: '',
          country: 'Palestine',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      next();
      return;
    }

    const user = await User.findById(payload.userId).select('-password');
    req.user = user ?? null;
    next();
  } catch (error) {
    console.error('attachUserIfPresent error:', error);
    req.user = null;
    next();
  }
};

export const protect = async (req, res, next) => {
  await attachUserIfPresent(req, res, () => {});

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};

export const requireAdminOrEmployee = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'employee')) {
    return res.status(403).json({
      success: false,
      message: 'Admin or Employee access required',
    });
  }

  next();
};

export const requireAdminOrDelivery = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'delivery')) {
    return res.status(403).json({
      success: false,
      message: 'Admin or Delivery access required',
    });
  }

  next();
};

export const requireAdminOrEmployeeOrDelivery = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'employee' && req.user.role !== 'delivery')) {
    return res.status(403).json({
      success: false,
      message: 'Admin, Employee, or Delivery access required',
    });
  }

  next();
};
