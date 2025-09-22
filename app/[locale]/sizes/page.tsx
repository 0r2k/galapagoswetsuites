'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface ProductConfig {
  name: string
  name_en: string
  product_type: string
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
  
  const [order, setOrder] = useState<RentalOrder | null>(null)
  const [sizes, setSizes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orderId) {
      setTimeout(() => {
        toast.error('ID de pedido requerido')
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
        throw new Error('Error al cargar el pedido')
      }
      
      const data = await response.json()
      setOrder(data)
      
      // Inicializar sizes con las tallas existentes
      const initialSizes: Record<string, string> = {}
      data.rental_items.forEach((item: RentalItem) => {
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
      toast.error('Error al cargar el pedido')
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
      toast.success(result.message || 'Tallas guardadas correctamente')
      
    } catch (error) {
      console.error('Error saving sizes:', error)
      toast.error('Error al guardar las tallas')
    } finally {
      setSaving(false)
    }
  }

  const getSizeOptions = (productType: string) => {
    switch (productType.toLowerCase()) {
      case 'wetsuit':
        return sizeOptions.wetsuit
      case 'fins':
        return sizeOptions.fins
      default:
        return []
    }
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
      <div className="container mx-auto p-6">
        <div className="text-center">Cargando pedido...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">No se pudo cargar el pedido</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Seleccionar Tallas</h1>
      
      <div className="mb-6">
        <p><strong>Cliente:</strong> {order.users.first_name} {order.users.last_name}</p>
        <p><strong>Email:</strong> {order.users.email}</p>
      </div>

      <div className="space-y-6">
        {Object.values(groupedItems).map((group) => {
          const needsSize = group.productType === 'wetsuit' || group.productType === 'fins'
          
          return (
            <div key={group.productName} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">{group.productName}</h2>
              
              {needsSize ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.items.map((item) => 
                    Array.from({ length: item.quantity }, (_, index) => {
                      const uniqueId = `${item.id}|${index}`
                      return (
                        <Card key={uniqueId} className="border-2 hover:border-blue-300 transition-colors gap-2">
                          <CardHeader className='gap-0'>
                            <CardTitle className="text-lg">
                              {item.product_config.name} #{index + 1}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Seleccionar Talla:
                                </label>
                                <Select
                                  value={sizes[uniqueId] || ''}
                                  onValueChange={(value) => handleSizeChange(uniqueId, value)}
                                >
                                  <SelectTrigger className="w-full border-gray-300 bg-white">
                                    <SelectValue placeholder="Seleccionar talla" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getSizeOptions(item.product_config.product_type).map((size) => (
                                      <SelectItem key={size} value={size}>
                                        {size}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
                      <p className="text-sm text-gray-600">Cantidad: {group.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                      <p className="text-sm text-gray-500 italic">No requiere talla</p>
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
          {saving ? 'Guardando...' : 'Guardar Tallas'}
        </Button>
      </div>
    </div>
  )
}