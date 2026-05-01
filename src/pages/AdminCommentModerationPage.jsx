import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SectionTitle from '../components/SectionTitle';
import { apiRequest } from '../utils/api';
import { formatDate } from '../utils/format';

const statusFilters = ['pending', 'rejected', 'approved'];

const statusStyles = {
  approved: 'bg-[#eef7ef] text-[#2b6d39]',
  pending: 'bg-[#fff6df] text-[#9b7108]',
  rejected: 'bg-[#fff1f1] text-[#9b2f2f]',
};

const AdminCommentModerationPage = ({ authToken, authUser, authLoading }) => {
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [activeStatus, setActiveStatus] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

    const loadComments = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await apiRequest(
          `/api/admin/comments/moderation?status=${encodeURIComponent(activeStatus)}`,
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
  }, [activeStatus, authToken, authUser?.role]);

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

        <Link to="/admin/dashboard" className="button-ghost">
          Back to dashboard
        </Link>
      </div>

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
    </div>
  );
};

export default AdminCommentModerationPage;
