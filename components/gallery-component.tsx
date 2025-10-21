import { Loader2 } from "lucide-react"
import Image from "next/image"

interface GalleryImage {
  id: string
  title: string
  url: string
  alt: string
  sort_order: number
  created_at: string
}

interface GalleryComponentProps {
  images: GalleryImage[]
  loading: boolean
  currentIndex: number
  locale: string
  className?: string
}

export function GalleryComponent({ 
  images, 
  loading, 
  currentIndex, 
  locale, 
  className = "" 
}: GalleryComponentProps) {
  return (
    <div className={className}>
      <section className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg h-full">
        <div className="relative">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              {locale === 'es' ? 'Cargando galería...' : 'Loading gallery...'}
            </div>
          ) : (
            <>
              {images.length > 0 ? (
                <div className="relative h-96 overflow-hidden rounded-lg">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                        index === currentIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <div className="relative w-full h-full">
                        <Image
                          src={image.url}
                          alt={image.alt}
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  {locale === 'es' ? 'No hay imágenes en la galería.' : 'No images in gallery.'}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}