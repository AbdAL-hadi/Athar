import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import User from '../../models/User.js';
import { getLoyaltyRewardById, getLoyaltyRewardDiscount, normalizeAtharPoints } from '../../src/utils/loyaltyPoints.js';

const POINTS_AWARD_STATUSES = ['Confirmed', 'Shipped', 'Delivered'];

const isTransactionUnsupported = (error) => {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('replica set member or mongos') || message.includes('transaction numbers are only allowed');
};

export const runWithLoyaltyTransaction = async (handler) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await handler(session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupported(error)) {
      throw error;
    }

    console.warn('[Athar loyalty] Mongo transactions are unavailable. Falling back to sequential loyalty writes for local development.');
    return handler(null);
  } finally {
    await session.endSession();
  }
};

const getOrderById = (orderId, session) => {
  const query = Order.findById(orderId);
  return session ? query.session(session) : query;
};

const getUserById = (userId, session) => {
  const query = User.findById(userId).select('-password');
  return session ? query.session(session) : query;
};

const getCurrentBalance = (user = null) =>
  Math.max(Number(user?.atharPoints ?? 0), Number(user?.loyaltyPoints ?? 0));

const getOrderEarnedPoints = (order = null) => {
  const earnedPoints = Number(order?.earnedPoints ?? 0);
  const legacyEarnedPoints = Number(order?.loyaltyPointsEarned ?? 0);
  return Math.max(0, earnedPoints || legacyEarnedPoints || 0);
};

const emptyAwardResult = (order = null) => ({
  applied: Boolean(order?.pointsAdded || order?.loyaltyPointsAppliedAt),
  appliedAt: order?.loyaltyPointsAppliedAt ?? null,
  pointsEarned: getOrderEarnedPoints(order),
  balance: null,
  user: null,
});

export const awardLoyaltyPointsForOrder = async (orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    return emptyAwardResult();
  }

  return runWithLoyaltyTransaction(async (session) => {
    const appliedAt = new Date();
    const claimQuery = Order.findOneAndUpdate(
      {
        _id: orderId,
        user: { $ne: null },
        status: { $in: POINTS_AWARD_STATUSES },
        pointsAdded: { $ne: true },
        loyaltyPointsAppliedAt: null,
        $or: [{ earnedPoints: { $gt: 0 } }, { loyaltyPointsEarned: { $gt: 0 } }],
      },
      {
        $set: {
          loyaltyPointsAppliedAt: appliedAt,
          pointsAdded: true,
        },
      },
      { new: true },
    );
    const claimedOrder = session ? await claimQuery.session(session) : await claimQuery;

    if (!claimedOrder) {
      return emptyAwardResult(await getOrderById(orderId, session));
    }

    const pointsEarned = getOrderEarnedPoints(claimedOrder);
    const updatedUser = await getUserById(claimedOrder.user, session);

    if (!updatedUser) {
      throw new Error('Unable to add Athar Points because the customer account was not found.');
    }

    const currentBalance = Math.max(
      Number(updatedUser.atharPoints ?? 0),
      Number(updatedUser.loyaltyPoints ?? 0),
    );
    const lifetimeBaseline = Math.max(
      Number(updatedUser.lifetimeLoyaltyPoints ?? 0),
      Number(updatedUser.atharPoints ?? 0),
      Number(updatedUser.loyaltyPoints ?? 0),
    );

    updatedUser.atharPoints = currentBalance + pointsEarned;
    updatedUser.loyaltyPoints = currentBalance + pointsEarned;
    updatedUser.lifetimeLoyaltyPoints = lifetimeBaseline + pointsEarned;

    await updatedUser.save({ session });

    return {
      applied: true,
      appliedAt,
      pointsEarned,
      balance: Math.max(Number(updatedUser.atharPoints ?? 0), Number(updatedUser.loyaltyPoints ?? 0)),
      user: updatedUser,
    };
  });
};

export const redeemLoyaltyRewardForCheckout = async ({
  userId,
  rewardId,
  subtotal = 0,
  shippingFee = 0,
  session = null,
}) => {
  if (!rewardId) {
    return {
      reward: null,
      discountAmount: 0,
      appliedShippingFee: Math.max(0, Number(shippingFee) || 0),
      finalTotal: Math.max(0, (Number(subtotal) || 0) + (Number(shippingFee) || 0)),
      updatedUser: null,
      remainingBalance: null,
      pointsRedeemed: 0,
    };
  }

  if (!userId || !mongoose.isValidObjectId(userId)) {
    const error = new Error('Log in to redeem Athar Points at checkout.');
    error.statusCode = 401;
    throw error;
  }

  const reward = getLoyaltyRewardById(rewardId);

  if (!reward) {
    const error = new Error('The selected Athar reward is not valid.');
    error.statusCode = 400;
    throw error;
  }

  const updatedUser = await getUserById(userId, session);

  if (!updatedUser) {
    const error = new Error('Unable to find your Athar account for reward redemption.');
    error.statusCode = 404;
    throw error;
  }

  const currentBalance = getCurrentBalance(updatedUser);

  if (currentBalance < reward.cost) {
    const error = new Error('You do not have enough Athar Points for this reward.');
    error.statusCode = 409;
    throw error;
  }

  const pricing = getLoyaltyRewardDiscount(reward, { subtotal, shippingFee });

  updatedUser.atharPoints = normalizeAtharPoints(currentBalance - reward.cost);
  updatedUser.loyaltyPoints = normalizeAtharPoints(currentBalance - reward.cost);
  await updatedUser.save({ session });

  return {
    reward,
    discountAmount: pricing.discountAmount,
    appliedShippingFee: pricing.appliedShippingFee,
    finalTotal: pricing.finalTotal,
    updatedUser,
    remainingBalance: getCurrentBalance(updatedUser),
    pointsRedeemed: reward.cost,
  };
};
