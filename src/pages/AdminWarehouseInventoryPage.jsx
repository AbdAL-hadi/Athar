import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/admin/AdminNavigation';
import InventoryAnalysisSection from '../components/admin/InventoryAnalysisSection';
import SectionTitle from '../components/SectionTitle';
import { apiRequest } from '../utils/api';

const statusClasses = {
  'Out of stock': 'bg-[#ffe5e5] text-[#7e2020]',
  'Low stock': 'bg-[#fff6df] text-[#9b7108]',
  'In stock': 'bg-[#eef7ef] text-[#2b6d39]',
};

const AdminWarehouseInventoryPage = ({ authToken, authUser, authLoading }) => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState({ warehouses: [], rows: [] });
  const [analysis, setAnalysis] = useState(null);
  const [analysisRange, setAnalysisRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysisError, setAnalysisError] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authToken || authUser?.role !== 'admin') {
      navigate('/auth');
    }
  }, [authLoading, authToken, authUser?.role, navigate]);

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadInventory = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await apiRequest('/api/admin/inventory', { token: authToken });

        if (!isCancelled) {
          setInventory(response?.data ?? { warehouses: [], rows: [] });
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message || 'Failed to load warehouse inventory.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadInventory();
    return () => {
      isCancelled = true;
    };
  }, [authToken, authUser?.role]);

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadAnalysis = async () => {
      try {
        setIsAnalysisLoading(true);
        setAnalysisError('');
        const response = await apiRequest(`/api/admin/inventory-analysis?range=${encodeURIComponent(analysisRange)}`, {
          token: authToken,
        });

        if (!isCancelled) {
          setAnalysis(response?.data ?? null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setAnalysisError(loadError.message || 'Failed to load inventory analysis.');
        }
      } finally {
        if (!isCancelled) {
          setIsAnalysisLoading(false);
        }
      }
    };

    loadAnalysis();
    return () => {
      isCancelled = true;
    };
  }, [analysisRange, authToken, authUser?.role]);

  const rows = useMemo(() => (Array.isArray(inventory.rows) ? inventory.rows : []), [inventory.rows]);
  const warehouses = useMemo(() => (Array.isArray(inventory.warehouses) ? inventory.warehouses : []), [inventory.warehouses]);

  if (authLoading) {
    return <div className="section-shell py-12 text-lg text-ink-soft">Checking inventory access...</div>;
  }

  if (!authUser || authUser.role !== 'admin') {
    return <div className="section-shell py-12 text-lg text-ink-soft">Redirecting to the login page...</div>;
  }

  return (
    <div className="section-shell space-y-8 pb-10 pt-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <SectionTitle
          title="Warehouse Inventory"
          description="Review product quantities by warehouse while Product.stock stays synced as the public total."
        />
        <AdminNavigation />
      </div>

      {isLoading ? (
        <div className="rounded-[28px] bg-white px-6 py-10 text-lg text-ink-soft shadow-card">Loading warehouse inventory...</div>
      ) : null}

      {error ? (
        <div className="rounded-[28px] border border-[#e7c8c8] bg-white px-6 py-5 text-[#8c6546] shadow-card">{error}</div>
      ) : null}

      <InventoryAnalysisSection
        analysis={analysis}
        isLoading={isAnalysisLoading}
        errorMessage={analysisError}
        range={analysisRange}
        onRangeChange={setAnalysisRange}
      />

      {!isLoading && !error ? (
        <section className="overflow-hidden rounded-[32px] bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Category</th>
                  {warehouses.map((warehouse) => (
                    <th key={warehouse._id || warehouse.id} className="px-5 py-4">
                      {warehouse.cityLabel || warehouse.name}
                    </th>
                  ))}
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.productId} className="border-b border-line/60 align-top text-sm text-ink">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{row.title}</p>
                    </td>
                    <td className="px-5 py-4">{row.category}</td>
                    {warehouses.map((warehouse) => {
                      const stock = row.warehouseStocks.find((item) => item.warehouseId === String(warehouse._id || warehouse.id));

                      return (
                        <td key={`${row.productId}-${warehouse._id || warehouse.id}`} className="px-5 py-4">
                          {stock?.quantity ?? 0}
                        </td>
                      );
                    })}
                    <td className="px-5 py-4 font-semibold">{row.total}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[row.status] || statusClasses['In stock']}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link to="/employee-dashboard" className="text-sm font-semibold text-rose hover:text-ink">
                        Edit stock distribution
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-ink-soft">No products found.</div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default AdminWarehouseInventoryPage;
