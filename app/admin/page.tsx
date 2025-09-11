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
import EmailTemplatesList from '@/app/admin/email-templates/page'
import { 
  PaymentConfig, 
  getAllPaymentConfigs, 
  activatePaymentConfig, 
  updatePaymentConfig,
  initializePaymentConfigs
} from '@/lib/paymentConfig'

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
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([])
  const [editingPaymentConfig, setEditingPaymentConfig] = useState<PaymentConfig | null>(null)
  const [isPaymentConfigModalOpen, setIsPaymentConfigModalOpen] = useState(false)
  
  // Estados para el modal de edición
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    supplier_cost: 0,
    public_price: 0,
    tax_percentage: 0,
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
      // Cargar productos con información completa
      const { data: productsData, error: productsError } = await supabase
        .from('product_config')
        .select('id, product_type, name, description, public_price, supplier_cost, image, tax_percentage, active')
        .eq('active', true)
      
      if (productsError) throw productsError
      
      const feesData = await getAdditionalFees()
      
      // Inicializar y cargar configuraciones de pago
      await initializePaymentConfigs()
      const paymentConfigsData = await getAllPaymentConfigs()
      
      setProducts(productsData || [])
      setFees(feesData)
      setPaymentConfigs(paymentConfigsData)
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
      public_price: product.public_price,
      tax_percentage: product.tax_percentage,
      active: product.active
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

  // Funciones para manejar configuración de Paymentez
  const handleActivatePaymentConfig = async (id: number) => {
    try {
      const success = await activatePaymentConfig(id)
      if (success) {
        toast.success('Configuración activada correctamente')
        loadData()
      } else {
        toast.error('Error al activar la configuración')
      }
    } catch (error) {
      console.error('Error activating payment config:', error)
      toast.error('Error al activar la configuración')
    }
  }

  const openPaymentConfigModal = (config: PaymentConfig) => {
    setEditingPaymentConfig(config)
    setIsPaymentConfigModalOpen(true)
  }

  const handleUpdatePaymentConfig = async () => {
    if (!editingPaymentConfig) return
    
    try {
      const success = await updatePaymentConfig(editingPaymentConfig.id, {
        environment: editingPaymentConfig.environment,
        api_url: editingPaymentConfig.api_url,
        app_code: editingPaymentConfig.app_code,
        app_key: editingPaymentConfig.app_key
      })
      
      if (success) {
        toast.success('Configuración actualizada correctamente')
        setIsPaymentConfigModalOpen(false)
        setEditingPaymentConfig(null)
        loadData()
      } else {
        toast.error('Error al actualizar la configuración')
      }
    } catch (error) {
      console.error('Error updating payment config:', error)
      toast.error('Error al actualizar la configuración')
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="fees">Tarifas Adicionales</TabsTrigger>
          <TabsTrigger value="payment-config">Configuración de Pago</TabsTrigger>
          <TabsTrigger value="email-templates">Plantillas de Email</TabsTrigger>
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

        <TabsContent value="payment-config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Pasarela de Pago - Paymentez</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configura las credenciales y URLs de la pasarela de pago Paymentez. 
                  Solo una configuración puede estar activa a la vez.
                </p>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entorno</TableHead>
                      <TableHead>URL de API</TableHead>
                      <TableHead>App Code</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell>
                          <Badge variant={config.environment === 'prod' ? 'default' : 'secondary'}>
                            {config.environment === 'prod' ? 'Producción' : 'Staging'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{config.api_url}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {config.app_code.substring(0, 10)}...
                        </TableCell>
                        <TableCell>
                          {config.is_active ? (
                            <Badge variant="default">Activa</Badge>
                          ) : (
                            <Badge variant="outline">Inactiva</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openPaymentConfigModal(config)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            {!config.is_active && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => handleActivatePaymentConfig(config.id)}
                              >
                                Activar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-templates" className="space-y-6">
          <EmailTemplatesList />
        </TabsContent>
      </Tabs>

      {/* Modal de Edición */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                className="col-span-3 border border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-right">
                Descripción
              </Label>
              <Input
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                className="col-span-3 border border-gray-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_cost" className="text-right">
                  Costo Proveedor
                </Label>
                <Input
                  id="supplier_cost"
                  type="number"
                  value={editForm.supplier_cost?.toString()}
                  onChange={(e) => setEditForm({...editForm, supplier_cost: parseFloat(e.target.value)})}
                  className="col-span-3 border border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="public_price" className="text-right">
                  PVP
                </Label>
                <Input
                  id="public_price"
                  type="number"
                  value={editForm.public_price?.toString()}
                  onChange={(e) => setEditForm({...editForm, public_price: parseFloat(e.target.value)})}
                  className="col-span-3 border border-gray-300"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-right">
                Impuesto
              </Label>
              <Input
                  id="tax_percentage"
                  type="number"
                  value={editForm.tax_percentage?.toString()}
                  onChange={(e) => setEditForm({...editForm, tax_percentage: parseFloat(e.target.value)})}
                  className="col-span-3 border border-gray-300"
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

      {/* Modal de Edición de Configuración de Pago */}
      <Dialog open={isPaymentConfigModalOpen} onOpenChange={setIsPaymentConfigModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Configuración de Paymentez</DialogTitle>
          </DialogHeader>
          {editingPaymentConfig && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="environment">Entorno</Label>
                <Select 
                  value={editingPaymentConfig.environment} 
                  onValueChange={(value: 'prod' | 'stg') => 
                    setEditingPaymentConfig({...editingPaymentConfig, environment: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stg">Staging</SelectItem>
                    <SelectItem value="prod">Producción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="api_url">URL de API</Label>
                <Input
                  id="api_url"
                  value={editingPaymentConfig.api_url}
                  onChange={(e) => setEditingPaymentConfig({
                    ...editingPaymentConfig, 
                    api_url: e.target.value
                  })}
                  placeholder="https://ccapi.paymentez.com"
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="app_code">App Code</Label>
                <Input
                  id="app_code"
                  value={editingPaymentConfig.app_code}
                  onChange={(e) => setEditingPaymentConfig({
                    ...editingPaymentConfig, 
                    app_code: e.target.value
                  })}
                  placeholder="your_app_code"
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="app_key">App Key</Label>
                <Input
                  id="app_key"
                  type="password"
                  value={editingPaymentConfig.app_key}
                  onChange={(e) => setEditingPaymentConfig({
                    ...editingPaymentConfig, 
                    app_key: e.target.value
                  })}
                  placeholder="your_app_key"
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="text-xs text-muted-foreground mt-4">
                <p><strong>Nota:</strong> Solo una configuración puede estar activa a la vez.</p>
                <p>Las credenciales se almacenan de forma segura en la base de datos.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPaymentConfigModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdatePaymentConfig}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}