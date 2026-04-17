import PendingRegistration from '../models/PendingRegistration.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { products as localCatalogProducts } from '../src/data/products.js';
import { createAuthToken, hashPassword, verifyPassword } from '../utils/auth.js';
import { sendVerificationEmail } from '../utils/notifications.js';
import {
  createVerificationCodeRecord,
  VERIFICATION_CODE_TTL_MINUTES,
  verifyStoredCode,
} from '../utils/verification.js';

const sanitizeUser = (userDocument) => ({
  id: userDocument._id.toString(),
  name: userDocument.name,
  email: userDocument.email,
  phone: userDocument.phone,
  profilePicture: userDocument.profilePicture ?? '',
  isEmailVerified: userDocument.isEmailVerified !== false,
  emailVerifiedAt: userDocument.emailVerifiedAt,
  role: userDocument.role,
  favoriteIds: Array.isArray(userDocument.favorites) ? userDocument.favorites : [],
  address: userDocument.address,
  createdAt: userDocument.createdAt,
  updatedAt: userDocument.updatedAt,
});

const isUserEmailVerified = (userDocument) => userDocument?.isEmailVerified !== false;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const editableProfileKeys = new Set(['email', 'phone', 'address', 'profilePicture']);
const editableAddressKeys = new Set(['line1', 'city', 'postalCode', 'country']);
const profilePicturePattern = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;
const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;
const normalizeReference = (value) => String(value ?? '').trim().toLowerCase();
const getSafeFavoriteIds = (userDocument) =>
  Array.isArray(userDocument?.favorites) ? userDocument.favorites : [];

const getBase64DecodedByteLength = (base64Value = '') => {
  const normalizedValue = String(base64Value).replace(/\s+/g, '');
  const padding = normalizedValue.endsWith('==') ? 2 : normalizedValue.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalizedValue.length * 3) / 4) - padding);
};

const normalizeProfilePicture = (submittedValue) => {
  const normalizedValue = String(submittedValue ?? '').trim();

  if (!normalizedValue) {
    return {
      value: '',
      error: '',
    };
  }

  if (!profilePicturePattern.test(normalizedValue)) {
    return {
      value: '',
      error: 'Profile picture must be a valid image upload.',
    };
  }

  const base64Payload = normalizedValue.split(',')[1] ?? '';

  if (getBase64DecodedByteLength(base64Payload) > MAX_PROFILE_PICTURE_BYTES) {
    return {
      value: '',
      error: 'Profile picture must be 5 MB or smaller.',
    };
  }

  return {
    value: normalizedValue,
    error: '',
  };
};

const getEmailDeliveryFailureMessage = (error) => {
  const rawMessage = String(error?.message ?? '').trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage.includes('invalid login') ||
    normalizedMessage.includes('authentication unsuccessful') ||
    normalizedMessage.includes('bad credentials')
  ) {
    return 'Gmail SMTP authentication failed. Please check SMTP_USER, SMTP_PASS, and make sure you are using a valid Google App Password.';
  }

  if (normalizedMessage.includes('timeout')) {
    return 'The SMTP connection timed out. Please check your internet connection and SMTP settings.';
  }

  if (normalizedMessage.includes('econnrefused')) {
    return 'The SMTP server refused the connection. Please confirm SMTP_HOST and SMTP_PORT.';
  }

  return rawMessage
    ? `We could not send the verification email. ${rawMessage}`
    : 'We could not send the verification email. Please check your SMTP settings and try again.';
};

const buildVerificationPayload = (userDocument, delivery = null) => ({
  email: userDocument.email,
  name: userDocument.name,
  expiresAt:
    userDocument.emailVerificationCodeExpiresAt ??
    userDocument.verificationCodeExpiresAt ??
    null,
  delivery,
});

const issueVerificationCode = async (userDocument) => {
  const { code, hash, expiresAt } = createVerificationCodeRecord();

  const delivery = await sendVerificationEmail({
    email: userDocument.email,
    name: userDocument.name,
    code,
  });

  if ('emailVerificationCodeHash' in userDocument) {
    userDocument.emailVerificationCodeHash = hash;
    userDocument.emailVerificationCodeExpiresAt = expiresAt;
    userDocument.lastVerificationSentAt = new Date();
  } else {
    userDocument.verificationCodeHash = hash;
    userDocument.verificationCodeExpiresAt = expiresAt;
    userDocument.lastVerificationSentAt = new Date();
  }

  await userDocument.save();

  return {
    delivery,
    expiresAt,
  };
};

const findPendingRegistrationByEmail = (email) => {
  return PendingRegistration.findOne({ email }).select(
    '+password +verificationCodeHash +verificationCodeExpiresAt +lastVerificationSentAt',
  );
};

const findLegacyUnverifiedUserByEmail = (email) => {
  return User.findOne({ email }).select(
    '+password +emailVerificationCodeHash +emailVerificationCodeExpiresAt +lastVerificationSentAt',
  );
};

const canPersistAuthenticatedUser = (authenticatedUser) => /^[0-9a-fA-F]{24}$/.test(String(authenticatedUser?._id ?? ''));

const getPersistentAuthenticatedUser = async (authenticatedUser) => {
  if (!canPersistAuthenticatedUser(authenticatedUser)) {
    return null;
  }

  return User.findById(authenticatedUser._id).select('-password');
};

const findProductByReference = async (reference) => {
  const normalizedReference = String(reference ?? '').trim();

  if (!normalizedReference) {
    return null;
  }

  const databaseProduct = /^[0-9a-fA-F]{24}$/.test(normalizedReference)
    ? await Product.findById(normalizedReference)
    : await Product.findOne({
        $or: [
          { slug: normalizedReference.toLowerCase() },
          { title: normalizedReference },
        ],
      });

  if (databaseProduct) {
    return databaseProduct;
  }

  return (
    localCatalogProducts.find((product) => {
      return (
        normalizeReference(product.id) === normalizeReference(normalizedReference) ||
        normalizeReference(product.slug) === normalizeReference(normalizedReference) ||
        normalizeReference(product.name) === normalizeReference(normalizedReference) ||
        normalizeReference(product.title) === normalizeReference(normalizedReference)
      );
    }) ?? null
  );
};

const getCanonicalFavoriteId = (productDocument) =>
  productDocument?.slug || productDocument?.id || productDocument?._id?.toString?.() || '';

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, address = {} } = req.body ?? {};
    const normalizedName = String(name ?? '').trim();
    const normalizedEmail = String(email ?? '').toLowerCase().trim();
    const normalizedPassword = String(password ?? '');
    const normalizedPhone = String(phone ?? '').trim();
    const normalizedAddress = {
      line1: String(address?.line1 ?? '').trim(),
      city: String(address?.city ?? '').trim(),
      postalCode: String(address?.postalCode ?? '').trim(),
      country: String(address?.country ?? '').trim(),
    };

    if (!normalizedName || !normalizedEmail || !normalizedPassword || !normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and phone are required.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (normalizedPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    if (
      !normalizedAddress.city ||
      !normalizedAddress.country ||
      !normalizedAddress.postalCode
    ) {
      return res.status(400).json({
        success: false,
        message: 'City, country, and postal code are required.',
      });
    }

    const existingUser = await findLegacyUnverifiedUserByEmail(normalizedEmail);

    if (existingUser && isUserEmailVerified(existingUser)) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const hashedPassword = await hashPassword(normalizedPassword);
    const pendingRegistration =
      (await findPendingRegistrationByEmail(normalizedEmail)) ||
      new PendingRegistration({
        email: normalizedEmail,
      });

    pendingRegistration.name = normalizedName;
    pendingRegistration.password = hashedPassword;
    pendingRegistration.phone = normalizedPhone;
    pendingRegistration.address = normalizedAddress;

    if (existingUser && !isUserEmailVerified(existingUser)) {
      await existingUser.deleteOne();
    }

    let delivery = null;

    try {
      const verificationResult = await issueVerificationCode(pendingRegistration);
      delivery = verificationResult.delivery;
    } catch (error) {
      console.error('[Athar email] Register delivery failed:', error.message);
      return res.status(502).json({
        success: false,
        message: getEmailDeliveryFailureMessage(error),
      });
    }

    return res.status(201).json({
      success: true,
      message: `Account created successfully. We sent a ${VERIFICATION_CODE_TTL_MINUTES}-minute verification code to your email.`,
      requiresVerification: true,
      data: buildVerificationPayload(pendingRegistration, delivery),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Registration failed.',
      error: error.message,
    });
  }
};

// Hardcoded employee credentials (temporary - to be replaced with database)
const EMPLOYEE_CREDENTIALS = {
  email: 'employee@athar.com',
  password: 'Employee@123',
};

const DELIVERY_CREDENTIALS = {
  email: 'delivery@athar.com',
  password: 'Delivery@123',
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check for employee login first
    if (normalizedEmail === EMPLOYEE_CREDENTIALS.email && password === EMPLOYEE_CREDENTIALS.password) {
      const employeeUser = {
        _id: 'employee-001',
        name: 'Employee',
        email: EMPLOYEE_CREDENTIALS.email,
        phone: '+970000000000',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        role: 'employee',
        profilePicture: '',
        address: {
          line1: '',
          city: '',
          postalCode: '',
          country: 'Palestine',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const token = createAuthToken(employeeUser);

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully as employee.',
        data: {
          token,
          user: sanitizeUser(employeeUser),
        },
      });
    }

    // Check for delivery login
    if (normalizedEmail === DELIVERY_CREDENTIALS.email && password === DELIVERY_CREDENTIALS.password) {
      const deliveryUser = {
        _id: 'delivery-001',
        name: 'Delivery',
        email: DELIVERY_CREDENTIALS.email,
        phone: '+970000000000',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        role: 'delivery',
        profilePicture: '',
        address: {
          line1: '',
          city: '',
          postalCode: '',
          country: 'Palestine',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const token = createAuthToken(deliveryUser);

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully as delivery personnel.',
        data: {
          token,
          user: sanitizeUser(deliveryUser),
        },
      });
    }

    const user = await findLegacyUnverifiedUserByEmail(normalizedEmail);

    if (user && (await verifyPassword(password, user.password))) {
      if (!isUserEmailVerified(user)) {
        let delivery = null;

      try {
        const verificationResult = await issueVerificationCode(user);
        delivery = verificationResult.delivery;
      } catch (error) {
        console.error('[Athar email] Login delivery failed:', error.message);

        return res.status(502).json({
          success: false,
          message: getEmailDeliveryFailureMessage(error),
        });
      }

        return res.status(403).json({
          success: false,
          message: 'Please verify your email first. We sent you a fresh verification code.',
          requiresVerification: true,
          data: buildVerificationPayload(user, delivery),
        });
      }

      const token = createAuthToken(user);

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: {
          token,
          user: sanitizeUser(user),
        },
      });
    }

    const pendingRegistration = await findPendingRegistrationByEmail(normalizedEmail);

    if (pendingRegistration && (await verifyPassword(password, pendingRegistration.password))) {
      let delivery = null;

      try {
        const verificationResult = await issueVerificationCode(pendingRegistration);
        delivery = verificationResult.delivery;
      } catch (error) {
        console.error('[Athar email] Pending login delivery failed:', error.message);

        return res.status(502).json({
          success: false,
          message: getEmailDeliveryFailureMessage(error),
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Please verify your email first. We sent you a fresh verification code.',
        requiresVerification: true,
        data: buildVerificationPayload(pendingRegistration, delivery),
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Login failed.',
      error: error.message,
    });
  }
};

export const verifyEmailCode = async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.email ?? '').toLowerCase().trim();
    const normalizedCode = String(req.body?.code ?? '').trim();

    if (!normalizedEmail || !normalizedCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required.',
      });
    }

    const existingVerifiedUser = await User.findOne({ email: normalizedEmail });

    if (existingVerifiedUser && isUserEmailVerified(existingVerifiedUser)) {
      const token = createAuthToken(existingVerifiedUser);

      return res.status(200).json({
        success: true,
        message: 'Email already verified.',
        data: {
          token,
          user: sanitizeUser(existingVerifiedUser),
        },
      });
    }

    const pendingRegistration = await findPendingRegistrationByEmail(normalizedEmail);

    if (pendingRegistration) {
      if (!pendingRegistration.verificationCodeHash || !pendingRegistration.verificationCodeExpiresAt) {
        return res.status(400).json({
          success: false,
          message: 'No active verification code was found. Please request a new code.',
        });
      }

      if (pendingRegistration.verificationCodeExpiresAt.getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'This verification code has expired. Please request a new one.',
        });
      }

      if (!verifyStoredCode(normalizedCode, pendingRegistration.verificationCodeHash)) {
        return res.status(400).json({
          success: false,
          message: 'The verification code is not correct. Please try again.',
        });
      }

      const user = await User.findOneAndUpdate(
        { email: normalizedEmail },
        {
          name: pendingRegistration.name,
          email: pendingRegistration.email,
          password: pendingRegistration.password,
          phone: pendingRegistration.phone,
          address: pendingRegistration.address,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationCodeHash: '',
          emailVerificationCodeExpiresAt: null,
          lastVerificationSentAt: null,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

      await pendingRegistration.deleteOne();

      const token = createAuthToken(user);

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully. You are now signed in.',
        data: {
          token,
          user: sanitizeUser(user),
        },
      });
    }

    const legacyUser = await findLegacyUnverifiedUserByEmail(normalizedEmail);

    if (!legacyUser) {
      return res.status(404).json({
        success: false,
        message: 'We could not find an account for this email.',
      });
    }

    if (!legacyUser.emailVerificationCodeHash || !legacyUser.emailVerificationCodeExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'No active verification code was found. Please request a new code.',
      });
    }

    if (legacyUser.emailVerificationCodeExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'This verification code has expired. Please request a new code.',
      });
    }

    if (!verifyStoredCode(normalizedCode, legacyUser.emailVerificationCodeHash)) {
      return res.status(400).json({
        success: false,
        message: 'The verification code is not correct. Please try again.',
      });
    }

    legacyUser.isEmailVerified = true;
    legacyUser.emailVerifiedAt = new Date();
    legacyUser.emailVerificationCodeHash = '';
    legacyUser.emailVerificationCodeExpiresAt = null;
    legacyUser.lastVerificationSentAt = null;
    await legacyUser.save();

    const token = createAuthToken(legacyUser);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You are now signed in.',
      data: {
        token,
        user: sanitizeUser(legacyUser),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Email verification failed.',
      error: error.message,
    });
  }
};

export const resendVerificationCode = async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.email ?? '').toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const pendingRegistration = await findPendingRegistrationByEmail(normalizedEmail);

    if (pendingRegistration) {
    let verificationResult;

    try {
      verificationResult = await issueVerificationCode(pendingRegistration);
    } catch (error) {
      console.error('[Athar email] Resend delivery failed:', error.message);

      return res.status(502).json({
        success: false,
        message: getEmailDeliveryFailureMessage(error),
      });
    }

      return res.status(200).json({
        success: true,
        message: `A new verification code has been sent. It stays valid for ${VERIFICATION_CODE_TTL_MINUTES} minutes.`,
        requiresVerification: true,
        data: buildVerificationPayload(pendingRegistration, verificationResult.delivery),
      });
    }

    const user = await findLegacyUnverifiedUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'We could not find an account for this email.',
      });
    }

    if (isUserEmailVerified(user)) {
      return res.status(400).json({
        success: false,
        message: 'This email is already verified. Please log in.',
      });
    }

    let verificationResult;

    try {
      verificationResult = await issueVerificationCode(user);
    } catch (error) {
      console.error('[Athar email] Legacy resend delivery failed:', error.message);

      return res.status(502).json({
        success: false,
        message: getEmailDeliveryFailureMessage(error),
      });
    }

    return res.status(200).json({
      success: true,
      message: `A new verification code has been sent. It stays valid for ${VERIFICATION_CODE_TTL_MINUTES} minutes.`,
      requiresVerification: true,
      data: buildVerificationPayload(user, verificationResult.delivery),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'We could not resend the verification code right now.',
      error: error.message,
    });
  }
};

export const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: sanitizeUser(req.user),
  });
};

export const updateCurrentUser = async (req, res) => {
  try {
    const submittedPayload = req.body ?? {};
    const submittedKeys = Object.keys(submittedPayload);

    if (submittedKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide contact, profile picture, or address details to update.',
      });
    }

    const hasInvalidField = submittedKeys.some((key) => !editableProfileKeys.has(key));

    if (hasInvalidField) {
      return res.status(400).json({
        success: false,
        message: 'Only contact information, profile picture, and address information can be updated.',
      });
    }

    if (
      submittedPayload.address !== undefined &&
      (
        typeof submittedPayload.address !== 'object' ||
        submittedPayload.address === null ||
        Array.isArray(submittedPayload.address) ||
        Object.keys(submittedPayload.address).some((key) => !editableAddressKeys.has(key))
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Only line1, city, postalCode, and country are allowed inside address information.',
      });
    }

    const user = await getPersistentAuthenticatedUser(req.user);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'This account cannot update profile details from the current session.',
      });
    }

    if (submittedPayload.email !== undefined) {
      const normalizedEmail = String(submittedPayload.email ?? '').toLowerCase().trim();

      if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address.',
        });
      }

      const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');

      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }

      user.email = normalizedEmail;
    }

    if (submittedPayload.phone !== undefined) {
      const normalizedPhone = String(submittedPayload.phone ?? '').trim();

      if (!normalizedPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required.',
        });
      }

      user.phone = normalizedPhone;
    }

    if (submittedPayload.profilePicture !== undefined) {
      const { value: normalizedProfilePicture, error: profilePictureError } =
        normalizeProfilePicture(submittedPayload.profilePicture);

      if (profilePictureError) {
        return res.status(400).json({
          success: false,
          message: profilePictureError,
        });
      }

      user.profilePicture = normalizedProfilePicture;
    }

    if (submittedPayload.address !== undefined) {
      const mergedAddress = {
        line1: String(submittedPayload.address?.line1 ?? user.address?.line1 ?? '').trim(),
        city: String(submittedPayload.address?.city ?? user.address?.city ?? '').trim(),
        postalCode: String(submittedPayload.address?.postalCode ?? user.address?.postalCode ?? '').trim(),
        country: String(submittedPayload.address?.country ?? user.address?.country ?? '').trim(),
      };

      if (!mergedAddress.city || !mergedAddress.postalCode || !mergedAddress.country) {
        return res.status(400).json({
          success: false,
          message: 'City, postal code, and country are required in address information.',
        });
      }

      user.address = mergedAddress;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Athar profile] Update failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not update your profile right now.',
      error: error.message,
    });
  }
};

export const getCurrentUserFavorites = async (req, res) => {
  try {
    const user = await getPersistentAuthenticatedUser(req.user);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'This account cannot manage favorites from the current session.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        favoriteIds: getSafeFavoriteIds(user),
      },
    });
  } catch (error) {
    console.error('[Athar favorites] Fetch failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not load favorites right now.',
      error: error.message,
    });
  }
};

export const addFavorite = async (req, res) => {
  try {
    const productReference = String(req.body?.productId ?? '').trim();

    if (!productReference) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.',
      });
    }

    const user = await getPersistentAuthenticatedUser(req.user);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'This account cannot manage favorites from the current session.',
      });
    }

    const product = await findProductByReference(productReference);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    const favoriteId = getCanonicalFavoriteId(product);
    const currentFavoriteIds = getSafeFavoriteIds(user);

    if (!favoriteId) {
      return res.status(422).json({
        success: false,
        message: 'This product cannot be saved to favorites right now.',
      });
    }

    if (!currentFavoriteIds.includes(favoriteId)) {
      user.favorites = [...currentFavoriteIds, favoriteId];
      await user.save();
    } else {
      user.favorites = currentFavoriteIds;
    }

    return res.status(200).json({
      success: true,
      message: 'Product saved to favorites.',
      data: {
        favoriteIds: getSafeFavoriteIds(user),
      },
    });
  } catch (error) {
    console.error('[Athar favorites] Add failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not save this product to favorites right now.',
      error: error.message,
    });
  }
};

export const removeFavorite = async (req, res) => {
  try {
    const productReference = String(req.params?.productId ?? '').trim();

    if (!productReference) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.',
      });
    }

    const user = await getPersistentAuthenticatedUser(req.user);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'This account cannot manage favorites from the current session.',
      });
    }

    const product = await findProductByReference(productReference);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    const favoriteId = getCanonicalFavoriteId(product);
    const currentFavoriteIds = getSafeFavoriteIds(user);
    user.favorites = currentFavoriteIds.filter((entry) => entry !== favoriteId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Product removed from favorites.',
      data: {
        favoriteIds: getSafeFavoriteIds(user),
      },
    });
  } catch (error) {
    console.error('[Athar favorites] Remove failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'We could not remove this product from favorites right now.',
      error: error.message,
    });
  }
};
