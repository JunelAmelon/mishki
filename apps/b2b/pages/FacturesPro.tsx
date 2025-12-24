'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Download, Eye, Filter, Calendar, FileText } from 'lucide-react';
import { useInvoicesB2B } from '../hooks/useInvoicesB2B';
import InvoiceDownloadButton from '@/components/invoice/InvoiceDownloadButton';

export default function FacturesPro() {
  const t = useTranslations('b2b.invoices');
  const locale = useLocale();
  const { invoices, months, loading, error } = useInvoicesB2B();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatut, setSelectedStatut] = useState<'all' | 'payee' | 'en_attente' | 'retard'>('all');
  const [selectedMois, setSelectedMois] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());
  const detectRegion = useMemo(() => {
    return () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase();
        if (tz?.includes('lima') || tz?.includes('peru')) {
          return 'pe' as const;
        }
        if (tz?.includes('paris') || tz?.includes('europe/paris')) {
          return 'fr' as const;
        }
      } catch {
        // ignore
      }

      const lowerLocale = locale.toLowerCase();
      if (lowerLocale.includes('pe')) return 'pe' as const;
      return 'fr' as const;
    };
  }, [locale]);
  const userRegion = useMemo(() => detectRegion(), [detectRegion]);

  const formatMoney = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );

  const statuts = [
    { value: 'all', label: t('filter_all_statuts') },
    { value: 'payee', label: t('statuts.paid') },
    { value: 'en_attente', label: t('statuts.pending') },
    { value: 'retard', label: t('statuts.overdue') },
  ];
  const years = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      const d = inv.date ? new Date(inv.date) : null;
      if (d && !Number.isNaN(d.getTime())) {
        set.add(String(d.getFullYear()));
      }
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [invoices]);

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'payee':
        return 'bg-green-100 text-green-700';
      case 'en_attente':
        return 'bg-blue-100 text-blue-700';
      case 'retard':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'payee':
        return t('statuts.paid');
      case 'en_attente':
        return t('statuts.pending');
      case 'retard':
        return t('statuts.overdue');
      default:
        return statut;
    }
  };

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value || '-';
    return d.toLocaleDateString(locale);
  };


  const selectPdfUrl = (inv: { pdfFranceUrl?: string; pdfPeruUrl?: string }) => {
    if (userRegion === 'pe') return inv.pdfPeruUrl || inv.pdfFranceUrl;
    return inv.pdfFranceUrl || inv.pdfPeruUrl;
  };

  const filteredFactures = invoices.filter((facture) => {
    const matchesYear =
      (() => {
        const d = facture.date ? new Date(facture.date) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        return String(d.getFullYear()) === selectedYear;
      })();
    const matchesSearch =
      facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (facture.produits || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatut = selectedStatut === 'all' || facture.statut === selectedStatut;
    const matchesMois =
      selectedMois === 'all' ||
      (() => {
        const d = facture.date ? new Date(facture.date) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        return label === selectedMois;
      })();
    return matchesYear && matchesSearch && matchesStatut && matchesMois;
  });

  const invoicesForStats = invoices.filter((f) => {
    const d = f.date ? new Date(f.date) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return String(d.getFullYear()) === selectedYear;
  });
  const totalHT = invoicesForStats.reduce((sum, f) => sum + (f.montantHT ?? 0), 0);
  const totalTTC = invoicesForStats.reduce((sum, f) => sum + (f.montantTTC ?? 0), 0);
  const enAttente = invoicesForStats.filter((f) => f.statut === 'en_attente').length;
  const enRetard = invoicesForStats.filter((f) => f.statut === 'retard').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-gray-900 mb-2">{t('title')}</h1>
            <p className="text-gray-600">{t('subtitle')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-700">
          {t('loading', { defaultMessage: 'Chargement...' })}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-gray-900 mb-2">{t('title')}</h1>
            <p className="text-gray-600">{t('subtitle')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-colors"
          style={{ backgroundColor: '#235730' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a4023')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#235730')}
          onClick={() => {
            // TODO: batch download all PDFs; for now noop.
          }}
        >
          <Download className="w-5 h-5" />
          {t('btn_download_all')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">{t('stats.total_ht')}</p>
          <p className="text-2xl text-gray-900">{formatMoney.format(totalHT)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">{t('stats.total_ttc')}</p>
          <p className="text-2xl text-gray-900">{formatMoney.format(totalTTC)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">{t('stats.pending')}</p>
          <p className="text-2xl text-blue-600">{enAttente}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">{t('stats.overdue')}</p>
          <p className="text-2xl text-red-600">{enRetard}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Statut Filter */}
          <select
            value={selectedStatut}
            onChange={(e) => setSelectedStatut(e.target.value as typeof selectedStatut)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statuts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Mois Filter */}
          <select
            value={selectedMois}
            onChange={(e) => setSelectedMois(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('filter_all_months')}</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          {t('results_count', { count: filteredFactures.length })}
        </p>
      </div>

      {/* Factures Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_num')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_date')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_products')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_ht')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_ttc')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_due')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_status')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFactures.map((facture) => {
                const pdfUrl = selectPdfUrl(facture);
                return (
                  <tr key={facture.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{facture.numero}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(facture.date)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 max-w-xs truncate block">
                        {facture.produits}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatMoney.format(facture.montantHT ?? 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatMoney.format(facture.montantTTC ?? 0)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {formatDate(facture.dateEcheance)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs ${getStatutBadge(
                          facture.statut
                        )}`}
                      >
                        {getStatutLabel(facture.statut)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {pdfUrl ? (
                          <>
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                              title={t('table.action_view')}
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            <a
                              href={pdfUrl}
                              download
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors inline-flex"
                              title={t('table.action_download')}
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </>
                        ) : facture.invoiceData ? (
                          <InvoiceDownloadButton
                            data={facture.invoiceData}
                            className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors inline-flex"
                            fileName={`facture-${facture.numero}.pdf`}
                            label={<Download className="w-4 h-4" aria-label={t('table.action_download')} />}
                            templateOverride={facture.locale}
                          />
                        ) : (
                          <span className="text-xs text-gray-400">{t('table.no_pdf')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredFactures.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-gray-900 mb-2">{t('no_results')}</h3>
          <p className="text-gray-600 mb-4">
            {t('no_results_desc')}
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedStatut('all');
              setSelectedMois('all');
            }}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#235730' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a4023')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#235730')}
          >
            {t('reset_filters')}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-gray-900 mb-3">{t('info.title')}</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span style={{ color: '#235730' }}>•</span>
            {t('info.line1')}
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: '#235730' }}>•</span>
            {t('info.line2')}
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: '#235730' }}>•</span>
            {t('info.line3')}
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: '#235730' }}>•</span>
            {t('info.line4')}
          </li>
        </ul>
      </div>
    </div>
  );
}

// Force SSR pour éviter les erreurs de build
export async function getServerSideProps() {
  return { props: {} };
}
