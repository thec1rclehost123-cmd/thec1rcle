'use client';

import { useCallback } from 'react';
import { verifyCheckoutPayment } from '../api/checkoutApi';

const RAZORPAY_SCRIPT_ID = 'c1rcle-razorpay-checkout';
let razorpayScriptPromise = null;

function loadRazorpayScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Payment gateway requires a browser.'));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID);
    const script = existingScript || document.createElement('script');
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }
      razorpayScriptPromise = null;
      reject(new Error('Payment gateway loaded without a checkout runtime.'));
    };
    script.onerror = () => {
      razorpayScriptPromise = null;
      script.remove();
      reject(new Error('Failed to load payment gateway'));
    };
    if (!existingScript) document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export function useRazorpayCheckout({
  attendeeDetails,
  eventTitle,
  onPaymentVerified,
  onPaymentError,
  onPaymentCancelled,
  onPaymentStateChange,
  isPaymentPending,
}) {
  return useCallback(
    async (initiateData, checkoutOptions = {}) => {
      const paymentVerifyKey =
        checkoutOptions.paymentVerifyKey || checkoutOptions.paymentAttemptId || null;
      const prefillMethod = ['card', 'upi', 'netbanking', 'wallet', 'emi', 'paylater'].includes(
        checkoutOptions.paymentMethod,
      )
        ? checkoutOptions.paymentMethod
        : undefined;
      if (initiateData?.razorpay?.orderId?.startsWith('order_mock_')) {
        throw new Error('Payment gateway is not configured for this checkout.');
      }
      if (!initiateData?.razorpay?.key) {
        throw new Error('Payment configuration unavailable, please try again.');
      }

      await loadRazorpayScript();

      return new Promise((resolve, reject) => {
        const finishWithError = (error) => {
          onPaymentError?.(error);
          reject(error);
        };

        const razorpayOptions = {
          key: initiateData.razorpay.key,
          amount: initiateData.razorpay.amount,
          currency: initiateData.razorpay.currency,
          name: 'THE C1RCLE',
          description: `Passes for ${eventTitle}`,
          order_id: initiateData.razorpay.orderId,
          handler: async (response) => {
            try {
              onPaymentStateChange?.('verifying');
              await verifyCheckoutPayment(
                {
                  orderId: initiateData.order.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
                paymentVerifyKey
                  ? {
                      headers: {
                        'x-idempotency-key': paymentVerifyKey,
                      },
                    }
                  : undefined,
              );
              await onPaymentVerified?.(initiateData);
              resolve();
            } catch (error) {
              finishWithError(error);
            }
          },
          modal: {
            ondismiss: () => {
              const error = new Error('Payment cancelled');
              onPaymentCancelled?.(error);
              reject(error);
            },
          },
          prefill: {
            name: attendeeDetails.name,
            email: attendeeDetails.email,
            contact: attendeeDetails.phone,
            ...(prefillMethod ? { method: prefillMethod } : {}),
          },
          theme: { color: '#1d1d1f' },
        };

        try {
          const razorpay = new window.Razorpay(razorpayOptions);
          onPaymentStateChange?.('awaiting_payment');

          razorpay.on('payment.failed', (response) => {
            finishWithError(new Error(response.error.description));
          });

          razorpay.open();
        } catch (error) {
          finishWithError(
            new Error('Could not launch payment window. Please disable ad-blockers.'),
          );
        }
      });
    },
    [
      attendeeDetails.email,
      attendeeDetails.name,
      attendeeDetails.phone,
      eventTitle,
      isPaymentPending,
      onPaymentCancelled,
      onPaymentError,
      onPaymentStateChange,
      onPaymentVerified,
    ],
  );
}
