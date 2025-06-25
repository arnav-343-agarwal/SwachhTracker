import { NextResponse } from 'next/server';
import { connectToDatabase, getReportById, updateReport, deleteReportIfOwner } from '@/lib/db';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { geocodeAddress } from '@/lib/geocode';
import { getUserFromRequest } from '@/lib/auth/jwt';

/**
 * GET /api/report/[id]
 * Get a specific report by ID
 */
export async function GET(request, context) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const includeReviews = searchParams.get('includeReviews') === 'true';

    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json(
        { error: 'Invalid report ID' },
        { status: 400 }
      );
    }

    const report = await getReportById(id, includeReviews);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const formattedReport = {
      _id: report._id,
      title: report.title,
      description: report.description,
      category: report.category,
      location: report.location,
      imageUrl: report.imageUrl,
      images: report.images || [],
      resolved: report.resolved,
      resolvedAt: report.resolvedAt,
      resolvedBy: report.resolvedBy,
      createdAt: report.createdAt,
      createdBy: report.createdBy ? {
        _id: report.createdBy._id,
        username: report.createdBy.username,
        email: report.createdBy.email
      } : null
    };

    if (includeReviews && report.reviews) {
      formattedReport.reviews = report.reviews.map(review => ({
        _id: review._id,
        comment: review.comment,
        upvote: review.upvote,
        createdAt: review.createdAt,
        author: review.author ? {
          _id: review.author._id,
          username: review.author.username
        } : null
      }));
    }

    return NextResponse.json({
      success: true,
      report: formattedReport
    });

  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/report/[id]
 * Update a specific report by ID
 */
export async function PATCH(request, context) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const currentReport = await getReportById(id);
    if (!currentReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    const body = await request.json();
    // Admin can always update resolved status
    if (user.isAdmin) {
      // Only allow resolved fields to be updated by admin
      const allowedAdminFields = ['resolved', 'resolvedAt', 'resolvedBy'];
      const keys = Object.keys(body);
      if (keys.every(k => allowedAdminFields.includes(k))) {
        // Update resolved status
        const updatedReport = await updateReport(id, body);
        if (!updatedReport) {
          return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
        }
        const formattedReport = {
          _id: updatedReport._id,
          title: updatedReport.title,
          description: updatedReport.description,
          category: updatedReport.category,
          location: updatedReport.location,
          imageUrl: updatedReport.imageUrl,
          images: updatedReport.images || [],
          resolved: updatedReport.resolved,
          resolvedAt: updatedReport.resolvedAt,
          resolvedBy: updatedReport.resolvedBy,
          createdAt: updatedReport.createdAt,
          createdBy: updatedReport.createdBy ? {
            _id: updatedReport.createdBy._id,
            username: updatedReport.createdBy.username,
            email: updatedReport.createdBy.email
          } : null
        };
        return NextResponse.json({ success: true, report: formattedReport });
      } else {
        return NextResponse.json({ error: 'Admins can only update resolved status.' }, { status: 403 });
      }
    }
    // Owner can update all fields
    if (!currentReport.createdBy || currentReport.createdBy._id.toString() !== user._id) {
      return NextResponse.json({ error: 'Unauthorized: You can only edit your own reports' }, { status: 403 });
    }
    const { title, description, category, location, address, newImages, imagesToDelete } = body;
    if (category) {
      const validCategories = ['garbage', 'waterlogging', 'other'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: 'Invalid category. Must be one of: garbage, waterlogging, other' },
          { status: 400 }
        );
      }
    }
    let finalLocation = location;
    if (address && !location) {
      try {
        const coords = await geocodeAddress(address);
        finalLocation = coords;
      } catch (error) {
        return NextResponse.json(
          { error: `Failed to geocode address: ${error.message}` },
          { status: 400 }
        );
      }
    }
    if (imagesToDelete && imagesToDelete.length > 0) {
      for (const publicId of imagesToDelete) {
        try {
          await deleteImage(publicId);
        } catch (error) {
          console.error(`Failed to delete image ${publicId}:`, error);
        }
      }
    }
    let uploadedNewImages = [];
    if (newImages && newImages.length > 0) {
      for (const image of newImages) {
        try {
          const uploadResult = await uploadImage(image);
          uploadedNewImages.push({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id
          });
        } catch (error) {
          for (const uploadedImage of uploadedNewImages) {
            try {
              await deleteImage(uploadedImage.publicId);
            } catch (cleanupError) {
              console.error('Failed to cleanup image:', cleanupError);
            }
          }
          return NextResponse.json(
            { error: `Failed to upload image: ${error.message}` },
            { status: 500 }
          );
        }
      }
    }
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (finalLocation !== undefined) updateData.location = finalLocation;
    if (imagesToDelete !== undefined) updateData.imagesToDelete = imagesToDelete;
    if (uploadedNewImages.length > 0) updateData.newImages = uploadedNewImages;
    const updatedReport = await updateReport(id, updateData);
    if (!updatedReport) {
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }
    const formattedReport = {
      _id: updatedReport._id,
      title: updatedReport.title,
      description: updatedReport.description,
      category: updatedReport.category,
      location: updatedReport.location,
      imageUrl: updatedReport.imageUrl,
      images: updatedReport.images || [],
      resolved: updatedReport.resolved,
      resolvedAt: updatedReport.resolvedAt,
      resolvedBy: updatedReport.resolvedBy,
      createdAt: updatedReport.createdAt,
      createdBy: updatedReport.createdBy ? {
        _id: updatedReport.createdBy._id,
        username: updatedReport.createdBy.username,
        email: updatedReport.createdBy.email
      } : null
    };
    return NextResponse.json({ success: true, report: formattedReport });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/report/[id]
 * Delete a specific report by ID
 */
export async function DELETE(request, context) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const report = await getReportById(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    const isOwner = report.createdBy && report.createdBy._id.toString() === user._id;
    if (!isOwner && !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Only the owner or admin can delete' }, { status: 403 });
    }

    if (report.images && report.images.length > 0) {
      for (const img of report.images) {
        try { await deleteImage(img.publicId); } catch (e) { /* ignore */ }
      }
    } else if (report.imageUrl && report.images?.length === 0) {
      try { await deleteImage(report.imageUrl); } catch (e) { /* ignore */ }
    }

    const deleted = await deleteReportIfOwner(id, user._id);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 