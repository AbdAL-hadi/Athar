import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import User from '../../models/User.js';
import {
  FIRST_ORDER_POINTS,
  getLoyaltyRewardById,
  getLoyaltyRewardDiscount,
  LOYALTY_REWARD_IDS,
  normalizeAtharPoints,
  PRODUCT_REVIEW_POINTS,
} from '../../src/utils/loyaltyPoints.js';

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
  Math.max(
    Number(user?.rewardPoints ?? 0),
    Number(user?.atharPoints ?? 0),
    Number(user?.loyaltyPoints ?? 0),
  );

const syncUserPointBalances = (user, nextBalance) => {
  const normalizedBalance = normalizeAtharPoints(nextBalance);
  user.rewardPoints = normalizedBalance;
  user.atharPoints = normalizedBalance;
  user.loyaltyPoints = normalizedBalance;
};

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

    let pointsEarned = getOrderEarnedPoints(claimedOrder);
    const updatedUser = await getUserById(claimedOrder.user, session);

    if (!updatedUser) {
      throw new Error('Unable to add Athar Points because the customer account was not found.');
    }

    const currentBalance = getCurrentBalance(updatedUser);
    const lifetimeBaseline = Math.max(
      Number(updatedUser.lifetimeLoyaltyPoints ?? 0),
      Number(updatedUser.rewardPoints ?? 0),
      Number(updatedUser.atharPoints ?? 0),
      Number(updatedUser.loyaltyPoints ?? 0),
    );

    if (Number(claimedOrder.rewardPointsRedeemed || 0) > 0 && Number.isFinite(Number(claimedOrder.pointsBalanceAfter))) {
      syncUserPointBalances(updatedUser, claimedOrder.pointsBalanceAfter);
      updatedUser.lifetimeLoyaltyPoints = lifetimeBaseline + pointsEarned;

      if (!updatedUser.firstOrderRewardGranted) {
        updatedUser.firstOrderRewardGranted = true;
      }

      await updatedUser.save({ session });

      return {
        applied: true,
        appliedAt,
        pointsEarned,
        balance: getCurrentBalance(updatedUser),
        user: updatedUser,
      };
    }

    if (!updatedUser.firstOrderRewardGranted) {
      pointsEarned += FIRST_ORDER_POINTS;
      claimedOrder.firstOrderBonusPoints = FIRST_ORDER_POINTS;
      updatedUser.firstOrderRewardGranted = true;
      await claimedOrder.save({ session });
    }

    syncUserPointBalances(updatedUser, currentBalance + pointsEarned);
    updatedUser.lifetimeLoyaltyPoints = lifetimeBaseline + pointsEarned;

    await updatedUser.save({ session });

    return {
      applied: true,
      appliedAt,
      pointsEarned,
      balance: getCurrentBalance(updatedUser),
      user: updatedUser,
    };
  });
};

export const redeemLoyaltyRewardForCheckout = async ({
  userId,
  rewardId,
  subtotal = 0,
  shippingFee = 0,
  estimatedPointsFromOrder = null,
  session = null,
}) => {
  const normalizedSubtotal = Math.max(0, Number(subtotal) || 0);
  const normalizedShippingFee = Math.max(0, Number(shippingFee) || 0);
  const estimatedCheckoutPoints =
    estimatedPointsFromOrder === null || estimatedPointsFromOrder === undefined
      ? Math.floor(normalizedSubtotal + normalizedShippingFee)
      : Math.max(0, Math.floor(Number(estimatedPointsFromOrder) || 0));

  if (!rewardId) {
    return {
      reward: null,
      discountAmount: 0,
      appliedShippingFee: normalizedShippingFee,
      finalTotal: Math.max(0, normalizedSubtotal + normalizedShippingFee),
      updatedUser: null,
      currentBalance: null,
      remainingBalance: null,
      projectedBalanceBeforeRedemption: null,
      pointsBalanceAfterRedemption: null,
      estimatedPointsFromOrder: estimatedCheckoutPoints,
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
  const projectedBalanceBeforeRedemption = currentBalance + estimatedCheckoutPoints;

  if (projectedBalanceBeforeRedemption < reward.cost) {
    const error = new Error('Not enough Athar Points to redeem this reward.');
    error.statusCode = 400;
    throw error;
  }

  const pricing = getLoyaltyRewardDiscount(reward, {
    subtotal: normalizedSubtotal,
    shippingFee: normalizedShippingFee,
  });

  return {
    reward,
    discountAmount: pricing.discountAmount,
    appliedShippingFee: pricing.appliedShippingFee,
    finalTotal: pricing.finalTotal,
    updatedUser,
    currentBalance,
    remainingBalance: projectedBalanceBeforeRedemption - reward.cost,
    projectedBalanceBeforeRedemption,
    pointsBalanceAfterRedemption: projectedBalanceBeforeRedemption - reward.cost,
    estimatedPointsFromOrder: estimatedCheckoutPoints,
    pointsRedeemed: reward.cost,
  };
};

export const getCheckoutRewardId = (useRewardDiscount = false) =>
  useRewardDiscount ? LOYALTY_REWARD_IDS.CHECKOUT_30_PERCENT : '';

export const deductRewardPointsForCheckout = async ({ user, pointsRedeemed, session = null }) => {
  if (!user || Number(pointsRedeemed || 0) <= 0) {
    return user;
  }

  const currentBalance = getCurrentBalance(user);
  const nextBalance = normalizeAtharPoints(currentBalance - Number(pointsRedeemed || 0));
  syncUserPointBalances(user, nextBalance);
  await user.save({ session });
  return user;
};

export const awardProductReviewPoints = async ({ userId, session = null }) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return null;
  }

  const user = await getUserById(userId, session);

  if (!user) {
    return null;
  }

  const currentBalance = getCurrentBalance(user);
  const lifetimeBaseline = Math.max(
    Number(user.lifetimeLoyaltyPoints ?? 0),
    Number(user.rewardPoints ?? 0),
    Number(user.atharPoints ?? 0),
    Number(user.loyaltyPoints ?? 0),
  );

  syncUserPointBalances(user, currentBalance + PRODUCT_REVIEW_POINTS);
  user.lifetimeLoyaltyPoints = lifetimeBaseline + PRODUCT_REVIEW_POINTS;
  await user.save({ session });
  return user;
};
