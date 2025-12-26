'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CreditCard, Check, Info } from 'lucide-react'
import { Button } from '@/apps/b2c/components/ui/button'
import { Input } from '@/apps/b2c/components/ui/input'
import { Label } from '@/apps/b2c/components/ui/label'
import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/apps/b2c/components/header'
import { Footer } from '@/apps/b2c/components/footer'
import { NewsletterSection } from '@/apps/b2c/components/newsletter-section'
import { useCart } from '@/apps/b2c/lib/cart-context'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import PaypalButton from '@/components/payments/PaypalButton'
import { useCheckout } from '@/apps/b2c/hooks/useCheckout'
import InvoiceDownloadButton from '@/components/invoice/InvoiceDownloadButton'
import { InvoiceData } from '@/lib/invoice/types'
import { auth, db, doc, getDoc } from '@mishki/firebase'
import { onAuthStateChanged } from 'firebase/auth'

type Step = 'livraison' | 'paiement'

export default function PaymentPage() {
  const t = useTranslations('b2c.payment')
  const locale = useLocale()
  const { items, checkoutItems, clearCart, removeItems } = useCart()
  const selectedItems = checkoutItems.length > 0 ? checkoutItems : items
  const { createOrderAndPayment } = useCheckout()
  const [currentStep, setCurrentStep] = useState<Step>('livraison')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('saved')
  const [selectedSavedAddress, setSelectedSavedAddress] = useState('')
  const [savedProfile, setSavedProfile] = useState<{ address?: string | null; city?: string | null; postalCode?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card')
  const [deliveryError, setDeliveryError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paypalError, setPaypalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderLinesSnapshot, setOrderLinesSnapshot] = useState<
    { name: string; quantity: number; priceTTC: number; slug?: string }[]
  >([])
  const [totalsSnapshot, setTotalsSnapshot] = useState<{ subtotal: number; tax: number; total: number; currency: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [clearedAfterPay, setClearedAfterPay] = useState(false)

  const [formData, setFormData] = useState({
    address: '',
    phone: '',
    city: '',
    postalCode: '',
    deliveryType: t('sections.delivery.types.relay'),
    cardName: '',
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: '',
  })

  // Capture userId for order persistence and fetch saved address
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUserId(user?.uid ?? null)
      setUserEmail(user?.email ?? null)
      if (user?.uid) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) {
            const data = snap.data() as { address?: string | null; city?: string | null; postalCode?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null }
            setSavedProfile({
              address: data.address ?? null,
              city: data.city ?? null,
              postalCode: data.postalCode ?? null,
              phone: data.phone ?? null,
              firstName: data.firstName ?? null,
              lastName: data.lastName ?? null,
            })
            const parts = [data.address, data.city, data.postalCode].filter(Boolean).join(', ')
            setSelectedSavedAddress(parts || '')
            // Pré-remplir formulaire pour affichage
            setFormData((prev) => ({
              ...prev,
              address: data.address ?? prev.address,
              city: data.city ?? prev.city,
              postalCode: data.postalCode ?? prev.postalCode,
              phone: data.phone ?? prev.phone,
            }))
          } else {
            setAddressMode('new')
          }
        } catch (e) {
          console.error('PaymentPage: failed to load saved address', e)
        }
      } else {
        setSavedProfile(null)
        setSelectedSavedAddress('')
        setAddressMode('new')
      }
    })
    return () => unsub()
  }, [])

  const formatMoney = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  )

  const cartTotal = clearedAfterPay ? 0 : selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const userRegion = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase()
      if (tz?.includes('lima') || tz?.includes('peru')) return 'pe' as const
      if (tz?.includes('paris') || tz?.includes('europe/paris')) return 'fr' as const
    } catch {
      // ignore
    }
    const lowerLocale = locale.toLowerCase()
    if (lowerLocale.includes('pe')) return 'pe' as const
    return 'fr' as const
  }, [locale])
  const taxRate = userRegion === 'pe' ? 0.18 : 0.2
  const subtotalHT = cartTotal / (1 + taxRate)
  const taxAmount = cartTotal - subtotalHT
  const totalTTC = cartTotal
  const round2 = (n: number) => Math.round(n * 100) / 100

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateDelivery = () => {
    const missing: string[] = []
    const phone = formData.phone.trim() || savedProfile?.phone?.trim() || ''
    if (!phone) missing.push('phone')
    if (!formData.deliveryType.trim()) missing.push('deliveryType')
    if (addressMode === 'new') {
      if (!formData.address.trim()) missing.push('address')
      if (!formData.city.trim()) missing.push('city')
      if (!formData.postalCode.trim()) missing.push('postalCode')
    }
    if (addressMode === 'saved' && !savedProfile?.address && !savedProfile?.city && !savedProfile?.postalCode) {
      missing.push('savedAddress')
    }
    const hasError = missing.length > 0
    setDeliveryError(hasError ? 'Merci de remplir les champs requis de livraison.' : '')
    return !hasError
  }

  const validatePayment = () => {
    if (paymentMethod === 'paypal') {
      setPaymentError('')
      return true
    }
    const missing: string[] = []
    if (paymentMethod === 'card') {
      if (!formData.cardName.trim()) missing.push('cardName')
      if (!formData.cardNumber.trim()) missing.push('cardNumber')
      if (!formData.expMonth.trim()) missing.push('expMonth')
      if (!formData.expYear.trim()) missing.push('expYear')
      if (!formData.cvc.trim()) missing.push('cvc')
    }
    const hasError = missing.length > 0
    setPaymentError(hasError ? 'Merci de remplir les champs requis de paiement.' : '')
    return !hasError
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'livraison', label: t('steps.livraison') },
    { key: 'paiement', label: t('steps.paiement') },
  ]

  const getStepStatus = (stepKey: Step) => {
    const stepOrder: Step[] = ['livraison', 'paiement']
    const currentIndex = stepOrder.indexOf(currentStep)
    const stepIndex = stepOrder.indexOf(stepKey)

    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'current'
    return 'pending'
  }

  const handleValidate = () => {
    if (!validatePayment()) return
    if (paymentMethod === 'card') {
      void persistOrder('card')
    }
  }

  const paypalAmount = totalTTC
  const persistOrder = async (provider: 'paypal' | 'card', paymentId?: string | null) => {
    setPaymentError('')
    setPaypalError('')
    const linesSnapshot = selectedItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      priceTTC: item.price,
      slug: item.id,
    }))
    const totals = {
      subtotal: round2(subtotalHT),
      tax: round2(taxAmount),
      total: round2(totalTTC),
      currency: 'EUR',
    }
    const fullName = [savedProfile?.firstName, savedProfile?.lastName].filter(Boolean).join(' ') || null
    const shipping = addressMode === 'saved'
      ? {
          address: savedProfile?.address ?? null,
          city: savedProfile?.city ?? null,
          postalCode: savedProfile?.postalCode ?? null,
          phone: formData.phone || savedProfile?.phone || null,
          fullName,
          deliveryType: formData.deliveryType || null,
        }
      : {
        address: formData.address || null,
        city: formData.city || null,
        postalCode: formData.postalCode || null,
        phone: formData.phone || null,
        fullName,
        deliveryType: formData.deliveryType || null,
      }
    setSaving(true)
    try {
      const id = await createOrderAndPayment({
        userId,
        lines: linesSnapshot.map((l) => ({ name: l.name, quantity: l.quantity, price: l.priceTTC, slug: l.slug })),
        totals,
        paymentProvider: provider,
        paymentId,
        status: 'payee',
        shipping,
      })
      setOrderId(id)
      setOrderLinesSnapshot(linesSnapshot)
      setTotalsSnapshot(totals)
      setShowConfirmation(true)
      setClearedAfterPay(true)

      // Envoi email facture (best-effort)
      try {
        const buyerAddress = addressMode === 'saved' ? selectedSavedAddress : formData.address
        const buyerName = [savedProfile?.firstName, savedProfile?.lastName].filter(Boolean).join(' ') || 'Client B2C'
        const buyerPhone = formData.phone || savedProfile?.phone || undefined
        const invoiceData: InvoiceData = {
          locale: userRegion,
          invoiceNumber: `INV-${id.slice(0, 8)}`,
          orderNumber: id,
          issueDate: new Date().toLocaleDateString('fr-FR'),
          buyer: {
            name: buyerName,
            addressLines: [buyerAddress || 'Adresse client', formData.city || '', formData.postalCode || ''].filter(Boolean),
            phone: buyerPhone,
            email: userEmail || undefined,
          },
          seller: {
            name: 'MISHKI LAB',
            addressLines: ['5 Rue du Printemps', '88000 Jeuxey', 'France'],
            siret: '92089652300011',
            ape: '2042Z',
            email: 'facturation@mishki.com',
          },
          payment: { terms: provider === 'paypal' ? 'Paiement en ligne (PayPal)' : 'Paiement en ligne (carte)' },
          lines: linesSnapshot.map((l) => ({
            qty: l.quantity,
            unit: 'pcs',
            code: l.slug,
            description: l.name,
            unitPrice: round2(l.priceTTC / (1 + taxRate)),
          })),
          totals: {
            subtotal: totals.subtotal,
            taxLabel: userRegion === 'pe' ? 'IGV 18%' : 'TVA 20%',
            taxAmount: totals.tax,
            total: totals.total,
            currency: totals.currency === 'EUR' ? 'EUR' : 'EUR',
          },
        }
        if (userEmail) {
          void fetch('/api/invoice-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, invoiceData }),
          }).catch((err) => console.error('invoice-email (b2c) failed', err))
        }
      } catch (e) {
        console.error('invoice-email (b2c) build/send failed', e)
      }

      // on ne retire que les articles payés
      const paidIds = linesSnapshot.map((l) => l.slug).filter(Boolean) as string[]
      if (paidIds.length) {
        removeItems(paidIds)
      } else {
        clearCart()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de paiement'
      if (provider === 'paypal') {
        setPaypalError(msg)
      } else {
        setPaymentError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePaypalSuccess = (payload?: { orderId?: string }) => {
    setPaypalError('')
    void persistOrder('paypal', payload?.orderId ?? null)
  }
  const handlePaypalError = (msg: string) => {
    setPaypalError(msg || 'Erreur de paiement PayPal')
  }

  const invoiceData: InvoiceData | null = useMemo(() => {
    if (!orderId || !orderLinesSnapshot.length || !totalsSnapshot) return null
    const issueDate = new Date()
    const buyerAddress = addressMode === 'saved' ? selectedSavedAddress : formData.address
    const buyerName = [savedProfile?.firstName, savedProfile?.lastName].filter(Boolean).join(' ') || 'Client B2C'
    const buyerPhone = formData.phone || savedProfile?.phone || undefined
    const invoiceNumber = `INV-${orderId.slice(0, 8)}`
    return {
      locale: userRegion,
      invoiceNumber,
      orderNumber: orderId,
      issueDate: issueDate.toLocaleDateString('fr-FR'),
      buyer: {
        name: buyerName,
        addressLines: [buyerAddress || 'Adresse client', formData.city || '', formData.postalCode || ''].filter(Boolean),
        phone: buyerPhone,
      },
      seller: {
        name: 'MISHKI LAB',
        addressLines: ['5 Rue du Printemps', '88000 Jeuxey', 'France'],
        siret: '92089652300011',
        ape: '2042Z',
        email: 'facturation@mishki.com',
      },
      payment: { terms: 'Paiement en ligne (carte/PayPal)' },
      lines: orderLinesSnapshot.map((l) => ({
        qty: l.quantity,
        unit: 'pcs',
        code: l.slug,
        description: l.name,
        unitPrice: round2(l.priceTTC / (1 + taxRate)), // HT unitaire
      })),
      totals: {
        subtotal: totalsSnapshot.subtotal,
        taxLabel: userRegion === 'pe' ? 'IGV 18%' : 'TVA 20%',
        taxAmount: totalsSnapshot.tax,
        total: totalsSnapshot.total,
        currency: 'EUR',
      },
    }
  }, [
    orderId,
    orderLinesSnapshot,
    totalsSnapshot,
    addressMode,
    formData.address,
    formData.city,
    formData.postalCode,
    formData.phone,
    userRegion,
    selectedSavedAddress,
    taxRate,
    savedProfile?.firstName,
    savedProfile?.lastName,
    savedProfile?.phone,
  ])

  if (showConfirmation) {
    return (
      <>
        <Header />
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="bg-white rounded-lg p-12 shadow-lg text-center max-w-md mx-4">
            <h2
              className="text-[#235730] mb-6"
              style={{
                fontFamily: 'var(--font-caveat)',
                fontSize: '32px',
                fontWeight: 400,
              }}
            >
              {t('confirmation.title')}
            </h2>
            <div className="w-24 h-24 mx-auto bg-[#235730] rounded-full flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }}>
              <div className="w-20 h-20 bg-[#235730] rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="mt-8">
              <Link href="/">
                <Button className="bg-[#235730] hover:bg-[#1d4626] text-white rounded-sm px-8">
                  {t('confirmation.btn_home')}
                </Button>
              </Link>
            </div>
            {invoiceData && (
              <div className="mt-6">
                <InvoiceDownloadButton
                  data={invoiceData}
                  fileName={`${invoiceData.invoiceNumber}.pdf`}
                  label="Télécharger la facture"
                  className="w-full justify-center px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                />
              </div>
            )}
          </div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="min-h-screen pt-20">
        <div className="container mx-auto px-6 py-12 md:py-16">
          <div className="mb-10">
            <Link href="/panier" className="inline-flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
              <Image
                src="/b2c/akar-icons_arrow-back.svg"
                alt={t('back')}
                width={32}
                height={32}
              />
            </Link>
            <div className="flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-[#235730]" />
              <h2
                className="text-[#235730]"
                style={{
                  fontFamily: 'var(--font-caveat)',
                  fontSize: '48px',
                  fontWeight: 400,
                }}
              >
                {t('title')}
              </h2>
            </div>
            <div className="w-full h-[1px] bg-[#235730] mt-2"></div>
          </div>

          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-lg p-8 shadow-sm">
              <div className="flex items-center justify-center gap-2 mb-8">
                {steps.map((step, index) => (
                  <div key={step.key} className="flex items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${getStepStatus(step.key) === 'current' ? 'text-[#235730] font-medium' : 'text-gray-500'}`}>
                        {step.label}
                      </span>
                      {getStepStatus(step.key) === 'completed' && (
                        <div className="w-5 h-5 bg-[#235730] rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {getStepStatus(step.key) === 'current' && (
                        <div className="w-5 h-5 border-2 border-[#235730] rounded-full" />
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="w-8 h-[1px] bg-gray-300 mx-2" />
                    )}
                  </div>
                ))}
              </div>

              <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#2d2d2d]">Résumé de commande</span>
                  <span className="text-sm text-gray-500">{selectedItems.length} article{selectedItems.length > 1 ? 's' : ''}</span>
                </div>
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-gray-500">Votre panier est vide. <Link href="/produits" className="text-[#235730] hover:underline">Retour boutique</Link></p>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-gray-700">
                        <span className="flex-1 pr-3 truncate">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="font-semibold text-[#2d2d2d]">
                          {formatMoney.format(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-3 mt-3 border-t border-gray-200 space-y-1 text-sm text-[#2d2d2d]">
                      <div className="flex justify-between">
                        <span>Sous-total HT</span>
                        <span>{formatMoney.format(subtotalHT)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TVA (20%)</span>
                        <span>{formatMoney.format(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-base">
                        <span>Total TTC</span>
                        <span>{formatMoney.format(totalTTC)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {currentStep === 'livraison' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-[#2d2d2d]">{t('sections.delivery.title')}</h3>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="addr_saved"
                        checked={addressMode === 'saved'}
                        onChange={() => setAddressMode('saved')}
                        className="w-4 h-4 text-[#235730] focus:ring-[#235730]"
                      />
                      <Label htmlFor="addr_saved" className="text-sm text-gray-700">
                        {t('sections.delivery.use_saved')}
                      </Label>
                    </div>
                    <select
                      disabled={addressMode !== 'saved' || !savedProfile}
                      value={selectedSavedAddress}
                      onChange={(e) => setSelectedSavedAddress(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#235730] focus:ring-[#235730] disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {savedProfile ? (
                        <option value={selectedSavedAddress || ''}>
                          {[savedProfile.address, savedProfile.city, savedProfile.postalCode].filter(Boolean).join(', ')}
                        </option>
                      ) : (
                        <option value="">{t('sections.delivery.no_saved_address')}</option>
                      )}
                    </select>
                    {savedProfile && (
                      <p className="text-xs text-gray-500">
                        {t('sections.delivery.saved_hint')}
                      </p>
                    )}

                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                      <input
                        type="radio"
                        id="addr_new"
                        checked={addressMode === 'new'}
                        onChange={() => setAddressMode('new')}
                        className="w-4 h-4 text-[#235730] focus:ring-[#235730]"
                      />
                      <Label htmlFor="addr_new" className="text-sm text-gray-700">
                        {t('sections.delivery.address_label')}
                      </Label>
                    </div>

                    {addressMode === 'new' && (
                      <>
                        <div>
                          <Label htmlFor="address" className="text-sm text-gray-500">{t('sections.delivery.address_label')}</Label>
                          <div className="relative">
                            <Input
                              id="address"
                              value={formData.address}
                              onChange={(e) => updateFormData('address', e.target.value)}
                              placeholder={t('sections.delivery.address_placeholder')}
                              className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                            />
                            {formData.address && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#235730] rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="city" className="text-sm text-gray-500">{t('sections.delivery.city_label')}</Label>
                          <div className="relative">
                            <Input
                              id="city"
                              value={formData.city}
                              onChange={(e) => updateFormData('city', e.target.value)}
                              placeholder={t('sections.delivery.city_placeholder')}
                              className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                            />
                            {formData.city && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#235730] rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="postalCode" className="text-sm text-gray-500">{t('sections.delivery.zip_label')}</Label>
                            <Input
                              id="postalCode"
                              value={formData.postalCode}
                              onChange={(e) => updateFormData('postalCode', e.target.value)}
                              placeholder={t('sections.delivery.zip_placeholder')}
                              className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone" className="text-sm text-gray-500">{t('sections.delivery.phone_label')}</Label>
                        <div className="relative">
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => updateFormData('phone', e.target.value)}
                            placeholder={t('sections.delivery.phone_placeholder')}
                            className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                          />
                          {formData.phone && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#235730] rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">{t('sections.delivery.type_label')}</Label>
                        <select
                          value={formData.deliveryType}
                          onChange={(e) => updateFormData('deliveryType', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#235730] focus:ring-[#235730]"
                        >
                          <option value={t('sections.delivery.types.relay')}>{t('sections.delivery.types.relay')}</option>
                          <option value={t('sections.delivery.types.home')}>{t('sections.delivery.types.home')}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-8">
                    <button
                      onClick={() => window.location.href = '/panier'}
                      className="text-sm text-gray-500 hover:text-[#235730]"
                    >
                      {t('sections.delivery.cancel')}
                    </button>
                    <Button
                      onClick={() => {
                        if (validateDelivery()) {
                          setCurrentStep('paiement')
                        }
                      }}
                      className="bg-[#235730] hover:bg-[#1d4626] text-white rounded-sm px-8"
                    >
                      {t('sections.delivery.next')}
                    </Button>
                  </div>
                  {deliveryError && (
                    <p className="text-red-600 text-sm text-center pt-2">{deliveryError}</p>
                  )}
                </div>
              )}

              {currentStep === 'paiement' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-[#2d2d2d]">{t('sections.payment.title')}</h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`w-full border rounded-md px-4 py-3 text-sm flex items-center justify-between transition ${paymentMethod === 'card'
                            ? 'border-[#235730] bg-[#235730]/5 text-[#235730]'
                            : 'border-gray-300 text-gray-700 hover:border-[#235730]'
                          }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex items-center gap-2">
                            <Image
                              src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
                              alt="Visa"
                              width={48}
                              height={24}
                              className="h-6 w-auto object-contain"
                            />
                            <Image
                              src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
                              alt="Mastercard"
                              width={48}
                              height={24}
                              className="h-6 w-auto object-contain"
                            />
                            <Image
                              src="/b2c/payments/stripe.svg"
                              alt="Stripe"
                              width={64}
                              height={24}
                              className="h-10 w-auto object-contain"
                            />
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('paypal')}
                        className={`w-full border rounded-md px-4 py-3 text-sm flex items-center justify-between transition ${paymentMethod === 'paypal'
                            ? 'border-[#235730] bg-[#235730]/5 text-[#235730]'
                            : 'border-gray-300 text-gray-700 hover:border-[#235730]'
                          }`}
                      >
                        <span className="flex items-center gap-3">
                          <Image
                            src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                            alt="PayPal"
                            width={80}
                            height={28}
                            className="h-7 w-auto object-contain"
                          />
                        </span>
                      </button>
                    </div>
                    {paymentError && (
                      <p className="text-red-600 text-sm">{paymentError}</p>
                    )}

                    {paymentMethod === 'card' && (
                      <>
                        <div>
                          <Label htmlFor="cardName" className="text-sm text-gray-500">{t('sections.payment.card_name_label')}</Label>
                          <div className="relative">
                            <Input
                              id="cardName"
                              value={formData.cardName}
                              onChange={(e) => updateFormData('cardName', e.target.value)}
                              placeholder={t('sections.payment.card_name_placeholder')}
                              className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                            />
                            {formData.cardName && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#235730] rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="cardNumber" className="text-sm text-gray-500">{t('sections.payment.card_number_label')}</Label>
                          <Input
                            id="cardNumber"
                            value={formData.cardNumber}
                            onChange={(e) => updateFormData('cardNumber', e.target.value)}
                            placeholder={t('sections.payment.card_number_placeholder')}
                            className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                            <Label className="text-sm text-gray-500">{t('sections.payment.expiration_label')}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={formData.expMonth}
                                onChange={(e) => updateFormData('expMonth', e.target.value)}
                                placeholder="03"
                                className="border-gray-300 focus:border-[#235730] focus:ring-[#235730] text-center"
                              />
                              <span className="text-gray-400">/</span>
                              <Input
                                value={formData.expYear}
                                onChange={(e) => updateFormData('expYear', e.target.value)}
                                placeholder="24"
                                className="border-gray-300 focus:border-[#235730] focus:ring-[#235730] text-center"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-500 flex items-center gap-1">
                              {t('sections.payment.cvc_label')} <Info className="w-3 h-3" />
                            </Label>
                            <Input
                              value={formData.cvc}
                              onChange={(e) => updateFormData('cvc', e.target.value)}
                              placeholder={t('sections.payment.cvc_placeholder')}
                              className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {paymentMethod === 'paypal' && (
                      <div className="p-4 border border-dashed border-[#235730] rounded-md bg-[#235730]/5 text-sm text-[#235730] space-y-2">
                        <p className="font-medium mb-1">PayPal</p>
                        <p className="text-[#235730]/80">
                          Vous serez redirigé vers PayPal pour finaliser votre paiement en toute sécurité.
                        </p>
                        <PaypalButton
                          amount={paypalAmount}
                          currency="EUR"
                          onSuccess={handlePaypalSuccess}
                          onError={handlePaypalError}
                          disabled={saving}
                        />
                        {paypalError && <p className="text-red-600 text-xs">{paypalError}</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-8">
                    <button
                      onClick={() => setCurrentStep('livraison')}
                      className="text-sm text-gray-500 hover:text-[#235730]"
                    >
                      {t('sections.payment.cancel')}
                    </button>
                    <Button
                      onClick={handleValidate}
                      disabled={saving}
                      className="bg-[#235730] hover:bg-[#1d4626] disabled:opacity-60 text-white rounded-sm px-8"
                    >
                      {saving ? 'Traitement...' : t('sections.payment.pay')}
                    </Button>
                  </div>
                  {paymentError && (
                    <p className="text-red-600 text-sm text-center pt-2">{paymentError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <NewsletterSection />
      </div>
      <Footer />
    </>
  )
}
