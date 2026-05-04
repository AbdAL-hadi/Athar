import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import StaggerContainer from '../components/animation/StaggerContainer';
import StaggerItem from '../components/animation/StaggerItem';
import SearchBar from '../components/SearchBar';
import Filter from '../components/Filter';
import SectionTitle from '../components/SectionTitle';
import AdminNavigation from '../components/admin/AdminNavigation';
import AdminProductEditor from '../components/admin/AdminProductEditor';

const ProductIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3v18" />
  </svg>
);

const OrderIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M20 10c0 4.42-8 11-8 11S4 14.42 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const employeeLinks = [
  { id: 'products', label: 'All Products', icon: 'product' },
  { id: 'orders', label: 'Orders Tracking', icon: 'order' },
];

const PRODUCTS_PER_PAGE = 6;
const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A to Z' },
];

const sortProducts = (productList, sortBy) => {
  const nextProducts = [...productList];

  switch (sortBy) {
    case 'price-asc':
      return nextProducts.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return nextProducts.sort((a, b) => b.price - a.price);
    case 'name-asc':
      return nextProducts.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return nextProducts.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return b.rating - a.rating;
      });
  }
};

const buildEditForm = (product) => ({
  title: product.title || '',
  description: product.description || '',
  shortDescription: product.shortDescription || '',
  accessibilityDescription: product.accessibilityDescription || '',
  price: product.price ?? '',
  compareAt: product.compareAt ?? '',
  pointsValue: product.pointsValue ?? product.atharPoints ?? product.customPoints ?? product.points ?? '',
  stock: product.stock ?? '',
  category: product.category || '',
  material: product.material || '',
  color: product.color || product.dominantColors?.[0] || '',
  sku: product.sku || product.motifCode || '',
  images: product.images || (product.image ? [product.image] : []),
  styleTags: product.styleTags || [],
  occasionTags: product.occasionTags || [],
  semanticTags: product.semanticTags || [],
  materialTags: product.materialTags || [],
  targetAudience: product.targetAudience || [],
  bestFor: product.bestFor || [],
  giftable: Boolean(product.giftable),
  tryOnEligible: Boolean(product.tryOnEligible),
  tryOnCategory: product.tryOnCategory || '',
  seoTitle: product.seoTitle || '',
  metaDescription: product.metaDescription || '',
  seoKeywords: product.seoKeywords || [],
  promoHeadline: product.promoHeadline || '',
  promoSubtitle: product.promoSubtitle || '',
  ctaText: product.ctaText || 'View Product',
  highlightBullets: product.highlightBullets || [],
});

const buildEmptyProductForm = () => ({
  title: '',
  description: '',
  shortDescription: '',
  accessibilityDescription: '',
  price: '',
  compareAt: '',
  pointsValue: '',
  stock: '',
  category: '',
  material: '',
  color: '',
  sku: '',
  images: [],
  styleTags: [],
  occasionTags: [],
  semanticTags: [],
  materialTags: [],
  targetAudience: [],
  bestFor: [],
  giftable: false,
  tryOnEligible: false,
  tryOnCategory: '',
  seoTitle: '',
  metaDescription: '',
  seoKeywords: [],
  promoHeadline: '',
  promoSubtitle: '',
  ctaText: 'View Product',
  highlightBullets: [],
});

const appendProductFormData = (form, imageFiles) => {
  const data = new FormData();

  Object.entries(form).forEach(([key, value]) => {
    if (key === 'images') {
      data.append('existingImages', JSON.stringify(Array.isArray(value) ? value : []));
      return;
    }

    if (Array.isArray(value)) {
      data.append(key, JSON.stringify(value));
      return;
    }

    data.append(key, value ?? '');
  });

  imageFiles.forEach((file) => data.append('images', file));
  return data;
};

const getCategoryList = (products) => {
  const categories = new Set();
  products.forEach((p) => {
    if (p.category) categories.add(p.category);
  });
  return Array.from(categories).sort();
};

const EmployeeDashboard = ({ authToken, authUser, authLoading, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [productError, setProductError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [error, setError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [productEditorMode, setProductEditorMode] = useState('');
  const [productImageFiles, setProductImageFiles] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [currentPage, setCurrentPage] = useState(1);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const isAdmin = authUser?.role === 'admin';
  const canManageProducts = authUser?.role === 'employee' || isAdmin;

  // Redirect if not authenticated or not an employee/admin manager.
  useEffect(() => {
    if (!authLoading) {
      if (!authToken || !canManageProducts) {
        navigate('/auth');
      }
    }
  }, [authLoading, authToken, canManageProducts, navigate]);

  // Load products independently so order failures never block product management.
  useEffect(() => {
    const loadProducts = async () => {
      if (!authToken || !canManageProducts) {
        setIsProductsLoading(false);
        return;
      }

      setIsProductsLoading(true);
      setProductError('');

      try {
        const productsRes = await apiRequest('/api/products');
        setProducts(productsRes?.data ?? []);
      } catch (err) {
        setProducts([]);
        setProductError('Failed to fetch products.');
      } finally {
        setIsProductsLoading(false);
      }
    };

    loadProducts();
  }, [authToken, canManageProducts]);

  useEffect(() => {
    const loadOrders = async () => {
      if (!authToken || !canManageProducts || activeTab !== 'orders') {
        return;
      }

      setIsOrdersLoading(true);
      setOrderError('');

      try {
        const ordersRes = await apiRequest('/api/orders/my', { token: authToken });
        setOrders(ordersRes?.data ?? []);
      } catch (err) {
        setOrders([]);
        setOrderError(err.message || 'Failed to fetch orders.');
      } finally {
        setIsOrdersLoading(false);
      }
    };

    loadOrders();
  }, [activeTab, authToken, canManageProducts]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [accountMenuOpen]);

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductEditorMode('edit');
    setProductImageFiles([]);
    setEditForm(buildEditForm(product));
  };

  const handleAddProduct = () => {
    setEditingProduct({ _id: '', images: [] });
    setProductEditorMode('create');
    setProductImageFiles([]);
    setEditForm(buildEmptyProductForm());
  };

  const handleCloseProductEditor = () => {
    setEditingProduct(null);
    setProductEditorMode('');
    setProductImageFiles([]);
    setError('');
  };

  const updateEditFormField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveProduct = async () => {
    try {
      setError('');
      const isCreate = productEditorMode === 'create';
      const hasImage = (Array.isArray(editForm.images) && editForm.images.length > 0) || productImageFiles.length > 0;

      if (!String(editForm.title || '').trim()) {
        throw new Error('Product name is required before saving.');
      }

      if (!String(editForm.category || '').trim()) {
        throw new Error('Category is required before saving.');
      }

      if (!String(editForm.description || '').trim()) {
        throw new Error('Description is required before saving.');
      }

      if (!String(editForm.material || '').trim()) {
        throw new Error('Material is required before saving.');
      }

      if (!String(editForm.price ?? '').trim() || !Number.isFinite(Number(editForm.price))) {
        throw new Error('Price must be numeric.');
      }

      if (String(editForm.pointsValue ?? '').trim() && !Number.isFinite(Number(editForm.pointsValue))) {
        throw new Error('Points Value must be numeric.');
      }

      if (!String(editForm.stock ?? '').trim() || !Number.isFinite(Number(editForm.stock))) {
        throw new Error('Stock must be numeric.');
      }

      if (!hasImage) {
        throw new Error('Upload at least one product image before saving.');
      }

      const response = await apiRequest(isCreate ? '/api/products' : `/api/products/${editingProduct._id}`, {
        method: isCreate ? 'POST' : 'PATCH',
        body: appendProductFormData(editForm, productImageFiles),
        token: authToken,
      });

      if (response.success && response.data) {
        setProducts((prev) => {
          if (isCreate) return [response.data, ...prev];
          return prev.map((p) => (p._id === editingProduct._id ? response.data : p));
        });

        handleCloseProductEditor();
      } else {
        throw new Error(response.message || 'Failed to save product');
      }
    } catch (err) {
      setError(err.message || 'Failed to save product. Please try again.');
      console.error('Product save error:', err);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!product?._id) {
      setError('This product cannot be deleted right now.');
      return;
    }

    const confirmed = window.confirm(`Delete "${product.title}" from Athar products? This will remove it from the database.`);

    if (!confirmed) {
      return;
    }

    try {
      setError('');

      await apiRequest(`/api/products/${product._id}`, {
        method: 'DELETE',
        token: authToken,
      });

      setProducts((currentProducts) => currentProducts.filter((item) => item._id !== product._id));
    } catch (err) {
      setError(err.message || 'Failed to delete product. Please try again.');
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await apiRequest(
        `/api/orders/${orderId}/status`,
        {
          method: 'PATCH',
          body: { status: newStatus },
          token: authToken,
        },
      );

      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? response.data : o)),
      );
    } catch (err) {
      setError(err.message || 'Failed to update order status');
    }
  };

  const handleProfileClick = () => {
    setAccountMenuOpen(false);
    navigate('/profile');
  };

  const handleLogoutClick = () => {
    setAccountMenuOpen(false);
    onLogout();
    navigate('/');
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (!authUser || !canManageProducts) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Redirecting...</div>;
  }

  // Filter and sort products
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const minimumPrice = minPrice ? Number(minPrice) : 0;
  const maximumPrice = maxPrice ? Number(maxPrice) : Number.POSITIVE_INFINITY;

  const filteredProducts = sortProducts(
    products.filter((product) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        product.title.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery) ||
        (product.description && product.description.toLowerCase().includes(normalizedQuery));

      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const matchesPrice = product.price >= minimumPrice && product.price <= maximumPrice;
      return matchesSearch && matchesCategory && matchesPrice;
    }),
    sortBy,
  );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedProducts = filteredProducts.slice((validPage - 1) * PRODUCTS_PER_PAGE, validPage * PRODUCTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Employee Navbar - Same style as client page */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="section-shell flex flex-col gap-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Logo Section */}
          <Link to={isAdmin ? '/admin/dashboard' : '/employee-dashboard'} className="flex items-center gap-4">
            <div className="rounded-[20px] bg-blush p-1.5">
              <img src={resolveApiAssetUrl('products/athar.jpg')} alt="Athar logo" className="h-14 w-14 rounded-full object-cover" />
            </div>
            <div>
              <p className="font-display text-5xl leading-none text-ink">Athar</p>
              <p className="text-sm text-ink-soft">Order & Product Management Portal</p>
            </div>
          </Link>

          {/* Navigation & Actions */}
          <div className="flex flex-wrap items-center gap-6">
            {isAdmin ? (
              <AdminNavigation />
            ) : (
              <nav className="flex flex-wrap items-center gap-6">
                {employeeLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => setActiveTab(link.id)}
                    className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                      activeTab === link.id
                        ? 'border-rose bg-blush text-ink'
                        : 'border-transparent text-ink-soft hover:border-line hover:bg-blush/60 hover:text-ink'
                    }`}
                    aria-label={link.label}
                    title={link.label}
                  >
                    {link.icon === 'product' ? <ProductIcon /> : <OrderIcon />}
                    <span className="sr-only">{link.label}</span>
                  </button>
                ))}
              </nav>
            )}

            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((currentValue) => !currentValue)}
                className="flex items-center gap-3 rounded-full border-2 border-rose bg-white px-2 py-2 transition hover:bg-blush"
              >
                {authUser.profilePicture ? (
                  <img
                    src={authUser.profilePicture}
                    alt={authUser.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ee8bb7] text-base font-bold text-white">
                    {authUser.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="max-w-[120px] truncate pr-2 font-semibold text-ink">
                  {authUser.name?.split(' ')[0] || 'Account'}
                </span>
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-line bg-white shadow-lg">
                  <div className="flex items-center gap-3 border-b border-line/30 px-4 py-4">
                    {authUser.profilePicture ? (
                      <img
                        src={authUser.profilePicture}
                        alt={authUser.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ee8bb7] text-lg font-bold text-white">
                        {authUser.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{authUser.name}</p>
                      <p className="text-xs capitalize text-ink-soft">{authUser.role}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleProfileClick}
                    className="block w-full px-4 py-3 text-left text-sm text-ink transition hover:bg-blush"
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className="block w-full rounded-b-lg px-4 py-3 text-left text-sm text-rose transition hover:bg-rose/10"
                  >
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="section-shell py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <SectionTitle
                title="All Products"
                description="Manage all Athar products. Edit product details, prices, and inventory."
              />
              {isAdmin ? (
                <button type="button" onClick={handleAddProduct} className="button-primary w-fit px-6 py-3 text-sm">
                  + Add Product
                </button>
              ) : null}
            </div>

            {isProductsLoading ? (
              <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">
                Loading products...
              </div>
            ) : null}

            {productError ? (
              <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">
                {productError}
              </div>
            ) : null}

            {!isProductsLoading && !productError && products.length > 0 && (
              <>
                {/* Search and Filters Section */}
                <section className="space-y-6 rounded-[32px] bg-white p-5 shadow-soft sm:p-6">
                  <SearchBar
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search products or materials"
                    showButton={false}
                  />
                  <Filter
                    categories={['All', ...getCategoryList(products)]}
                    selectedCategory={selectedCategory}
                    onCategoryChange={(category) => {
                      setSelectedCategory(category);
                      setCurrentPage(1);
                    }}
                    sortValue={sortBy}
                    sortOptions={sortOptions}
                    onSortChange={(sort) => {
                      setSortBy(sort);
                      setCurrentPage(1);
                    }}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    onMinPriceChange={(min) => {
                      setMinPrice(min);
                      setCurrentPage(1);
                    }}
                    onMaxPriceChange={(max) => {
                      setMaxPrice(max);
                      setCurrentPage(1);
                    }}
                    summary={`Showing ${Math.min(PRODUCTS_PER_PAGE, filteredProducts.length - (validPage - 1) * PRODUCTS_PER_PAGE)} of ${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`}
                    onClear={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setMinPrice('');
                      setMaxPrice('');
                      setSortBy('featured');
                      setCurrentPage(1);
                    }}
                  />
                </section>

                {/* Products Grid */}
                {filteredProducts.length > 0 ? (
                  <section className="space-y-8">
                    <StaggerContainer immediate className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {paginatedProducts.map((product) => {
                        const productImageUrl = resolveApiAssetUrl(product?.images?.[0] || product?.image);
                        return (
                          <StaggerItem key={product._id}>
                            <div className="rounded-[28px] bg-white overflow-hidden hover:shadow-lg transition shadow-card group">
                              {productImageUrl && (
                                <div className="relative overflow-hidden rounded-[24px] bg-cream aspect-[4/3]">
                                  <img
                                    src={productImageUrl}
                                    alt={product.title}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                                  />
                                </div>
                              )}
                              <div className="p-4">
                                <h3 className="font-bold text-ink mb-2 line-clamp-2">{product.title}</h3>
                                <p className="text-text text-sm mb-3 line-clamp-2">
                                  {product.description}
                                </p>
                                <div className="flex justify-between items-center mb-4">
                                  <span className="text-blush font-bold text-lg">{product.price}JD</span>
                                  <span className="text-sm text-muted uppercase tracking-[0.18em]">{product.category}</span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditProduct(product)}
                                    className="w-full bg-blush text-white py-2 rounded-lg hover:bg-opacity-80 transition font-semibold"
                                  >
                                    Edit Product
                                  </button>
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProduct(product)}
                                      className="w-full rounded-lg border border-[#e7c8c8] bg-white py-2 font-semibold text-[#8c3f3f] transition hover:bg-[#fff5f5]"
                                    >
                                      Delete Product
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </StaggerItem>
                        );
                      })}
                    </StaggerContainer>

                    {/* Pagination */}
                    {totalPages > 1 ? (
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`inline-flex h-11 w-11 items-center justify-center border text-lg font-display transition ${
                              validPage === pageNumber
                                ? 'border-ink/25 bg-blush text-ink shadow-card'
                                : 'border-transparent bg-[#f4e7e2] text-ink-soft hover:border-ink/10 hover:text-ink'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
                    <h3 className="font-display text-4xl text-ink">No products found.</h3>
                  </div>
                )}
              </>
            )}

            {!isProductsLoading && !productError && products.length === 0 && (
              <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
                <h3 className="font-display text-4xl text-ink">The catalog is temporarily empty.</h3>
                {isAdmin ? (
                  <button type="button" onClick={handleAddProduct} className="button-primary mt-5 px-6 py-3 text-sm">
                    + Add Product
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <h2 className="text-3xl font-bold text-ink mb-6">Orders Tracking & Management</h2>

            {isOrdersLoading ? (
              <div className="text-center py-8">Loading orders...</div>
            ) : orderError ? (
              <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">
                {orderError}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-text">No orders found</div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blush"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-text">Order ID</p>
                        <p className="font-semibold text-ink">{order.orderNumber || order._id.slice(-8)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-text">Customer</p>
                        <p className="font-semibold text-ink">{order.user?.name || 'Guest'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-text">Email</p>
                        <p className="font-semibold text-ink text-sm">{order.user?.email || order.customerEmail || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-text">Total</p>
                        <p className="font-semibold text-blush">${order.total?.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="bg-gray-50 rounded p-4 mb-4">
                      <p className="font-semibold text-ink mb-2">Items:</p>
                      <div className="space-y-2">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.title} x {item.quantity}</span>
                            <span className="text-text">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="bg-gray-50 rounded p-4 mb-4">
                      <p className="font-semibold text-ink mb-2">Shipping Address:</p>
                      <p className="text-sm text-text">
                        {order.address?.line1}, {order.address?.city}, {order.address?.country}
                      </p>
                    </div>

                    {/* Status Management */}
                    <div className="flex justify-between items-center">
                      <div>
                        <span
                          className={`px-4 py-2 rounded-full text-sm font-semibold ${
                            order.status === 'Delivered'
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'Shipped'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'Confirmed'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      {order.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateOrderStatus(order._id, 'Confirmed')}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"
                          >
                            ✓ Confirm
                          </button>
                          <button
                            onClick={() => handleUpdateOrderStatus(order._id, 'Cancelled')}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold"
                          >
                            ✕ Refuse
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {editingProduct && (
        <AdminProductEditor
          authToken={authToken}
          error={error}
          form={editForm}
          imageFiles={productImageFiles}
          isAdmin={isAdmin}
          mode={productEditorMode}
          product={editingProduct}
          onCancel={handleCloseProductEditor}
          onFieldChange={updateEditFormField}
          onImagesChange={setProductImageFiles}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
};

export default EmployeeDashboard;
