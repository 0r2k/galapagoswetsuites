'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Edit } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { 
  ProductConfig, 
  AdditionalFee, 
  getProducts, 
  getAdditionalFees, 
  updateProduct,
  ProductType,
  WetsuitSubtype,
  Island
} from '@/lib/db'
import { toast } from 'sonner'

// Interface para productos con información completa
interface Product {
  id: string
  product_type: string
  name: string
  description: string
  public_price: number
  supplier_cost: number
  image: string
  tax_percentage: number
  active: boolean
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [fees, setFees] = useState<AdditionalFee[]>([])
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('products')
  
  // Estados para el modal de edición
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    supplier_cost: 0,
    public_price: 0
  })

  // Formulario para nueva tarifa
  const [newFee, setNewFee] = useState<Partial<AdditionalFee>>({
    fee_type: 'island_return_fee',
    location: 'san-cristobal' as Island,
    amount: 5,
    active: true
  })

  // Verificar autenticación
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      // Verificar si el usuario es administrador
      const { data: customer } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (!customer) {
        // En lugar de redirigir silenciosamente, mostrar un mensaje de error
        // y luego redirigir al home
        router.push('/?error=access_denied')
        return
      }
      
      setUser(user)
      loadData()
    }
    
    checkUser()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar productos con información completa
      const { data: productsData, error: productsError } = await supabase
        .from('product_config')
        .select('id, product_type, name, description, public_price, supplier_cost, image, tax_percentage, active')
        .eq('active', true)
      
      if (productsError) throw productsError
      
      const feesData = await getAdditionalFees()
      
      setProducts(productsData || [])
      setFees(feesData)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error', { description: 'No se pudieron cargar los datos' })
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setEditForm({
      name: product.name,
      description: product.description,
      supplier_cost: product.supplier_cost,
      public_price: product.public_price
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    
    try {
      const { error } = await supabase
        .from('product_config')
        .update({
          name: editForm.name,
          description: editForm.description,
          supplier_cost: editForm.supplier_cost,
          public_price: editForm.public_price
        })
        .eq('id', editingProduct.id)
      
      if (error) throw error
      
      toast.success('Producto actualizado', { description: 'Los cambios se han guardado correctamente' })
      setIsEditModalOpen(false)
      setEditingProduct(null)
      loadData()
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error('Error', { description: 'No se pudo actualizar el producto' })
    }
  }

  const handleCreateFee = async () => {
    try {
      await supabase.from('additional_fees').insert([newFee])
      setNewFee({
        fee_type: 'island_return_fee',
        location: 'san-cristobal',
        amount: 5,
        active: true
      })
      loadData()
    } catch (error) {
      console.error('Error creating fee:', error)
    }
  }

  const handleUpdateFee = async (id: string, updates: Partial<AdditionalFee>) => {
    try {
      await supabase.from('additional_fees').update(updates).eq('id', id)
      loadData()
    } catch (error) {
      console.error('Error updating fee:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <Button onClick={handleLogout}>Cerrar Sesión</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="fees">Tarifas Adicionales</TabsTrigger>
        </TabsList>
        
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Productos Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.length > 0 ? (
                  products.map(product => (
                    <Card key={product.id} className="overflow-hidden">
                      <CardHeader className="text-center">
                        <CardTitle className="text-lg flex flex-col items-center gap-2">
                          {product.name}
                          <div className="flex gap-2">
                            <Badge variant="secondary">${product.public_price}/día</Badge>
                            <Badge variant="outline">Costo: ${product.supplier_cost}</Badge>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-4xl mb-2">
                            <Image 
                              src={product.image}
                              alt={product.name}
                              width={40}
                              height={40}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground text-center">{product.description}</p>
                          <div className="text-xs text-muted-foreground mt-2">
                            <p>Tipo: {product.product_type === 'wetsuit' ? 'Traje de buceo' : 
                                     product.product_type === 'snorkel' ? 'Snorkel' : 'Aletas'}</p>
                            <p>IVA: {product.tax_percentage}%</p>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button 
                          onClick={() => openEditModal(product)} 
                          className="w-full"
                          variant="outline"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-12 text-muted-foreground">
                    <p>No hay productos disponibles en este momento.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agregar Nueva Tarifa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fee_type">Tipo de Tarifa</Label>
                  <Select 
                    value={newFee.fee_type || ''} 
                    onValueChange={(value) => setNewFee({...newFee, fee_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="island_return_fee">Tarifa de Devolución en Otra Isla</SelectItem>
                      <SelectItem value="late_return_fee">Tarifa por Devolución Tardía</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newFee.fee_type === 'island_return_fee' && (
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Select 
                      value={newFee.location || ''} 
                      onValueChange={(value) => setNewFee({...newFee, location: value as Island})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ubicación" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="san-cristobal">San Cristóbal</SelectItem>
                        <SelectItem value="santa-cruz">Santa Cruz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="amount">Monto</Label>
                  <Input 
                    type="number" 
                    value={newFee.amount?.toString()} 
                    onChange={(e) => setNewFee({...newFee, amount: parseFloat(e.target.value)})}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={newFee.active} 
                    onCheckedChange={(checked) => setNewFee({...newFee, active: checked})}
                  />
                  <Label>Activo</Label>
                </div>
              </div>

              <Button className="mt-4" onClick={handleCreateFee}>Agregar Tarifa</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tarifas Existentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell>
                        {fee.fee_type === 'island_return_fee' ? 'Devolución en Otra Isla' : 
                         fee.fee_type === 'late_return_fee' ? 'Devolución Tardía' : fee.fee_type}
                      </TableCell>
                      <TableCell>{fee.location}</TableCell>
                      <TableCell>${fee.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Switch 
                          checked={fee.active} 
                          onCheckedChange={(checked) => handleUpdateFee(fee.id, { active: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => {
                          // Implementar edición
                        }}>Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Edición */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Descripción
              </Label>
              <Input
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="supplier_cost" className="text-right">
                Costo Proveedor
              </Label>
              <Input
                id="supplier_cost"
                type="number"
                value={editForm.supplier_cost?.toString()}
                onChange={(e) => setEditForm({...editForm, supplier_cost: parseFloat(e.target.value)})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="public_price" className="text-right">
                Precio Público
              </Label>
              <Input
                id="public_price"
                type="number"
                value={editForm.public_price?.toString()}
                onChange={(e) => setEditForm({...editForm, public_price: parseFloat(e.target.value)})}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateProduct}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}