'use client';

import { addDoc, collection, db } from '@mishki/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useCallback } from 'react';

type CheckoutLine = {
  name: string;
  quantity: number;
  price: number;
  slug?: string;
};

type Totals = {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
};

type CreateOrderAndPaymentParams = {
  userId?: string | null;
  lines: CheckoutLine[];
  totals: Totals;
  paymentProvider: 'paypal' | 'card';
  paymentId?: string | null;
  status?: 'payee' | 'en_attente' | 'retard';
};

export function useCheckout() {
  const createOrderAndPayment = useCallback(
    async ({ userId = null, lines, totals, paymentProvider, paymentId = null, status = 'payee' }: CreateOrderAndPaymentParams) => {
      const orderDoc = await addDoc(collection(db, 'orders'), {
        userId,
        createdAt: serverTimestamp(),
        lines: lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          slug: l.slug,
          price: l.price,
        })),
        amountHT: totals.subtotal,
        amountTTC: totals.total,
        currency: totals.currency,
        paymentStatus: status,
        paymentProvider,
        paymentId,
      });

      await addDoc(collection(db, 'payments'), {
        orderId: orderDoc.id,
        amountHT: totals.subtotal,
        amountTTC: totals.total,
        tax: totals.tax,
        currency: totals.currency,
        status,
        provider: paymentProvider,
        paymentId,
        createdAt: serverTimestamp(),
      });

      return orderDoc.id;
    },
    []
  );

  return { createOrderAndPayment };
}
