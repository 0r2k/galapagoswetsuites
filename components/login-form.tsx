'use client'

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"
import { createSession } from "@/app/login/actions"

interface LoginFormProps extends React.ComponentProps<"form"> {
  redirectUrl?: string;
}

export function LoginForm({
  className,
  redirectUrl = '/admin',
  ...props
}: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        // Check role and redirect
        if (data.user) {
          if (data.session) {
            await createSession(data.session.access_token)
          }

          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('email', data.user.email)
            .single()

          if (userData) {
            if (userData.role === 'admin') {
              // If admin, respect the redirectUrl if it's not default, otherwise go to admin
              if (redirectUrl && redirectUrl !== '/admin') {
                 router.push(redirectUrl)
              } else {
                 router.push('/admin')
              }
            } else if (userData.role === 'calendar_viewer') {
               // Calendar viewers always go to calendar or respect specific calendar deep links
               if (redirectUrl && redirectUrl.startsWith('/calendar')) {
                 router.push(redirectUrl)
               } else {
                 router.push('/calendar')
               }
            } else {
              // Customers or others go home
              router.push('/')
            }
          } else {
             router.push('/')
          }
        }
      }
    } catch (err) {
      console.error('Error interno durante el inicio de sesión:', err)
      setErrorMsg('Ocurrió un error interno. Por favor, inténtelo de nuevo más tarde.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="grid gap-8">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            className="bg-white"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Contraseña</Label>
          </div>
          <Input
            className="bg-white"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          Ingresar
        </Button>
        {errorMsg && <p style={{ color: 'crimson' }}>{errorMsg}</p>}
      </div>

    </form>
  )
}
