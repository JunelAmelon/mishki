'use server';

type InvoiceEmailTemplateParams = {
  customerName: string;
  orderId: string;
  total: string;
  invoiceNumber: string;
  ctaHref?: string;
};

/**
 * Template HTML simple aux couleurs Mishki (#235730).
 */
export async function buildInvoiceEmailHtml({
  customerName,
  orderId,
  total,
  invoiceNumber,
  ctaHref,
}: InvoiceEmailTemplateParams): Promise<string> {
  const primary = '#235730';
  const muted = '#4b5563';
  const bg = '#f8fafc';

  return `
  <!doctype html>
  <html lang="fr">
    <body style="margin:0;padding:0;background:${bg};font-family:Arial,Helvetica,sans-serif;color:${muted};">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:32px 0;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.06);">
              <tr>
                <td style="background:${primary};color:#ffffff;padding:24px 28px;font-size:20px;font-weight:700;letter-spacing:0.2px;">
                  MISHKI — Facture ${invoiceNumber}
                </td>
              </tr>
              <tr>
                <td style="padding:24px 28px;">
                  <p style="margin:0 0 12px 0;font-size:14px;">Bonjour ${customerName},</p>
                  <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">
                    Merci pour votre commande <strong>${orderId}</strong>. Vous trouverez la facture en pièce jointe.<br />
                    Montant total : <strong style="color:${primary};font-size:16px;">${total}</strong>
                  </p>
                  ${ctaHref ? `<div style="margin:24px 0;">
                    <a href="${ctaHref}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Accéder à mon espace pro</a>
                  </div>` : ''}
                  <p style="margin:0;font-size:13px;color:${muted};line-height:1.6;">
                    Si vous avez la moindre question, répondez simplement à cet email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 28px 24px 28px;font-size:12px;color:${muted};background:#f4f5f7;">
                  <p style="margin:0 0 6px 0;"><strong>MISHKI LAB</strong> — 5 Rue du Printemps, 88000 Jeuxey, France</p>
                  <p style="margin:0;">facturation@mishki.com</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}
