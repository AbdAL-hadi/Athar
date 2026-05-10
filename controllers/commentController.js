import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { recordBehaviorEventSafely } from '../services/behaviorEventService.js';
import { awardProductReviewPoints } from '../services/loyalty/loyaltyPointsService.js';
import { moderateComment } from '../services/moderation/commentModerationService.js';
import { sendCommentRejectedEmail } from '../utils/notifications.js';

const COMMENT_MAX_LENGTH = 500;
const ALLOWED_ADMIN_STATUSES = new Set(['approved', 'rejected', 'pending']);

const isObjectId = (value) => mongoose.isValidObjectId(String(value ?? ''));

const findProductByReference = async (reference) => {
  const normalizedReference = String(reference ?? '').trim();

  if (!normalizedReference) {
    return null;
  }

  return isObjectId(normalizedReference)
    ? Product.findById(normalizedReference)
    : Product.findOne({ slug: normalizedReference.toLowerCase() });
};

const getPersistentAuthenticatedUser = async (authenticatedUser) => {
  if (isObjectId(authenticatedUser?._id)) {
    return User.findById(authenticatedUser._id).select('-password');
  }

  if (authenticatedUser?.email) {
    return User.findOne({ email: String(authenticatedUser.email).toLowerCase().trim() }).select('-password');
  }

  return null;
};

const sanitizePublicComment = (commentDocument, currentUserId = '') => ({
  id: commentDocument._id.toString(),
  productId: commentDocument.product?.toString?.() ?? '',
  productSlug: commentDocument.productSlug,
  authorName: commentDocument.authorName,
  text: commentDocument.text,
  rating: commentDocument.rating,
  status: commentDocument.status,
  createdAt: commentDocument.createdAt,
  updatedAt: commentDocument.updatedAt,
  isOwner:
    currentUserId &&
    String(commentDocument.user?.toString?.() ?? '') === String(currentUserId),
});

const sanitizeAdminComment = (commentDocument) => ({
  ...sanitizePublicComment(commentDocument),
  productTitle: commentDocument.productTitle,
  authorEmail: commentDocument.authorEmail,
  moderationScore: commentDocument.moderationScore,
  moderationDecision: commentDocument.moderationDecision,
  moderationReason: commentDocument.moderationReason,
  moderationLabels: commentDocument.moderationLabels,
  moderationDetails: commentDocument.moderationDetails,
  reviewedBy: commentDocument.reviewedBy,
  reviewedAt: commentDocument.reviewedAt,
});

const notifyRejectedComment = async (comment) => {
  try {
    await sendCommentRejectedEmail({
      email: comment.authorEmail,
      name: comment.authorName,
      reason: comment.moderationReason,
    });
  } catch (error) {
    console.error('[Athar moderation] Rejection email failed:', error.message);
  }
};

const grantProductReviewReward = async (comment) => {
  if (!comment || comment.status !== 'approved' || comment.rewardPointsGranted) {
    return null;
  }

  const existingRewardedComment = await Comment.findOne({
    _id: { $ne: comment._id },
    user: comment.user,
    product: comment.product,
    rewardPointsGranted: true,
  }).select('_id');

  if (existingRewardedComment) {
    return null;
  }

  const updatedUser = await awardProductReviewPoints({ userId: comment.user });
  comment.rewardPointsGranted = true;
  comment.rewardPointsGrantedAt = new Date();
  await comment.save();
  return updatedUser;
};

export const createProductComment = async (req, res) => {
  try {
    const user = await getPersistentAuthenticatedUser(req.user);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'This account cannot publish product comments from the current session.',
      });
    }

    const product = await findProductByReference(req.body?.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    const normalizedText = String(req.body?.text ?? '').replace(/\s+/g, ' ').trim();

    if (!normalizedText) {
      return res.status(400).json({
        success: false,
        message: 'Please write a comment before submitting.',
      });
    }

    if (normalizedText.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Comments must stay under ${COMMENT_MAX_LENGTH} characters.`,
      });
    }

    const rating = req.body?.rating === undefined || req.body?.rating === ''
      ? null
      : Number(req.body.rating);

    if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5.',
      });
    }

    const moderation = await moderateComment(normalizedText);
    const comment = await Comment.create({
      product: product._id,
      productSlug: product.slug,
      productTitle: product.title,
      user: user._id,
      authorName: user.name,
      authorEmail: user.email,
      text: normalizedText,
      rating,
      status: moderation.decision,
      moderationScore: moderation.score,
      moderationDecision: moderation.decision,
      moderationReason: moderation.reason,
      moderationLabels: moderation.labels,
      moderationDetails: moderation.details,
    });

    if (comment.status === 'rejected') {
      void notifyRejectedComment(comment);
    }

    if (comment.status === 'approved') {
      void grantProductReviewReward(comment).catch((error) => {
        console.error('[Athar comments] Review reward failed:', error.message);
      });
    }

    void recordBehaviorEventSafely({
      body: {
        eventType: 'review_create',
        quantity: 1,
        sourcePage: `/products/${product.slug}`,
        metadata: {
          status: comment.status || 'created',
          hasRating: rating !== null,
        },
      },
      user,
      product,
      userCity: user.address?.city || '',
    });

    const message =
      comment.status === 'approved'
        ? 'Comment published successfully.'
        : comment.status === 'rejected'
          ? 'Your comment was not published because it may violate community guidelines.'
          : 'Your comment is under review and will appear after approval.';

    return res.status(201).json({
      success: true,
      message,
      data: sanitizePublicComment(comment, user._id.toString()),
    });
  } catch (error) {
    console.error('[Athar comments] Create failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not save your comment right now.',
      error: error.message,
    });
  }
};

export const getApprovedProductComments = async (req, res) => {
  try {
    const product = await findProductByReference(req.params.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    const comments = await Comment.find({
      product: product._id,
      status: 'approved',
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const currentUserId = isObjectId(req.user?._id) ? String(req.user._id) : '';

    return res.status(200).json({
      success: true,
      data: comments.map((comment) => sanitizePublicComment(comment, currentUserId)),
    });
  } catch (error) {
    console.error('[Athar comments] Public fetch failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not load product comments right now.',
      error: error.message,
    });
  }
};

export const getAdminModerationComments = async (req, res) => {
  try {
    const status = String(req.query?.status ?? '').trim();
    const query = ALLOWED_ADMIN_STATUSES.has(status) ? { status } : {};
    const comments = await Comment.find(query)
      .sort({ status: -1, createdAt: -1 })
      .limit(150);

    return res.status(200).json({
      success: true,
      data: comments.map(sanitizeAdminComment),
    });
  } catch (error) {
    console.error('[Athar comments] Admin fetch failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not load moderation comments right now.',
      error: error.message,
    });
  }
};

export const updateAdminCommentStatus = async (req, res) => {
  try {
    const nextStatus = String(req.body?.status ?? '').trim();

    if (!ALLOWED_ADMIN_STATUSES.has(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved, rejected, or pending.',
      });
    }

    if (!isObjectId(req.params.commentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid comment ID.',
      });
    }

    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
      });
    }

    const wasRejected = comment.status === 'rejected';
    comment.status = nextStatus;
    comment.moderationDecision = nextStatus;
    comment.reviewedBy = req.user?.email || req.user?.name || 'admin';
    comment.reviewedAt = new Date();

    if (nextStatus === 'approved') {
      comment.moderationReason = 'Approved by admin review.';
    } else if (nextStatus === 'rejected') {
      comment.moderationReason = req.body?.reason
        ? String(req.body.reason).trim()
        : 'Rejected by admin review.';
    } else {
      comment.moderationReason = 'Returned to pending review by admin.';
    }

    await comment.save();

    if (nextStatus === 'approved') {
      await grantProductReviewReward(comment);
    }

    if (nextStatus === 'rejected' && !wasRejected) {
      void notifyRejectedComment(comment);
    }

    return res.status(200).json({
      success: true,
      message: `Comment marked as ${nextStatus}.`,
      data: sanitizeAdminComment(comment),
    });
  } catch (error) {
    console.error('[Athar comments] Admin status update failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not update the comment status right now.',
      error: error.message,
    });
  }
};
