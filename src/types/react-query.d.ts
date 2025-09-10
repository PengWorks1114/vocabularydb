declare module "@tanstack/react-query" {
  import { ReactNode } from "react";
  export class QueryClient {
    constructor(options?: unknown);
  }
  export interface UseQueryResult<TData = unknown> {
    data?: TData;
    error?: unknown;
    isLoading: boolean;
    refetch: () => Promise<void>;
  }
  export interface QueryClientProviderProps {
    client: QueryClient;
    children: ReactNode;
  }
  export function QueryClientProvider(
    props: QueryClientProviderProps
  ): JSX.Element;
  export function useQuery<TData = unknown>(
    options: unknown
  ): UseQueryResult<TData>;
}
