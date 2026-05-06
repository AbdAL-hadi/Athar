import Feedback from '../models/Feedback.js';
import User from '../models/User.js';

const canPersistAuthenticatedUser = (authenticatedUser) =>
  /^[0-9a-fA-F]{24}$/.test(String(authenticatedUser?._id ?? ''));

const getPersistentAuthenticatedUser = async (authenticatedUser) => {
  if (!canPersistAuthenticatedUser(authenticatedUser)) {
    return null;
  }

  return User.findById(authenticatedUser._id).select('-password');
};

const sanitizeFeedback = (feedbackDocument, currentUserId = '') => ({
  id: feedbackDocument._id.toString(),
  userId: feedbackDocument.user?.toString?.() ?? '',
  name: feedbackDocument.name,
  message: feedbackDocument.message,
  rating: Math.min(5, Math.max(1, Number(feedbackDocument.rating) || 5)),
  status: feedbackDocument.status || 'approved',
  createdAt: feedbackDocument.createdAt,
  updatedAt: feedbackDocument.updatedAt,
  isOwner:
    currentUserId &&
    String(feedbackDocument.user?.toString?.() ?? '') === String(currentUserId),
});

export const getFeedbackList = async (req, res) => {
  try {
    const currentUserId = req.user?._id?.toString?.() ?? '';
    const feedbackItems = await Feedback.find({
      $or: [{ status: 'approved' }, { status: { $exists: false } }],
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: feedbackItems.map((feedbackItem) =>
        sanitizeFeedback(feedbackItem, currentUserId),
      ),
    });
  } catch (error) {
    console.error('[Athar reviews] Fetch failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not load reviews right now.',
      error: error.message,
    });
  }
};

export const upsertFeedback = async (req, res) => {
  try {
    const user = await getPersistentAuthenticatedUser(req.user);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'This account cannot publish reviews from the current session.',
      });
    }

    if (user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customer accounts can add reviews.',
      });
    }

    const normalizedMessage = String(req.body?.message ?? '')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalizedMessage.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please write at least 10 characters in your review.',
      });
    }

    if (normalizedMessage.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Reviews must stay under 500 characters.',
      });
    }

    const normalizedRating = Math.round(Number(req.body?.rating ?? 5));

    if (normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a rating between 1 and 5 stars.',
      });
    }

    const feedback = await Feedback.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        name: user.name,
        message: normalizedMessage,
        rating: normalizedRating,
        status: 'approved',
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: 'Your review has been saved.',
      data: sanitizeFeedback(feedback, user._id.toString()),
    });
  } catch (error) {
    console.error('[Athar reviews] Save failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not save your review right now.',
      error: error.message,
    });
  }
};
