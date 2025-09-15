"use client"

import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SheetPopoverContent } from "@/components/ui/sheet-popover-content"
import { CalendarIcon, PlusIcon, ShoppingCart, Trash2, MinusIcon, Loader2 } from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from 'sonner'
import Image from "next/image"
import { supabase } from "@/lib/supabaseClient"

interface Product {
  id: string
  product_type: string
  name: string
  description: string
  public_price: number
  supplier_cost: number
  image: string
  tax_percentage: number
}

// Definición de tipos para los items del carrito
interface CartItem {
  product: Product
  quantity: number
  startDate?: Date
  endDate?: Date
  startTime?: string
  endTime?: string
  returnIsland?: "santa-cruz" | "san-cristobal"
}

// Función para cargar el carrito desde localStorage
function loadCartFromLocalStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  const savedCart = localStorage.getItem('galapagosCart')
  if (!savedCart) return [];
  
  try {
    const parsedCart = JSON.parse(savedCart)
    return parsedCart.map((item: any) => ({
      ...item,
      startDate: item.startDate ? new Date(item.startDate) : undefined,
      endDate: item.endDate ? new Date(item.endDate) : undefined
    }))
  } catch (error) {
    console.error('Error al cargar el carrito desde localStorage:', error)
    return []
  }
}

function RentalPageContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [startTime, setStartTime] = useState<string | null>(null)
  const [endTime, setEndTime] = useState<string | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [returnFees, setReturnFees] = useState<{id: string, name: string, location: string, amount: number}[]>([])
  const [quantity, setQuantity] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  const portalRefCb = useCallback((node: HTMLDivElement | null) => {
    portalRef.current = node;
    setPortalEl(node);
  }, []);

  const timeSlots = [
    { time: "07:00", available: true },
    { time: "08:00", available: true },
    { time: "09:00", available: true },
    { time: "10:00", available: true },
    { time: "11:00", available: true },
    { time: "12:00", available: true },
    { time: "13:00", available: true },
    { time: "14:00", available: true },
    { time: "15:00", available: true },
    { time: "16:00", available: true },
    { time: "17:00", available: true },
    { time: "18:00", available: true },
    { time: "19:00", available: true },
    { time: "20:00", available: true },
  ]

  // Función para verificar si una hora está disponible
  const isTimeSlotAvailable = (timeSlot: string, selectedDate: Date | undefined) => {
    if (!selectedDate) return true
    
    // Verificar si la fecha seleccionada es hoy
    const isToday = selectedDate.toDateString() === today.toDateString()
    
    if (!isToday) return true
    
    // Obtener la hora actual en Galápagos (UTC-6)
    const now = new Date()
    // Primero obtener UTC, luego restar 6 horas para Galápagos
    const utcTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000))
    const galapagosTime = new Date(utcTime.getTime() - (6 * 60 * 60 * 1000))
    const currentHour = galapagosTime.getHours()
    const currentMinute = galapagosTime.getMinutes()
    
    // Convertir el timeSlot a horas y minutos
    const [slotHour, slotMinute] = timeSlot.split(':').map(Number)
    
    // Comparar si la hora del slot es posterior a la hora actual
    if (slotHour > currentHour) return true
    if (slotHour === currentHour && slotMinute > currentMinute) return true
    
    return false
  }
  
  useEffect(() => {
    const loadedCart = loadCartFromLocalStorage()
    setCartItems(loadedCart)
    
    // Actualizar estados de fechas y horas si hay items en el carrito
    if (loadedCart.length > 0) {
      const firstItem = loadedCart[0]
      if (firstItem.startDate) setStartDate(firstItem.startDate)
      if (firstItem.endDate) setEndDate(firstItem.endDate)
      if (firstItem.startTime) setStartTime(firstItem.startTime)
      if (firstItem.endTime) setEndTime(firstItem.endTime)
    }
  }, [])
  
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('product_config')
          .select('id, product_type, name, description, public_price, supplier_cost, image, tax_percentage')
          .eq('active', true)
          
        if (error) {
          throw error
        }
        
        if (data) {
          const mappedProducts = data.map(item => ({
            id: item.id,
            product_type: item.product_type,
            name: item.name,
            description: item.description,
            public_price: item.public_price,
            supplier_cost: item.supplier_cost,
            image: item.image,
            tax_percentage: item.tax_percentage || 0
          }))
          
          setProducts(mappedProducts)
        }
      } catch (error) {
        console.error('Error al cargar productos:', error)
        toast.error('Error', { description: "No se pudieron cargar los productos. Por favor, intenta de nuevo más tarde." })
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [])

  useEffect(() => {
    const fetchReturnFees = async () => {
      try {
        const { data, error } = await supabase
          .from('additional_fees')
          .select('id, name, location, amount')
          .eq('fee_type', 'island_return_fee')
          .eq('active', true)
          
        if (error) {
          throw error
        }
        
        if (data) {
          setReturnFees(data)
        }
      } catch (error) {
        console.error('Error al cargar tarifas de devolución:', error)
      }
    }
    
    fetchReturnFees()
  }, [])
  
  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'access_denied') {
      toast.error('Acceso denegado', { description: "No tienes permisos para acceder al área de administración." })
    }
  }, [searchParams])
  
  const openAddProductModal = (product: Product) => {
    setSelectedProduct(product)
    setQuantity(1)
    setModalOpen(true)
  }
  
  const addToCart = (product: Product, qty: number) => {
    const existingItemIndex = cartItems.findIndex(item => item.product.id === product.id)
    
    let updatedCart: CartItem[] = []
    
    if (existingItemIndex >= 0) {
      updatedCart = [...cartItems]
      updatedCart[existingItemIndex].quantity += qty
    } else {
      updatedCart = [
        ...cartItems,
        {
          product: product,
          quantity: qty
        }
      ]
    }
    
    setCartItems(updatedCart)
    localStorage.setItem('galapagosCart', JSON.stringify(updatedCart))
    setModalOpen(false)
    
    toast.success("Producto añadido", { description: `${qty} ${product.name} añadido al carrito` })
  }
  
  const removeFromCart = (index: number) => {
    const newCartItems = [...cartItems]
    newCartItems.splice(index, 1)
    setCartItems(newCartItems)
    localStorage.setItem('galapagosCart', JSON.stringify(newCartItems))
  }
  
  const updateCartItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return
    
    const newCartItems = [...cartItems]
    newCartItems[index].quantity = newQuantity
    setCartItems(newCartItems)
    localStorage.setItem('galapagosCart', JSON.stringify(newCartItems))
  }
  
  // Actualizar fecha, hora e isla de devolución
  const updateCartDetails = (field: string, value: any) => {
    const updatedCart = cartItems.map(item => ({
      ...item,
      [field]: value
    }))
    
    setCartItems(updatedCart)
    
    // Si estamos actualizando la isla de devolución, calculamos y guardamos la tarifa
    if (field === 'returnIsland') {
      const returnFee = returnFees.find(fee => fee.location === value)
      const returnFeeAmount = returnFee ? returnFee.amount : 0
      
      // Guardamos la tarifa de devolución en localStorage
      localStorage.setItem('galapagosReturnFee', JSON.stringify({
        island: value,
        amount: returnFeeAmount
      }))
    }
    
    localStorage.setItem('galapagosCart', JSON.stringify(updatedCart))
  }
  
  // Calcula los días de alquiler según las reglas de horario
  const calculateRentalDays = (): number => {
    if (!startDate || !endDate || !startTime || !endTime) {
      return 0
    }
    
    // Extraer horas de los strings de hora (formato "HH:MM")
    const startHour = parseInt(startTime.split(':')[0])
    const endHour = parseInt(endTime.split(':')[0])
    
    // Calcular días base
    let days = differenceInDays(endDate, startDate)
    
    // Aplicar reglas de horario
    // Si retira hasta las 16:00 se cobra ese día, después de las 17:00 no
    if (startHour >= 17) {
      days -= 1
    }
    
    // Si devuelve hasta las 16:00 no se cobra ese día, después de las 17:00 sí
    if (endHour >= 17) {
      days += 1
    }
    
    // Asegurar que al menos sea 1 día
    return Math.max(1, days)
  }
  
  const calculateCartTotal = (): { baseTotal: number, returnFeeAmount: number } => {
    let baseTotal = cartItems.reduce((total, item) => {
      return total + (item.product.public_price * item.quantity)
    }, 0)
    
    let returnFeeAmount = 0;
    if (cartItems.length > 0 && cartItems[0].returnIsland) {
      const returnFee = returnFees.find(fee => fee.location === cartItems[0].returnIsland)
      if (returnFee) {
        // Calcular cantidad total de items
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0)
        // Multiplicar por cada grupo de 3 items (redondeado hacia arriba)
        const multiplier = Math.ceil(totalItems / 3)
        returnFeeAmount = returnFee.amount * multiplier;
      }
    }
    
    return { baseTotal, returnFeeAmount }
  }
  
  const calculateFinalTotal = (): { subtotal: number, returnFeeAmount: number, totalWithTax: number } => {
    const { baseTotal, returnFeeAmount } = calculateCartTotal()
    const days = calculateRentalDays()
    
    // El subtotal es el precio base por día multiplicado por los días
    const subtotal = baseTotal * days
    
    // Calculamos el IVA basado en el tax_percentage de cada producto
    const totalWithTax = cartItems.reduce((total, item) => {
      const itemSubtotal = item.product.public_price * item.quantity * days
      const itemTax = itemSubtotal * (item.product.tax_percentage || 0)
      return total + itemSubtotal + itemTax
    }, returnFeeAmount) // Agregamos la tarifa de devolución sin multiplicar por días
    
    return { subtotal, returnFeeAmount, totalWithTax }
  }

  const calculateInitialPayment = (): number => {
    const days = calculateRentalDays()
    
    // Pago inicial = diferencia entre precio público y costo proveedor
    const initialPayment = cartItems.reduce((total, item) => {
      const priceDifference = (item.product.public_price - item.product.supplier_cost) * item.quantity * days
      return total + priceDifference
    }, 0)
    
    return Math.max(initialPayment, 0) // Asegurar que no sea negativo
  }
  
  const proceedToCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Carrito vacío", { description: "Añade productos al carrito antes de continuar" })
      return
    }
    
    if (!cartItems[0].startDate) {
      toast.error("Fecha de inicio requerida", { description: "Por favor selecciona una fecha de inicio para el alquiler" })
      return
    }
    
    if (!cartItems[0].startTime) {
      toast.error("Hora de inicio requerida", { description: "Por favor selecciona una hora de inicio para el alquiler" })
      return
    }
    
    if (!cartItems[0].endDate) {
      toast.error("Fecha de devolución requerida", { description: "Por favor selecciona una fecha de devolución para el alquiler" })
      return
    }
    
    if (!cartItems[0].endTime) {
      toast.error("Hora de devolución requerida", { description: "Por favor selecciona una hora de devolución para el alquiler" })
      return
    }
    
    if (!cartItems[0].returnIsland) {
      toast.error("Isla de devolución requerida", { description: "Por favor selecciona una isla donde devolverás el equipo" })
      return
    }
    
    // Los datos ya están en localStorage, así que podemos navegar directamente a checkout
    window.location.href = '/checkout'
  }

  const renderProduct = (product: Product) => {
    const productQuantity = cartItems.reduce((total: number, item: CartItem) => {
      return item.product.id === product.id ? total + item.quantity : total
    }, 0)
    
    return (
      <Card key={product.id} className="gap-4 relative">
        {productQuantity > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 z-10 min-w-[24px] h-6 flex items-center justify-center rounded-full text-xs font-bold"
          >
            {productQuantity}
          </Badge>
        )}
        <CardHeader className="text-center">
          <CardTitle className="text-xl flex justify-center gap-2">{product.name} <Badge variant="secondary">${product.public_price}/día</Badge></CardTitle>
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
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button 
            onClick={() => openAddProductModal(product)} 
            className="w-full"
            variant="outline"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Rentar
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Modal para seleccionar cantidad de producto
  const renderQuantityModal = () => {
    if (!selectedProduct) return null;
    
    return (
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ¿{selectedProduct.product_type === "fins" ? "Cuántas" : "Cuántos"} {selectedProduct.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center gap-4 py-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <MinusIcon className="h-4 w-4" />
            </Button>
            <div className="w-16 text-center">
              <div className="h-10 w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm ring-offset-background text-center">
                {quantity}
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity(quantity + 1)}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (selectedProduct) {
                addToCart(selectedProduct, quantity);
              }
            }}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Renderizar el carrito de compras
  const renderCart = () => {
    return (
      <Card className="bg-primary/5 border-primary/20 shadow-md">
        <CardHeader className="">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrito
            </span>
            <Badge variant="outline" className="bg-white border border-accent text-accent">{cartItems.reduce((total, item) => total + item.quantity, 0)} items</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Tu carrito está vacío</p>
              <p className="text-sm">Añade productos desde el catálogo</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lista de productos en el carrito */}
              <div className="space-y-3">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 pb-2 border-b">
                    <div className="flex items-center gap-2">
                      <div className="text-xl">
                        <Image 
                          src={item.product.image}
                          alt={item.product.name}
                          width={20}
                          height={20}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">${item.product.public_price}/día × {item.quantity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="text-right font-medium">
                        ${item.product.public_price * item.quantity}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFromCart(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Total por dia */}
              <div>
                <div className="flex justify-between font-medium">
                  <span>Total/día</span>
                  <span>${calculateCartTotal().baseTotal}</span>
                </div>
              </div>
              
              {/* Selector de fechas y horas */}
              {cartItems.length > 0 && (
                <div className="mt-12 space-y-3">
                  <div className="space-y-2">
                    <label className="font-bold">Fecha y hora de recogida</label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild className="w-full">
                        <Button
                          variant={"outline"}
                          className="justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM d, yy", { locale: es }) + 
                          (startTime ? ` a las ${startTime}` : '')
                          : (
                            <span>Seleccionar fecha</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <SheetPopoverContent container={portalEl ?? undefined} className="w-auto p-0 max-h-[75vh] overflow-y-auto">
                        <div className="flex">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(newDate) => {
                              if (newDate) {
                                setStartDate(newDate)
                                setStartTime(null)
                                updateCartDetails('startDate', newDate)
                              }
                            }}
                            className="p-2 sm:pe-5"
                            disabled={[
                              { before: today }, // Dates before today
                            ]}
                          />
                          <div className="w-40 border-l">
                            <div className="py-4">
                              <div className="space-y-3">
                                <div className="flex h-5 shrink-0 items-center px-5">
                                  <p className="text-sm font-medium">
                                    {startDate ? format(startDate, "EEEE, d", { locale: es }) : 'Seleccionar fecha'}
                                  </p>
                                </div>
                                <div
                                  className="h-[250px] overflow-y-auto px-5 touch-pan-y"
                                  style={{ WebkitOverflowScrolling: "touch" }}
                                  data-scroll-lock-scrollable=""
                                >
                                  <div className="grid gap-1.5">
                                    {timeSlots.map(({ time: timeSlot, available }) => {
                                      const isAvailable = available && isTimeSlotAvailable(timeSlot, startDate)
                                      return (
                                        <Button
                                          key={timeSlot}
                                          variant={startTime === timeSlot ? "default" : "outline"}
                                          size="sm"
                                          className="w-full"
                                          onClick={() => {
                                            setStartTime(timeSlot)
                                            updateCartDetails('startTime', timeSlot)
                                          }}
                                          disabled={!isAvailable}
                                        >
                                          {timeSlot}
                                        </Button>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </SheetPopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="font-bold">Isla de recogida</label>
                    <div className="">
                      Santa Cruz
                    </div>
                  </div>

                  
                  <div className="space-y-2">
                    <label className="font-bold">Fecha y hora de devolución</label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild className="w-full">
                        <Button
                          variant={"outline"}
                          className="justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM d, yy", { locale: es }) + 
                          (endTime ? ` a las ${endTime}` : '')
                          : (
                            <span>Seleccionar fecha</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <SheetPopoverContent container={portalEl ?? undefined} className="w-auto p-0 max-h-[75vh] overflow-y-auto">
                        <div className="flex">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(newDate) => {
                              if (newDate) {
                                setEndDate(newDate)
                                setEndTime(null)
                                updateCartDetails('endDate', newDate)
                              }
                            }}
                            className="p-2 sm:pe-5"
                            disabled={[
                              { before: startDate ? startDate : today }
                            ]}
                          />
                          <div className="w-40 border-l">
                            <div className="py-4">
                              <div className="space-y-3">
                                <div className="flex h-5 shrink-0 items-center px-5">
                                  <p className="text-sm font-medium">
                                    {endDate ? format(endDate, "EEEE, d", { locale: es }) : 'Seleccionar fecha'}
                                  </p>
                                </div>
                                <div
                                  className="h-[250px] overflow-y-auto px-5 touch-pan-y"
                                  style={{ WebkitOverflowScrolling: "touch" }}
                                  data-scroll-lock-scrollable=""
                                >
                                  <div className="grid gap-1.5">
                                    {timeSlots.map(({ time: timeSlot, available }) => (
                                      <Button
                                        key={timeSlot}
                                        variant={endTime === timeSlot ? "default" : "outline"}
                                        size="sm"
                                        className="w-full"
                                        onClick={() => {
                                          setEndTime(timeSlot)
                                          updateCartDetails('endTime', timeSlot)
                                        }}
                                        disabled={!available}
                                      >
                                        {timeSlot}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </SheetPopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-bold">Isla de devolución</label>
                    <Select
                      value={cartItems.length > 0 && cartItems[0].returnIsland ? cartItems[0].returnIsland : undefined}
                      onValueChange={(value) => {
                        updateCartDetails('returnIsland', value)
                      }}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Seleccionar isla" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {returnFees.map((fee) => {
                          // Calcular el monto con multiplier como en línea 323
                          const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0)
                          const multiplier = Math.ceil(totalItems / 3)
                          const calculatedDeliveryAmount = fee.amount * multiplier
                          
                          return (
                            <SelectItem key={fee.id} value={fee.location}>
                              {fee.name} {fee.amount > 0 && `(+$${calculatedDeliveryAmount})`}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Total final */}
              {cartItems.length > 0 && startDate && endDate && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Días de alquiler:</span>
                    <span>{calculateRentalDays()} días</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Pago inicial:</span>
                    <span>${calculateInitialPayment().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Pagar al recoger:</span>
                    <span>${(calculateFinalTotal().totalWithTax - calculateInitialPayment()).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${calculateFinalTotal().totalWithTax.toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              {/* Botón para continuar */}
              <Button 
                className="w-full mt-4" 
                onClick={proceedToCheckout}
                disabled={!cartItems.length || !startDate || !endDate || !startTime || !endTime || !cartItems[0]?.returnIsland}
              >
                Continuar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/chokotrip.webp" alt="Chokotrip" width={40} height={40} />
              <h1 className="text-xl font-bold">Galápagos - Wetsuit & Snorkeling</h1>
            </div>
            
            {/* Mobile Cart Button */}
            <div className="sm:hidden">
              <Button
                variant="outline"
                size="icon"
                className="relative"
                onClick={() => setCartDrawerOpen(true)}
              >
                <ShoppingCart className="h-4 w-4" />
                {cartItems.length > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute rounded-full -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {cartItems.reduce((total, item) => total + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-12 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-balance mb-4">Renta de wetsuits y equipo de snorkeling</h2>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            ¡Una preocupacion menos en tu viaje a Galapagos!<strong>Tenemos en la Isla Santa Cruz, mas de 100 equipos de snorkeling, aletas, wetsuit</strong> cortos y largos (3mm) para explorar la vida marina en cada playa y tour diario.
          </p>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            <strong>Alquílalo por dia o por todo el tiempo que deseas</strong> y lo puedes devolver en la isla de Santa Cruz o San Cristobal.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-8 items-start">
          {/* Left Column - Products */}
          <div className="flex-1 w-full sm:w-auto ">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading ? (
                <div className="col-span-2 flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Cargando productos...</span>
                </div>
              ) : products.length > 0 ? (
                products.map(product => renderProduct(product))
              ) : (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  <p>No hay productos disponibles en este momento.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Cart (Hidden on mobile) */}
          <div className="hidden sm:block w-full sm:w-80 sm:sticky lg:top-24">
            {renderCart()}
          </div>
        </div>
      </main>

      {/* Modal para seleccionar cantidad */}
      {renderQuantityModal()}

      {/* Mobile Cart Drawer */}
      <Drawer open={cartDrawerOpen} onOpenChange={setCartDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <div id="sheet-portal" ref={portalRefCb} className="contents" />
          <DrawerHeader>
            <DrawerTitle>Tu Carrito</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            {renderCart()}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Footer */}
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

export default function GalapagosRentalPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando...</div>}>
      <RentalPageContent />
    </Suspense>
  )
}