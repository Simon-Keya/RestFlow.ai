// apps/mobile/src/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    return () => unsubscribe();
  }, []);

  return {
    isOnline,
    isInternetReachable,
    isFullyOnline: isOnline && isInternetReachable,
  };
};