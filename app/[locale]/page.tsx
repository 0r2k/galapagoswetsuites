"use client"

import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { useSearchParams, useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SheetPopoverContent } from "@/components/ui/sheet-popover-content"
import { CalendarIcon, PlusIcon, ShoppingCart, Trash2, MinusIcon, Loader2 } from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { es, enUS } from "date-fns/locale"
import { toast } from 'sonner'
import Image from "next/image"
import { supabase } from "@/lib/supabaseClient"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslations } from 'next-intl'

interface Product {
  id: string
  product_type: string
  name: string
  description: string
  name_en?: string
  description_en?: string
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
  const params = useParams()
  const router = useRouter()
  const locale = params.locale || 'es'
  const t = useTranslations()
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
  // const [dateTimePopoverOpen, setDateTimePopoverOpen] = useState(false)
  // const [endDateTimePopoverOpen, setEndDateTimePopoverOpen] = useState(false)
  const [hasDateConflict, setHasDateConflict] = useState(false)
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
          .select('id, product_type, name, description, name_en, description_en, public_price, supplier_cost, image, tax_percentage')
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
            name_en: item.name_en,
            description_en: item.description_en,
            public_price: item.public_price,
            supplier_cost: item.supplier_cost,
            image: item.image,
            tax_percentage: item.tax_percentage || 0
          }))
          
          setProducts(mappedProducts)
        }
      } catch (error) {
        console.error('Error al cargar productos:', error)
        toast.error(t('common.error'), { description: t('notifications.loadError') })
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
      toast.error(t('common.error'), { description: t('notifications.accessDenied') })
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
    
    // Usar nombre traducido en la notificación
    const productName = locale === 'en' && product.name_en ? product.name_en : product.name
    toast.success(t('notifications.productAdded'), { description: t('notifications.productAddedDescription', {qty, productName}) })
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
      toast.error(t('notifications.emptyCart'), { description: t('notifications.emptyCartDescription') })
      return
    }
    
    if (!cartItems[0].startDate) {
      toast.error(t('notifications.startDateRequired'), { description: t('notifications.startDateRequiredDescription') })
      return
    }
    
    if (!cartItems[0].startTime) {
      toast.error(t('notifications.startTimeRequired'), { description: t('notifications.startTimeRequiredDescription') })
      return
    }
    
    if (!cartItems[0].endDate) {
      toast.error(t('notifications.endDateRequired'), { description: t('notifications.endDateRequiredDescription') })
      return
    }
    
    if (!cartItems[0].endTime) {
      toast.error(t('notifications.endTimeRequired'), { description: t('notifications.endTimeRequiredDescription') })
      return
    }
    
    if (!cartItems[0].returnIsland) {
      toast.error(t('notifications.returnIslandRequired'), { description: t('notifications.returnIslandRequiredDescription') })
      return
    }
    
    // Los datos ya están en localStorage, así que podemos navegar directamente a checkout
    router.push(`/${locale}/checkout`)
  }

  const renderProduct = (product: Product) => {
    const productQuantity = cartItems.reduce((total: number, item: CartItem) => {
      return item.product.id === product.id ? total + item.quantity : total
    }, 0)
    
    // Obtener nombre y descripción según el idioma
    const productName = locale === 'en' && product.name_en ? product.name_en : product.name
    const productDescription = locale === 'en' && product.description_en ? product.description_en : product.description
    
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
          <CardTitle className="text-xl flex justify-center gap-2">{productName} <Badge variant="secondary">${product.public_price}{t('products.perDay')}</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl mb-2">
              <Image 
                src={product.image}
                alt={productName}
                width={40}
                height={40}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">{productDescription}</p>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button 
            onClick={() => openAddProductModal(product)} 
            className="w-full"
            variant="outline"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('products.rent')}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Modal para seleccionar cantidad de producto
  const renderQuantityModal = () => {
    if (!selectedProduct) return null;
    
    // Obtener nombre según el idioma para el modal
    const productName = locale === 'en' && selectedProduct.name_en ? selectedProduct.name_en : selectedProduct.name
    
    return (
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct.product_type === "fins" ? t('products.howManyFeminine', {productName}) : t('products.howMany', {productName})}
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
              {t('common.cancel')}
            </Button>
            <Button onClick={() => {
              if (selectedProduct) {
                addToCart(selectedProduct, quantity);
              }
            }}>
              {t('common.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Renderizar el carrito de compras
  const renderCart = (hideHeader = false) => {
    const [popoverStates, setPopoverStates] = useState<Record<string, boolean>>({})
    const handlePopoverState = (id: string, isOpen?: boolean) => {
      if (isOpen !== undefined) {
        // Si se proporciona un valor, establecer ese valor
        setPopoverStates(prev => ({
          ...prev,
          [id]: isOpen
        }))
      } else {
        // Si no se proporciona un valor, alternar el estado actual
        setPopoverStates(prev => ({
          ...prev,
          [id]: !prev[id]
        }))
      }
    }

    // Función para obtener el estado de un popover específico
    const getPopoverState = (id: string) => {
      return popoverStates[id] || false
    }
    return (
      <Card className="bg-primary/5 border-primary/20 shadow-md">
        {!hideHeader && (
          <CardHeader className="">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t('cart.title')}
              </span>
              <Badge variant="outline" className="bg-white border border-accent text-accent">{cartItems.reduce((total, item) => total + item.quantity, 0)} {t('cart.items')}</Badge>
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-4 pt-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>{t('cart.empty')}</p>
              <p className="text-sm">{t('cart.emptyDescription')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lista de productos en el carrito */}
              <div className="space-y-3">
                {cartItems.map((item, index) => {
                  // Obtener nombre según el idioma para cada item del carrito
                  const itemName = locale === 'en' && item.product.name_en ? item.product.name_en : item.product.name
                  
                  return (
                    <div key={index} className="flex items-center justify-between gap-2 pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <div className="text-xl">
                          <Image 
                            src={item.product.image}
                            alt={itemName}
                            width={20}
                            height={20}
                          />
                        </div>
                        <div>
                          <p className="font-medium">{itemName}</p>
                          <p className="text-sm text-muted-foreground">${item.product.public_price}{t('products.perDay')} × {item.quantity}</p>
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
                  )
                })}
              </div>
              
              {/* Total por dia */}
              <div>
                <div className="flex justify-between font-medium">
                  <span>{t('cart.totalPerDay')}</span>
                  <span>${calculateCartTotal().baseTotal}</span>
                </div>
              </div>
              
              {/* Selector de fechas y horas */}
              {cartItems.length > 0 && (
                <div className="mt-12 space-y-3">
                  <div className="space-y-2">
                    <label className="font-bold">{t('cart.pickupDate')}</label>
                    <Popover modal={false} open={getPopoverState('startDate')} onOpenChange={(open) => handlePopoverState('startDate', open)}>
                      <PopoverTrigger asChild className="w-full">
                        <Button
                          variant={"outline"}
                          className="justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM d, yy", { locale: locale === 'en' ? enUS : es }) + 
                          (startTime ? ` ${t('time.at')} ${startTime}` : '') : (
                            <span>{t('time.selectTime')}</span>
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
                                
                                // Check if new start date is after end date
                                if (endDate && newDate > endDate) {
                                  console.log('Esta mal')
                                  setHasDateConflict(true)
                                } else {
                                  console.log('Esta bien')
                                  setHasDateConflict(false)
                                }
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
                                    {startDate ? format(startDate, "EEEE, d", { locale: locale === 'en' ? enUS : es }) : t('time.selectTime')}
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
                                            // Cerrar el popover automáticamente cuando se selecciona una hora
                                            // setDateTimePopoverOpen(false)
                                            handlePopoverState('startDate', false)
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
                    <label className="font-bold">{t('cart.pickupIsland')}</label>
                    <div className="">
                      Santa Cruz
                    </div>
                  </div>

                  
                  <div className="space-y-2">
                    <label className="font-bold">{t('cart.returnDate')}</label>
                    <Popover modal={false} open={getPopoverState('endDate')} onOpenChange={(open) => handlePopoverState('endDate', open)}>
                      <PopoverTrigger asChild className="w-full">
                        <Button
                          variant={"outline"}
                           className={`justify-start text-left font-normal ${hasDateConflict ? 'border-red-500 text-red-500' : ''}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM d, yy", { locale: locale === 'en' ? enUS : es }) + 
                          (endTime ? ` ${t('time.at')} ${endTime}` : '')
                          : (
                            <span>{t('time.selectTime')}</span>
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
                                if (startDate && newDate < startDate) {
                                  setHasDateConflict(true)
                                } else {
                                  setHasDateConflict(false)
                                }
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
                                    {endDate ? format(endDate, "EEEE, d", { locale: locale === 'en' ? enUS : es }) : t('time.selectTime')}
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
                                          // Cerrar el popover automáticamente cuando se selecciona una hora
                                          // setEndDateTimePopoverOpen(false)
                                          handlePopoverState('endDate', false)
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
                    <label className="font-bold">{t('cart.returnIsland')}</label>
                    <Select
                      value={cartItems.length > 0 && cartItems[0].returnIsland ? cartItems[0].returnIsland : undefined}
                      onValueChange={(value) => {
                        updateCartDetails('returnIsland', value)
                      }}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder={t('common.select')} />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {returnFees.map((fee) => {
                          // Calcular el monto con multiplier como en línea 323
                          const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0)
                          const multiplier = Math.ceil(totalItems / 3)
                          const calculatedDeliveryAmount = fee.amount * multiplier
                          
                          return (
                            <SelectItem key={fee.id} value={fee.location}>
                              {t(`cart.${fee.location}`)} {fee.amount > 0 && `(+$${calculatedDeliveryAmount})`}
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
                    <span>{t('cart.rentalDays')}</span>
                    <span>{calculateRentalDays()} días</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t('cart.initialPayment')}</span>
                    <span>${calculateInitialPayment().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t('cart.payOnPickup')}</span>
                    <span>${(calculateFinalTotal().totalWithTax - calculateInitialPayment()).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t('cart.total')}</span>
                    <span>${calculateFinalTotal().totalWithTax.toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              {/* Botón para continuar */}
              <Button 
                className="w-full mt-4" 
                onClick={proceedToCheckout}
               disabled={!cartItems.length || !startDate || !endDate || !startTime || !endTime || !cartItems[0]?.returnIsland || hasDateConflict}
              >
                {t('cart.proceedToCheckout')}
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
              <h1 className="text-md sm:text-xl font-bold">Galápagos - Wetsuit & Snorkeling</h1>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <LanguageSwitcher />
              
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
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-6 sm:py-12 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-balance mb-4">{t('hero.title')}</h2>
          <p className="text-sm sm:text-base text-muted-foreground text-pretty">
            {t.rich('hero.subtitle', {
              br: () => <br />,
              strong: (chunks) => <strong>{chunks}</strong>
            })}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground text-pretty mt-4">
            {t.rich('hero.description', {
              strong: (chunks) => <strong>{chunks}</strong>
            })}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-8">
        <div className="flex flex-col sm:flex-row gap-8 items-start">
          {/* Left Column - Products */}
          <div className="flex-1 w-full sm:w-auto ">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading ? (
                <div className="col-span-2 flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">{t('products.loading')}</span>
                </div>
              ) : products.length > 0 ? (
                products.map(product => renderProduct(product))
              ) : (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  <p>{t('products.noProducts')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Cart (Hidden on mobile) */}
          <div className="block w-full sm:w-80 sm:sticky lg:top-24">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Image src="/location-galapagos-wetsuits.webp" width={320} height={260} alt="Galápagos Wetsuit" className="w-full h-auto rounded-md mb-4 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Moisés Brito entre Thomas Berlanga y Juan Montalvo,<br />Puerto Ayora - Santa Cruz</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="hidden sm:block">
              {renderCart()}
            </div>
          </div>
        </div>
      </main>

      {/* Modal para seleccionar cantidad */}
      {renderQuantityModal()}

      {/* Mobile Cart Drawer */}
      <Drawer open={cartDrawerOpen} onOpenChange={setCartDrawerOpen}>
        <DrawerContent>
          <div id="sheet-portal" ref={portalRefCb} className="contents" />
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-center gap-2">
              <ShoppingCart className="h-5 w-5" /> 
              {t('cart.title')}
              <Badge variant="outline" className="bg-white border border-accent text-accent">
                {cartItems.reduce((total, item) => total + item.quantity, 0)} {t('cart.items')}
              </Badge>
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            {renderCart(true)}
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
  const t = useTranslations()
  
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">{t('common.loading')}</div>}>
      <RentalPageContent />
    </Suspense>
  )
}