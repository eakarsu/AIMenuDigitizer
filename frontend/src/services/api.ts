import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Query params helper
interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  [key: string]: any;
}

function buildParams(params?: ListParams) {
  if (!params) return {};
  const p: any = {};
  if (params.page) p.page = params.page;
  if (params.limit) p.limit = params.limit;
  if (params.search) p.search = params.search;
  if (params.sortBy) p.sortBy = params.sortBy;
  if (params.sortOrder) p.sortOrder = params.sortOrder;
  // Pass through any filter_ params
  Object.keys(params).forEach(key => {
    if (key.startsWith('filter_')) p[key] = params[key];
  });
  return p;
}

// API functions
export const menuApi = {
  getAll: (params?: ListParams) => api.get('/api/menus', { params: buildParams(params) }),
  getById: (id: number) => api.get(`/api/menus/${id}`),
  create: (data: any) => api.post('/api/menus', data),
  update: (id: number, data: any) => api.put(`/api/menus/${id}`, data),
  delete: (id: number) => api.delete(`/api/menus/${id}`),
  bulkDelete: (ids: number[]) => api.delete('/api/menus/bulk', { data: { ids } }),
  bulkUpdate: (ids: number[], updates: any) => api.put('/api/menus/bulk', { ids, updates }),

  // Menu items
  getItem: (menuId: number, itemId: number) => api.get(`/api/menus/${menuId}/items/${itemId}`),
  createItem: (menuId: number, data: any) => api.post(`/api/menus/${menuId}/items`, data),
  updateItem: (menuId: number, itemId: number, data: any) => api.put(`/api/menus/${menuId}/items/${itemId}`, data),
  deleteItem: (menuId: number, itemId: number) => api.delete(`/api/menus/${menuId}/items/${itemId}`),
};

export const allergenApi = {
  getByMenu: (menuId: number, params?: ListParams) => api.get(`/api/allergens/menu/${menuId}`, { params: buildParams(params) }),
  getByItem: (itemId: number) => api.get(`/api/allergens/item/${itemId}`),
  create: (data: any) => api.post('/api/allergens', data),
  update: (id: number, data: any) => api.put(`/api/allergens/${id}`, data),
  delete: (id: number) => api.delete(`/api/allergens/${id}`),
  bulkDelete: (ids: number[]) => api.delete('/api/allergens/bulk', { data: { ids } }),
  bulkUpdate: (ids: number[], updates: any) => api.put('/api/allergens/bulk', { ids, updates }),
};

export const nutritionApi = {
  getByMenu: (menuId: number, params?: ListParams) => api.get(`/api/calories/menu/${menuId}`, { params: buildParams(params) }),
  getByItem: (itemId: number) => api.get(`/api/calories/item/${itemId}`),
  create: (data: any) => api.post('/api/calories', data),
  update: (id: number, data: any) => api.put(`/api/calories/${id}`, data),
  delete: (id: number) => api.delete(`/api/calories/${id}`),
  bulkDelete: (ids: number[]) => api.delete('/api/calories/bulk', { data: { ids } }),
  bulkUpdate: (ids: number[], updates: any) => api.put('/api/calories/bulk', { ids, updates }),
};

export const translationApi = {
  getByMenu: (menuId: number, params?: ListParams) => api.get(`/api/translations/menu/${menuId}`, { params: buildParams(params) }),
  getByItem: (itemId: number) => api.get(`/api/translations/item/${itemId}`),
  getLanguages: () => api.get('/api/translations/languages'),
  create: (data: any) => api.post('/api/translations', data),
  update: (id: number, data: any) => api.put(`/api/translations/${id}`, data),
  delete: (id: number) => api.delete(`/api/translations/${id}`),
  bulkDelete: (ids: number[]) => api.delete('/api/translations/bulk', { data: { ids } }),
  bulkUpdate: (ids: number[], updates: any) => api.put('/api/translations/bulk', { ids, updates }),
};

export const aiApi = {
  analyzeImage: (imageBase64: string, menuId?: number) =>
    api.post('/api/ai/analyze-image', { imageBase64, menuId }),
  analyzeText: (menuText: string, menuId?: number) =>
    api.post('/api/ai/analyze-text', { menuText, menuId }),
  detectAllergens: (itemName: string, description: string, menuItemId?: number) =>
    api.post('/api/ai/detect-allergens', { itemName, description, menuItemId }),
  estimateCalories: (itemName: string, description: string, menuItemId?: number) =>
    api.post('/api/ai/estimate-calories', { itemName, description, menuItemId }),
  translate: (itemName: string, description: string, targetLanguage: string, menuItemId?: number) =>
    api.post('/api/ai/translate', { itemName, description, targetLanguage, menuItemId }),
  optimizePrice: (itemName: string, description: string, currentPrice: number, category: string, menuItemId?: number) =>
    api.post('/api/ai/optimize-price', { itemName, description, currentPrice, category, menuItemId }),
  getPriceSuggestions: (menuId: number) => api.get(`/api/ai/price-suggestions/menu/${menuId}`),
  deletePriceSuggestion: (id: number) => api.delete(`/api/ai/price-suggestions/${id}`),
  recommendDishes: (menuId: number, preferences: string, dietaryRestrictions: string, mealType: string, budget: string) =>
    api.post('/api/ai/recommend-dishes', { menuId, preferences, dietaryRestrictions, mealType, budget }),
  getRecommendations: (menuId: number) => api.get(`/api/ai/recommendations/menu/${menuId}`),
  deleteRecommendation: (id: number) => api.delete(`/api/ai/recommendations/${id}`),
  analyzeNutritionHealthcare: (itemName: string, description: string, healthConditions: string, menuItemId?: number) =>
    api.post('/api/ai/nutrition-healthcare', { itemName, description, healthConditions, menuItemId }),
  getHistory: (type?: string) => api.get('/api/ai/history', { params: { type } }),
};

export const authApi = {
  getDemoCredentials: () => api.get('/api/auth/demo-credentials'),
  logout: () => api.post('/api/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/api/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { token, newPassword }),
  verifyEmail: (token: string) => api.get(`/api/auth/verify-email/${token}`),
  resendVerification: () => api.post('/api/auth/resend-verification'),
  getProfile: () => api.get('/api/auth/profile'),
  updateProfile: (data: { name?: string; email?: string }) => api.put('/api/auth/profile', data),
};

export const exportApi = {
  csv: (type: string, menuId?: number) =>
    api.get(`/api/export/csv/${type}`, {
      params: menuId ? { menuId } : {},
      responseType: 'blob',
    }),
  pdf: (type: string, menuId?: number) =>
    api.get(`/api/export/pdf/${type}`, {
      params: menuId ? { menuId } : {},
      responseType: 'blob',
    }),
};
