export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown[];
  id: number | string;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number | string;
}

export interface RpcDiagnosticResult {
  timestamp: number;
  request: JsonRpcRequest;
  response: JsonRpcResponse | null;
  latency: number | null;
  error: string | null;
  success: boolean;
}

export interface DiagnosticHistoryItem extends RpcDiagnosticResult {
  id: string;
  endpoint: string;
}

export interface RpcMethodPreset {
  name: string;
  method: string;
  params?: unknown[];
  description: string;
}
