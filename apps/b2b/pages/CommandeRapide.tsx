'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Zap, Plus, Trash2, ShoppingCart, Minus } from 'lucide-react';
import { collection, db, getDocs, query, where, doc, getDoc } from '@mishki/firebase';
import { useProductsB2B, type ProductB2B } from '../hooks/useProductsB2B';
import { useAuth } from '../context/AuthContext';

interface OrderLine {
  id: string;
  reference: string;
  nom: string;
  quantite: number;
  prixHT: number;
  image: string;
}

interface OrderDoc {
  lines?: OrderLine[];
  createdAt?: string;
  userId?: string;
  user?: { id?: string } | null;
  userUID?: string;
  uid?: string;
  items?: { reference?: string; slug?: string; id?: string; quantite?: number; quantity?: number; qty?: number }[];
  orderItems?: { reference?: string; slug?: string; id?: string; quantite?: number; quantity?: number; qty?: number }[];
}

const MIN_QTY = 100;

export default function CommandeRapide() {
  const [orderLines, setOrderLines] = useState<OrderLine[]>([
    { id: '1', reference: '', nom: '', quantite: MIN_QTY, prixHT: 0, image: '' },
  ]);
  const [validatedProducts, setValidatedProducts] = useState<Map<string, ProductB2B>>(new Map());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [orderCounts, setOrderCounts] = useState<Map<string, number>>(new Map());
  const [stockMessages, setStockMessages] = useState<Record<string, string>>({});
  const hasStockError = useMemo(() => Object.values(stockMessages).some(Boolean), [stockMessages]);
  const { products, loading, error } = useProductsB2B();
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations('b2b.quick_order');
  const locale = useLocale();
  const idCounter = useRef(1);
  const remise = user?.remise || 0;

  const nextId = () => {
    idCounter.current += 1;
    return `line-${idCounter.current}`;
  };

  const priceWithRemise = (product: ProductB2B) => {
    const base = product.prixHT;
    const discounted = base - (base * remise) / 100;
    return Math.max(0, discounted);
  };

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
  const htLabel = useMemo(() => {
    const lower = locale.toLowerCase();
    if (lower.startsWith('fr')) return 'HT';
    if (lower.startsWith('es')) return 'Sin IGV';
    return 'Excl. VAT';
  }, [locale]);

  const normalizeRef = (ref: string) => ref.trim().toLowerCase();

  const productByRef = useMemo(() => {
    const map = new Map<string, ProductB2B>();
    products.forEach((p) => {
      map.set(normalizeRef(p.reference), p);
    });
    return map;
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    const fetchOrders = async () => {
      if (!user) {
        setOrderCounts(new Map());
        return;
      }
      try {
        const ordersRef = collection(db, 'orders');
        const ordersQuery = user.id
          ? query(ordersRef, where('userId', '==', user.id))
          : ordersRef;
        const snap = await getDocs(ordersQuery);
        const orderMap = new Map<string, OrderDoc>();
        if (cancelled) return;
        const counts = new Map<string, number>();
        snap.docs.forEach((doc) => {
          const data = doc.data() as OrderDoc;
          orderMap.set(doc.id, data);
          const orderUserId = data.userId || data.user?.id || data.userUID || data.uid;
          if (!orderUserId || orderUserId !== user.id) return;
          const items = (data.items as { reference?: string; slug?: string; id?: string; quantite?: number; quantity?: number; qty?: number }[]) ||
            (data.orderItems as { reference?: string; slug?: string; id?: string; quantite?: number; quantity?: number; qty?: number }[]) || [];
          items.forEach((item) => {
            const ref = normalizeRef(item.reference || item.slug || item.id || '');
            if (!ref) return;
            const qty = Number(item.quantite ?? item.quantity ?? item.qty ?? 0) || 1;
            counts.set(ref, (counts.get(ref) || 0) + qty);
          });
        });

        // Fallback via payments userId -> orderId -> fetch order (if userId absent in order)
        const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('userId', '==', user.id)));
        for (const p of paymentsSnap.docs) {
          const data = p.data() as { orderId?: string };
          const orderId = data.orderId;
          if (!orderId) continue;
          let orderData = orderMap.get(orderId);
          if (!orderData) {
            const orderDoc = await getDoc(doc(db, 'orders', orderId));
            if (orderDoc.exists()) {
              orderData = orderDoc.data() as OrderDoc;
            }
          }
          if (!orderData) continue;
          const items = (orderData.items as { reference?: string; slug?: string; id?: string; quantite?: number; quantity?: number; qty?: number }[]) ||
            (orderData.orderItems as { reference?: string; slug?: string; id?: string; quantite?: number; quantity?: number; qty?: number }[]) || [];
          items.forEach((item) => {
            const ref = normalizeRef(item.reference || item.slug || item.id || '');
            if (!ref) return;
            const qty = Number(item.quantite ?? item.quantity ?? item.qty ?? 0) || 1;
            counts.set(ref, (counts.get(ref) || 0) + qty);
          });
        }

        setOrderCounts(counts);
      } catch (e) {
        console.error('CommandeRapide: erreur récupération commandes', e);
      }
    };
    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const commonProducts = useMemo(() => {
    // Nombre dynamique : on affiche jusqu'à 12 refs ou moins si catalogue plus petit.
    const maxItems = Math.min(12, productByRef.size || products.length || 12);

    // Priorité : références les plus commandées par l'utilisateur courant.
    const orderRefs = orderCounts.size
      ? Array.from(orderCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([ref]) => ref)
      : [];

    const picked: ProductB2B[] = [];
    orderRefs.forEach((ref) => {
      if (picked.length >= maxItems) return;
      const prod = productByRef.get(ref);
      if (prod && !picked.some((p) => normalizeRef(p.reference) === ref)) {
        picked.push(prod);
      }
    });

    // Fallback : premières références du catalogue par ordre alpha si aucune ou pas assez de commandes.
    if (picked.length < maxItems) {
      const sortedAll = [...products]
        .sort((a, b) => a.reference.localeCompare(b.reference))
        .map((p) => normalizeRef(p.reference));
      sortedAll.forEach((ref) => {
        if (picked.length >= maxItems) return;
        const prod = productByRef.get(ref);
        if (prod && !picked.some((p) => normalizeRef(p.reference) === ref)) {
          picked.push(prod);
        }
      });
    }

    return picked.slice(0, maxItems);
  }, [orderCounts, productByRef, products]);

  const addLine = () => {
    setOrderLines([
      ...orderLines,
      { id: Date.now().toString(), reference: '', nom: '', quantite: MIN_QTY, prixHT: 0, image: '' },
    ]);
  };

  const hasStockIssues = () => {
    let issue = false;
    orderLines.forEach((line) => {
      const product = validatedProducts.get(line.id);
      if (!product) {
        issue = true;
        return;
      }
      const stock = product.stock;
      if (typeof stock === 'number') {
        if (stock <= 0) {
          setStockMessages((prev) => ({ ...prev, [line.id]: t('stock.out') || 'Stock épuisé' }));
          issue = true;
          return;
        }
        if (stock < MIN_QTY) {
          setStockMessages((prev) => ({
            ...prev,
            [line.id]: t('stock.min', { min: MIN_QTY, stock }) || `Stock insuffisant (min ${MIN_QTY}, dispo ${stock})`,
          }));
          setOrderLines((prev) =>
            prev.map((l) => (l.id === line.id ? { ...l, quantite: stock } : l))
          );
          issue = true;
          return;
        }
        if (line.quantite > stock) {
          setStockMessages((prev) => ({
            ...prev,
            [line.id]: t('stock.limited', { max: stock }) || `Stock max: ${stock}`,
          }));
          setOrderLines((prev) =>
            prev.map((l) => (l.id === line.id ? { ...l, quantite: stock } : l))
          );
          issue = true;
        }
      }
    });
    return issue;
  };

  const removeLine = (id: string) => {
    if (orderLines.length > 1) {
      setOrderLines(orderLines.filter((line) => line.id !== id));
      setValidatedProducts((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      setStockMessages((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const updateReference = (id: string, reference: string) => {
    const displayedRef = reference.toUpperCase();
    const normalized = normalizeRef(reference);

    setOrderLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, reference: displayedRef } : line))
    );

    const product = productByRef.get(normalized);
    if (product) {
      setValidatedProducts((prev) => new Map(prev).set(id, product));
      enforceStockForLine(id, product);
    } else {
      setValidatedProducts((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      setStockMessages((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const enforceStockForLine = (id: string, product: ProductB2B) => {
    const stock = product?.stock;
    setOrderLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const current = line.quantite;
        if (typeof stock === 'number') {
          if (stock <= 0) {
            setStockMessages((prevMsg) => ({ ...prevMsg, [id]: t('stock.out') || 'Stock épuisé' }));
            return { ...line, quantite: Math.max(0, Math.min(MIN_QTY, stock)) };
          }
          if (stock < MIN_QTY) {
            setStockMessages((prevMsg) => ({
              ...prevMsg,
              [id]: t('stock.min', { min: MIN_QTY, stock }) || `Stock insuffisant (min ${MIN_QTY}, dispo ${stock})`,
            }));
            return { ...line, quantite: stock };
          }
          if (current > stock) {
            setStockMessages((prevMsg) => ({
              ...prevMsg,
              [id]: t('stock.limited', { max: stock }) || `Stock max: ${stock}`,
            }));
            return { ...line, quantite: stock };
          }
        }
        setStockMessages((prevMsg) => ({ ...prevMsg, [id]: '' }));
        return line;
      })
    );
  };

  const updateQuantity = (id: string, quantite: number) => {
    const product = validatedProducts.get(id);
    const stock = product?.stock;
    const requested = Math.max(MIN_QTY, quantite);
    if (typeof stock === 'number') {
      if (stock <= 0) {
        setStockMessages((prev) => ({ ...prev, [id]: t('stock.out') || 'Stock épuisé' }));
        setOrderLines((prev) =>
          prev.map((line) => (line.id === id ? { ...line, quantite: Math.max(0, Math.min(MIN_QTY, stock)) } : line))
        );
        return;
      }
      if (requested > stock) {
        setStockMessages((prev) => ({
          ...prev,
          [id]: t('stock.limited', { max: stock }) || `Stock max: ${stock}`,
        }));
        setOrderLines((prev) =>
          prev.map((line) => (line.id === id ? { ...line, quantite: stock } : line))
        );
        return;
      }
    }
    setStockMessages((prev) => ({ ...prev, [id]: '' }));
    const finalQty = typeof stock === 'number' ? Math.min(requested, stock) : requested;
    setOrderLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, quantite: finalQty } : line))
    );
  };

  const handleQuickPick = (product: ProductB2B) => {
    const ref = product.reference;
    const displayedRef = ref.toUpperCase();
    const stock = product.stock;
    // Ne pas insérer si stock insuffisant (< MIN_QTY ou 0)
    if (typeof stock === 'number' && stock < MIN_QTY) {
      // cible une ligne vide si existante pour afficher le message
      const emptyLine = orderLines.find((line) => !line.reference);
      const targetId = emptyLine?.id;
      if (targetId) {
        setStockMessages((prev) => ({
          ...prev,
          [targetId]: t('stock.min', { min: MIN_QTY, stock }) || `Stock insuffisant (min ${MIN_QTY}, dispo ${stock})`,
        }));
      } else {
        const newId = nextId();
        setOrderLines((prev) => [
          ...prev,
          { id: newId, reference: '', nom: '', quantite: MIN_QTY, prixHT: 0, image: '' },
        ]);
        setStockMessages((prev) => ({
          ...prev,
          [newId]: t('stock.min', { min: MIN_QTY, stock }) || `Stock insuffisant (min ${MIN_QTY}, dispo ${stock})`,
        }));
      }
      return;
    }

    setOrderLines((prev) => {
      const emptyLine = prev.find((line) => !line.reference);
      if (emptyLine) {
        const updated = prev.map((line) =>
          line.id === emptyLine.id ? { ...line, reference: displayedRef, quantite: Math.max(MIN_QTY, line.quantite) } : line
        );
        setValidatedProducts((prevMap) => {
          const map = new Map(prevMap);
          map.set(emptyLine.id, product);
          return map;
        });
        enforceStockForLine(emptyLine.id, product);
        return updated;
      }

      const newLine = {
        id: nextId(),
        reference: displayedRef,
        nom: product.nom,
        quantite: MIN_QTY,
        prixHT: product.prixHT,
        image: product.image,
      };
      setValidatedProducts((prevMap) => {
        const map = new Map(prevMap);
        map.set(newLine.id, product);
        return map;
      });
      const next = [...prev, newLine];
      enforceStockForLine(newLine.id, product);
      return next;
    });
  };

  const goToPaymentPage = () => {
    let hasError = false;
    setFeedback(null);
    orderLines.forEach((line) => {
      if (!line.reference) {
        hasError = true;
        return;
      }
      const product = validatedProducts.get(line.id);
      if (!product) {
        hasError = true;
        return;
      }
    });
    const stockIssue = hasStockIssues();
    if (hasError || validatedProducts.size === 0 || stockIssue) {
      setFeedback({ type: 'error', message: t('error_msg') });
      return;
    }

    const lines = orderLines
      .map((line) => {
        const product = validatedProducts.get(line.id);
        if (!product) return null;
        const qty = Math.max(MIN_QTY, line.quantite);
        const unitPriceHT = priceWithRemise(product);
        return {
          name: product.nom,
          reference: product.reference,
          quantity: qty,
          unitPriceHT,
          totalHT: unitPriceHT * qty,
        };
      })
      .filter(Boolean) as {
        name: string;
        reference: string;
        quantity: number;
        unitPriceHT: number;
        totalHT: number;
      }[];

    const subtotalHT = lines.reduce((sum, l) => sum + l.totalHT, 0);
    const tax = subtotalHT * 0.2;
    const totalTTC = subtotalHT + tax;

    const draft = {
      source: 'quick' as const,
      lines,
      totals: {
        subtotalHT,
        tax,
        totalTTC,
        currency: 'EUR' as const,
      },
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('b2bPaymentDraft', JSON.stringify(draft));
    }
    router.push('/pro/paiement');
  };

  const calculateTotal = () => {
    return orderLines.reduce((sum, line) => {
      const product = validatedProducts.get(line.id);
      if (product) {
        const unitPrice = priceWithRemise(product);
        return sum + unitPrice * line.quantite;
      }
      return sum;
    }, 0);
  };

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900 mb-2 flex items-center gap-2">
            <Zap className="w-7 h-7" style={{ color: '#235730' }} />
            {t('title')}
          </h1>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg p-3 text-sm ${feedback.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
            }`}
        >
          {feedback.message}
        </div>
      )}

      {/* References Table */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-gray-900 mb-3">{t('common_refs')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg-grid-cols-6 gap-2 text-sm">
          {loading && <span className="text-gray-500 text-sm">{t('loading') || 'Chargement...'}</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
          {!loading && !error && commonProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg px-3 py-2 text-gray-700 hover:bg-blue-100 transition-colors cursor-pointer"
              onClick={() => handleQuickPick(product)}
            >
              {product.reference}
            </div>
          ))}
        </div>
      </div>

      {/* Order Form */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-gray-900">{t('form_title')}</h2>
            {remise > 0 && (
              <span className="text-sm text-gray-700">
                Remise pro : <span className="font-semibold text-[#235730]">{remise}%</span>
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_ref')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_product')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_price')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_qty')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600">{t('table.col_total')}</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orderLines.map((line) => {
                const product = validatedProducts.get(line.id);
                const isValid = !!product;
                const hasReference = !!line.reference;

                return (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={line.reference}
                        onChange={(e) => updateReference(line.id, e.target.value)}
                        placeholder={t('input_placeholder')}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${hasReference && !isValid
                          ? 'border-red-300 focus:ring-red-500 bg-red-50'
                          : isValid
                            ? 'border-green-300 focus:ring-green-500 bg-green-50'
                            : 'border-gray-200 focus:ring-blue-500'
                          }`}
                      />
                      {hasReference && !isValid && (
                        <p className="text-xs text-red-600 mt-1">{t('invalid_ref')}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isValid ? (
                        <div className="flex items-center gap-2">
                          <Image
                            src={product.image}
                            alt={product.nom}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <span className="text-sm text-gray-900">{product.nom}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isValid ? (
                        <div className="text-sm text-gray-900 space-y-1">
                          {remise > 0 && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatMoney.format(product.prixHT)} {htLabel}
                            </p>
                          )}
                          <p>{formatMoney.format(priceWithRemise(product))} {htLabel}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(line.id, line.quantite - 1)}
                          disabled={line.quantite <= MIN_QTY}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min={MIN_QTY}
                          step={1}
                          value={line.quantite}
                          onChange={(e) => updateQuantity(line.id, parseInt(e.target.value) || MIN_QTY)}
                          className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => updateQuantity(line.id, line.quantite + 1)}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {stockMessages[line.id] && (
                        <p className="text-xs text-red-600 mt-1">{stockMessages[line.id]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isValid ? (
                        <div className="text-sm text-gray-900 space-y-1 text-right">
                          {remise > 0 && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatMoney.format(product.prixHT * line.quantite)} {htLabel}
                            </p>
                          )}
                          <p>
                            {formatMoney.format(priceWithRemise(product) * line.quantite)} {htLabel}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => removeLine(line.id)}
                        disabled={orderLines.length === 1}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={addLine}
              className="flex items-center gap-2 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('add_line')}
            </button>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-600">{t('total_label')}</p>
                <p className="text-2xl text-gray-900">{formatMoney.format(calculateTotal())} {htLabel}</p>
              </div>
              <button
                onClick={goToPaymentPage}
                disabled={validatedProducts.size === 0 || hasStockError}
                className="flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#235730' }}
                onMouseEnter={(e) => validatedProducts.size > 0 && (e.currentTarget.style.backgroundColor = '#1a4023')}
                onMouseLeave={(e) => validatedProducts.size > 0 && (e.currentTarget.style.backgroundColor = '#235730')}
              >
                <ShoppingCart className="w-5 h-5" />
                {t('btn_validate', { count: validatedProducts.size })}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="text-gray-900 mb-2">{t('tips.tip1_title')}</h4>
          <p className="text-sm text-gray-600">
            {t('tips.tip1_desc')}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h4 className="text-gray-900 mb-2">{t('tips.tip2_title')}</h4>
          <p className="text-sm text-gray-600">
            {t('tips.tip2_desc')}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <h4 className="text-gray-900 mb-2">{t('tips.tip3_title')}</h4>
          <p className="text-sm text-gray-600">
            {t('tips.tip3_desc')}
          </p>
        </div>
      </div>
    </div>
    </>
  );
}

