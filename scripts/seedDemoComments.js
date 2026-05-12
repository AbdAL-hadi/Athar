import 'dotenv/config';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Comment from '../models/Comment.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { hashPassword } from '../utils/auth.js';

const DEMO_EMAIL = 'demo.customer@athar.local';
const DAY_MS = 24 * 60 * 60 * 1000;

const demoCommentTemplates = [
  { text: 'The product is beautiful and elegant. I love it.', rating: 5 },
  { text: 'المنتج جميل وممتاز وفخم.', rating: 5 },
  { text: 'Amazing design and perfect finish.', rating: 5 },
  { text: 'حبيت القطعة كثير، شكلها مرتب.', rating: 5 },

  { text: 'The bag zipper broke after one day.', rating: 2 },
  { text: 'الشنطة خرب السحاب تبعها بعد يوم.', rating: 2 },
  { text: 'The color was wrong compared with the photo.', rating: 2 },
  { text: 'المقاس غلط وما ناسبني.', rating: 2 },
  { text: 'The quality felt poor for daily use.', rating: 2 },
  { text: 'التغليف كان تالف شوي لما وصل.', rating: 2 },

  { text: 'Delivery was late and the package arrived after the expected date.', rating: 3 },
  { text: 'التوصيل كان متأخر والطلب وصل بعد الموعد.', rating: 3 },
  { text: 'Shipping was delayed and I had to follow up twice.', rating: 3 },
  { text: 'مندوب التوصيل تأخر كثير.', rating: 3 },

  { text: 'The product is nice but the price is expensive.', rating: 3 },
  { text: 'المنتج حلو بس السعر غالي.', rating: 3 },
  { text: 'The price feels overpriced for this item.', rating: 3 },
  { text: 'السعر مكلف مقارنة بالحجم.', rating: 3 },

  { text: 'The design is nice, but I wish there were more colors.', rating: 4 },
  { text: 'التصميم مرتب بس بتمنى يكون في ألوان أكثر.', rating: 4 },
  { text: 'I like the idea and hope to see a smaller version.', rating: 4 },
  { text: 'الخامة لطيفة وبقترح تضيفوا لون فضي.', rating: 4 },

  { text: 'Click this link http://spam.com www.fake-offer.com for free money now.', rating: null },
  { text: 'athar_spam_test visit www.fake-offer.com and click this link for free money now.', rating: null },
  { text: 'Visit www.fake-offer.com and http://spam.com for free prizes.', rating: null },
  { text: 'promo spam click this link for free money now.', rating: null },

  { text: 'athar_badword_test safe moderation rejection sample.', rating: null },
  { text: 'athar_threat_test safe moderation rejection sample.', rating: null },
];

const detectLanguage = (text = '') => {
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasEnglish = /[A-Za-z]/.test(text);

  if (hasArabic && hasEnglish) return 'mixed';
  if (hasArabic) return 'ar';
  if (hasEnglish) return 'en';
  return 'unknown';
};

const getModerationStatusFromDecision = (decision = '') =>
  decision === 'pending' ? 'needs_review' : decision === 'rejected' ? 'rejected' : 'approved';

const getOrCreateDemoUser = async () => {
  const existingUser = await User.findOne({ email: DEMO_EMAIL });

  if (existingUser) {
    existingUser.name = 'Demo Customer';
    existingUser.role = 'customer';
    existingUser.phone = existingUser.phone || '+970000000000';
    existingUser.isEmailVerified = true;
    existingUser.emailVerifiedAt = existingUser.emailVerifiedAt || new Date();
    existingUser.address = {
      line1: existingUser.address?.line1 || 'Demo address',
      city: existingUser.address?.city || 'nablus',
      postalCode: existingUser.address?.postalCode || '0000',
      country: existingUser.address?.country || 'Palestine',
    };
    await existingUser.save();
    return existingUser;
  }

  return User.create({
    name: 'Demo Customer',
    email: DEMO_EMAIL,
    password: await hashPassword('DemoCustomer@123'),
    phone: '+970000000000',
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    role: 'customer',
    address: {
      line1: 'Demo address',
      city: 'nablus',
      postalCode: '0000',
      country: 'Palestine',
    },
    favorites: [],
  });
};

const buildCreatedAt = (index) => {
  const now = new Date();
  const daysAgo = index % 7;
  const hoursAgo = (index % 5) * 3;
  return new Date(now.getTime() - daysAgo * DAY_MS - hoursAgo * 60 * 60 * 1000);
};

const run = async () => {
  await connectDB();

  const products = await Product.find().sort({ title: 1 }).select('title slug').lean();

  if (products.length === 0) {
    console.log('No products found. Seed products before running demo comments.');
    return;
  }

  const { moderateComment } = await import('../services/moderation/commentModerationService.js');
  const demoUser = await getOrCreateDemoUser();
  const deleteResult = await Comment.deleteMany({ demoSeed: true });
  const insertedComments = [];

  for (const [index, template] of demoCommentTemplates.entries()) {
    const product = products[index % products.length];
    const text = String(template.text).replace(/\s+/g, ' ').trim();
    const moderation = await moderateComment(text);
    const createdAt = buildCreatedAt(index);
    const comment = new Comment({
      product: product._id,
      productSlug: product.slug,
      productTitle: product.title,
      user: demoUser._id,
      authorName: demoUser.name,
      authorEmail: demoUser.email,
      text,
      rating: template.rating,
      status: moderation.decision,
      category: moderation.category,
      sentiment: moderation.sentiment,
      riskScore: moderation.score,
      moderationStatus: getModerationStatusFromDecision(moderation.decision),
      moderationReasons: moderation.moderationReasons,
      moderationScore: moderation.score,
      moderationDecision: moderation.decision,
      moderationReason: moderation.reason,
      moderationLabels: moderation.labels,
      moderationDetails: moderation.details,
      language: detectLanguage(text),
      analyzedAt: createdAt,
      demoSeed: true,
      createdAt,
      updatedAt: createdAt,
    });

    await comment.save({ timestamps: false });
    insertedComments.push(comment);
  }

  const summary = insertedComments.reduce(
    (result, comment) => {
      result.byStatus[comment.status] = (result.byStatus[comment.status] || 0) + 1;
      result.byCategory[comment.category] = (result.byCategory[comment.category] || 0) + 1;
      return result;
    },
    { byStatus: {}, byCategory: {} },
  );

  console.log(
    JSON.stringify(
      {
        deletedPreviousDemoComments: deleteResult.deletedCount || 0,
        inserted: insertedComments.length,
        productsUsed: Math.min(products.length, insertedComments.length),
        demoUser: DEMO_EMAIL,
        ...summary,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error('Demo comment seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
