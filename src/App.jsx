import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { products as mockProducts } from './data/products';
import MainLayout from './layout/MainLayout';
import AboutPage from './pages/AboutPage';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import DeliveryDashboard from './pages/DeliveryDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import FavoritesPage from './pages/FavoritesPage';
import HomePage from './pages/HomePage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import ProductsPage from './pages/ProductsPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import { apiRequest } from './utils/api';
import { clearAuthSession, getActiveAuthToken, loadAuthToken, loadAuthUser, saveAuthSession } from './utils/authSession';
import { addCartItem, getCartItemCount, loadCart, removeCartItem, saveCart, updateCartItemQuantity } from './utils/cart';
import { loadFavorites, saveFavorites, toggleFavorite } from './utils/favorites';
import { mergeCatalogProducts, normalizeProducts } from './utils/productCatalog';

const fallbackProducts = normalizeProducts(mockProducts);

const App = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState(fallbackProducts);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [cartItems, setCartItems] = useState(() => loadCart());
  const [favoriteIds, setFavoriteIds] = useState(() => loadFavorites());
  const [authToken, setAuthToken] = useState(() => loadAuthToken());
  const [authUser, setAuthUser] = useState(() => loadAuthUser());
  const [authLoading, setAuthLoading] = useState(() => Boolean(loadAuthToken()));

  // Function to refresh products from API
  const refreshProducts = async () => {
    setProductsLoading(true);
    setProductsError('');

    try {
      const response = await apiRequest('/api/products');
      const remoteProducts = mergeCatalogProducts(response?.data ?? [], fallbackProducts);
      setProducts(remoteProducts);
    } catch (error) {
      setProducts(fallbackProducts);
      setProductsError(error.message || 'Unable to load products from the Athar API right now.');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError('');

      try {
        const response = await apiRequest('/api/products');
        const remoteProducts = mergeCatalogProducts(response?.data ?? [], fallbackProducts);

        if (!isCancelled) {
          setProducts(remoteProducts);
        }
      } catch (error) {
        if (!isCancelled) {
          setProducts(fallbackProducts);
          setProductsError(error.message || 'Unable to load products from the Athar API right now.');
        }
      } finally {
        if (!isCancelled) {
          setProductsLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadAuthenticatedUser = async () => {
      const activeToken = getActiveAuthToken(authToken);

      if (!activeToken) {
        setAuthLoading(false);
        setAuthUser(null);
        return;
      }

      setAuthLoading(true);

      try {
        const response = await apiRequest('/api/auth/me', { token: activeToken });
        const user = response?.data ?? null;

        if (!isCancelled) {
          setAuthToken(activeToken);
          setAuthUser(user);
          saveAuthSession({ token: activeToken, user });
        }
      } catch (error) {
        if (!isCancelled) {
          clearAuthSession();
          setAuthToken('');
          setAuthUser(null);
        }
      } finally {
        if (!isCancelled) {
          setAuthLoading(false);
        }
      }
    };

    loadAuthenticatedUser();

    return () => {
      isCancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    saveCart(cartItems);
  }, [cartItems]);

  useEffect(() => {
    saveFavorites(favoriteIds);
  }, [favoriteIds]);

  const handleAddToCart = (product, quantity = 1) => {
    setCartItems((currentItems) => addCartItem(currentItems, product, quantity));
  };

  const handleUpdateCartItem = (productId, quantity) => {
    setCartItems((currentItems) => updateCartItemQuantity(currentItems, productId, quantity));
  };

  const handleRemoveCartItem = (productId) => {
    setCartItems((currentItems) => removeCartItem(currentItems, productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleToggleFavorite = (productId) => {
    setFavoriteIds((currentFavoriteIds) => toggleFavorite(currentFavoriteIds, productId));
  };

  const handleAuthSuccess = ({ token, user }) => {
    saveAuthSession({ token, user });
    setAuthToken(token);
    setAuthUser(user);
    setAuthLoading(false);

    // Redirect based on user role
    if (user?.role === 'employee') {
      navigate('/employee-dashboard');
    } else if (user?.role === 'delivery') {
      navigate('/delivery-dashboard');
    } else {
      navigate('/');
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthToken('');
    setAuthUser(null);
    setAuthLoading(false);
  };

  const handleUpdateProfile = (updatedUser) => {
    setAuthUser(updatedUser);
    saveAuthSession({ token: authToken, user: updatedUser });
  };

  const cartCount = getCartItemCount(cartItems);

  return (
    <Routes>
      <Route element={<MainLayout cartCount={cartCount} authUser={authUser} authLoading={authLoading} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} />}>
        <Route path="/" element={<HomePage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />} />
        <Route path="/products" element={<ProductsPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} isLoading={productsLoading} errorMessage={productsError} onRefreshProducts={refreshProducts} />} />
        <Route path="/products/:id" element={<ProductDetailsPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} onAddToCart={handleAddToCart} />} />
        <Route path="/search" element={<SearchPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />} />
        <Route path="/favorites" element={<FavoritesPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />} />
        <Route path="/cart" element={<CartPage items={cartItems} onUpdateQuantity={handleUpdateCartItem} onRemoveItem={handleRemoveCartItem} />} />
        <Route path="/checkout" element={<CheckoutPage items={cartItems} products={products} productsLoading={productsLoading} productsError={productsError} authToken={authToken} authUser={authUser} authLoading={authLoading} onCheckoutSuccess={handleClearCart} />} />
        <Route path="/checkout/success" element={<CheckoutPage items={cartItems} products={products} productsLoading={productsLoading} productsError={productsError} authToken={authToken} authUser={authUser} authLoading={authLoading} onCheckoutSuccess={handleClearCart} />} />
        <Route path="/order-tracking" element={<OrderTrackingPage authToken={authToken} authUser={authUser} authLoading={authLoading} />} />
        <Route path="/profile" element={<ProfilePage authUser={authUser} authToken={authToken} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/auth" element={<AuthPage authUser={authUser} authLoading={authLoading} onAuthSuccess={handleAuthSuccess} onLogout={handleLogout} />} />
      </Route>
      <Route path="/employee-dashboard" element={<EmployeeDashboard authToken={authToken} authUser={authUser} authLoading={authLoading} onLogout={handleLogout} />} />
      <Route path="/delivery-dashboard" element={<DeliveryDashboard authToken={authToken} authUser={authUser} authLoading={authLoading} onLogout={handleLogout} />} />
    </Routes>
  );
};

export default App;
