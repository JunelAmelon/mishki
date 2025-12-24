'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { collection, db, getDocs } from '@mishki/firebase';
import type { Timestamp } from 'firebase/firestore';
import { InvoiceData, InvoiceLocale } from '@/lib/invoice/types';
import { useAuth } from '../context/AuthContext';

type PaymentDoc = {
  orderId?: string;
  amountHT?: number;
  amountTTC?: number;
  tax?: number;
  currency?: string;
  status?: 'payee' | 'en_attente' | 'retard' | string;
  dueDate?: string | Timestamp;
  createdAt?: string | Timestamp;
  provider?: string;
  pdfFranceUrl?: string;
  pdfPeruUrl?: string;
};

type OrderLine = {
  name?: string;
  quantity?: number;
  reference?: string;
  unitPriceHT?: number;
};

type OrderDoc = {
  lines?: OrderLine[];
  createdAt?: string | Timestamp;
  userId?: string | null;
  userEmail?: string | null;
  userSociete?: string | null;
  userSiret?: string | null;
  userNom?: string | null;
  userPrenom?: string | null;
  userRemise?: number | null;
};

export type Invoice = {
  id: string;
  numero: string;
  date: string;
  montantHT: number;
  montantTTC: number;
  statut: 'payee' | 'en_attente' | 'retard' | string;
  dateEcheance: string;
  produits: string;
  pdfFranceUrl?: string;
  pdfPeruUrl?: string;
  locale: InvoiceLocale;
  invoiceData?: InvoiceData;
};

const sellerInfo = {
  name: 'MISHKI LAB',
  addressLines: ['5 Rue du Printemps', '88000 Jeuxey', 'France'],
  siret: '92089652300011',
  ape: '2042Z',
  email: 'facturation@mishki.com',
};

const toDate = (value?: string | Timestamp | null) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && 'toDate' in value) {
    return value.toDate();
  }
  return null;
};

const toIsoString = (value?: string | Timestamp | null) => {
  const d = toDate(value);
  return d ? d.toISOString() : '';
};

const localeFromCurrency = (currency?: string): InvoiceLocale => {
  if (currency?.toUpperCase() === 'PEN') return 'pe';
  return 'fr';
};

export function useInvoicesB2B() {
  const locale = useLocale();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user?.id) {
          setInvoices([]);
          setLoading(false);
          return;
        }

        const [paymentsSnap, ordersSnap] = await Promise.all([
          getDocs(collection(db, 'payments')),
          getDocs(collection(db, 'orders')),
        ]);
        if (!mounted) return;

        const orderMap = new Map<string, OrderDoc>();
        ordersSnap.docs.forEach((d) => {
          orderMap.set(d.id, d.data() as OrderDoc);
        });

        const mapped: Invoice[] = paymentsSnap.docs.reduce<Invoice[]>((acc, d) => {
          const data = d.data() as PaymentDoc;
          const order = data.orderId ? orderMap.get(data.orderId) : undefined;

          const payUserId = (data as { userId?: string | null }).userId ?? null;
          const orderUserId = order?.userId ?? null;
          if (user.id && payUserId && payUserId !== user.id) return acc;
          if (user.id && !payUserId && orderUserId && orderUserId !== user.id) return acc;
          if (user.id && !payUserId && !orderUserId) return acc;

          const lines = order?.lines || [];
          const produits =
            lines.length > 0
              ? lines
                  .map((l) => {
                    const qty = l.quantity ?? 0;
                    const name = l.name || '';
                    return qty ? `${name} x${qty}` : name;
                  })
                  .filter(Boolean)
                  .join(', ')
              : '';

          const issueDateIso = toIsoString(data.createdAt || order?.createdAt);
          const dueIso = toIsoString(data.dueDate);

          const amountHT = data.amountHT ?? 0;
          const taxAmount = data.tax ?? Math.max(0, (data.amountTTC ?? 0) - amountHT);
          const amountTTC = data.amountTTC ?? amountHT + taxAmount;
          const currency = (data.currency?.toUpperCase() || 'EUR') as 'EUR' | 'PEN';
          const localeForInvoice = localeFromCurrency(currency);

          const invoiceData: InvoiceData = {
            locale: localeForInvoice,
            invoiceNumber: data.orderId || d.id,
            orderNumber: data.orderId,
            issueDate: issueDateIso ? new Date(issueDateIso).toLocaleDateString('fr-FR') : '',
            dueDate: dueIso ? new Date(dueIso).toLocaleDateString('fr-FR') : undefined,
            buyer: {
              name: order?.userSociete || order?.userEmail || 'Client B2B',
              addressLines: [],
              contact: [order?.userNom, order?.userPrenom].filter(Boolean).join(' ') || undefined,
              email: order?.userEmail || undefined,
              siret: localeForInvoice === 'fr' ? order?.userSiret || undefined : undefined,
            },
            seller: sellerInfo,
            payment: { terms: data.provider ? `Paiement ${data.provider}` : 'Paiement en ligne' },
            lines:
              lines.length > 0
                ? lines.map((l) => ({
                    qty: l.quantity ?? 1,
                    unit: 'pcs',
                    code: l.reference,
                    description: l.name || 'Produit',
                    unitPrice: l.unitPriceHT ?? amountHT,
                  }))
                : [
                    {
                      qty: 1,
                      unit: 'pcs',
                      description: 'Commande',
                      unitPrice: amountHT,
                    },
                  ],
            totals: {
              subtotal: amountHT,
              taxLabel: localeForInvoice === 'pe' ? 'IGV 18%' : 'TVA 20%',
              taxAmount,
              total: amountTTC,
              currency,
            },
          };

          acc.push({
            id: d.id,
            numero: data.orderId || d.id,
            date: issueDateIso,
            montantHT: amountHT,
            montantTTC: amountTTC,
            statut: (data.status as Invoice['statut']) || 'en_attente',
            dateEcheance: dueIso,
            produits,
            pdfFranceUrl: data.pdfFranceUrl,
            pdfPeruUrl: data.pdfPeruUrl,
            locale: localeForInvoice,
            invoiceData,
          });
          return acc;
        }, []);

        // Optionnel: trier par date décroissante si date parseable
        mapped.sort((a, b) => {
          const ta = Date.parse(a.date || '');
          const tb = Date.parse(b.date || '');
          if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
          return tb - ta;
        });

        setInvoices(mapped);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Erreur de récupération des factures';
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [locale, user?.id]);

  const months = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      const d = inv.date ? new Date(inv.date) : null;
      if (d && !Number.isNaN(d.getTime())) {
        const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        set.add(label);
      }
    });
    return Array.from(set);
  }, [invoices, locale]);

  return { invoices, months, loading, error };
}
