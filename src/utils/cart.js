export const SHIPPING_FEE = 20;

const CART_KEY = 'athar.cart.items';

export const loadCart = () => {
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) ?? '[]');
  } catch (error) {
    return [];
  }
};

export const saveCart = (items) => {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (error) {
    // Ignore storage errors.
  }
};

export const addCartItem = (items, product, quantity = 1) => {
  const existingItem = items.find((item) => item.id === product.id);

  if (!existingItem) {
    return [
      ...items,
      {
        id: product.id,
        name: product.name,
        category: product.category,
        image: product.images?.[0] ?? '',
        material: product.material,
        price: product.price,
        compareAt: product.compareAt ?? product.price,
        quantity,
      },
    ];
  }

  return items.map((item) =>
    item.id === product.id ? { ...item, quantity: Math.max(1, item.quantity + quantity) } : item,
  );
};

export const updateCartItemQuantity = (items, productId, quantity) => {
  const nextQuantity = Math.max(1, Number(quantity) || 1);
  return items.map((item) => (item.id === productId ? { ...item, quantity: nextQuantity } : item));
};

export const removeCartItem = (items, productId) => items.filter((item) => item.id !== productId);

export const getCartItemCount = (items) => items.reduce((sum, item) => sum + item.quantity, 0);

export const getCartSubtotal = (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export const getCartCompareSubtotal = (items) => {
  return items.reduce((sum, item) => sum + (item.compareAt ?? item.price) * item.quantity, 0);
};

export const getCartGrandTotal = (items) => (items.length > 0 ? getCartSubtotal(items) + SHIPPING_FEE : 0);
