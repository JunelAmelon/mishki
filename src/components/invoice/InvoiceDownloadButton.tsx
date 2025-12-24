'use client';

import React, { ReactNode, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import InvoiceFR from './InvoiceFR';
import InvoicePE from './InvoicePE';
import { InvoiceData } from '@/lib/invoice/types';

type InvoiceDownloadButtonProps = {
  data: InvoiceData;
  fileName?: string;
  label?: ReactNode;
  className?: string;
  templateOverride?: 'fr' | 'pe';
};

export default function InvoiceDownloadButton({
  data,
  fileName,
  label = 'Télécharger la facture',
  className,
  templateOverride,
}: InvoiceDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Template = useMemo(() => {
    const tpl = templateOverride ?? data.locale;
    return tpl === 'pe' ? InvoicePE : InvoiceFR;
  }, [data.locale, templateOverride]);

  const name = fileName ?? `invoice-${data.invoiceNumber || 'preview'}.pdf`;

  const handleDownload = async () => {
    setError(null);
    setLoading(true);
    try {
      const instance = pdf(<Template data={data} />);
      const blob = await instance.toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de génération du PDF';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={
        className ?? 'px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow'
      }
      disabled={loading}
      title={error ?? undefined}
    >
      {loading ? 'Préparation...' : label}
    </button>
  );
}
