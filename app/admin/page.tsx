'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabaseClient'
import { 
  ProductConfig, 
  AdditionalFee, 
  getProducts, 
  getAdditionalFees, 
  createProduct, 
  updateProduct,
  ProductType,
  WetsuitSubtype,
  Island
} from '@/lib/db'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductConfig[]>([])
  const [fees, setFees] = useState<AdditionalFee[]>([])
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('products')
  
  // Formulario para nuevo producto
  const [newProduct, setNewProduct] = useState<Partial<ProductConfig>>({
    product_type: 'snorkel',
    product_subtype: undefined,
    supplier_cost: 0,
    public_price: 0,
    tax_percentage: 0,
    stock_quantity: 0,
    active: true
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
      const productsData = await getProducts()
      const feesData = await getAdditionalFees()
      
      setProducts(productsData)
      setFees(feesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProduct = async () => {
    try {
      await createProduct(newProduct as any)
      setNewProduct({
        product_type: 'snorkel',
        product_subtype: undefined,
        supplier_cost: 0,
        public_price: 0,
        tax_percentage: 0,
        stock_quantity: 0,
        active: true
      })
      loadData()
    } catch (error) {
      console.error('Error creating product:', error)
    }
  }

  const handleUpdateProduct = async (id: string, updates: Partial<ProductConfig>) => {
    try {
      await updateProduct(id, updates)
      loadData()
    } catch (error) {
      console.error('Error updating product:', error)
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
              <CardTitle>Agregar Nuevo Producto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product_type">Tipo de Producto</Label>
                  <Select 
                    value={newProduct.product_type} 
                    onValueChange={(value) => setNewProduct({...newProduct, product_type: value as ProductType})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wetsuit">Traje de Buceo</SelectItem>
                      <SelectItem value="snorkel">Snorkel</SelectItem>
                      <SelectItem value="fins">Aletas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newProduct.product_type === 'wetsuit' && (
                  <div className="space-y-2">
                    <Label htmlFor="product_subtype">Subtipo</Label>
                    <Select 
                      value={newProduct.product_subtype} 
                      onValueChange={(value) => setNewProduct({...newProduct, product_subtype: value as WetsuitSubtype})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar subtipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corto">Corto</SelectItem>
                        <SelectItem value="largo">Largo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="supplier_cost">Costo del Proveedor</Label>
                  <Input 
                    type="number" 
                    value={newProduct.supplier_cost?.toString()} 
                    onChange={(e) => setNewProduct({...newProduct, supplier_cost: parseFloat(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="public_price">Precio al Público</Label>
                  <Input 
                    type="number" 
                    value={newProduct.public_price?.toString()} 
                    onChange={(e) => setNewProduct({...newProduct, public_price: parseFloat(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_percentage">Porcentaje de IVA</Label>
                  <Input 
                    type="number" 
                    value={newProduct.tax_percentage?.toString()} 
                    onChange={(e) => setNewProduct({...newProduct, tax_percentage: parseFloat(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock_quantity">Cantidad en Stock</Label>
                  <Input 
                    type="number" 
                    value={newProduct.stock_quantity?.toString()} 
                    onChange={(e) => setNewProduct({...newProduct, stock_quantity: parseInt(e.target.value)})}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={newProduct.active} 
                    onCheckedChange={(checked) => setNewProduct({...newProduct, active: checked})}
                  />
                  <Label>Activo</Label>
                </div>
              </div>

              <Button className="mt-4" onClick={handleCreateProduct}>Agregar Producto</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos Existentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Subtipo</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>IVA %</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.product_type === 'wetsuit' ? 'Traje de buceo' : 
                         product.product_type === 'snorkel' ? 'Snorkel' : 'Aletas'}
                      </TableCell>
                      <TableCell>{product.product_subtype}</TableCell>
                      <TableCell>{product.size}</TableCell>
                      <TableCell>${product.supplier_cost.toFixed(2)}</TableCell>
                      <TableCell>${product.public_price.toFixed(2)}</TableCell>
                      <TableCell>{product.tax_percentage}%</TableCell>
                      <TableCell>{product.stock_quantity}</TableCell>
                      <TableCell>
                        <Switch 
                          checked={product.active} 
                          onCheckedChange={(checked) => handleUpdateProduct(product.id, { active: checked })}
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
    </div>
  )
}