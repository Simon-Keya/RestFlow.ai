// apps/mobile/src/hooks/useApi.ts
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import type { ApiResponse } from '../types/api';

export const useApiQuery = <T>(
  key: string[],
  url: string,
  options?: UseQueryOptions<ApiResponse<T>>,
) => {
  return useQuery<ApiResponse<T>>({
    queryKey: key,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<T>>(url);
      return res.data;
    },
    ...options,
  });
};

export const useApiMutation = <T, V = any>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  options?: UseMutationOptions<ApiResponse<T>, unknown, V>,
) => {
  return useMutation<ApiResponse<T>, unknown, V>({
    mutationFn: async (variables: V) => {
      const res = await apiClient({
        url,
        method,
        data: variables,
      });
      return res.data;
    },
    ...options,
  });
};