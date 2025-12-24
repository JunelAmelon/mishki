import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { InvoiceData, InvoiceLine } from '@/lib/invoice/types';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9.5, fontFamily: 'Helvetica', lineHeight: 1.35 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { marginBottom: 14 },
  titleBox: {
    borderWidth: 0.8,
    borderColor: '#1f1f1f',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    width: 190,
    gap: 3,
  },
  bold: { fontWeight: 700 },
  label: { fontWeight: 700 },
  table: { width: '100%', borderWidth: 0.6, borderColor: '#2e2e2e' },
  th: {
    fontWeight: 700,
    padding: 5,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    backgroundColor: '#f5f5f5',
  },
  td: { padding: 5, borderRightWidth: 0.6, borderBottomWidth: 0.6 },
  totals: { alignSelf: 'flex-end', width: '55%', borderWidth: 0.6, borderColor: '#2e2e2e' },
  note: { fontSize: 8, marginTop: 8, color: '#444' },
  metaBox: { padding: 8, borderWidth: 0.6, borderColor: '#2e2e2e', borderRadius: 2, gap: 3 },
});

const currency = (value: number, currency: string) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(value);

export default function InvoicePE({ data }: { data: InvoiceData }) {
  const { seller, buyer, lines, totals, payment, issueDate, invoiceNumber, serie, dueDate } = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.section, styles.row]}>
          <View style={{ width: '58%' }}>
            <Text style={[styles.bold, { marginBottom: 4, fontSize: 11 }]}>{seller.name}</Text>
            {seller.addressLines.map((l: string, i: number) => (
              <Text key={i}>{l}</Text>
            ))}
            {seller.ruc && <Text>RUC : {seller.ruc}</Text>}
            {seller.email && <Text>{seller.email}</Text>}
          </View>
          <View style={styles.titleBox}>
            <Text style={[styles.bold, { fontSize: 11 }]}>FACTURA ELECTRÓNICA</Text>
            {seller.ruc && <Text>RUC: {seller.ruc}</Text>}
            <Text>{serie ?? ''}</Text>
            <Text style={[styles.bold, { fontSize: 12 }]}>{invoiceNumber}</Text>
          </View>
        </View>

        <View style={[styles.section, styles.row]}>
          <View style={{ width: '60%' }}>
            <View style={[styles.metaBox, { alignSelf: 'stretch' }]}>
              <Text style={styles.bold}>Señor(es)</Text>
              <Text>{buyer.name}</Text>
              {buyer.ruc && <Text>RUC: {buyer.ruc}</Text>}
              {buyer.addressLines.map((l: string, i: number) => (
                <Text key={i}>{l}</Text>
              ))}
            </View>
          </View>
          <View style={{ width: '36%', gap: 3 }}>
            <View style={styles.metaBox}>
              <Text>Fecha de Emisión: {issueDate}</Text>
              {dueDate && <Text>Vencimiento: {dueDate}</Text>}
              <Text>Tipo de Moneda: {totals.currency === 'PEN' ? 'SOLES' : totals.currency}</Text>
              <Text>Formato de Pago: {payment.terms}</Text>
            </View>
          </View>
        </View>

        {payment.installments && payment.installments.length > 0 && (
          <View style={[styles.section, { borderWidth: 0.5, padding: 6 }]}>
            <Text style={styles.bold}>INFORMACIÓN DEL CRÉDITO</Text>
            <Text>
              Monto neto pendiente de pago {currency(totals.total, totals.currency)} - Total de cuotas:{' '}
              {payment.installments.length}
            </Text>
            <View style={[styles.table, { marginTop: 6 }]}>
              <View style={[styles.row, { backgroundColor: '#f2f2f2' }]}>
                <Text style={[styles.th, { width: '20%' }]}>Cuota</Text>
                <Text style={[styles.th, { width: '40%' }]}>Monto Cuota</Text>
                <Text style={[styles.th, { width: '40%' }]}>Fecha Vencimiento</Text>
              </View>
              {payment.installments.map((c: { amount: number; dueDate: string }, idx: number) => (
                <View key={idx} style={styles.row}>
                  <Text style={[styles.td, { width: '20%' }]}>{idx + 1}</Text>
                  <Text style={[styles.td, { width: '40%' }]}>{currency(c.amount, totals.currency)}</Text>
                  <Text style={[styles.td, { width: '40%' }]}>{c.dueDate}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.section, styles.table]}>
          <View style={[styles.row, { backgroundColor: '#f2f2f2' }]}>
            <Text style={[styles.th, { width: '10%' }]}>Cantidad</Text>
            <Text style={[styles.th, { width: '15%' }]}>Unidad</Text>
            <Text style={[styles.th, { width: '15%' }]}>Código</Text>
            <Text style={[styles.th, { width: '40%' }]}>Descripción</Text>
            <Text style={[styles.th, { width: '20%' }]}>Valor Unitario</Text>
          </View>
          {lines.map((line: InvoiceLine, idx: number) => (
            <View key={idx} style={styles.row}>
              <Text style={[styles.td, { width: '10%' }]}>{line.qty.toFixed(2)}</Text>
              <Text style={[styles.td, { width: '15%' }]}>{line.unit}</Text>
              <Text style={[styles.td, { width: '15%' }]}>{line.code ?? ''}</Text>
              <Text style={[styles.td, { width: '40%' }]}>{line.description}</Text>
              <Text style={[styles.td, { width: '20%' }]}>{currency(line.unitPrice, totals.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, styles.totals]}>
          <View style={[styles.row, { borderBottomWidth: 0.5 }]}>
            <Text style={[styles.td, { width: '60%' }]}>Sub Total Ventas :</Text>
            <Text style={[styles.td, { width: '40%' }]}>{currency(totals.subtotal, totals.currency)}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0.5 }]}>
            <Text style={[styles.td, { width: '60%' }]}>Descuentos :</Text>
            <Text style={[styles.td, { width: '40%' }]}>{currency(totals.discount ?? 0, totals.currency)}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0.5 }]}>
            <Text style={[styles.td, { width: '60%' }]}>{totals.taxLabel} :</Text>
            <Text style={[styles.td, { width: '40%' }]}>{currency(totals.taxAmount, totals.currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.td, { width: '60%', fontWeight: 700 }]}>Importe Total :</Text>
            <Text style={[styles.td, { width: '40%', fontWeight: 700 }]}>{currency(totals.total, totals.currency)}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          Esta es una representación impresa de la factura electrónica, generada por el sistema.
        </Text>
      </Page>
    </Document>
  );
}
