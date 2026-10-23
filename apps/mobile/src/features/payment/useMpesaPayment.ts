// apps/mobile/src/features/payment/useMpesaPayment.ts
import { useState } from 'react';
import apiClient from '../../api/apiClient';
import { usePaymentStore } from './paymentStore';

export const useMpesaPayment = () => {
  const { addPayment, updatePaymentStatus } = usePaymentStore();
  const [loading, setLoading] = useState(false);

  const payWithMpesa = async (order_id: string, phone_number: string, amount: number) => {
    setLoading(true);

    try {
      const res = await apiClient.post('/payment/mpesa', {
        order_id,
        phone_number,
        amount,
      });

      addPayment({
        order_id,
        amount,
        status: 'pending',
        payment_method: 'mpesa',
      });

      return res.data;
    } catch (error: any) {
      console.error('M-Pesa failed', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { payWithMpesa, loading };
};