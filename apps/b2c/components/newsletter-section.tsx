'use client'

import { useState } from "react"
import { Button } from "@/apps/b2c/components/ui/button"
import { Input } from "@/apps/b2c/components/ui/input"
import { useTranslations } from "next-intl"
import { db } from "@mishki/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"

export function NewsletterSection() {
  const t = useTranslations('b2c.home.newsletter')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setMessage(t('error') || 'Email requis')
      return
    }
    setLoading(true)
    try {
      await addDoc(collection(db, 'newsletters'), {
        email: trimmed,
        createdAt: serverTimestamp(),
      })
      setMessage(t('success') || 'Merci, vous êtes inscrit(e) !')
      setEmail('')
    } catch (err) {
      setMessage(t('error') || 'Une erreur est survenue, veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-6 text-center">
        <h2
          className="mb-4 text-[#235730]"
          style={{
            fontFamily: 'var(--font-caveat)',
            fontSize: '48px',
            fontWeight: 400,
          }}
        >
          {t('title')}
        </h2>
        <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
          {t('desc')}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
          <Input
            type="email"
            placeholder={t('placeholder')}
            className="flex-1 border-[#235730]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <Button type="submit" disabled={loading} className="bg-[#235730] hover:bg-[#1d4626] text-white px-8">
            {t('btn')}
          </Button>
        </form>
        {message && (
          <p className="mt-4 text-sm text-gray-700">
            {message}
          </p>
        )}
      </div>
    </section>
  )
}
