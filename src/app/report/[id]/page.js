'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function ReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [resolving, setResolving] = useState(false);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewUpvote, setReviewUpvote] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editingReviewText, setEditingReviewText] = useState('');
  const [editingReviewUpvote, setEditingReviewUpvote] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      try {
        const res = await fetch(`/api/report/${id}?includeReviews=true`);
        const data = await res.json();
        if (data.success) setReport(data.report);
        else setError(data.error || 'Failed to load report');
      } catch (err) {
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchReport();
  }, [id]);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    }
    fetchUser();
  }, []);

  // Mini map
  useEffect(() => {
    if (!mounted || !report || !mapContainer.current || mapRef.current) return;
    const { location } = report;
    if (!location) return;
    // Wait for container to have non-zero size
    let tries = 0;
    function tryInitMap() {
      tries++;
      const el = mapContainer.current;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        const map = new mapboxgl.Map({
          container: el,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [location.lng, location.lat],
          zoom: 13
        });
        mapRef.current = map;
        new mapboxgl.Marker().setLngLat([location.lng, location.lat]).addTo(map);
        setTimeout(() => map.resize(), 200);
        // Cleanup
        return () => map.remove();
      } else if (tries < 20) {
        setTimeout(tryInitMap, 100);
      }
    }
    tryInitMap();
    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [report, mounted]);

  const canEdit = user && report && report.createdBy && user._id === report.createdBy._id;
  const canResolve = user && user.isAdmin && report && !report.resolved;
  const canDelete = user && report && (user.isAdmin || (report.createdBy && user._id === report.createdBy._id));

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await fetch(`/api/report/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'is-admin': user.isAdmin ? 'true' : 'false', 'user-email': user.email }
      });
      if (!res.ok) throw new Error('Failed to resolve');
      router.refresh();
    } catch (err) {
      alert('Failed to mark as resolved');
    } finally {
      setResolving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/report/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/explore');
    } catch (err) {
      alert('Failed to delete report');
    }
  };

  // Helper to refetch report after review actions
  const refetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/report/${id}?includeReviews=true`);
      const data = await res.json();
      if (data.success) setReport(data.report);
      else setError(data.error || 'Failed to load report');
    } catch (err) {
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  // Add review
  const handleAddReview = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const res = await fetch(`/api/report/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: reviewText, upvote: reviewUpvote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add review');
      setReviewText('');
      setReviewUpvote(false);
      await refetchReport();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Edit review
  const handleEditReview = (review) => {
    setEditingReviewId(review._id);
    setEditingReviewText(review.comment);
    setEditingReviewUpvote(review.upvote);
  };
  const handleSaveEditReview = async (reviewId) => {
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const res = await fetch(`/api/report/${id}/review/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: editingReviewText, upvote: editingReviewUpvote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update review');
      setEditingReviewId(null);
      setEditingReviewText('');
      setEditingReviewUpvote(false);
      await refetchReport();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };
  // Delete review
  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const res = await fetch(`/api/report/${id}/review/${reviewId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete review');
      await refetchReport();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Admin toggle for resolved status
  const handleAdminToggleResolved = async () => {
    if (!user || !user.isAdmin) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/report/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolved: !report.resolved,
          resolvedAt: !report.resolved ? new Date().toISOString() : null,
          resolvedBy: user._id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update resolved status');
      await refetchReport();
    } catch (err) {
      alert('Failed to update resolved status');
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto py-8 text-center">Loading...</div>;
  if (error) return <div className="max-w-2xl mx-auto py-8 text-center text-red-600">{error}</div>;
  if (!report) return null;

  const images = report.images && report.images.length > 0 ? report.images : report.imageUrl ? [{ url: report.imageUrl }] : [];
  const reviews = report.reviews || [];
  const userReview = user && reviews.find(r => r.author && r.author._id === user._id);
  // Fallback: if createdBy._id is missing, compare to createdBy directly (string)
  const isOwner = user && report.createdBy && (
    (report.createdBy._id && user._id === report.createdBy._id) ||
    (!report.createdBy._id && user._id === report.createdBy)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* Left: Report details and map */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold text-gray-900">{report.title}</span>
            <span className={`text-xs px-2 py-1 rounded ${report.resolved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{report.resolved ? 'Resolved' : 'Unresolved'}</span>
          </div>
          <div className="mb-2 text-sm text-gray-500">Category: <span className="font-medium text-gray-700">{report.category}</span></div>
          <div className="mb-2 text-sm text-gray-500">Upvotes: <span className="font-bold text-green-700">{report.upvotes || 0}</span></div>
          <div className="mb-4 text-gray-800 whitespace-pre-line">{report.description}</div>

          {/* Images carousel/stacked */}
          {images.length > 0 && (
            <div className="mb-6">
              {images.length === 1 ? (
                <img src={images[0].url} alt="Report" className="w-full max-h-72 object-cover rounded-md border" />
              ) : (
                <div className="relative w-full max-w-xl mx-auto">
                  <img src={images[imgIdx].url} alt={`Report image ${imgIdx + 1}`} className="w-full max-h-72 object-cover rounded-md border" />
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 shadow hover:bg-opacity-100"
                    onClick={() => setImgIdx((imgIdx - 1 + images.length) % images.length)}
                    aria-label="Previous image"
                    style={{ display: images.length > 1 ? 'block' : 'none' }}
                  >&#8592;</button>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 shadow hover:bg-opacity-100"
                    onClick={() => setImgIdx((imgIdx + 1) % images.length)}
                    aria-label="Next image"
                    style={{ display: images.length > 1 ? 'block' : 'none' }}
                  >&#8594;</button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <span key={i} className={`inline-block w-2 h-2 rounded-full ${i === imgIdx ? 'bg-green-600' : 'bg-gray-300'}`}></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mini map */}
          <div className="mb-6">
            <div className="w-full h-48 rounded-md overflow-hidden border">
              <div ref={mapContainer} className="w-full h-full" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-4">
            {/* Only owner sees edit/delete */}
            {isOwner && (
              <>
                <button onClick={() => router.push(`/report/${id}/edit`)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Edit</button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
              </>
            )}
            {/* Only admin (not owner unless also admin) sees resolved toggle */}
            {user && user.isAdmin && !isOwner && (
              <button
                onClick={handleAdminToggleResolved}
                disabled={resolving}
                className={`px-4 py-2 rounded ${report.resolved ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-green-600 text-white hover:bg-green-700'}`}
              >
                {resolving
                  ? (report.resolved ? 'Unmarking...' : 'Marking...')
                  : (report.resolved ? 'Mark as Unresolved (Admin)' : 'Mark as Resolved (Admin)')}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Right: Reviews */}
      <div className="w-full md:w-[400px] flex-shrink-0">
        <div className="bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
          <h2 className="text-xl font-bold mb-4 text-black">Reviews</h2>
          {user && !userReview && (
            <form onSubmit={handleAddReview} className="mb-6">
              <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} className="w-full px-3 py-2 border rounded mb-2 text-black" rows={2} placeholder="Write a review..." required disabled={reviewSubmitting} />
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-1 text-black">
                  <input type="checkbox" checked={reviewUpvote} onChange={e => setReviewUpvote(e.target.checked)} disabled={reviewSubmitting} />
                  <span>Upvote</span>
                </label>
              </div>
              {reviewError && <div className="text-red-600 text-sm mb-2">{reviewError}</div>}
              <button type="submit" className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700" disabled={reviewSubmitting}>Post Review</button>
            </form>
          )}
          {user && userReview && editingReviewId !== userReview._id && (
            <div className="mb-4 text-sm text-green-700">You have already reviewed this report.</div>
          )}
          {/* Edit review form */}
          {editingReviewId && (
            <form onSubmit={e => { e.preventDefault(); handleSaveEditReview(editingReviewId); }} className="mb-6">
              <textarea value={editingReviewText} onChange={e => setEditingReviewText(e.target.value)} className="w-full px-3 py-2 border rounded mb-2 text-black" rows={2} required disabled={reviewSubmitting} />
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-1 text-black">
                  <input type="checkbox" checked={editingReviewUpvote} onChange={e => setEditingReviewUpvote(e.target.checked)} disabled={reviewSubmitting} />
                  <span>Upvote</span>
                </label>
              </div>
              {reviewError && <div className="text-red-600 text-sm mb-2">{reviewError}</div>}
              <button type="submit" className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2" disabled={reviewSubmitting}>Save</button>
              <button type="button" className="px-4 py-1 bg-gray-300 text-black rounded hover:bg-gray-400" onClick={() => setEditingReviewId(null)} disabled={reviewSubmitting}>Cancel</button>
            </form>
          )}
          <div className="flex-1 overflow-y-auto space-y-4">
            {reviews.length === 0 && <div className="text-gray-500 text-sm">No reviews yet.</div>}
            {reviews.map((review) => {
              const isReviewAuthor = user && review.author && review.author._id === user._id;
              const isReportOwner = user && report.createdBy && user._id === report.createdBy._id;
              return (
                <div key={review._id} className="bg-gray-50 rounded p-3 border flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-black">{review.author?.username || 'Unknown'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${review.upvote ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{review.upvote ? 'Upvoted' : 'No Upvote'}</span>
                    <span className="text-xs text-gray-400 ml-auto">{new Date(review.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-black text-sm mb-1 whitespace-pre-line">{review.comment}</div>
                  <div className="flex gap-2 text-xs">
                    {isReviewAuthor && editingReviewId !== review._id && (
                      <>
                        <button onClick={() => handleEditReview(review)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => handleDeleteReview(review._id)} className="text-red-600 hover:underline">Delete</button>
                      </>
                    )}
                    {!isReviewAuthor && isReportOwner && (
                      <button onClick={() => handleDeleteReview(review._id)} className="text-red-600 hover:underline">Delete</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* DEBUG: Show user and owner IDs for troubleshooting */}
      <div className="mb-4 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-900">
        <div><b>Debug Info:</b></div>
        <div>user._id: {user?._id || 'null'}</div>
        <div>report.createdBy._id: {report?.createdBy?._id || 'null'}</div>
        <div>isOwner: {String(isOwner)}</div>
      </div>
    </div>
  );
} 