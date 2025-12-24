'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadScript, PayPalNamespace, type PayPalButtonsComponent } from '@paypal/paypal-js';

type PaypalButtonProps = {
  amount: number;
  currency?: 'EUR' | 'USD' | 'GBP' | 'PEN';
  disabled?: boolean;
  className?: string;
  onSuccess?: (payload: { orderId?: string; details?: unknown }) => void;
  onError?: (message: string) => void;
};

export default function PaypalButton({
  amount,
  currency = 'EUR',
  disabled,
  className,
  onSuccess,
  onError,
}: PaypalButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderedRef = useRef(false);
  const retryRef = useRef(false);
  const paypalPromise = useMemo<Promise<PayPalNamespace | null> | null>(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      const msg = 'NEXT_PUBLIC_PAYPAL_CLIENT_ID manquant';
      setError(msg);
      onError?.(msg);
      return null;
    }
    return loadScript({ clientId, currency });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  useEffect(() => {
    if (disabled) return;
    let paypal: PayPalNamespace | null = null;
    let isMounted = true;
    let buttons: PayPalButtonsComponent | null = null;
    const containerEl = containerRef.current;

    const renderButtons = async () => {
      if (!paypalPromise || !containerEl) return;
      // reset container to avoid stale zoid iframes on remount
      containerEl.innerHTML = '';
      renderedRef.current = false;
      setLoading(true);
      try {
        paypal = await paypalPromise;
        if (!paypal || !isMounted || !containerEl) return;
        const Buttons = paypal.Buttons;
        const funding = paypal.FUNDING?.PAYPAL;
        if (!Buttons) {
          const msg = 'PayPal Buttons non disponibles';
          setError(msg);
          onError?.(msg);
          return;
        }
        buttons =
          Buttons({
            style: { layout: 'vertical', shape: 'rect', color: 'gold' },
            fundingSource: funding,
            createOrder: (_, actions) => {
              return actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [
                  {
                    amount: {
                      currency_code: currency,
                      value: amount.toFixed(2),
                    },
                  },
                ],
              });
            },
            onApprove: async (_, actions) => {
              try {
                const details = await actions.order?.capture?.();
                onSuccess?.({ orderId: details?.id, details });
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Erreur capture PayPal';
                setError(msg);
                onError?.(msg);
              }
            },
            onError: (err) => {
              const msg = err instanceof Error ? err.message : 'Erreur PayPal';
              setError(msg);
              onError?.(msg);
            },
            onCancel: () => {
              setError(null);
            },
          }) || null;
        if (buttons) {
          try {
            await buttons.render(containerEl);
            renderedRef.current = true;
          } catch (renderErr) {
            const msg = renderErr instanceof Error ? renderErr.message : 'Erreur de rendu PayPal';
            const isZoid = msg.toLowerCase().includes('zoid destroyed all components');
            if (isZoid && !retryRef.current) {
              retryRef.current = true;
              setTimeout(() => {
                retryRef.current = false;
                renderButtons();
              }, 0);
            } else if (!isZoid) {
              setError(msg);
              onError?.(msg);
            }
            return;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur de chargement PayPal';
        setError(msg);
        onError?.(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    renderButtons();

    return () => {
      isMounted = false;
      if (buttons) {
        buttons.close?.();
      }
      renderedRef.current = false;
      if (containerEl) {
        containerEl.innerHTML = '';
      }
    };
  }, [amount, currency, paypalPromise, onError, onSuccess, disabled]);

  return (
    <div className={className}>
      <div ref={containerRef} className={disabled ? 'pointer-events-none opacity-60' : undefined} />
      {disabled && <p className="text-xs text-gray-400 mt-2">PayPal désactivé</p>}
      {loading && !disabled && <p className="text-xs text-gray-500 mt-2">Chargement PayPal...</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
