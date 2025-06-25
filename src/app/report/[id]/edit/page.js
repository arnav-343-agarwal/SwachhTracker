 'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function EditReportPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'garbage',
    location: '',
    images: [], // new images (File objects)
  });
  const [existingImages, setExistingImages] = useState([]); // {url, publicId}
  const [imagesToDelete, setImagesToDelete] = useState([]); // publicIds
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch report data on mount
  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      try {
        const res = await fetch(`/api/report/${id}`);
        const data = await res.json();
        if (data.success) {
          setFormData({
            title: data.report.title || '',
            description: data.report.description || '',
            category: data.report.category || 'garbage',
            location: data.report.location ? `${data.report.location.lat},${data.report.location.lng}` : '',
            images: []
          });
          setExistingImages(data.report.images || (data.report.imageUrl ? [{ url: data.report.imageUrl }] : []));
        } else {
          setError(data.error || 'Failed to load report');
        }
      } catch (err) {
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchReport();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({ ...prev, images: files }));
  };

  const handleRemoveExistingImage = (publicId) => {
    setImagesToDelete(prev => [...prev, publicId]);
    setExistingImages(prev => prev.filter(img => img.publicId !== publicId));
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      // Validate
      if (!formData.title.trim() || !formData.description.trim()) {
        throw new Error('Please fill in all required fields');
      }
      // Prepare location
      let location = formData.location;
      if (location && location.includes(',')) {
        const [lat, lng] = location.split(',').map(Number);
        location = { lat, lng };
      } else {
        location = undefined;
      }
      // Convert new images to base64
      let newImages = [];
      for (const file of formData.images) {
        const base64 = await convertFileToBase64(file);
        newImages.push(base64);
      }
      // PATCH to API
      const patchData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        location,
        newImages,
        imagesToDelete
      };
      const response = await fetch(`/api/report/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'user-id': '000000000000000000000001' // For dev
        },
        body: JSON.stringify(patchData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update report');
      }
      router.push(`/report/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto py-8 text-center">Loading...</div>;
  if (error) return <div className="max-w-2xl mx-auto py-8 text-center text-red-600">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-black">Edit Report</h1>
        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md"><p className="text-red-600">{error}</p></div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2 text-black">Title *</label>
            <input type="text" id="title" name="title" value={formData.title} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" required />
          </div>
          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2 text-black">Description *</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" required />
          </div>
          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-2 text-black">Category *</label>
            <select id="category" name="category" value={formData.category} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" required>
              <option value="garbage">Garbage</option>
              <option value="waterlogging">Waterlogging</option>
              <option value="other">Other</option>
            </select>
          </div>
          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium mb-2 text-black">Location (lat,lng)</label>
            <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="28.6139,77.2090" />
            <p className="mt-1 text-sm text-gray-500">Format: latitude,longitude</p>
          </div>
          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black">Existing Images</label>
              <div className="flex flex-wrap gap-3">
                {existingImages.map((img, idx) => (
                  <div key={img.publicId || idx} className="relative group">
                    <img src={img.url} alt="Report" className="w-24 h-24 object-cover rounded border" />
                    {img.publicId && (
                      <button type="button" onClick={() => handleRemoveExistingImage(img.publicId)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs opacity-80 group-hover:opacity-100">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Add New Images */}
          <div>
            <label htmlFor="images" className="block text-sm font-medium mb-2 text-black">Add Images</label>
            <input type="file" id="images" name="images" onChange={handleImageChange} multiple accept="image/*" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
            {formData.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.images.map((img, idx) => (
                  <img key={idx} src={URL.createObjectURL(img)} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                ))}
              </div>
            )}
          </div>
          {/* Submit */}
          <div className="flex justify-end">
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
