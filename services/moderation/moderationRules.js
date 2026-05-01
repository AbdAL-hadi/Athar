// Expand these lists to match Athar's community policy and the languages used by visitors.
// The test tokens are intentionally harmless so the team can verify rejection safely.
export const moderationRuleGroups = [
  {
    category: 'threats',
    severity: 95,
    terms: [
      'athar_threat_test',
      'i will hurt you',
      'i will kill you',
      'kill yourself',
      'رح اقتلك',
      'بدي اضربك',
    ],
  },
  {
    category: 'hate',
    severity: 90,
    terms: [
      'athar_hate_test',
      'hate speech test',
      'كل الناس من هالنوع سيئين',
    ],
  },
  {
    category: 'profanity',
    severity: 85,
    terms: [
      'athar_badword_test',
      'idiot',
      'stupid',
      'غبي',
      'حقير',
      'تافه',
    ],
  },
  {
    category: 'harassment',
    severity: 65,
    terms: [
      'athar_harassment_test',
      'you are worthless',
      'nobody likes you',
      'انت فاشل',
      'ما حدا بحبك',
    ],
  },
  {
    category: 'spam',
    severity: 45,
    terms: [
      'athar_spam_test',
      'free money now',
      'click this link',
      'buy followers',
    ],
  },
];

export const suspiciousPatterns = [
  {
    id: 'too-many-links',
    label: 'spam',
    score: 45,
    pattern: /(https?:\/\/|www\.)/gi,
    minimumMatches: 2,
  },
  {
    id: 'excessive-uppercase',
    label: 'spam',
    score: 35,
    test: (text) => {
      const letters = text.replace(/[^a-z]/gi, '');
      return letters.length >= 18 && letters === letters.toUpperCase();
    },
  },
  {
    id: 'excessive-repetition',
    label: 'spam',
    score: 35,
    pattern: /(.{2,})\1{4,}/gi,
    minimumMatches: 1,
  },
];
