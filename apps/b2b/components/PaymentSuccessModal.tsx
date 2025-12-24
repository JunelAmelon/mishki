'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import InvoiceDownloadButton from '@/components/invoice/InvoiceDownloadButton';
import { InvoiceData } from '@/lib/invoice/types';

type LineInput = {
  description: string;
  code?: string;
  qty: number;
  unitPrice: number;
};

type TotalsInput = {
  subtotalHT: number;
  tax: number;
  totalTTC: number;
  currency: string;
};

type BuyerInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type PaymentSuccessModalProps = {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  lines: LineInput[];
  totals: TotalsInput | null;
  buyer: BuyerInput;
};

const sellerInfo = {
  name: 'MISHKI LAB',
  addressLines: ['5 Rue du Printemps', '88000 Jeuxey', 'France'],
  siret: '92089652300011',
  ape: '2042Z',
  email: 'facturation@mishki.com',
};

export default function PaymentSuccessModal({ open, onClose, orderId, lines, totals, buyer }: PaymentSuccessModalProps) {
  const locale = useLocale();

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

  const invoiceData: InvoiceData | null = useMemo(() => {
    if (!orderId || !totals) return null;
    const issueDate = new Date();
    const currency: 'EUR' | 'PEN' = totals.currency === 'PEN' ? 'PEN' : 'EUR';
    return {
      locale: userRegion,
      invoiceNumber: `INV-${orderId.slice(0, 8)}`,
      orderNumber: orderId,
      issueDate: issueDate.toLocaleDateString('fr-FR'),
      buyer: {
        name: buyer.name || 'Client B2B',
        addressLines: [],
        phone: buyer.phone || undefined,
        email: buyer.email || undefined,
      },
      seller: sellerInfo,
      payment: { terms: 'Paiement en ligne (PayPal)' },
      lines: lines.map((l) => ({
        qty: l.qty,
        unit: 'pcs',
        code: l.code,
        description: l.description,
        unitPrice: l.unitPrice,
      })),
      totals: {
        subtotal: totals.subtotalHT,
        taxLabel: 'TVA 20%',
        taxAmount: totals.tax,
        total: totals.totalTTC,
        currency,
      },
    };
  }, [buyer.email, buyer.name, buyer.phone, lines, orderId, totals, userRegion]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Paiement réussi</h3>
        <p className="text-sm text-gray-600 mb-4">
          Votre paiement est confirmé. Vous pouvez télécharger la facture dès maintenant.
        </p>
        {invoiceData ? (
          <InvoiceDownloadButton data={invoiceData} />
        ) : (
          <p className="text-sm text-red-600">Impossible de préparer la facture.</p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
