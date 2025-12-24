'use client';

import { addDoc, collection, db } from '@mishki/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useCallback } from 'react';

type B2BUser = {
  id?: string | null;
  email?: string | null;
  nom?: string | null;
  prenom?: string | null;
  societe?: string | null;
  siret?: string | null;
  remise?: number | null;
};

type CheckoutLine = {
  name: string;
  reference?: string;
  quantity: number;
  unitPriceHT: number;
  totalHT?: number;
};

type Totals = {
  subtotalHT: number;
  tax: number;
  totalTTC: number;
  currency: string;
};

type CreateOrderAndPaymentParams = {
  user?: B2BUser | null;
  lines: CheckoutLine[];
  totals: Totals;
  paymentProvider: 'paypal' | 'card';
  paymentId?: string | null;
  status?: 'payee' | 'en_attente' | 'retard';
};

export function useCheckoutB2B() {
  const createOrderAndPayment = useCallback(
    async ({ user, lines, totals, paymentProvider, paymentId = null, status = 'payee' }: CreateOrderAndPaymentParams) => {
      const orderDoc = await addDoc(collection(db, 'orders'), {
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        userSociete: user?.societe ?? null,
        userSiret: user?.siret ?? null,
        userNom: user?.nom ?? null,
        userPrenom: user?.prenom ?? null,
        userRemise: user?.remise ?? null,
        createdAt: serverTimestamp(),
        lines: lines.map((l) => ({
          name: l.name,
          reference: l.reference,
          quantity: l.quantity,
          unitPriceHT: l.unitPriceHT,
          totalHT: l.totalHT ?? l.unitPriceHT * l.quantity,
        })),
        amountHT: totals.subtotalHT,
        tax: totals.tax,
        amountTTC: totals.totalTTC,
        currency: totals.currency,
        paymentStatus: status,
        paymentProvider,
        paymentId,
      });

      await addDoc(collection(db, 'payments'), {
        orderId: orderDoc.id,
        userId: user?.id ?? null,
        amountHT: totals.subtotalHT,
        tax: totals.tax,
        amountTTC: totals.totalTTC,
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
