'use server';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { generateInvoicePdfBuffer } from '@/lib/invoice/pdf';
import type { InvoiceData } from '@/lib/invoice/types';
import { buildInvoiceEmailHtml } from '@/lib/email/templates/invoice';

type RequestPayload = {
  email?: string | null;
  invoiceData?: InvoiceData;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestPayload;
    const to = body.email;
    const invoiceData = body.invoiceData;

    if (!to || !invoiceData) {
      return NextResponse.json({ error: 'Missing email or invoiceData' }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'facturation@mishki.com';

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'SMTP configuration is missing' }, { status: 500 });
    }

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);
    const subject = `Votre facture ${invoiceData.invoiceNumber || invoiceData.orderNumber || ''}`.trim();
    const ctaHref =
      invoiceData.buyer.company && invoiceData.buyer.company.trim().length > 0
        ? 'https://mishki.com/pro/accueil'
        : 'https://mishki.com/';

    const html = await buildInvoiceEmailHtml({
      customerName: invoiceData.buyer.name,
      orderId: invoiceData.orderNumber || invoiceData.invoiceNumber,
      total: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoiceData.totals.currency }).format(
        invoiceData.totals.total
      ),
      invoiceNumber: invoiceData.invoiceNumber,
      ctaHref,
    });

    await transport.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
      attachments: [
        {
          filename: `${invoiceData.invoiceNumber || 'facture'}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('invoice-email POST error', error);
    return NextResponse.json({ error: 'Failed to send invoice email' }, { status: 500 });
  }
}
