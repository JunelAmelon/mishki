import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { InvoiceData, InvoiceLine } from '@/lib/invoice/types';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', lineHeight: 1.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { marginBottom: 14 },
  title: { fontSize: 15, fontWeight: 700, letterSpacing: 0.3 },
  label: { fontWeight: 700 },
  table: { width: '100%', borderWidth: 0.6, borderColor: '#2e2e2e' },
  th: { fontWeight: 700, padding: 5, borderRightWidth: 0.6, borderBottomWidth: 0.6, backgroundColor: '#f5f5f5' },
  td: { padding: 5, borderRightWidth: 0.6, borderBottomWidth: 0.6 },
  totals: { alignSelf: 'flex-end', width: '62%', borderWidth: 0.6, borderColor: '#2e2e2e' },
  small: { fontSize: 8 },
  metaBox: { padding: 8, borderWidth: 0.6, borderColor: '#2e2e2e', borderRadius: 2, gap: 3 },
  hint: { fontSize: 8, color: '#444' },
  divider: { borderBottomWidth: 0.6, borderColor: '#2e2e2e', marginVertical: 6 },
});

const currency = (value: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value);

const lineDiscount = (line: InvoiceLine) => line.discount ?? 0;

export default function InvoiceFR({ data }: { data: InvoiceData }) {
  const { seller, buyer, lines, totals, payment, issueDate, invoiceNumber, orderNumber } = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.section, styles.row]}>
          <View style={{ width: '55%' }}>
            <Text style={styles.title}>{seller.name}</Text>
            {seller.addressLines.map((l: string, i: number) => (
              <Text key={i}>{l}</Text>
            ))}
            {seller.siret && <Text>Siret : {seller.siret}</Text>}
            {seller.ape && <Text>APE : {seller.ape}</Text>}
            {seller.phone && <Text>Tél : {seller.phone}</Text>}
            {seller.email && <Text>Mail : {seller.email}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end', width: '40%', gap: 4 }}>
            <View style={styles.metaBox}>
              <Text style={styles.label}>FACTURE</Text>
              <Text>Émise le : {issueDate}</Text>
              <Text>N° : {invoiceNumber}</Text>
              {orderNumber && <Text>Commande : {orderNumber}</Text>}
            </View>
            <View style={[styles.metaBox, { alignSelf: 'stretch', marginTop: 4 }]}>
              <Text style={styles.label}>{buyer.name}</Text>
              {buyer.company && <Text>{buyer.company}</Text>}
              {buyer.addressLines.map((l: string, i: number) => (
                <Text key={i}>{l}</Text>
              ))}
              {buyer.phone && <Text>Tél : {buyer.phone}</Text>}
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.table]}>
          <View style={[styles.row, { backgroundColor: '#f2f2f2' }]}>
            <Text style={[styles.th, { width: '8%' }]}>QTE</Text>
            <Text style={[styles.th, { width: '14%' }]}>PU HT €</Text>
            <Text style={[styles.th, { width: '12%' }]}>REMISE</Text>
            <Text style={[styles.th, { width: '18%' }]}>PRIX HT €</Text>
            <Text style={[styles.th, { width: '48%' }]}>DESIGNATION</Text>
          </View>
          {lines.map((line: InvoiceLine, idx: number) => {
            const discount = lineDiscount(line);
            const lineTotal = line.qty * line.unitPrice - discount;
            return (
              <View key={idx} style={styles.row}>
                <Text style={[styles.td, { width: '8%' }]}>{line.qty}</Text>
                <Text style={[styles.td, { width: '14%' }]}>{currency(line.unitPrice, totals.currency)}</Text>
                <Text style={[styles.td, { width: '12%' }]}>{discount ? currency(discount, totals.currency) : '-'}</Text>
                <Text style={[styles.td, { width: '18%' }]}>{currency(lineTotal, totals.currency)}</Text>
                <Text style={[styles.td, { width: '48%' }]}>
                  {line.description}
                  {line.code ? ` (${line.code})` : ''}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.section, { alignItems: 'flex-end' }]}>
          <View style={styles.totals}>
            <View style={[styles.row, { borderBottomWidth: 0.5 }]}>
              <Text style={[styles.td, { width: '60%' }]}>TOTAL HT €</Text>
              <Text style={[styles.td, { width: '40%' }]}>{totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0.5 }]}>
              <Text style={[styles.td, { width: '60%' }]}>TVA</Text>
              <Text style={[styles.td, { width: '40%' }]}>{totals.taxAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.td, { width: '60%', fontWeight: 700 }]}>NET A PAYER €</Text>
              <Text style={[styles.td, { width: '40%', fontWeight: 700 }]}>{totals.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 4 }]}>
          <Text style={styles.label}>Conditions de paiement :</Text>
          <Text>{payment.terms}</Text>
          {buyer.vatId && <Text style={{ marginTop: 4 }}>N° de TVA intracommunautaire : {buyer.vatId}</Text>}
          <Text style={[styles.small, { marginTop: 6 }]}>
            En cas de retard de paiement, des pénalités de retard à hauteur de trois fois le taux d&apos;intérêt légal en
            vigueur, ainsi qu&apos;une indemnité forfaitaire fixée par décret seront appliquées.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
