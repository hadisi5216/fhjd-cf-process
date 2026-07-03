import axios from 'axios';

const TOKEN_KEY = 'fhjd_cf_token';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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

export async function getProduct(id: number) {
  const response = await api.get<Product>(`/products/${id}`);
  return response.data;
}

export async function getProductFlows(id: number) {
  const response = await api.get<FlowRecord[]>(`/products/${id}/flows`);
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
