export type NativeRPCMeta = {
  callbackId?: string;
  event?: string;
};

export type NativeRPCRequest = {
  _meta?: NativeRPCMeta;
  method: string;
  service: string;
  params?: Record<string, any> | null;
};

export type NativeRPCResponseData = Record<string, any> | null;

export type NativeRPCResponse = {
  _meta: NativeRPCMeta;
  method: string;
  service: string;
  code: number;
  message?: string;
  data?: NativeRPCResponseData;
};

export type NativeRPCServiceContext = {
  pageUrl?: string;
};

export interface NativeRPCService {
  readonly name: string;
  canHandleMethod(method: string): boolean;
  perform(
    method: string,
    params: Record<string, any> | null | undefined,
    context: NativeRPCServiceContext,
  ): Promise<NativeRPCResponseData>;
}
