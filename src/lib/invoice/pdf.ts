'use server';

import React from 'react';
import type { ReactElement, ComponentType } from 'react';
import { pdf } from '@react-pdf/renderer';
import InvoiceFR from '@/components/invoice/InvoiceFR';
import InvoicePE from '@/components/invoice/InvoicePE';
import type { InvoiceData } from './types';

function isReadableStream(val: unknown): val is ReadableStream<Uint8Array> {
  return (
    typeof val === 'object' &&
    val !== null &&
    typeof (val as ReadableStream<Uint8Array>).getReader === 'function'
  );
}

function isNodeReadable(val: unknown): val is NodeJS.ReadableStream {
  return (
    typeof val === 'object' &&
    val !== null &&
    typeof (val as NodeJS.ReadableStream).on === 'function' &&
    typeof (val as NodeJS.ReadableStream).once === 'function'
  );
}

async function webStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(merged);
}

async function nodeStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const bufs: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (c) => bufs.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(bufs)));
    stream.on('error', reject);
  });
}

/**
 * Génère un Buffer PDF à partir des composants InvoiceFR/InvoicePE et des données d’une facture.
 * À exécuter côté serveur (utilisé pour pièces jointes email).
 */
export async function generateInvoicePdfBuffer(data: InvoiceData): Promise<Buffer> {
  const Doc: ComponentType<{ data: InvoiceData }> = data.locale === 'pe' ? InvoicePE : InvoiceFR;
  const element: ReactElement = React.createElement(Doc, { data });

  // Utilise toBuffer (promise) sur l'instance pdf(element) et convertit en Buffer
  // @ts-expect-error typings react-pdf vs React 19
  const instance = pdf(element as unknown as ReactElement);
  const raw: Buffer | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | NodeJS.ReadableStream =
    await instance.toBuffer();

  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw));
  if (isReadableStream(raw)) return webStreamToBuffer(raw);
  if (isNodeReadable(raw)) return nodeStreamToBuffer(raw);

  throw new Error('Unsupported PDF buffer response type');
}
