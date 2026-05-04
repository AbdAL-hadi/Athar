import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import User from '../../models/User.js';

const POINTS_AWARD_STATUSES = ['Confirmed', 'Shipped', 'Delivered'];

const isTransactionUnsupported = (error) => {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('replica set member or mongos') || message.includes('transaction numbers are only allowed');
};

const runWithLoyaltyTransaction = async (handler) => {
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
