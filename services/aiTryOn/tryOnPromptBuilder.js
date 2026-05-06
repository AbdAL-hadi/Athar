const PRODUCT_TYPE_ALIASES = {
  glasses: 'sunglasses',
  sunglass: 'sunglasses',
  sunglasses: 'sunglasses',
  eyewear: 'sunglasses',
  rings: 'ring',
  ring: 'ring',
  bracelets: 'bracelet',
  bracelet: 'bracelet',
  bangle: 'bracelet',
  bangles: 'bracelet',
  watches: 'watch',
  watch: 'watch',
  necklace: 'necklace',
  necklaces: 'necklace',
  pendant: 'necklace',
  pendants: 'necklace',
  earring: 'earrings',
  earrings: 'earrings',
  bags: 'bag',
  bag: 'bag',
  handbag: 'bag',
  carryall: 'bag',
  wallet: 'wallet',
  wallets: 'wallet',
  cardholder: 'wallet',
  'card-holder': 'wallet',
  'card holder': 'wallet',
};

export const TRY_ON_PRODUCT_RULES = {
  ring: {
    visibleArea: 'hand and fingers',
    keywords: [/ring/i, /rings/i, /band/i, /خاتم/i],
    instructions: [
      'Ensure one hand is clearly visible with natural, readable fingers.',
      'If the original pose hides the hand or places it inside a pocket, naturally reposition one hand so the ring is visible.',
      'Prefer a natural pose where the ring hand is slightly raised near the torso, waist, or chest.',
      'Place the ring on a realistic finger with correct scale, perspective, and contact with the skin.',
      'Keep the hand elegant and natural; avoid awkward, exaggerated, or distorted hand poses.',
    ],
    poseCorrections: [
      'For hand jewelry, visibility takes priority over copying a hidden-hand pose.',
      'If hands are inside pockets, cropped out, behind the body, or too small, create a minimal believable pose adjustment that reveals one hand and fingers.',
    ],
  },
  bracelet: {
    visibleArea: 'wrist and forearm',
    keywords: [/bracelet/i, /bracelets/i, /bangle/i, /cuff/i, /hand chain/i, /سوار/i],
    instructions: [
      'Ensure the wrist and part of the forearm are clearly visible.',
      'If sleeves cover the bracelet area, adjust the sleeve or arm pose naturally so the bracelet can be seen.',
      'If needed, slightly raise or reposition the arm while keeping the pose relaxed and believable.',
      'Place the bracelet naturally on the wrist with correct scale, curvature, and contact.',
      'Make the bracelet a clearly visible focal accessory without over-enlarging it.',
    ],
    poseCorrections: [
      'For wrist accessories, reveal the wrist and lower forearm when they are hidden by sleeves, pockets, cropping, or crossed arms.',
      'Only change the arm position as much as needed for a clean product preview.',
    ],
  },
  watch: {
    visibleArea: 'wrist',
    keywords: [/watch/i, /watches/i, /ساعة/i],
    instructions: [
      'Ensure the wrist is fully visible.',
      'If sleeves cover the wrist, reveal the wrist area naturally without making the outfit look forced.',
      'Adjust the arm pose to display the watch clearly and elegantly.',
      'Place the watch naturally on the wrist with correct strap wrap, face orientation, scale, and shadows.',
    ],
    poseCorrections: [
      'For watches, avoid hidden wrists, hands in pockets, heavy sleeve coverage, and cropped forearms.',
      'Use a subtle arm repositioning if the uploaded photo does not show the wrist clearly.',
    ],
  },
  necklace: {
    visibleArea: 'neck, collarbone, and upper chest',
    keywords: [/necklace/i, /pendant/i, /medallion/i, /chain/i, /قلادة/i, /عقد/i],
    instructions: [
      'Ensure the neck, collarbone, and upper chest area are visible.',
      'Move hair away from the necklace area if needed.',
      'Adjust framing to show the necklace clearly while preserving the person identity.',
      'Keep the necklace naturally positioned around the neck with realistic drape, scale, and shadows.',
    ],
    poseCorrections: [
      'For necklaces and pendants, avoid high collars, heavy hair coverage, tight crops, or framing that hides the neck.',
      'If needed, subtly open the framing and adjust hair or neckline so the necklace can be evaluated.',
    ],
  },
  earrings: {
    visibleArea: 'ears',
    keywords: [/earring/i, /earrings/i, /stud/i, /drop earring/i, /أقراط/i, /حلق/i],
    instructions: [
      'Ensure at least one ear is clearly visible.',
      'Move hair behind the ear if necessary.',
      'Use a front-facing or slightly angled face pose that shows the earrings clearly.',
      'Place earrings naturally on the ears with correct scale, attachment points, and shadows.',
      'Keep the result flattering and natural.',
    ],
    poseCorrections: [
      'For earrings, do not let hair, cropping, or face angle hide both ears.',
      'Make only the needed hair and face-angle adjustments to reveal the accessory.',
    ],
  },
  sunglasses: {
    visibleArea: 'face and eyes',
    keywords: [/sunglass/i, /sunglasses/i, /glasses/i, /eyewear/i, /frames/i, /نظارة/i, /نظارات/i],
    instructions: [
      'Ensure the face is front-facing or slightly angled in a flattering way.',
      'Place the sunglasses correctly on the face, aligned with the eyes, nose bridge, and ears.',
      'Keep the face structure, skin tone, and expression natural.',
      'Make the eyewear the focal accessory while preserving realistic reflections and shadows.',
    ],
    poseCorrections: [
      'For sunglasses, avoid face crops, extreme head turns, hidden eyes, or framing that makes the eyewear hard to judge.',
      'Use a clean portrait crop if the uploaded image does not frame the face well.',
    ],
  },
  bag: {
    visibleArea: 'full bag and natural carrying area',
    keywords: [/bag/i, /bags/i, /handbag/i, /shoulder bag/i, /carryall/i, /حقيبة/i],
    instructions: [
      'Show the bag in a natural carrying pose.',
      'The bag may be held in the hand or worn on the shoulder depending on the design.',
      'Ensure the full bag is visible and not cropped awkwardly.',
      'Preserve the bag shape, color, embroidery, handles, structure, and material details.',
    ],
    poseCorrections: [
      'For bags, allow a wider crop and natural hand, arm, or shoulder placement so the full item is visible.',
      'Avoid hiding the bag behind the body or cropping off straps, handles, or corners.',
    ],
  },
  wallet: {
    visibleArea: 'hand and wallet',
    keywords: [/wallet/i, /wallets/i, /card holder/i, /cardholder/i, /card sleeve/i, /محفظة/i],
    instructions: [
      'Show the wallet in the hand in a natural presentation pose.',
      'Ensure the wallet is clearly visible and not hidden.',
      'Preserve the wallet shape, color, embossing, stitching, zipper, and material details.',
      'Keep hand anatomy natural and product scale believable.',
    ],
    poseCorrections: [
      'For wallets, reveal one hand and use a simple product presentation pose if the uploaded pose hides the hands.',
      'Avoid cropped fingers or a wallet hidden inside a pocket or bag.',
    ],
  },
  accessory: {
    visibleArea: 'the body area where the accessory is worn',
    keywords: [],
    instructions: [
      'Place the accessory on the most appropriate visible body area.',
      'Make the product clearly visible without changing the person more than necessary.',
      'Preserve product details, realistic scale, and natural contact with the body or clothing.',
    ],
    poseCorrections: [
      'If the original pose hides the accessory area, make a minimal natural pose or framing adjustment so the product can be evaluated.',
    ],
  },
};

const STYLE_PROMPTS = {
  realistic: [
    'Style mode: Realistic.',
    'Keep the original person photo feeling as much as possible.',
    'Preserve clothing, background, lighting, and pose whenever product visibility allows it.',
    'Make only necessary adjustments for accessory visibility.',
    'Use natural lighting and a realistic e-commerce try-on look with minimal scene changes.',
  ],
  'studio-fashion': [
    'Style mode: Studio fashion.',
    'Allow a more polished, fashion-oriented composition and a cleaner, more elegant pose.',
    'Keep the same identity, facial features, skin tone, and believable body proportions.',
    'Improve presentation quality with a premium editorial look while keeping product visibility as the priority.',
    'The final image may feel more styled than the uploaded photo, but it must still look like the same person.',
  ],
};

const normalizeText = (value = '') => String(value ?? '').trim().toLowerCase();

const normalizeArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
};

const getProductTextParts = (product = {}) => [
  product.tryOnCategory,
  product.category,
  product.title,
  product.name,
  product.description,
  product.shortDescription,
  product.material,
  ...normalizeArray(product.styleTags),
  ...normalizeArray(product.occasionTags),
  ...normalizeArray(product.dominantColors),
  ...normalizeArray(product.visualTraits),
  ...normalizeArray(product.semanticTags),
  ...normalizeArray(product.materialTags),
  ...normalizeArray(product.targetAudience),
  ...normalizeArray(product.bestFor),
];

const getExplicitProductType = (product = {}) => {
  const explicitType = normalizeText(product.tryOnCategory);

  if (!explicitType) {
    return '';
  }

  return PRODUCT_TYPE_ALIASES[explicitType] || '';
};

export const inferTryOnProductType = (product = {}) => {
  const explicitType = getExplicitProductType(product);

  if (explicitType) {
    return explicitType;
  }

  const haystack = normalizeText(getProductTextParts(product).filter(Boolean).join(' '));

  for (const [productType, rule] of Object.entries(TRY_ON_PRODUCT_RULES)) {
    if (productType === 'accessory') {
      continue;
    }

    if (rule.keywords.some((pattern) => pattern.test(haystack))) {
      return productType;
    }
  }

  const category = normalizeText(product.category);
  return PRODUCT_TYPE_ALIASES[category] || 'accessory';
};

export const resolveTryOnStyle = (selectedStyle = 'realistic') => {
  const normalizedStyle = normalizeText(selectedStyle).replace(/_/g, '-');

  return normalizedStyle === 'studio-fashion' || normalizedStyle === 'studio fashion'
    ? 'studio-fashion'
    : 'realistic';
};

export const buildProductSpecificPrompt = (productType = 'accessory') => {
  const rule = TRY_ON_PRODUCT_RULES[productType] || TRY_ON_PRODUCT_RULES.accessory;

  return [
    `Product-specific visibility requirement: the ${rule.visibleArea} must be clearly visible.`,
    ...rule.instructions,
  ].join('\n');
};

export const buildStylePrompt = (selectedStyle = 'realistic') => {
  const resolvedStyle = resolveTryOnStyle(selectedStyle);

  return STYLE_PROMPTS[resolvedStyle].join('\n');
};

export const buildPoseAdjustmentPrompt = (productType = 'accessory', photoContext = {}) => {
  const rule = TRY_ON_PRODUCT_RULES[productType] || TRY_ON_PRODUCT_RULES.accessory;
  const contextInstructions = [];

  if (photoContext?.handsHidden && ['ring', 'bracelet', 'watch', 'wallet'].includes(productType)) {
    contextInstructions.push('Detected or suspected hidden hands: reveal one hand naturally so the product can be seen.');
  }

  if (photoContext?.longSleeves && ['bracelet', 'watch'].includes(productType)) {
    contextInstructions.push('Detected or suspected sleeve coverage: reveal the wrist or lower forearm naturally.');
  }

  if (photoContext?.neckHidden && productType === 'necklace') {
    contextInstructions.push('Detected or suspected hidden neck area: adjust hair, neckline, or framing to reveal the necklace area.');
  }

  if (photoContext?.earsCovered && productType === 'earrings') {
    contextInstructions.push('Detected or suspected covered ears: move hair behind at least one ear.');
  }

  return [
    'Pose correction rules:',
    ...rule.poseCorrections,
    ...contextInstructions,
    'Do not over-edit the person. Only modify pose, hair, sleeve position, or framing as much as needed to make the product clearly visible.',
  ].join('\n');
};

const getCatalogTags = (product = {}) => [
  ...normalizeArray(product.styleTags),
  ...normalizeArray(product.occasionTags),
  ...normalizeArray(product.dominantColors),
  ...normalizeArray(product.visualTraits),
  ...normalizeArray(product.semanticTags),
  ...normalizeArray(product.materialTags),
].filter(Boolean);

export const buildTryOnPrompt = ({
  product = {},
  selectedStyle = 'realistic',
  photoContext = {},
  personImageAnalysis = null,
} = {}) => {
  const productType = inferTryOnProductType(product);
  const resolvedStyle = resolveTryOnStyle(selectedStyle);
  const catalogTags = getCatalogTags(product);
  const productName = product.title || product.name || 'the Athar accessory';
  const photoContextToUse = personImageAnalysis || photoContext;

  const sections = [
    [
      'Identity preservation:',
      "Create a realistic premium try-on preview using the uploaded person photo as the identity reference.",
      'Preserve the same person identity, facial features, skin tone, body proportions, age impression, and overall realism.',
      'Do not change the person into a different person.',
      'Preserve the uploaded person photo feeling unless a small pose or framing adjustment is required for product visibility.',
    ].join('\n'),
    [
      'Product insertion:',
      'Use the second image as the product reference.',
      `Place the ${productName} naturally on the person.`,
      `Resolved product type: ${productType}.`,
      product.category ? `Catalog category: ${product.category}.` : '',
      product.material ? `Known material: ${product.material}.` : '',
      product.description ? `Catalog description: ${product.description}.` : '',
      catalogTags.length ? `Catalog tags: ${catalogTags.join(', ')}.` : '',
      'Preserve the product shape, color, material, embroidery, engraving, structure, scale, and distinctive details as much as possible.',
      'Make the product clearly visible and do not hide it behind hair, clothing, hands, pockets, body angle, or cropping.',
    ]
      .filter(Boolean)
      .join('\n'),
    buildProductSpecificPrompt(productType),
    buildPoseAdjustmentPrompt(productType, photoContextToUse),
    buildStylePrompt(resolvedStyle),
    [
      'Quality constraints:',
      'Keep the final result elegant, believable, premium, and suitable for an Athar e-commerce product preview.',
      'Keep the Athar warm editorial aesthetic without making the image look fake or overly retouched.',
      'Do not distort hands, fingers, wrists, ears, face, neck, shoulders, or body anatomy.',
      'Do not crop out the product.',
      'Do not create duplicate limbs, broken fingers, melted jewelry, warped eyewear, or unrealistic product placement.',
      'Do not change the product into a different item.',
      'Return only the generated image. Do not return text.',
    ].join('\n'),
  ];

  return {
    prompt: sections.join('\n\n'),
    productType,
    style: resolvedStyle,
    visibleArea: TRY_ON_PRODUCT_RULES[productType]?.visibleArea || TRY_ON_PRODUCT_RULES.accessory.visibleArea,
  };
};
