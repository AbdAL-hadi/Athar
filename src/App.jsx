import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { products as mockProducts } from './data/products';
import AITryOnModal from './components/AITryOnModal';
import AccessibilityToolbar from './components/accessibility/AccessibilityToolbar';
import MainLayout from './layout/MainLayout';
import AboutPage from './pages/AboutPage';
import AdminCommentModerationPage from './pages/AdminCommentModerationPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import DeliveryDashboard from './pages/DeliveryDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import FavoritesPage from './pages/FavoritesPage';
import HeritageMapPage from './pages/HeritageMapPage';
import HomePage from './pages/HomePage';
import MotifDetailsPage from './pages/MotifDetailsPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import ProductsPage from './pages/ProductsPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import Toast from './components/Toast';
import { apiRequest } from './utils/api';
import { clearAuthSession, getActiveAuthToken, loadAuthToken, loadAuthUser, saveAuthSession } from './utils/authSession';
import { addCartItem, getCartItemCount, loadCart, removeCartItem, saveCart, updateCartItemQuantity } from './utils/cart';
import { getProductFavoriteReference, isProductFavorite, mergeCatalogProducts, normalizeProduct, normalizeProducts } from './utils/productCatalog';

const fallbackProducts = normalizeProducts(mockProducts);

const App = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState(fallbackProducts);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [cartItems, setCartItems] = useState(() => loadCart());
  const [favoriteIds, setFavoriteIds] = useState(() => loadAuthUser()?.favoriteIds ?? []);
  const [authToken, setAuthToken] = useState(() => loadAuthToken());
  const [authUser, setAuthUser] = useState(() => loadAuthUser());
  const [authLoading, setAuthLoading] = useState(() => Boolean(loadAuthToken()));
  const [tryOnProduct, setTryOnProduct] = useState(null);
  const [cartAuthMessage, setCartAuthMessage] = useState('');

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
      setProductsError(error.message || 'Unable to refresh the Athar collection right now.');
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
          setProductsError(error.message || 'Unable to refresh the Athar collection right now.');
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
    if (!authUser) {
      setFavoriteIds([]);
      return;
    }

    setFavoriteIds(Array.isArray(authUser.favoriteIds) ? authUser.favoriteIds : []);
  }, [authUser]);

  const syncAuthUser = (nextUser, nextToken = authToken) => {
    setAuthUser(nextUser);
    saveAuthSession({ token: nextToken, user: nextUser });
  };

  const syncFavoriteIds = (nextFavoriteIds) => {
    setFavoriteIds(nextFavoriteIds);

    if (authUser) {
      syncAuthUser({ ...authUser, favoriteIds: nextFavoriteIds });
    }
  };

  const handleAddToCart = (product, quantity = 1) => {
    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken || !authUser) {
      setCartAuthMessage('Please log in to add items to your cart.');
      navigate('/login');
      return false;
    }

    setCartItems((currentItems) => addCartItem(currentItems, product, quantity));
    return true;
  };

  const handleUpdateCartItem = (productId, quantity) => {
    setCartItems((currentItems) => updateCartItemQuantity(currentItems, productId, quantity));
  };

  const handleRemoveCartItem = (productId) => {
    setCartItems((currentItems) => removeCartItem(currentItems, productId));
  };

  const handleProductLoaded = (updatedProduct) => {
    if (!updatedProduct) return;

    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        [updatedProduct.id, updatedProduct.slug, updatedProduct.productId].some((reference) =>
          reference && [product.id, product.slug, product.productId].includes(reference),
        )
          ? { ...product, ...updatedProduct }
          : product,
      ),
    );
  };

  const handleProductSaved = (savedProduct) => {
    if (!savedProduct) return;

    const normalizedProduct = normalizeProduct(savedProduct);

    setProducts((currentProducts) => {
      const productExists = currentProducts.some((product) =>
        [normalizedProduct.id, normalizedProduct.slug, normalizedProduct.productId].some((reference) =>
          reference && [product.id, product.slug, product.productId].includes(reference),
        ),
      );

      if (!productExists) {
        return [normalizedProduct, ...currentProducts];
      }

      return currentProducts.map((product) =>
        [normalizedProduct.id, normalizedProduct.slug, normalizedProduct.productId].some((reference) =>
          reference && [product.id, product.slug, product.productId].includes(reference),
        )
          ? { ...product, ...normalizedProduct }
          : product,
      );
    });
  };

  const handleClearCart = () => {
    setCartItems([]);
    void refreshProducts();
  };

  const handleToggleFavorite = async (productOrReference) => {
    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken || !authUser) {
      navigate('/auth?mode=register');
      return;
    }

    const product =
      typeof productOrReference === 'string'
        ? products.find((item) => isProductFavorite([productOrReference], item)) ?? productOrReference
        : productOrReference;
    const productReference = getProductFavoriteReference(product);

    if (!productReference) {
      console.error('[Athar favorites] Missing product reference for favorite toggle.');
      return;
    }

    try {
      const isFavorite = isProductFavorite(favoriteIds, product);
      const response = await apiRequest(
        isFavorite ? `/api/auth/favorites/${encodeURIComponent(productReference)}` : '/api/auth/favorites',
        {
          method: isFavorite ? 'DELETE' : 'POST',
          body: isFavorite ? undefined : { productId: productReference },
          token: activeToken,
        },
      );

      syncFavoriteIds(response?.data?.favoriteIds ?? []);
    } catch (error) {
      if (error?.status === 401) {
        clearAuthSession();
        setAuthToken('');
        setAuthUser(null);
        setFavoriteIds([]);
        setAuthLoading(false);
        navigate('/auth?mode=register');
        return;
      }

      console.error('[Athar favorites] Toggle failed:', error?.message ?? error);
    }
  };

  const handleOpenTryOn = (product) => {
    setTryOnProduct(product);
  };

  const handleCloseTryOn = () => {
    setTryOnProduct(null);
  };

  const handleAuthSuccess = ({ token, user }) => {
    saveAuthSession({ token, user });
    setAuthToken(token);
    setAuthUser(user);
    setFavoriteIds(user?.favoriteIds ?? []);
    setAuthLoading(false);

    // Redirect based on user role
    if (user?.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (user?.role === 'employee') {
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
    setFavoriteIds([]);
    setAuthLoading(false);
  };

  const handleUpdateProfile = (updatedUser) => {
    syncAuthUser(updatedUser);

    if (Array.isArray(updatedUser?.favoriteIds)) {
      setFavoriteIds(updatedUser.favoriteIds);
    }
  };

  const cartCount = getCartItemCount(cartItems);

  return (
    <>
    <Routes>
      <Route element={<MainLayout cartCount={cartCount} authUser={authUser} authLoading={authLoading} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} />}>
        <Route path="/" element={<HomePage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} authUser={authUser} authToken={authToken} onAddToCart={handleAddToCart} />} />
        <Route path="/products" element={<ProductsPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} onAddToCart={handleAddToCart} isLoading={productsLoading} errorMessage={productsError} onRefreshProducts={refreshProducts} />} />
        <Route path="/products/:id" element={<ProductDetailsPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} onAddToCart={handleAddToCart} authUser={authUser} authToken={authToken} onOpenTryOn={handleOpenTryOn} onProductLoaded={handleProductLoaded} />} />
        <Route path="/motifs/:motifId" element={<MotifDetailsPage products={products} />} />
        <Route path="/search" element={<SearchPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />} />
        <Route path="/favorites" element={<FavoritesPage products={products} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} authUser={authUser} onAddToCart={handleAddToCart} />} />
        <Route path="/heritage-map" element={<HeritageMapPage />} />
        <Route path="/cart" element={<CartPage items={cartItems} onUpdateQuantity={handleUpdateCartItem} onRemoveItem={handleRemoveCartItem} />} />
        <Route path="/checkout" element={<CheckoutPage items={cartItems} products={products} productsLoading={productsLoading} productsError={productsError} authToken={authToken} authUser={authUser} authLoading={authLoading} onCheckoutSuccess={handleClearCart} />} />
        <Route path="/checkout/success" element={<CheckoutPage items={cartItems} products={products} productsLoading={productsLoading} productsError={productsError} authToken={authToken} authUser={authUser} authLoading={authLoading} onCheckoutSuccess={handleClearCart} />} />
        <Route path="/order-tracking" element={<OrderTrackingPage authToken={authToken} authUser={authUser} authLoading={authLoading} />} />
        <Route path="/profile" element={<ProfilePage authUser={authUser} authToken={authToken} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage authToken={authToken} authUser={authUser} authLoading={authLoading} />} />
        <Route path="/admin/comments" element={<AdminCommentModerationPage authToken={authToken} authUser={authUser} authLoading={authLoading} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/auth" element={<AuthPage authUser={authUser} authLoading={authLoading} onAuthSuccess={handleAuthSuccess} onLogout={handleLogout} />} />
        <Route path="/login" element={<AuthPage authUser={authUser} authLoading={authLoading} onAuthSuccess={handleAuthSuccess} onLogout={handleLogout} />} />
      </Route>
      <Route path="/employee-dashboard" element={<EmployeeDashboard authToken={authToken} authUser={authUser} authLoading={authLoading} onLogout={handleLogout} onProductSaved={handleProductSaved} />} />
      <Route path="/delivery-dashboard" element={<DeliveryDashboard authToken={authToken} authUser={authUser} authLoading={authLoading} onLogout={handleLogout} />} />
    </Routes>
    <AITryOnModal product={tryOnProduct} open={Boolean(tryOnProduct)} onClose={handleCloseTryOn} />
    <AccessibilityToolbar />
    <Toast
      open={Boolean(cartAuthMessage)}
      variant="error"
      title="Login required"
      message={cartAuthMessage}
      onClose={() => setCartAuthMessage('')}
    />
    </>
  );
};

export default App;
