'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Check,
  Package,
  CreditCard,
} from 'lucide-react';
import { useProductsB2B } from '../hooks/useProductsB2B';

export default function Panier() {
  const t = useTranslations('b2b.cart');
  const locale = useLocale();
  const { items, removeFromCart, updateQuantity, clearCart, total } = useCart();
  const { user } = useAuth();
  const { products } = useProductsB2B();
  const router = useRouter();
  const minQty = 100;
  const [stockMessages, setStockMessages] = useState<Record<string, string>>({});

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
  const ttcLabel = useMemo(() => {
    const lower = locale.toLowerCase();
    if (lower.startsWith('fr')) return 'TTC';
    if (lower.startsWith('es')) return 'Con IGV';
    return 'Incl. VAT';
  }, [locale]);

  const calculateRemise = (prix: number) => {
    const remise = user?.remise || 0;
    return prix - (prix * remise) / 100;
  };

  const productById = useMemo(() => {
    const map = new Map<string, { stock?: number }>();
    products.forEach((p) => map.set(p.id, { stock: p.stock }));
    return map;
  }, [products]);

  const applyQuantity = async (itemId: string, nextQtyRaw: number) => {
    const productInfo = productById.get(itemId);
    const stock = productInfo?.stock;
    const nextQty = Math.max(minQty, nextQtyRaw);
    if (stock !== undefined) {
      if (stock <= 0) {
        setStockMessages((prev) => ({ ...prev, [itemId]: t('stock.out') || 'Stock épuisé' }));
        return;
      }
      if (nextQty > stock) {
        setStockMessages((prev) => ({
          ...prev,
          [itemId]: t('stock.limited', { max: stock }) || `Stock max: ${stock}`,
        }));
        await updateQuantity(itemId, stock);
        return;
      }
    }
    setStockMessages((prev) => ({ ...prev, [itemId]: '' }));
    await updateQuantity(itemId, nextQty);
  };

  const totalHT = items.reduce((sum, item) => {
    const prixRemise = calculateRemise(item.prixHT);
    return sum + prixRemise * item.quantite;
  }, 0);

  const totalRemise = total - totalHT;
  const tva = totalHT * 0.2;
  const totalTTC = totalHT + tva;
  const goToPaymentPage = () => {
    const lines = items.map((item) => {
      const prixRemise = calculateRemise(item.prixHT);
      return {
        name: item.nom,
        reference: item.reference,
        quantity: item.quantite,
        unitPriceHT: prixRemise,
        totalHT: prixRemise * item.quantite,
      };
    });
    const draft = {
      source: 'cart' as const,
      lines,
      totals: {
        subtotalHT: totalHT,
        tax: tva,
        totalTTC,
        currency: 'EUR' as const,
      },
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('b2bPaymentDraft', JSON.stringify(draft));
    }
    router.push('/pro/paiement');
  };

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/pro/catalogue')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: '#235730' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-gray-900 text-xl md:text-2xl">{t('title')}</h1>
            <p className="text-sm md:text-base text-gray-600">{t('subtitle')}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-gray-900 mb-2">{t('empty.title')}</h3>
          <p className="text-gray-600 mb-6">
            {t('empty.subtitle')}
          </p>
          <button
            onClick={() => router.push('/pro/catalogue')}
            className="px-6 py-3 text-white rounded-lg transition-colors inline-flex items-center gap-2"
            style={{ backgroundColor: '#235730' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a4023')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#235730')}
          >
            <Package className="w-5 h-5" />
            {t('empty.btn_browse')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/pro/catalogue')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: '#235730' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-gray-900 text-xl md:text-2xl">{t('title')}</h1>
            <p className="text-sm md:text-base text-gray-600">
              {t('items_count', { count: items.length })} • {t('remise_label', { remise: user?.remise || 0 })}
            </p>
          </div>
        </div>
        <button
          onClick={clearCart}
          className="hidden md:flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {t('btn_clear')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const prixRemise = calculateRemise(item.prixHT);
            const sousTotal = prixRemise * item.quantite;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 p-4 md:p-6"
              >
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.nom}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-gray-900 truncate">{item.nom}</h3>
                        <p className="text-sm text-gray-500">{item.reference}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Price and Quantity */}
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                      <div>
                        {user?.remise ? (
                          <>
                            <p className="text-xs text-gray-400 line-through">
                              {formatMoney.format(item.prixHT)} {htLabel}
                            </p>
                            <p className="text-gray-900">
                              {formatMoney.format(prixRemise)} <span className="text-sm">{htLabel}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-900">
                            {formatMoney.format(item.prixHT)} <span className="text-sm">{htLabel}</span>
                          </p>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-gray-200 rounded-lg">
                          <button
                            onClick={() => applyQuantity(item.id, item.quantite - 1)}
                            className="p-2 hover:bg-gray-50 transition-colors rounded-l-lg"
                            style={{ color: '#235730' }}
                            disabled={item.quantite <= minQty}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-4 py-2 text-gray-900 min-w-[3rem] text-center">
                            {item.quantite}
                          </span>
                          <button
                            onClick={() => applyQuantity(item.id, item.quantite + 1)}
                            className="p-2 hover:bg-gray-50 transition-colors rounded-r-lg"
                            style={{ color: '#235730' }}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right min-w-[5rem]">
                          <p className="text-gray-900">{formatMoney.format(sousTotal)}</p>
                        </div>
                      </div>
                      {stockMessages[item.id] && (
                        <p className="text-xs text-red-600 mt-1">{stockMessages[item.id]}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Clear Cart Button Mobile */}
          <button
            onClick={clearCart}
            className="md:hidden w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors bg-white border border-gray-200"
          >
            <Trash2 className="w-4 h-4" />
            {t('btn_clear')}
          </button>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
            <h3 className="text-gray-900 mb-2">{t('summary.title')}</h3>
            {user?.remise ? (
              <p className="text-sm text-gray-700 mb-2">
                Remise pro appliquée : <span className="font-semibold text-[#235730]">{user.remise}%</span>
              </p>
            ) : null}

            <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('summary.subtotal_ht')}</span>
                <span className="text-gray-900">{formatMoney.format(total)}</span>
              </div>

              {user?.remise && totalRemise > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">{t('summary.remise_pro', { remise: user.remise })}</span>
                  <span className="text-green-600">-{formatMoney.format(totalRemise)}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('summary.total_ht')}</span>
                <span className="text-gray-900">{formatMoney.format(totalHT)} {htLabel}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('summary.tva')}</span>
                <span className="text-gray-900">{formatMoney.format(tva)}</span>
              </div>
            </div>

            <div className="flex justify-between mb-6">
              <span className="text-gray-900">{t('summary.total_ttc')} ({ttcLabel})</span>
              <span className="text-xl text-gray-900">{formatMoney.format(totalTTC)}</span>
            </div>

            <button
              onClick={goToPaymentPage}
              className="w-full py-3 rounded-lg text-white transition-colors flex items-center justify-center gap-2 mb-3"
              style={{ backgroundColor: '#235730' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a4023')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#235730')}
            >
              <CreditCard className="w-5 h-5" />
              {t('summary.btn_validate')}
            </button>

            <button
              onClick={() => router.push('/pro/catalogue')}
              className="w-full py-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              {t('summary.btn_continue')}
            </button>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#235730' }} />
                <div>
                  <p className="mb-1">{t('summary.info_free_delivery')}</p>
                  <p className="mb-1">{t('summary.info_secure_payment')}</p>
                  <p>{t('summary.info_guarantee')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// Force SSR pour éviter les erreurs de build avec useCart/useAuth
export async function getServerSideProps() {
  return { props: {} };
}
