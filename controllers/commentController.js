import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { recordBehaviorEventSafely } from '../services/behaviorEventService.js';
import { awardProductReviewPoints } from '../services/loyalty/loyaltyPointsService.js';
import { classifyCommentCategory, moderateComment } from '../services/moderation/commentModerationService.js';
import { sendCommentRejectedEmail } from '../utils/notifications.js';

const COMMENT_MAX_LENGTH = 500;
const ALLOWED_ADMIN_STATUSES = new Set(['approved', 'rejected', 'pending']);
const COMMENT_CATEGORIES = [
  'praise',
  'product_complaint',
  'delivery_complaint',
  'price_complaint',
  'offensive',
  'spam',
  'general_feedback',
  'unknown',
];
const PROBLEM_CATEGORIES = new Set(['product_complaint', 'delivery_complaint', 'price_complaint', 'offensive', 'spam']);
const DAY_MS = 24 * 60 * 60 * 1000;

const complaintKeywords = [
  { keyword: 'delivery', category: 'delivery_complaint' },
  { keyword: 'late', category: 'delivery_complaint' },
  { keyword: 'delayed', category: 'delivery_complaint' },
  { keyword: 'shipping', category: 'delivery_complaint' },
  { keyword: 'broken', category: 'product_complaint' },
  { keyword: 'broke', category: 'product_complaint' },
  { keyword: 'damaged', category: 'product_complaint' },
  { keyword: 'quality', category: 'product_complaint' },
  { keyword: 'color', category: 'product_complaint' },
  { keyword: 'size', category: 'product_complaint' },
  { keyword: 'wrong', category: 'product_complaint' },
  { keyword: 'bad', category: 'product_complaint' },
  { keyword: 'poor', category: 'product_complaint' },
  { keyword: 'disappointed', category: 'product_complaint' },
  { keyword: 'expensive', category: 'price_complaint' },
  { keyword: 'price', category: 'price_complaint' },
  { keyword: 'packaging', category: 'product_complaint' },
  { keyword: 'توصيل', category: 'delivery_complaint' },
  { keyword: 'تأخير', category: 'delivery_complaint' },
  { keyword: 'متأخر', category: 'delivery_complaint' },
  { keyword: 'شحن', category: 'delivery_complaint' },
  { keyword: 'مكسور', category: 'product_complaint' },
  { keyword: 'خربان', category: 'product_complaint' },
  { keyword: 'تالف', category: 'product_complaint' },
  { keyword: 'جودة', category: 'product_complaint' },
  { keyword: 'لون', category: 'product_complaint' },
  { keyword: 'مقاس', category: 'product_complaint' },
  { keyword: 'غلط', category: 'product_complaint' },
  { keyword: 'سيء', category: 'product_complaint' },
  { keyword: 'مش منيح', category: 'product_complaint' },
  { keyword: 'غالي', category: 'price_complaint' },
  { keyword: 'سعر', category: 'price_complaint' },
  { keyword: 'تغليف', category: 'product_complaint' },
];

const isObjectId = (value) => mongoose.isValidObjectId(String(value ?? ''));

const getModerationStatusFromDecision = (decision = '') =>
  decision === 'pending' ? 'needs_review' : decision === 'rejected' ? 'rejected' : 'approved';

const getDateMatchFromRange = (range = '7d') => {
  const normalizedRange = String(range || '7d').trim().toLowerCase();

  if (normalizedRange === 'all') {
    return {};
  }

  const now = new Date();

  if (normalizedRange === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { createdAt: { $gte: start, $lte: now } };
  }

  const days = normalizedRange === '30d' ? 30 : 7;
  return { createdAt: { $gte: new Date(now.getTime() - days * DAY_MS), $lte: now } };
};

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
  category: commentDocument.category || 'unknown',
  riskScore: Number(commentDocument.riskScore ?? commentDocument.moderationScore ?? 0),
  sentiment: commentDocument.sentiment || 'unknown',
  moderationStatus: commentDocument.moderationStatus || getModerationStatusFromDecision(commentDocument.status),
  moderationReasons: commentDocument.moderationReasons || [],
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
      category: moderation.category,
      sentiment: moderation.sentiment,
      riskScore: moderation.score,
      moderationStatus: getModerationStatusFromDecision(moderation.decision),
      moderationReasons: moderation.moderationReasons,
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
    const productId = String(req.query?.productId ?? '').trim();

    if (productId && isObjectId(productId)) {
      query.product = productId;
    }

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

const getEffectiveCategory = (comment) => {
  if (COMMENT_CATEGORIES.includes(comment.category)) {
    return comment.category;
  }

  return 'unknown';
};

const getEffectiveRiskScore = (comment) => Number(comment.riskScore ?? comment.moderationScore ?? 0);

const getEffectiveSentiment = (comment) => {
  if (comment.sentiment && comment.sentiment !== 'unknown') {
    return comment.sentiment;
  }

  const category = getEffectiveCategory(comment);
  if (category === 'praise') return 'positive';
  if (PROBLEM_CATEGORIES.has(category)) return 'negative';
  return 'unknown';
};

const isProblemComment = (comment) => {
  const category = getEffectiveCategory(comment);
  const status = comment.status || '';
  const moderationStatus = comment.moderationStatus || getModerationStatusFromDecision(status);

  return (
    getEffectiveSentiment(comment) === 'negative' ||
    PROBLEM_CATEGORIES.has(category) ||
    status === 'pending' ||
    status === 'rejected' ||
    moderationStatus === 'needs_review' ||
    moderationStatus === 'rejected' ||
    getEffectiveRiskScore(comment) >= 30
  );
};

const countComplaintKeywords = (comments) => {
  const keywordCounts = new Map();

  comments.filter(isProblemComment).forEach((comment) => {
    const text = String(comment.text || '').toLowerCase();

    complaintKeywords.forEach(({ keyword, category }) => {
      const normalizedKeyword = keyword.toLowerCase();
      if (!text.includes(normalizedKeyword)) return;

      const existing = keywordCounts.get(keyword) || { keyword, category, count: 0 };
      existing.count += 1;
      keywordCounts.set(keyword, existing);
    });
  });

  return [...keywordCounts.values()].sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword)).slice(0, 15);
};

const calculateTopFlaggedProducts = (comments) => {
  const byProduct = new Map();

  comments.forEach((comment) => {
    const productId = String(comment.product?._id || comment.product || '');
    if (!productId) return;

    const current = byProduct.get(productId) || {
      productId,
      productTitle: comment.productTitle || comment.product?.title || 'Unknown product',
      productSlug: comment.productSlug || comment.product?.slug || '',
      totalComments: 0,
      negativeComments: 0,
      needsReviewCount: 0,
      rejectedCount: 0,
      riskScoreTotal: 0,
      issueCounts: {},
    };
    const category = getEffectiveCategory(comment);
    const riskScore = getEffectiveRiskScore(comment);
    const moderationStatus = comment.moderationStatus || getModerationStatusFromDecision(comment.status);

    current.totalComments += 1;
    current.riskScoreTotal += riskScore;

    if (getEffectiveSentiment(comment) === 'negative' || PROBLEM_CATEGORIES.has(category) || riskScore >= 30) {
      current.negativeComments += 1;
    }

    if (comment.status === 'pending' || moderationStatus === 'needs_review') {
      current.needsReviewCount += 1;
    }

    if (comment.status === 'rejected' || moderationStatus === 'rejected') {
      current.rejectedCount += 1;
    }

    if (PROBLEM_CATEGORIES.has(category)) {
      current.issueCounts[category] = (current.issueCounts[category] || 0) + 1;
    }

    byProduct.set(productId, current);
  });

  return [...byProduct.values()]
    .map((item) => {
      const topIssueCategory =
        Object.entries(item.issueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

      return {
        productId: item.productId,
        productTitle: item.productTitle,
        productSlug: item.productSlug,
        totalComments: item.totalComments,
        negativeComments: item.negativeComments,
        needsReviewCount: item.needsReviewCount,
        rejectedCount: item.rejectedCount,
        averageRiskScore: Math.round(item.riskScoreTotal / Math.max(1, item.totalComments)),
        topIssueCategory,
      };
    })
    .filter(
      (item) =>
        item.negativeComments > 0 ||
        item.needsReviewCount > 0 ||
        item.rejectedCount > 0 ||
        item.averageRiskScore >= 30,
    )
    .sort((a, b) => {
      const aFlagged = a.needsReviewCount + a.rejectedCount;
      const bFlagged = b.needsReviewCount + b.rejectedCount;
      return bFlagged - aFlagged || b.averageRiskScore - a.averageRiskScore || b.negativeComments - a.negativeComments;
    })
    .slice(0, 10);
};

export const getAdminCommentAnalytics = async (req, res) => {
  try {
    const match = getDateMatchFromRange(req.query?.range || '7d');
    const comments = await Comment.find(match).populate('product', 'title slug').lean();
    const categoryCounts = COMMENT_CATEGORIES.reduce((lookup, category) => {
      lookup[category] = 0;
      return lookup;
    }, {});

    comments.forEach((comment) => {
      const category = getEffectiveCategory(comment);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        categoryBreakdown: COMMENT_CATEGORIES.map((category) => ({
          category,
          count: categoryCounts[category] || 0,
        })),
        topFlaggedProducts: calculateTopFlaggedProducts(comments),
        topComplaintKeywords: countComplaintKeywords(comments),
      },
    });
  } catch (error) {
    console.error('[Athar comments] Analytics failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not load comment analytics right now.',
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
    comment.moderationStatus = getModerationStatusFromDecision(nextStatus);
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
