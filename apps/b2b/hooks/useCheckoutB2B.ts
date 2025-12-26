'use client';

import { addDoc, collection, db, doc, runTransaction } from '@mishki/firebase';
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

type ShippingInfoB2B = {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  contactName?: string | null;
  deliveryType?: string | null;
};

type CreateOrderAndPaymentParams = {
  user?: B2BUser | null;
  lines: CheckoutLine[];
  totals: Totals;
  paymentProvider: 'paypal' | 'card';
  paymentId?: string | null;
  status?: 'payee' | 'en_attente' | 'retard';
  shipping?: ShippingInfoB2B;
};

export function useCheckoutB2B() {
  const createOrderAndPayment = useCallback(
    async ({ user, lines, totals, paymentProvider, paymentId = null, status = 'payee', shipping }: CreateOrderAndPaymentParams) => {
      // Vérifier stock et décrémenter via transaction
      await runTransaction(db, async (trx) => {
        // Lire tous les stocks avant toute écriture (contrainte Firestore transactions).
        const stockSnapshots = await Promise.all(
          lines.map(async (l) => {
            if (!l.reference) return null;
            const ref = doc(db, 'products', l.reference);
            const snap = await trx.get(ref);
            return { line: l, ref, snap };
          })
        );

        // Validation stocks
        for (const entry of stockSnapshots) {
          if (!entry || !entry.snap.exists()) continue;
          const data = entry.snap.data() as { stock?: number };
          if (typeof data.stock === 'number' && data.stock < entry.line.quantity) {
            throw new Error(`Stock insuffisant pour ${entry.line.reference}`);
          }
        }

        // Ecritures après validation
        for (const entry of stockSnapshots) {
          if (!entry || !entry.snap.exists()) continue;
          const data = entry.snap.data() as { stock?: number };
          if (typeof data.stock === 'number') {
            trx.update(entry.ref, { stock: data.stock - entry.line.quantity });
          }
        }
      });

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
        shipping: shipping ?? null,
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
        shipping: shipping ?? null,
      });

      return orderDoc.id;
    },
    []
  );

  return { createOrderAndPayment };
}
