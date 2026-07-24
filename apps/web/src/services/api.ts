import axios from 'axios';

const TOKEN_KEY = 'fhjd_cf_token';
let authExpiredRedirectStarted = false;

export const api = axios.create({
  baseURL: '/api',
});

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;

  const message = (error.response?.data as { message?: string | string[] } | undefined)?.message;
  if (Array.isArray(message)) return message.join('；');
  return message || fallback;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url ?? '');
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest && getToken()) {
      clearToken();
      if (!authExpiredRedirectStarted) {
        authExpiredRedirectStarted = true;
        const params = new URLSearchParams({
          authExpired: '1',
          from: `${window.location.pathname}${window.location.search}`,
        });
        window.location.replace(`/login?${params.toString()}`);
      }
    }

    return Promise.reject(error);
  },
);

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  authExpiredRedirectStarted = false;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasValidToken() {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as { exp?: number };
    const valid = typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    if (!valid) clearToken();
    return valid;
  } catch {
    clearToken();
    return false;
  }
}

function decodeBase64Url(value?: string) {
  if (!value) throw new Error('Invalid token');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export type AdminUser = {
  id: number;
  username: string;
  displayName: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AdminUser;
};

export async function login(username: string, password: string) {
  const response = await api.post<LoginResponse>('/auth/login', { username, password });
  return response.data;
}

export async function getProfile() {
  const response = await api.get<AdminUser>('/admin/profile');
  return response.data;
}

export async function changeAdminPassword(oldPassword: string, newPassword: string) {
  const response = await api.put<{ success: boolean }>('/admin/password', { oldPassword, newPassword });
  return response.data;
}

export type DashboardSummary = {
  total: number;
  inProgress: number;
  finished: number;
  overdue: number;
  byProcess: Array<{
    id: number;
    name: string;
    count: number;
    products?: Array<{
      id: number;
      productName: string;
      productModel: string;
      serialNo?: string;
      status: Product['status'];
      currentEnteredAt?: string;
    }>;
  }>;
};

export type Product = {
  id: number;
  rowNo?: number;
  productName: string;
  productModel: string;
  serialNo?: string;
  quantity: number;
  unit: string;
  remark?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED' | 'OVERDUE';
  currentEnteredAt?: string;
  createdAt?: string;
  updatedAt?: string;
  currentProcess?: {
    id: number;
    name: string;
  } | null;
};

export type FlowRecord = {
  id: number;
  scanContent: string;
  source?: 'SCAN' | 'MANUAL';
  isDuplicate: boolean;
  note?: string;
  scannedAt: string;
  createdAt: string;
  scanner?: {
    id: number;
    code: string;
    name: string;
  } | null;
  operator?: {
    id: number;
    username: string;
    displayName: string;
  } | null;
  processStep?: {
    id: number;
    name: string;
  } | null;
};

export type ProductDrawing = {
  id: number;
  productId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type ProductProcessAttachment = {
  id: number;
  productId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type ProductProcessAttachmentPreview =
  | {
      kind: 'word';
      text: string;
      truncated: boolean;
    }
  | {
      kind: 'excel';
      sheets: Array<{ name: string; rows: string[][] }>;
      truncated: boolean;
    };

export type ProductInput = {
  rowNo?: number;
  productName: string;
  productModel: string;
  serialNo?: string;
  quantity?: number;
  unit?: string;
  remark?: string;
};

export type ProcessStep = {
  id: number;
  name: string;
  sortOrder: number;
  timeoutHours: number;
  enabled: boolean;
  _count?: {
    scanners: number;
    products: number;
  };
};

export type ProcessInput = {
  name: string;
  sortOrder?: number;
  timeoutHours?: number;
  enabled?: boolean;
};

export type Scanner = {
  id: number;
  code: string;
  name: string;
  ipAddress?: string;
  enabled: boolean;
  lastSeenAt?: string;
  processStep?: {
    id: number;
    name: string;
  };
};

export type ScannerInput = {
  code: string;
  name: string;
  ipAddress?: string;
  processStepId: number;
  enabled?: boolean;
};

export type Warning = {
  id: number;
  level: 'OVERDUE';
  status: 'OPEN' | 'HANDLED';
  message: string;
  createdAt: string;
  handledAt?: string;
  product: Product;
  processStep: {
    id: number;
    name: string;
  };
};

export type SystemSettings = {
  screenPreviewDataEnabled: boolean;
};

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<DashboardSummary>;
  return (
    typeof candidate.total === 'number' &&
    typeof candidate.inProgress === 'number' &&
    typeof candidate.finished === 'number' &&
    typeof candidate.overdue === 'number' &&
    Array.isArray(candidate.byProcess)
  );
}

export async function getDashboardSummary() {
  const response = await api.get<DashboardSummary>('/dashboard/summary');
  if (!isDashboardSummary(response.data)) {
    throw new Error('Invalid dashboard summary response');
  }

  return response.data;
}

export async function getProducts(keyword?: string, status?: Product['status'], processId?: number) {
  const response = await api.get<Product[]>('/products', {
    params: {
      ...(keyword ? { keyword } : {}),
      ...(status ? { status } : {}),
      ...(processId ? { processId } : {}),
    },
  });
  return response.data;
}

export async function exportProducts(keyword?: string, status?: Product['status'], processId?: number) {
  const response = await api.get<Blob>('/products/export', {
    params: {
      ...(keyword ? { keyword } : {}),
      ...(status ? { status } : {}),
      ...(processId ? { processId } : {}),
    },
    responseType: 'blob',
  });
  return response.data;
}

export async function getProduct(id: number) {
  const response = await api.get<Product>(`/products/${id}`);
  return response.data;
}

export async function getProductFlows(id: number) {
  const response = await api.get<FlowRecord[]>(`/products/${id}/flows`);
  return response.data;
}

export async function getProductDrawings(id: number) {
  const response = await api.get<ProductDrawing[]>(`/products/${id}/drawings`);
  return response.data;
}

export async function uploadProductDrawing(id: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ProductDrawing>(`/products/${id}/drawings`, formData);
  return response.data;
}

export async function getProductDrawingFile(productId: number, drawingId: number) {
  const response = await api.get<Blob>(`/products/${productId}/drawings/${drawingId}/file`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function deleteProductDrawing(productId: number, drawingId: number) {
  const response = await api.delete<{ success: boolean }>(`/products/${productId}/drawings/${drawingId}`);
  return response.data;
}

export async function getProductProcessAttachments(id: number) {
  const response = await api.get<ProductProcessAttachment[]>(`/products/${id}/process-attachments`);
  return response.data;
}

export async function uploadProductProcessAttachment(id: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ProductProcessAttachment>(`/products/${id}/process-attachments`, formData);
  return response.data;
}

export async function getProductProcessAttachmentPreview(productId: number, attachmentId: number) {
  const response = await api.get<ProductProcessAttachmentPreview>(
    `/products/${productId}/process-attachments/${attachmentId}/preview`,
  );
  return response.data;
}

export async function getProductProcessAttachmentFile(productId: number, attachmentId: number) {
  const response = await api.get<Blob>(`/products/${productId}/process-attachments/${attachmentId}/file`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function deleteProductProcessAttachment(productId: number, attachmentId: number) {
  const response = await api.delete<{ success: boolean }>(
    `/products/${productId}/process-attachments/${attachmentId}`,
  );
  return response.data;
}

export async function createProduct(data: ProductInput) {
  const response = await api.post<Product>('/products', data);
  return response.data;
}

export async function updateProduct(id: number, data: ProductInput) {
  const response = await api.put<Product>(`/products/${id}`, data);
  return response.data;
}

export async function updateProductProcess(id: number, processStepId: number) {
  const response = await api.put<Product>(`/products/${id}/process`, { processStepId });
  return response.data;
}

export async function deleteProduct(id: number) {
  const response = await api.delete<{ success: boolean }>(`/products/${id}`);
  return response.data;
}

export async function getProcesses() {
  const response = await api.get<ProcessStep[]>('/processes');
  return response.data;
}

export async function createProcess(data: ProcessInput) {
  const response = await api.post<ProcessStep>('/processes', data);
  return response.data;
}

export async function updateProcess(id: number, data: ProcessInput) {
  const response = await api.put<ProcessStep>(`/processes/${id}`, data);
  return response.data;
}

export async function deleteProcess(id: number) {
  const response = await api.delete<{ success: boolean }>(`/processes/${id}`);
  return response.data;
}

export async function getScanners() {
  const response = await api.get<Scanner[]>('/scanners');
  return response.data;
}

export async function createScanner(data: ScannerInput) {
  const response = await api.post<Scanner>('/scanners', data);
  return response.data;
}

export async function updateScanner(id: number, data: ScannerInput) {
  const response = await api.put<Scanner>(`/scanners/${id}`, data);
  return response.data;
}

export async function deleteScanner(id: number) {
  const response = await api.delete<{ success: boolean }>(`/scanners/${id}`);
  return response.data;
}

export async function getWarnings() {
  const response = await api.get<Warning[]>('/warnings');
  return response.data;
}

export async function handleWarning(id: number, remark?: string) {
  const response = await api.post<Warning>(`/warnings/${id}/handle`, { remark });
  return response.data;
}

export async function getSettings() {
  const response = await api.get<SystemSettings>('/settings');
  return response.data;
}

export async function getPublicSettings() {
  const response = await api.get<SystemSettings>('/settings/public');
  return response.data;
}

export async function updateSettings(data: SystemSettings) {
  const response = await api.put<SystemSettings>('/settings', data);
  return response.data;
}
