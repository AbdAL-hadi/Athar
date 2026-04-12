const FAVORITES_KEY = 'athar.favorite.ids';

export const loadFavorites = () => {
  try {
    return JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]');
  } catch (error) {
    return [];
  }
};

export const saveFavorites = (favoriteIds) => {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
  } catch (error) {
    // Ignore storage errors.
  }
};

export const toggleFavorite = (favoriteIds, productId) => {
  return favoriteIds.includes(productId)
    ? favoriteIds.filter((id) => id !== productId)
    : [...favoriteIds, productId];
};
