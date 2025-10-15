"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GalleryImage {
  id: string;
  title?: string;
  url: string;
  alt?: string;
  sort_order?: number;
}

interface GalleryProps {
  refreshTrigger?: number;
}

export default function Gallery({ refreshTrigger }: GalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/gallery/list");
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const data = await response.json();
      setImages(data.images || []);
    } catch (error) {
      console.error('Error fetching gallery images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchImages();
    }
  }, [refreshTrigger]);

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta imagen?')) {
      return;
    }

    setDeletingId(imageId);
    try {
      const response = await fetch(`/api/gallery/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageId }),
      });

      if (!response.ok) {
        throw new Error('Error al eliminar la imagen');
      }

      // Remove image from local state
      setImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Imagen eliminada correctamente');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Error al eliminar la imagen');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, imageId: string) => {
    setDraggedItem(imageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, imageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(imageId);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetImageId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetImageId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const draggedIndex = images.findIndex(img => img.id === draggedItem);
    const targetIndex = images.findIndex(img => img.id === targetImageId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Create new array with reordered items
    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(targetIndex, 0, draggedImage);

    // Update local state optimistically
    setImages(newImages);

    // Update sort_order values and send to API
    const updatedImages = newImages.map((img, index) => ({
      ...img,
      sort_order: index + 1
    }));

    try {
      const response = await fetch('/api/gallery/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          images: updatedImages.map(img => ({ id: img.id, sort_order: img.sort_order }))
        }),
      });

      if (!response.ok) {
        throw new Error('Error al reordenar las imágenes');
      }

      setImages(updatedImages);
      toast.success('Orden actualizado correctamente');
    } catch (error) {
      console.error('Error reordering images:', error);
      toast.error('Error al reordenar las imágenes');
      // Revert to original order on error
      fetchImages();
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-8 lg:grid-cols-12 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {images.length > 0 ? (
        <div className="grid grid-cols-3 md:grid-cols-8 lg:grid-cols-12 gap-3">
        {images.map(img => (
          <figure 
            key={img.id} 
            className={`relative group space-y-1 cursor-move transition-all duration-200 ${
              draggedItem === img.id ? 'opacity-50 scale-95' : ''
            } ${
              dragOverItem === img.id ? 'ring-2 ring-blue-400 ring-offset-2' : ''
            }`}
            draggable
            onDragStart={(e) => handleDragStart(e, img.id)}
            onDragOver={(e) => handleDragOver(e, img.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, img.id)}
          >
            <div className="relative">
              <img src={img.url} alt={img.alt || ""} loading="lazy" className="w-full h-auto rounded-lg" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
                onClick={() => handleDeleteImage(img.id)}
                disabled={deletingId === img.id}
              >
                {deletingId === img.id ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </Button>
            </div>
            {img.title && <figcaption className="text-xs text-gray-600">{img.title}</figcaption>}
          </figure>
        ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">No hay imágenes en la galería.</p>
      )}
    </>
  );
}
