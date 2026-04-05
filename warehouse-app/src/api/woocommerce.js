import axios from 'axios';

let apiClient = null;

export const initAPI = (siteUrl, consumerKey, consumerSecret) => {
  const baseURL = `${siteUrl.replace(/\/$/, '')}/wp-json/wc/v3`;

  apiClient = axios.create({
    baseURL,
    auth: {
      username: consumerKey,
      password: consumerSecret,
    },
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return apiClient;
};

export const getAPIClient = () => {
  if (!apiClient) throw new Error('API henüz başlatılmadı. Lütfen önce giriş yapın.');
  return apiClient;
};

// ─── SİPARİŞLER ───────────────────────────────────────────────────────────────

export const getOrders = async (params = {}) => {
  const client = getAPIClient();
  const defaultParams = {
    per_page: 50,
    orderby: 'date',
    order: 'desc',
    ...params,
  };
  const response = await client.get('/orders', { params: defaultParams });
  return response.data;
};

export const getOrder = async (orderId) => {
  const client = getAPIClient();
  const response = await client.get(`/orders/${orderId}`);
  return response.data;
};

export const updateOrderStatus = async (orderId, status, note = '') => {
  const client = getAPIClient();
  const payload = { status };
  if (note) payload.customer_note = note;
  const response = await client.put(`/orders/${orderId}`, payload);
  return response.data;
};

export const addOrderNote = async (orderId, note, isCustomerNote = false) => {
  const client = getAPIClient();
  const response = await client.post(`/orders/${orderId}/notes`, {
    note,
    customer_note: isCustomerNote,
  });
  return response.data;
};

// Sipariş kargo takip numarası ekle (meta_data üzerinden)
export const setTrackingNumber = async (orderId, trackingNumber, carrier) => {
  const client = getAPIClient();
  const response = await client.put(`/orders/${orderId}`, {
    meta_data: [
      { key: '_tracking_number', value: trackingNumber },
      { key: '_tracking_carrier', value: carrier },
    ],
    status: 'completed',
  });
  return response.data;
};

// ─── ÜRÜNLER & STOK ───────────────────────────────────────────────────────────

export const getProducts = async (params = {}) => {
  const client = getAPIClient();
  const defaultParams = { per_page: 100, ...params };
  const response = await client.get('/products', { params: defaultParams });
  return response.data;
};

export const getProduct = async (productId) => {
  const client = getAPIClient();
  const response = await client.get(`/products/${productId}`);
  return response.data;
};

export const getProductBySKU = async (sku) => {
  const client = getAPIClient();
  const response = await client.get('/products', { params: { sku } });
  return response.data[0] || null;
};

export const searchProductByBarcode = async (barcode) => {
  const client = getAPIClient();
  // Önce SKU ile dene
  const bySKU = await client.get('/products', { params: { sku: barcode } });
  if (bySKU.data.length > 0) return bySKU.data[0];

  // Bulunamazsa meta_data'da barkod ara (ACF / custom field)
  const search = await client.get('/products', { params: { search: barcode, per_page: 10 } });
  if (search.data.length > 0) return search.data[0];

  return null;
};

export const updateStock = async (productId, stockQuantity) => {
  const client = getAPIClient();
  const response = await client.put(`/products/${productId}`, {
    stock_quantity: stockQuantity,
    manage_stock: true,
  });
  return response.data;
};

export const updateVariationStock = async (productId, variationId, stockQuantity) => {
  const client = getAPIClient();
  const response = await client.put(`/products/${productId}/variations/${variationId}`, {
    stock_quantity: stockQuantity,
    manage_stock: true,
  });
  return response.data;
};

export const getLowStockProducts = async (threshold = 5) => {
  const client = getAPIClient();
  const response = await client.get('/products', {
    params: {
      stock_status: 'instock',
      per_page: 100,
    },
  });
  return response.data.filter(
    (p) => p.manage_stock && p.stock_quantity !== null && p.stock_quantity <= threshold
  );
};

// ─── KARGO ────────────────────────────────────────────────────────────────────

export const getShipments = async () => {
  const client = getAPIClient();
  const response = await client.get('/orders', {
    params: {
      status: 'processing',
      per_page: 50,
      orderby: 'date',
      order: 'asc',
    },
  });
  return response.data;
};

// ─── İSTATİSTİKLER ────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  const client = getAPIClient();
  const [processing, pending, completed, onHold] = await Promise.all([
    client.get('/orders', { params: { status: 'processing', per_page: 1 } }),
    client.get('/orders', { params: { status: 'pending', per_page: 1 } }),
    client.get('/orders', { params: { status: 'completed', per_page: 1 } }),
    client.get('/orders', { params: { status: 'on-hold', per_page: 1 } }),
  ]);

  return {
    processing: parseInt(processing.headers['x-wp-total'] || 0),
    pending: parseInt(pending.headers['x-wp-total'] || 0),
    completed: parseInt(completed.headers['x-wp-total'] || 0),
    onHold: parseInt(onHold.headers['x-wp-total'] || 0),
  };
};
