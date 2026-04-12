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
      req.user = null;
      next();
      return;
    }

    const payload = verifyAuthToken(token);

    if (!payload?.userId) {
      req.user = null;
      next();
      return;
    }

    const user = await User.findById(payload.userId).select('-password');
    req.user = user ?? null;
    next();
  } catch (error) {
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
