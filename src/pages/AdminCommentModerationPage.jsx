import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SectionTitle from '../components/SectionTitle';
import { apiRequest } from '../utils/api';
import { formatDate } from '../utils/format';

const statusFilters = ['pending', 'rejected', 'approved'];
const analyticsRanges = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const categoryLabels = {
  praise: 'Praise',
  product_complaint: 'Product Complaint',
  delivery_complaint: 'Delivery Complaint',
  price_complaint: 'Price Complaint',
  offensive: 'Offensive',
  spam: 'Spam',
  general_feedback: 'General Feedback',
  unknown: 'Unknown',
};

const statusStyles = {
  approved: 'bg-[#eef7ef] text-[#2b6d39]',
  pending: 'bg-[#fff6df] text-[#9b7108]',
  rejected: 'bg-[#fff1f1] text-[#9b2f2f]',
};

const issueStyles = {
  praise: 'bg-[#eef7ef] text-[#2b6d39]',
  product_complaint: 'bg-[#fff6df] text-[#9b7108]',
  delivery_complaint: 'bg-[#fff6df] text-[#9b7108]',
  price_complaint: 'bg-[#fff6df] text-[#9b7108]',
  offensive: 'bg-[#fff1f1] text-[#9b2f2f]',
  spam: 'bg-[#fff1f1] text-[#9b2f2f]',
  general_feedback: 'bg-[#f4e7e2] text-ink-soft',
  unknown: 'bg-white text-ink-soft',
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

const AdminCommentModerationPage = ({ authToken, authUser, authLoading }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [comments, setComments] = useState([]);
  const [activeStatus, setActiveStatus] = useState('pending');
  const [activeTab, setActiveTab] = useState('moderation');
  const [analyticsRange, setAnalyticsRange] = useState('7d');
  const [analytics, setAnalytics] = useState({
    categoryBreakdown: [],
    topFlaggedProducts: [],
    topComplaintKeywords: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');
  const [message, setMessage] = useState('');
  const productFilter = searchParams.get('productId') || '';

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authToken || authUser?.role !== 'admin') {
      navigate('/auth');
    }
  }, [authLoading, authToken, authUser?.role, navigate]);

  useEffect(() => {
    if (productFilter) {
      setActiveTab('moderation');
    }
  }, [productFilter]);

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadComments = async () => {
      setIsLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({ status: activeStatus });
        if (productFilter) params.set('productId', productFilter);
        const response = await apiRequest(
          `/api/admin/comments/moderation?${params.toString()}`,
          { token: authToken },
        );

        if (!isCancelled) {
          setComments(Array.isArray(response?.data) ? response.data : []);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message || 'Failed to load moderation comments.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      isCancelled = true;
    };
  }, [activeStatus, authToken, authUser?.role, productFilter]);

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadAnalytics = async () => {
      setIsAnalyticsLoading(true);
      setAnalyticsError('');

      try {
        const response = await apiRequest(
          `/api/admin/comments/analytics?range=${encodeURIComponent(analyticsRange)}`,
          { token: authToken },
        );

        if (!isCancelled) {
          setAnalytics(response?.data ?? {
            categoryBreakdown: [],
            topFlaggedProducts: [],
            topComplaintKeywords: [],
          });
        }
      } catch (loadError) {
        if (!isCancelled) {
          setAnalyticsError(loadError.message || 'Failed to load comment analytics.');
        }
      } finally {
        if (!isCancelled) {
          setIsAnalyticsLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      isCancelled = true;
    };
  }, [analyticsRange, authToken, authUser?.role]);

  const updateStatus = async (commentId, status) => {
    setUpdatingId(commentId);
    setError('');
    setMessage('');

    try {
      const response = await apiRequest(`/api/admin/comments/${encodeURIComponent(commentId)}/status`, {
        method: 'PATCH',
        token: authToken,
        body: { status },
      });

      setMessage(response?.message || `Comment marked as ${status}.`);
      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId),
      );
    } catch (updateError) {
      setError(updateError.message || 'Failed to update comment status.');
    } finally {
      setUpdatingId('');
    }
  };

  if (authLoading) {
    return <div className="section-shell py-12 text-lg text-ink-soft">Checking admin access...</div>;
  }

  if (!authUser || authUser.role !== 'admin') {
    return <div className="section-shell py-12 text-lg text-ink-soft">Redirecting to login...</div>;
  }

  return (
    <div className="section-shell space-y-8 pb-10 pt-8">
      <SectionTitle
        title="Comment Moderation"
        description="Review product comments that were approved, rejected, or sent to pending by Athar's local AI-assisted moderation."
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-full bg-[#f4e7e2] p-1">
          {['moderation', 'analytics'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                activeTab === tab ? 'bg-white text-ink shadow-card' : 'text-ink-soft'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <Link to="/admin/dashboard" className="button-ghost">
          Back to dashboard
        </Link>
      </div>

      {activeTab === 'moderation' ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-[#f4e7e2] p-1">
            {statusFilters.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setActiveStatus(status)}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                  activeStatus === status ? 'bg-white text-ink shadow-card' : 'text-ink-soft'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          {productFilter ? (
            <Link to="/admin/comments" className="text-sm font-semibold text-[#8f5f45] underline">
              Clear product filter
            </Link>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[24px] border border-[#bdd8bc] bg-[#f1faf0] px-5 py-4 text-[#2f6a35]">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-[#8c6546] shadow-card">
          {error}
        </div>
      ) : null}

      {activeTab === 'analytics' ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 rounded-[28px] bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-3xl text-ink">Analytics</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Focused moderation analytics for categories, flagged products, and repeated complaint keywords.
              </p>
            </div>
            <label className="min-w-[220px]">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Range</span>
              <select
                value={analyticsRange}
                onChange={(event) => setAnalyticsRange(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
              >
                {analyticsRanges.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {analyticsError ? (
            <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-[#8c6546] shadow-card">
              {analyticsError}
            </div>
          ) : null}

          <section className="rounded-[28px] bg-white p-6 shadow-card">
            <h2 className="font-display text-3xl text-ink">Comment Categories</h2>
            {isAnalyticsLoading ? (
              <div className="mt-4 rounded-[22px] bg-[#fffaf8] px-5 py-6 text-ink-soft">Loading category analytics...</div>
            ) : analytics.categoryBreakdown?.some((item) => item.count > 0) ? (
              <div className="mt-5 space-y-3">
                {analytics.categoryBreakdown.map((item) => {
                  const maxCount = Math.max(...analytics.categoryBreakdown.map((category) => Number(category.count || 0)), 1);
                  const width = `${Math.max(4, (Number(item.count || 0) / maxCount) * 100)}%`;

                  return (
                    <div key={item.category} className="grid gap-2 md:grid-cols-[190px_1fr_70px] md:items-center">
                      <span className="text-sm font-semibold text-ink">{categoryLabels[item.category] || item.category}</span>
                      <div className="h-4 overflow-hidden rounded-full bg-[#f4e7e2]">
                        <div className="h-full rounded-full bg-[#8f5f45]" style={{ width }} />
                      </div>
                      <span className="text-sm font-bold text-ink">{formatNumber(item.count)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] bg-[#fffaf8] px-5 py-6 text-ink-soft">No comment categories found yet.</div>
            )}
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-card">
            <h2 className="font-display text-3xl text-ink">Top Flagged Products</h2>
            {isAnalyticsLoading ? (
              <div className="mt-4 rounded-[22px] bg-[#fffaf8] px-5 py-6 text-ink-soft">Loading flagged products...</div>
            ) : analytics.topFlaggedProducts?.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-[22px] border border-line">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Total Comments</th>
                      <th className="px-4 py-3">Negative Comments</th>
                      <th className="px-4 py-3">Needs Review</th>
                      <th className="px-4 py-3">Rejected</th>
                      <th className="px-4 py-3">Avg Risk</th>
                      <th className="px-4 py-3">Top Issue</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topFlaggedProducts.map((product) => (
                      <tr key={product.productId} className="border-b border-line/60 align-top text-ink">
                        <td className="px-4 py-4 font-semibold">{product.productTitle}</td>
                        <td className="px-4 py-4">{formatNumber(product.totalComments)}</td>
                        <td className="px-4 py-4">{formatNumber(product.negativeComments)}</td>
                        <td className="px-4 py-4">{formatNumber(product.needsReviewCount)}</td>
                        <td className="px-4 py-4">{formatNumber(product.rejectedCount)}</td>
                        <td className="px-4 py-4">{formatNumber(product.averageRiskScore)}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${issueStyles[product.topIssueCategory] || issueStyles.unknown}`}>
                            {categoryLabels[product.topIssueCategory] || product.topIssueCategory}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {product.productSlug ? (
                              <Link className="font-semibold text-[#8f5f45] underline" to={`/products/${product.productSlug}`}>
                                View Product
                              </Link>
                            ) : null}
                            <Link className="font-semibold text-[#8f5f45] underline" to={`/admin/comments?productId=${encodeURIComponent(product.productId)}`}>
                              View Comments
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] bg-[#fffaf8] px-5 py-6 text-ink-soft">No flagged products yet.</div>
            )}
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-card">
            <h2 className="font-display text-3xl text-ink">Top Complaint Keywords</h2>
            {isAnalyticsLoading ? (
              <div className="mt-4 rounded-[22px] bg-[#fffaf8] px-5 py-6 text-ink-soft">Loading complaint keywords...</div>
            ) : analytics.topComplaintKeywords?.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-[22px] border border-line">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                      <th className="px-4 py-3">Keyword</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Related Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topComplaintKeywords.map((item) => (
                      <tr key={`${item.keyword}-${item.category}`} className="border-b border-line/60 text-ink">
                        <td className="px-4 py-4 font-semibold">{item.keyword}</td>
                        <td className="px-4 py-4">{formatNumber(item.count)}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${issueStyles[item.category] || issueStyles.unknown}`}>
                            {categoryLabels[item.category] || item.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] bg-[#fffaf8] px-5 py-6 text-ink-soft">No complaint keywords detected yet.</div>
            )}
          </section>
        </section>
      ) : null}

      {activeTab === 'moderation' ? (
      <section className="space-y-4">
        {isLoading ? (
          <div className="rounded-[28px] bg-white px-6 py-10 text-lg text-ink-soft shadow-card">
            Loading comments...
          </div>
        ) : null}

        {!isLoading && comments.length === 0 ? (
          <div className="rounded-[28px] bg-white px-6 py-10 text-lg text-ink-soft shadow-card">
            No {activeStatus} comments right now.
          </div>
        ) : null}

        {!isLoading
          ? comments.map((comment) => (
              <article key={comment.id} className="rounded-[28px] bg-white p-6 shadow-card">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyles[comment.status] || statusStyles.pending}`}>
                        {comment.status}
                      </span>
                      <span className="text-sm uppercase tracking-[0.16em] text-muted">
                        Score {comment.moderationScore}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-3xl text-ink">{comment.productTitle}</h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {comment.authorName} · {comment.authorEmail} · {comment.createdAt ? formatDate(comment.createdAt) : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateStatus(comment.id, 'approved')}
                      disabled={updatingId === comment.id}
                      className="rounded-full bg-[#eef7ef] px-4 py-2 text-sm font-semibold text-[#2b6d39] disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(comment.id, 'rejected')}
                      disabled={updatingId === comment.id}
                      className="rounded-full bg-[#fff1f1] px-4 py-2 text-sm font-semibold text-[#9b2f2f] disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(comment.id, 'pending')}
                      disabled={updatingId === comment.id}
                      className="rounded-full bg-[#fff6df] px-4 py-2 text-sm font-semibold text-[#9b7108] disabled:opacity-60"
                    >
                      Pending
                    </button>
                  </div>
                </div>

                <p className="mt-5 rounded-[22px] bg-[#fffaf8] px-5 py-4 text-base leading-8 text-ink-soft">
                  {comment.text}
                </p>

                <div className="mt-4 grid gap-3 text-sm text-ink-soft md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-ink">Reason:</span> {comment.moderationReason || 'No reason provided.'}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Labels:</span> {comment.moderationLabels?.length ? comment.moderationLabels.join(', ') : 'None'}
                  </p>
                </div>
              </article>
            ))
          : null}
      </section>
      ) : null}
    </div>
  );
};

export default AdminCommentModerationPage;
