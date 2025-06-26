'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";


export default function ReportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'garbage',
    location: '',
    images: [],
  });

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.replace('/login');
        } else {
          setAuthChecked(true);
        }
      } catch {
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({ ...prev, images: files }));
  };

  const convertFileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!formData.title.trim() || !formData.description.trim() || !formData.location.trim()) {
        throw new Error('Please fill in all required fields.');
      }

      if (formData.images.length === 0) {
        throw new Error('Please upload at least one image.');
      }

      const base64Images = [];
      for (const image of formData.images) {
        const base64 = await convertFileToBase64(image);
        base64Images.push(base64);
      }

      const reportData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        address: formData.location.trim(),
        newImages: base64Images,
      };

      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit report');
      }

      router.push('/explore');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!authChecked) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Report an Issue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Issue Title *</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g., Garbage dumping near park"
                value={formData.title}
                onChange={handleInputChange}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the issue in detail..."
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="garbage">Garbage</SelectItem>
                  <SelectItem value="waterlogging">Waterlogging</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                name="location"
                placeholder="e.g., Sector 12, Noida"
                value={formData.location}
                onChange={handleInputChange}
              />
              <p className="text-muted-foreground text-sm">
                We'll fetch coordinates from this address.
              </p>
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label htmlFor="images">Upload Images *</Label>
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
              />
              <p className="text-muted-foreground text-sm">
                Upload JPEG, PNG files (1 or more).
              </p>

              {/* Preview */}
              {formData.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {formData.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={URL.createObjectURL(img)}
                      alt={`img-${idx}`}
                      className="h-24 w-full object-cover rounded"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
