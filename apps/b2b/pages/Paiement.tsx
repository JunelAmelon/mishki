'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, CreditCard } from 'lucide-react';
import { Input } from '@/apps/b2c/components/ui/input';
import { Label } from '@/apps/b2c/components/ui/label';
import PaypalButton from '@/components/payments/PaypalButton';
import PaymentSuccessModal from '../components/PaymentSuccessModal';
import { useCheckoutB2B } from '../hooks/useCheckoutB2B';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db, doc, getDoc } from '@mishki/firebase';
import type { InvoiceData } from '@/lib/invoice/types';

type CheckoutLine = {
  name: string;
  reference?: string;
  quantity: number;
  unitPriceHT: number;
  totalHT?: number;
};

type Draft = {
  source: 'cart' | 'quick';
  lines: CheckoutLine[];
  totals?: { subtotalHT: number; tax: number; totalTTC: number; currency: string };
};

type SavedProfile = {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  contactName?: string | null;
};

export default function PaiementB2B() {
  const locale = useLocale();
  const t = useTranslations('b2b.payment');
  const tr = (key: string, fallback: string, values?: Record<string, string | number>) =>
    t(key, { defaultMessage: fallback, ...values });
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const { createOrderAndPayment } = useCheckoutB2B();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(null);
  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('saved');
  const [deliveryError, setDeliveryError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paypalError, setPaypalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderIdSnapshot, setOrderIdSnapshot] = useState<string | null>(null);
  const [linesSnapshot, setLinesSnapshot] = useState<
    { description: string; code?: string; qty: number; unitPrice: number }[]
  >([]);
  const [totalsSnapshot, setTotalsSnapshot] = useState<{ subtotalHT: number; tax: number; totalTTC: number; currency: string } | null>(null);
  const [clearedAfterPay, setClearedAfterPay] = useState(false);

  const [formData, setFormData] = useState({
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    contactName: '',
    deliveryType: 'Point relais',
  });

  // Charger un brouillon (panier ou commande rapide) si présent
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('b2bPaymentDraft');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Draft;
      setDraft(parsed);
    } catch {
      // ignore
    }
  }, []);

  // Charger profil enregistré (adresse/tel)
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setSavedProfile(null);
        setAddressMode('new');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.id));
        if (snap.exists()) {
          const data = snap.data() as SavedProfile & { phone?: string | null; prenom?: string | null; nom?: string | null; contactName?: string | null };
          setSavedProfile({
            address: data.address ?? null,
            city: data.city ?? null,
            postalCode: data.postalCode ?? null,
            phone: data.phone ?? null,
            contactName: data.contactName ?? ([data.prenom, data.nom].filter(Boolean).join(' ') || null),
          });
          setFormData((prev) => ({
            ...prev,
            address: data.address ?? prev.address,
            city: data.city ?? prev.city,
            postalCode: data.postalCode ?? prev.postalCode,
            phone: data.phone ?? prev.phone,
            contactName: data.contactName ?? ([data.prenom, data.nom].filter(Boolean).join(' ') || prev.contactName),
          }));
          if (!data.address && !data.city && !data.postalCode) {
            setAddressMode('new');
          }
        } else {
          setSavedProfile(null);
          setAddressMode('new');
        }
      } catch (e) {
        console.error('PaiementB2B: load profile failed', e);
        setSavedProfile(null);
        setAddressMode('new');
      }
    };
    void loadProfile();
  }, [user?.id]);

  const formatMoney = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
      }),
    [locale]
  );

  const htLabel = useMemo(() => {
    const lower = locale.toLowerCase();
    if (lower.startsWith('fr')) return 'HT';
    if (lower.startsWith('es')) return 'Sin IGV';
    return 'Excl. VAT';
  }, [locale]);

  const userRegion = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase();
      if (tz?.includes('lima') || tz?.includes('peru')) return 'pe' as const;
      if (tz?.includes('paris') || tz?.includes('europe/paris')) return 'fr' as const;
    } catch {
      // ignore
    }
    const lowerLocale = locale.toLowerCase();
    if (lowerLocale.includes('pe')) return 'pe' as const;
    return 'fr' as const;
  }, [locale]);

  const baseLines: CheckoutLine[] = useMemo(() => {
    if (clearedAfterPay) return [];
    if (draft) return draft.lines;
    const remise = user?.remise || 0;
    return items.map((it) => {
      const price = it.prixHT - (it.prixHT * remise) / 100;
      return {
        name: it.nom,
        reference: it.reference,
        quantity: it.quantite,
        unitPriceHT: price,
        totalHT: price * it.quantite,
      };
    });
  }, [draft, items, user?.remise, clearedAfterPay]);

  const totals = useMemo(() => {
    if (clearedAfterPay) return { subtotalHT: 0, tax: 0, totalTTC: 0, currency: 'EUR' as const };
    if (draft?.totals) return draft.totals;
    const subtotalHT = baseLines.reduce((sum, l) => sum + (l.totalHT ?? l.unitPriceHT * l.quantity), 0);
    const tax = subtotalHT * 0.2;
    const totalTTC = subtotalHT + tax;
    return { subtotalHT, tax, totalTTC, currency: 'EUR' as const };
  }, [baseLines, draft?.totals, clearedAfterPay]);

  const paypalAmount = totals.totalTTC;

  const updateForm = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateDelivery = () => {
    const missing: string[] = [];
    const phone = formData.phone.trim() || savedProfile?.phone?.trim() || '';
    if (!phone) missing.push('phone');
    if (!formData.deliveryType.trim()) missing.push('deliveryType');
    if (addressMode === 'new') {
      if (!formData.address.trim()) missing.push('address');
      if (!formData.city.trim()) missing.push('city');
      if (!formData.postalCode.trim()) missing.push('postalCode');
    } else {
      if (!savedProfile?.address && !savedProfile?.city && !savedProfile?.postalCode) {
        missing.push('savedAddress');
      }
    }
    setDeliveryError(missing.length ? 'Merci de compléter les informations de livraison.' : '');
    return missing.length === 0;
  };

  const shipping = useMemo(() => {
    const contactName = formData.contactName || savedProfile?.contactName || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.societe || null;
    if (addressMode === 'saved') {
      return {
        address: savedProfile?.address ?? null,
        city: savedProfile?.city ?? null,
        postalCode: savedProfile?.postalCode ?? null,
        phone: formData.phone || savedProfile?.phone || null,
        contactName,
        deliveryType: formData.deliveryType || null,
      };
    }
    return {
      address: formData.address || null,
      city: formData.city || null,
      postalCode: formData.postalCode || null,
      phone: formData.phone || null,
      contactName,
      deliveryType: formData.deliveryType || null,
    };
  }, [addressMode, formData, savedProfile, user?.nom, user?.prenom, user?.societe]);

  const persistOrder = async (provider: 'paypal' | 'card', paymentId?: string | null) => {
    setPaymentError('');
    setPaypalError('');
    if (!validateDelivery()) return;
    setSaving(true);
    try {
      const orderId = await createOrderAndPayment({
        user,
        lines: baseLines,
        totals,
        paymentProvider: provider,
        paymentId: paymentId ?? null,
        status: 'payee',
        shipping,
      });

      const invoiceLines = baseLines.map((l) => ({
        description: l.name,
        code: l.reference,
        qty: l.quantity,
        unitPrice: l.unitPriceHT,
      }));

      setOrderIdSnapshot(orderId);
      setLinesSnapshot(invoiceLines);
      setTotalsSnapshot(totals);
      setShowSuccessModal(true);
      setClearedAfterPay(true);

      // Envoi email facture (best-effort)
      if (user?.email) {
        const buyerName = [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.societe || 'Client B2B';
        const buyerAddress = [shipping.address, shipping.city, shipping.postalCode].filter(Boolean) as string[];
        const invoiceData: InvoiceData = {
          locale: userRegion,
          invoiceNumber: `INV-${orderId.slice(0, 8)}`,
          orderNumber: orderId,
          issueDate: new Date().toLocaleDateString('fr-FR'),
          buyer: {
            name: buyerName,
            company: user?.societe || undefined,
            addressLines: buyerAddress,
            phone: shipping.phone || undefined,
            email: user.email || undefined,
          },
          seller: {
            name: 'MISHKI LAB',
            addressLines: ['5 Rue du Printemps', '88000 Jeuxey', 'France'],
            siret: '92089652300011',
            ape: '2042Z',
            email: 'facturation@mishki.com',
          },
          payment: { terms: provider === 'paypal' ? 'Paiement en ligne (PayPal)' : 'Paiement en ligne (carte)' },
          lines: invoiceLines.map((l) => ({
            qty: l.qty,
            unit: 'pcs',
            code: l.code,
            description: l.description,
            unitPrice: l.unitPrice,
          })),
          totals: {
            subtotal: totals.subtotalHT,
            taxLabel: userRegion === 'pe' ? 'IGV 18%' : 'TVA 20%',
            taxAmount: totals.tax,
            total: totals.totalTTC,
            currency: 'EUR',
          },
        };

        void fetch('/api/invoice-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, invoiceData }),
        }).catch((err) => {
          console.error('invoice-email failed', err);
        });
      }

      if (draft?.source === 'cart') {
        clearCart();
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('b2bPaymentDraft');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de paiement';
      if (provider === 'paypal') {
        setPaypalError(msg);
      } else {
        setPaymentError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePaypalSuccess = (payload?: { orderId?: string }) => {
    void persistOrder('paypal', payload?.orderId ?? null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl text-gray-900">{tr('title', 'Paiement')}</h1>
            <p className="text-sm text-gray-600">{tr('subtitle', 'Validation de votre commande B2B')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <h2 className="text-gray-900 text-lg">{tr('orderSummary.title', 'Résumé de commande')}</h2>
              {user?.remise ? (
                <p className="text-sm text-gray-700">
                  {tr('orderSummary.discount', 'Remise professionnelle appliquée :')}{' '}
                  <span className="font-semibold text-[#235730]">{user.remise}%</span>
                </p>
              ) : null}
              {baseLines.length === 0 ? (
                <p className="text-sm text-gray-600">{tr('orderSummary.empty', 'Aucun article dans votre commande.')}</p>
              ) : (
                <div className="space-y-3">
                  {baseLines.map((line, idx) => (
                    <div key={`${line.reference || line.name}-${idx}`} className="flex items-start justify-between border border-gray-100 rounded-lg p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{line.name}</p>
                        {line.reference && (
                          <p className="text-xs text-gray-500">
                            {tr('orderSummary.ref', 'Ref : {ref}', { ref: line.reference })}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {tr('orderSummary.qty', 'Quantité : {qty}', { qty: line.quantity })}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm text-gray-900">
                          {formatMoney.format(line.unitPriceHT)} {tr('orderSummary.ht', 'HT')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tr('orderSummary.total', 'Total : {amount}', {
                            amount: formatMoney.format(line.totalHT ?? line.unitPriceHT * line.quantity),
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <h2 className="text-gray-900 text-lg">{tr('shipping.title', 'Adresse de livraison')}</h2>

              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="addr_saved"
                  checked={addressMode === 'saved'}
                  onChange={() => setAddressMode('saved')}
                  className="w-4 h-4 text-[#235730] focus:ring-[#235730]"
                />
                <Label htmlFor="addr_saved" className="text-sm text-gray-700">
                  {tr('shipping.useSaved', "Utiliser l'adresse enregistrée")}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="addr_new"
                  checked={addressMode === 'new'}
                  onChange={() => setAddressMode('new')}
                  className="w-4 h-4 text-[#235730] focus:ring-[#235730]"
                />
                <Label htmlFor="addr_new" className="text-sm text-gray-700">
                  {tr('shipping.newAddress', 'Saisir une nouvelle adresse')}
                </Label>
              </div>

              {addressMode === 'saved' && (
                <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  {savedProfile && (savedProfile.address || savedProfile.city || savedProfile.postalCode) ? (
                    <>
                      <p>{savedProfile.address}</p>
                      <p>
                        {[savedProfile.postalCode, savedProfile.city].filter(Boolean).join(' ') || null}
                      </p>
                      {savedProfile.phone && <p>{savedProfile.phone}</p>}
                    </>
                  ) : (
                    <p>{tr('shipping.noSaved', 'Aucune adresse enregistrée.')}</p>
                  )}
                </div>
              )}

              {addressMode === 'new' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="contactName" className="text-sm text-gray-500">
                      {tr('shipping.contact', 'Contact')}
                    </Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => updateForm('contactName', e.target.value)}
                      placeholder={tr('shipping.contactPlaceholder', 'Nom du contact')}
                      className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address" className="text-sm text-gray-500">
                      {tr('shipping.address', 'Adresse')}
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => updateForm('address', e.target.value)}
                      placeholder={tr('shipping.addressPlaceholder', 'Adresse complète')}
                      className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="postalCode" className="text-sm text-gray-500">
                      {tr('shipping.postalCode', 'Code postal')}
                    </Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => updateForm('postalCode', e.target.value)}
                      placeholder={tr('shipping.postalCodePlaceholder', '75001')}
                      className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city" className="text-sm text-gray-500">
                    {tr('shipping.city', 'Ville')}
                    </Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateForm('city', e.target.value)}
                      placeholder={tr('shipping.cityPlaceholder', 'Paris')}
                      className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone" className="text-sm text-gray-500">
                    {tr('shipping.phone', 'Téléphone')}
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    placeholder={tr('shipping.phonePlaceholder', '+33 6 ...')}
                    className="border-gray-300 focus:border-[#235730] focus:ring-[#235730]"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-500">{tr('shipping.deliveryMode', 'Mode de livraison')}</Label>
                  <select
                    value={formData.deliveryType}
                    onChange={(e) => updateForm('deliveryType', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#235730] focus:ring-[#235730]"
                  >
                    <option value="Point relais">{tr('shipping.deliveryRelay', 'Point relais')}</option>
                    <option value="Livraison à domicile">{tr('shipping.deliveryHome', 'Livraison à domicile')}</option>
                  </select>
                </div>
              </div>

              {deliveryError && <p className="text-sm text-red-600">{deliveryError}</p>}
            </section>

            <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <h2 className="text-gray-900 text-lg">{tr('payment.title', 'Paiement')}</h2>
              <p className="text-sm text-gray-600">
                {tr('payment.paypalLabel', 'PayPal (pro) – montant TTC : {amount}', {
                  amount: formatMoney.format(paypalAmount),
                })}
              </p>
              {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
              {paypalError && <p className="text-sm text-red-600">{paypalError}</p>}
              {saving && <p className="text-sm text-gray-500">{tr('payment.processing', 'Traitement en cours...')}</p>}
              <div className="max-w-sm">
                <PaypalButton
                  amount={paypalAmount}
                  currency="EUR"
                  disabled={saving}
                  onSuccess={handlePaypalSuccess}
                  onError={(msg) => setPaypalError(msg || 'Erreur PayPal')}
                />
              </div>
              <button
                onClick={() => persistOrder('card', null)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-white"
                style={{ backgroundColor: '#235730' }}
                disabled={saving}
              >
                <CreditCard className="w-4 h-4" />
                {tr('payment.cardCta', 'Payer par carte (simulation)')}
              </button>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6 space-y-4">
              <h3 className="text-gray-900 mb-2">{tr('summary.title', 'Récapitulatif')}</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>{tr('summary.subtotal', 'Sous-total {ht}', { ht: htLabel })}</span>
                  <span>{formatMoney.format(totals.subtotalHT)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{tr('summary.tax', 'TVA (20%)')}</span>
                  <span>{formatMoney.format(totals.tax)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                  <span>{tr('summary.total', 'Total TTC')}</span>
                  <span>{formatMoney.format(totals.totalTTC)}</span>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-600 space-y-1">
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4" style={{ color: '#235730' }} /> {tr('summary.badgeSecure', 'Paiement sécurisé')}
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4" style={{ color: '#235730' }} /> {tr('summary.badgeShipping', 'Livraison suivie')}
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4" style={{ color: '#235730' }} /> {tr('summary.badgeSupport', 'Assistance dédiée pro')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSuccessModal && totalsSnapshot && (
        <PaymentSuccessModal
          open={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          orderId={orderIdSnapshot}
          lines={linesSnapshot}
          totals={totalsSnapshot}
          buyer={{
            name: [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.societe || 'Client B2B',
            company: user?.societe || null,
            email: user?.email || undefined,
            phone: shipping.phone || undefined,
            addressLines: [
              shipping.address || undefined,
              [shipping.postalCode, shipping.city].filter(Boolean).join(' ') || undefined,
            ].filter(Boolean) as string[],
          }}
          homeHref="/pro/accueil"
        />
      )}
    </div>
  );
}
