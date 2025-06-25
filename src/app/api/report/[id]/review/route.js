import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import Report from '@/lib/db/reportModel';
import Review from '@/lib/db/reviewModel';
import { getUserFromRequest } from '@/lib/auth/jwt';

export async function POST(request, { params }) {
  await connectToDatabase();
  const { id: reportId } = await params;
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { comment, upvote } = await request.json();
  if (!comment || typeof upvote !== 'boolean') {
    return NextResponse.json({ error: 'Comment and upvote required' }, { status: 400 });
  }
  // Prevent duplicate review by same user for this report
  const existing = await Review.findOne({ report: reportId, author: user._id });
  if (existing) {
    return NextResponse.json({ error: 'You have already reviewed this report.' }, { status: 409 });
  }
  // Create review
  const review = await Review.create({
    report: reportId,
    author: user._id,
    comment,
    upvote,
    createdAt: new Date()
  });
  // Add review ref to report
  await Report.findByIdAndUpdate(reportId, { $push: { reviews: review._id } });
  // Optionally update upvotes count
  if (upvote) {
    await Report.findByIdAndUpdate(reportId, { $inc: { upvotes: 1 } });
  }
  return NextResponse.json({ success: true, review });
} 