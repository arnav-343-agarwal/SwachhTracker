import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import Report from '@/lib/db/reportModel';
import Review from '@/lib/db/reviewModel';
import { getUserFromRequest } from '@/lib/auth/jwt';

// PATCH: Edit a review (author only)
export async function PATCH(request, { params }) {
  await connectToDatabase();
  const { id: reportId, reviewId } = await params;
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const review = await Review.findById(reviewId);
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  if (review.author.toString() !== user._id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { comment, upvote } = await request.json();
  if (!comment || typeof upvote !== 'boolean') {
    return NextResponse.json({ error: 'Comment and upvote required' }, { status: 400 });
  }
  // If upvote changed, update report upvotes
  if (review.upvote !== upvote) {
    await Report.findByIdAndUpdate(reportId, { $inc: { upvotes: upvote ? 1 : -1 } });
  }
  review.comment = comment;
  review.upvote = upvote;
  await review.save();
  return NextResponse.json({ success: true, review });
}

// DELETE: Author or report owner can delete
export async function DELETE(request, { params }) {
  await connectToDatabase();
  const { id: reportId, reviewId } = await params;
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const review = await Review.findById(reviewId);
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  const report = await Report.findById(reportId);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  const isAuthor = review.author.toString() === user._id;
  const isReportOwner = report.createdBy.toString() === user._id;
  if (!isAuthor && !isReportOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  // Remove review from report.reviews
  await Report.findByIdAndUpdate(reportId, { $pull: { reviews: review._id } });
  // Update upvotes if needed
  if (review.upvote) {
    await Report.findByIdAndUpdate(reportId, { $inc: { upvotes: -1 } });
  }
  await review.deleteOne();
  return NextResponse.json({ success: true });
} 