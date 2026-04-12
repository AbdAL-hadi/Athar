const ORDER_HISTORY_KEY = 'athar.order.history';

const readStorage = () => {
  try {
    return JSON.parse(window.localStorage.getItem(ORDER_HISTORY_KEY) ?? '{}');
  } catch (error) {
    return {};
  }
};

const writeStorage = (value) => {
  try {
    window.localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(value));
  } catch (error) {
    // Ignore storage errors.
  }
};

const getScope = (user) => (user?.id ? `user:${user.id}` : 'guest');

export const getOrderIdentifier = (order) => order?.orderNumber ?? order?.id ?? order?._id ?? '';

export const saveRecentOrder = (orderIdentifier, user) => {
  if (!orderIdentifier) {
    return;
  }

  const storage = readStorage();
  const scope = getScope(user);
  const current = Array.isArray(storage[scope]) ? storage[scope] : [];
  storage[scope] = [orderIdentifier, ...current.filter((item) => item !== orderIdentifier)].slice(0, 8);
  writeStorage(storage);
};

export const loadRecentOrders = (user) => {
  const storage = readStorage();
  return Array.isArray(storage[getScope(user)]) ? storage[getScope(user)] : [];
};
