'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from "next/image"
import { toast } from 'sonner'

interface ProductConfig {
  name: string
  name_en: string
  product_type: string
  product_subtype?: string
}

interface RentalItem {
  id: string
  product_config_id: string
  quantity: number
  size: string | null
  product_config: ProductConfig
}

interface User {
  first_name: string
  last_name: string
  email: string
}

interface RentalOrder {
  id: string
  customer_id: string
  users: User
  rental_items: RentalItem[]
}

const sizeOptions = {
  wetsuit: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  fins: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']
}

export default function SizesPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const t = useTranslations('sizes')
  const tCommon = useTranslations('common')
  const tProduct = useTranslations('products')
  const locale = useLocale()
  
  const [order, setOrder] = useState<RentalOrder | null>(null)
  const [sizes, setSizes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orderId) {
      setTimeout(() => {
        toast.error(t('orderIdRequired'))
      }, 0)
      setLoading(false)
      return
    }

    fetchOrder()
  }, [orderId])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/rentals/${orderId}`)
      
      if (!response.ok) {
        throw new Error(t('errorLoadingOrder'))
      }
      
      const orderData = await response.json()
      setOrder(orderData)
      
      // Inicializar sizes con las tallas existentes
      const initialSizes: Record<string, string> = {}
      orderData.rental_items.forEach((item: RentalItem) => {
        if (item.size) {
          const productType = item.product_config.product_type.toLowerCase()
          const needsSize = productType === 'wetsuit' || productType === 'fins'
          
          if (needsSize) {
            // Si el item necesita talla y tiene tallas guardadas, parsearlas
            const savedSizes = item.size.split(',')
            for (let i = 0; i < item.quantity; i++) {
              const uniqueId = `${item.id}|${i}`
              initialSizes[uniqueId] = savedSizes[i] || ''
            }
          }
        }
      })
      setSizes(initialSizes)
      
    } catch (error) {
      console.error('Error fetching order:', error)
      toast.error(t('orderNotFound'))
    } finally {
      setLoading(false)
    }
  }

  const handleSizeChange = (itemId: string, size: string) => {
    setSizes(prev => ({
      ...prev,
      [itemId]: size
    }))
  }

  const handleSave = async () => {
    if (!orderId) return
    
    setSaving(true)
    try {
      const response = await fetch(`/api/rentals/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sizes }),
      })

      if (!response.ok) {
        throw new Error('Error al guardar las tallas')
      }

      const result = await response.json()
      toast.success(result.message || t('sizesSavedSuccessfully'))
    } catch (error) {
      console.error('Error saving sizes:', error)
      toast.error(t('errorSavingSizes'))
    } finally {
      setSaving(false)
    }
  }

  const getSizeOptions = (productType: string) => {
    switch (productType.toLowerCase()) {
      case 'wetsuit':
        return sizeOptions.wetsuit
      default:
        return []
    }
  }

  // Función para obtener la clave de traducción correcta
  const getProductTranslationKey = (productType: string, productSubtype?: string) => {
    const type = productType.toLowerCase()
    
    if (type === 'wetsuit') {
      if (productSubtype?.toLowerCase() === 'short' || productSubtype?.toLowerCase() === 'corto') {
        return 'wetsuitShort'
      } else if (productSubtype?.toLowerCase() === 'long' || productSubtype?.toLowerCase() === 'largo') {
        return 'wetsuitLong'
      }
      // Fallback para wetsuit sin subtipo específico
      return 'wetsuitShort'
    } else if (type === 'fins' || type === 'aletas') {
      return 'fins'
    } else if (type === 'snorkel') {
      return 'snorkel'
    }
    
    return 'unknownProduct'
  }

  // Agrupar items por tipo de producto
  const groupedItems = order?.rental_items.reduce((groups, item) => {
    const productType = item.product_config.product_type.toLowerCase()
    const productName = item.product_config.name.trim()
    
    if (!groups[productName]) {
      groups[productName] = {
        productType,
        productName,
        items: []
      }
    }
    
    groups[productName].items.push(item)
    return groups
  }, {} as Record<string, { productType: string, productName: string, items: RentalItem[] }>) || {}

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingOrder')}</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">{t('orderNotFound')}</div>
      </div>
    )
  }

  return (
    <div className='bg-gradient-to-b from-primary/5 to-background'>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
        
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('customer')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-gray-600">{tCommon('name')}:</span>
                <span className="ml-2 text-gray-900">{order.users.first_name} {order.users.last_name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">{t('email')}:</span>
                <span className="ml-2 text-gray-900">{order.users.email}</span>
              </div>
            </div>
          </div>

        <div className="space-y-6">
          {Object.values(groupedItems).map((group) => {
            const needsSize = group.productType === 'wetsuit' || group.productType === 'fins'
            
            return (
              <div key={group.productName} className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {tProduct(getProductTranslationKey(group.productType, group.items[0]?.product_config.product_subtype))}
                </h2>
                
                {needsSize ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.items.map((item) => 
                      Array.from({ length: item.quantity }, (_, index) => {
                        const uniqueId = `${item.id}|${index}`
                        return (
                          <Card key={uniqueId} className="hover:border-blue-300 transition-colors gap-2">
                            <CardHeader className='gap-0'>
                              <CardTitle className="text-lg">
                                {locale === 'en' ? item.product_config.name_en : item.product_config.name} #{index + 1}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    {item.product_config.product_type.toLowerCase() === 'fins' ? t('enterSize') : t('selectSize')}:
                                  </label>
                                  {item.product_config.product_type.toLowerCase() === 'fins' ? (
                                    <Input
                                      type="text"
                                      value={sizes[uniqueId] || ''}
                                      onChange={(e) => handleSizeChange(uniqueId, e.target.value)}
                                      placeholder={t('enterSizePlaceholder')}
                                      className="w-full border-gray-300 bg-white"
                                    />
                                  ) : (
                                    <Select
                                      value={sizes[uniqueId] || ''}
                                      onValueChange={(value) => handleSizeChange(uniqueId, value)}
                                    >
                                      <SelectTrigger className="w-full border-gray-300 bg-white">
                                        <SelectValue placeholder={t('selectSizePlaceholder')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getSizeOptions(item.product_config.product_type).map((size) => (
                                          <SelectItem key={size} value={size}>
                                            {size}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })
                    ).flat()}
                  </div>
                ) : (
                  <div className="space-y-2">
                        <p className="text-sm text-gray-600">{t('quantity')}: {group.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                        <p className="text-sm text-gray-500 italic">{t('noSizeRequired')}</p>
                      </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8">
          <Button 
            onClick={handleSave} 
            disabled={saving || Object.keys(sizes).length === 0}
            className="w-full md:w-auto py-6 px-10 text-lg font-bold cursor-pointer"
          >
            {saving ? t('saving') : t('saveSizes')}
          </Button>
        </div>
      </div>
      <footer className="border-t bg-card/50 mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/chokotrip.webp" alt="Chokotrip" width={24} height={24} />
            <span className="font-semibold">Galápagos - Wetsuit & Snorkeling</span>
          </div>
          <p className="text-muted-foreground text-sm">by <a href="https://www.chokotrip.info/" target="_blank">Chokotrip</a></p>
        </div>
      </footer>
    </div>
  )
}