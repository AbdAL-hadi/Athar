import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import SearchBar from '../components/SearchBar';
import Filter from '../components/Filter';
import SectionTitle from '../components/SectionTitle';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [currentPage, setCurrentPage] = useState(1);

  // Redirect if not authenticated or not an employee
  useEffect(() => {
    if (!authLoading) {
      if (!authToken || authUser?.role !== 'employee') {
        navigate('/auth');
      }
    }
  }, [authLoading, authToken, authUser?.role, navigate]);

  // Load products and orders
  useEffect(() => {
    const loadData = async () => {
      if (!authToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [productsRes, ordersRes] = await Promise.all([
          apiRequest('/api/products'),
          apiRequest('/api/orders/my', { token: authToken }),
        ]);

        setProducts(productsRes?.data ?? []);
        setOrders(ordersRes?.data ?? []);
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [authToken]);

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setEditForm({
      title: product.title,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
    });
  };

  const handleSaveProduct = async () => {
    try {
      setError('');
      const response = await apiRequest(`/api/products/${editingProduct._id}`, {
        method: 'PATCH',
        body: editForm,
        token: authToken,
      });

      if (response.success && response.data) {
        // Update the product in the state with the response data
        setProducts((prev) =>
          prev.map((p) =>
            p._id === editingProduct._id ? response.data : p,
          ),
        );
        
        // Close the modal
        setEditingProduct(null);
        setError('');
      } else {
        throw new Error(response.message || 'Failed to update product');
      }
    } catch (err) {
      setError(err.message || 'Failed to update product. Please try again.');
      console.error('Product update error:', err);
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

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (!authUser || authUser?.role !== 'employee') {
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
          <div className="flex items-center gap-4">
            <div className="rounded-[20px] bg-blush p-1.5">
              <img src={resolveApiAssetUrl('products/athar.jpg')} alt="Athar logo" className="h-14 w-14 rounded-full object-cover" />
            </div>
            <div>
              <p className="font-display text-5xl leading-none text-ink">Athar Employee</p>
              <p className="text-sm text-ink-soft">Order & Product Management Portal</p>
            </div>
          </div>

          {/* Navigation & Actions */}
          <div className="flex flex-wrap items-center gap-6">
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

            <button
              onClick={onLogout}
              className="button-primary whitespace-nowrap"
            >
              Logout
            </button>
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
            <SectionTitle 
              title="All Products" 
              description="Manage all Athar products. Edit product details, prices, and inventory."
            />

            {isLoading ? (
              <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">
                Loading products...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">
                {error}
              </div>
            ) : null}

            {!isLoading && products.length > 0 && (
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
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {paginatedProducts.map((product) => {
                        const productImageUrl = resolveApiAssetUrl(product?.images?.[0] || product?.image);
                        return (
                          <div
                            key={product._id}
                            className="rounded-[28px] bg-white overflow-hidden hover:shadow-lg transition shadow-card group"
                          >
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
                              <button
                                onClick={() => handleEditProduct(product)}
                                className="w-full bg-blush text-white py-2 rounded-lg hover:bg-opacity-80 transition font-semibold"
                              >
                                Edit Product
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

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

            {!isLoading && products.length === 0 && (
              <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
                <h3 className="font-display text-4xl text-ink">The catalog is temporarily empty.</h3>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <h2 className="text-3xl font-bold text-ink mb-6">Orders Tracking & Management</h2>

            {isLoading ? (
              <div className="text-center py-8">Loading orders...</div>
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

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl p-0">
            {/* Modal Header */}
            <div className="border-b border-line px-8 py-6">
              <h2 className="font-display text-5xl text-ink">Edit Product</h2>
              <p className="text-muted text-sm mt-1">Update product details and information</p>
            </div>

            {/* Modal Content */}
            <div className="px-8 py-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-muted mb-3">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="field w-full bg-white text-base"
                  placeholder="Enter product title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-muted mb-3">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="field w-full bg-white text-base"
                  rows="5"
                  placeholder="Enter product description"
                />
              </div>

              {/* Price and Stock Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-muted mb-3">Price</label>
                  <input
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                    className="field w-full bg-white text-base"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-muted mb-3">Stock</label>
                  <input
                    type="number"
                    value={editForm.stock}
                    onChange={(e) => setEditForm({ ...editForm, stock: parseInt(e.target.value) })}
                    className="field w-full bg-white text-base"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-muted mb-3">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="field w-full bg-white text-base"
                  placeholder="Enter category"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-line px-8 py-6 flex gap-4">
              <button
                onClick={() => setEditingProduct(null)}
                className="flex-1 px-6 py-3 border-2 border-line text-ink rounded-full hover:bg-cream transition font-semibold text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                className="flex-1 button-primary text-base py-3"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
