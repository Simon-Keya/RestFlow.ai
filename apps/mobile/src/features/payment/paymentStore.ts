// apps/mobile/src/features/payment/paymentStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PaymentRecord = {
  order_id: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  payment_method: 'mpesa' | 'stripe' | 'cash';
  transaction_id?: string;
  timestamp: string;
};

interface PaymentState {
  payments: PaymentRecord[];
  currentPayment: PaymentRecord | null;

  addPayment: (payment: Omit<PaymentRecord, 'timestamp'>) => void;
  updatePaymentStatus: (order_id: string, status: 'success' | 'failed', transaction_id?: string) => void;
  clearPayments: () => void;
}

export const usePaymentStore = create<PaymentState>()(
  persist(
    (set) => ({
      payments: [],
      currentPayment: null,

      addPayment: (payment) => {
        const newPayment: PaymentRecord = {
          ...payment,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          payments: [newPayment, ...state.payments],
          currentPayment: newPayment,
        }));
      },

      updatePaymentStatus: (order_id, status, transaction_id) => {
        set((state) => ({
          payments: state.payments.map((p) =>
            p.order_id === order_id
              ? { ...p, status, transaction_id }
              : p
          ),
          currentPayment: state.currentPayment?.order_id === order_id
            ? { ...state.currentPayment, status, transaction_id }
            : state.currentPayment,
        }));
      },

      clearPayments: () => set({ payments: [], currentPayment: null }),
    }),
    {
      name: 'restflow-payments',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);