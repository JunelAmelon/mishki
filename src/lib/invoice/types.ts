export type InvoiceLocale = 'fr' | 'pe';

export type InvoiceLine = {
  qty: number;
  unit: string;
  code?: string;
  description: string;
  unitPrice: number; // HT en FR, TTC ou HT selon usage PE
  discount?: number; // montant
};

export type InvoiceParty = {
  name: string;
  addressLines: string[];
  city?: string;
  contact?: string;
  email?: string;
  phone?: string;
  ruc?: string; // PE
  siret?: string; // FR
  ape?: string; // FR
  vatId?: string; // FR intracom
};

export type InvoiceTotals = {
  subtotal: number;
  discount?: number;
  taxLabel: string; // TVA / IGV
  taxAmount: number;
  total: number;
  currency: 'EUR' | 'PEN';
};

export type InvoicePayment = {
  terms: string; // Virement / Contado / Crédito
  method?: string;
  installments?: { amount: number; dueDate: string }[];
};

export type InvoiceData = {
  locale: InvoiceLocale;
  invoiceNumber: string;
  orderNumber?: string;
  issueDate: string;
  dueDate?: string;
  buyer: InvoiceParty;
  seller: InvoiceParty;
  payment: InvoicePayment;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  currencyLabel?: string; // ex. SOL / €
  serie?: string; // ex. E001-1680 pour PE
  notes?: string[];
};
