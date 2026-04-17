import axios from 'axios';

const BASE_URL = 'https://api.geliver.io/api/v1';

let client = null;

export const initGeliver = (token) => {
  client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
  });
};

export const hasGeliver = () => !!client;

// Sipariş verisinden Geliver gönderi oluştur, fiyat teklifleri gelir
export const createShipment = async ({ senderAddressID, order, dims }) => {
  if (!client) throw new Error('Geliver token girilmedi.');
  const s = order.shipping;
  const b = order.billing;

  const payload = {
    senderAddressID,
    recipientAddress: {
      name: `${s.first_name || b.first_name} ${s.last_name || b.last_name}`.trim(),
      phone: b.phone || '',
      address1: s.address_1 || b.address_1,
      countryCode: s.country || 'TR',
      cityCode: s.state || s.city,
      districtName: s.city,
    },
    length: String(dims.length),
    width: String(dims.width),
    height: String(dims.height),
    distanceUnit: 'cm',
    weight: String(dims.weight),
    massUnit: 'kg',
    order: {
      orderNumber: String(order.number),
      sourceIdentifier: `wc-${order.id}`,
      totalAmount: parseFloat(order.total),
      totalAmountCurrency: order.currency || 'TRY',
    },
  };

  const res = await client.post('/shipments', payload);
  return res.data; // { id, offers: [{id, provider, price, currency}], ... }
};

// Seçilen teklifi onayla → kargo etiketi oluşturulur
export const acceptOffer = async (offerId) => {
  if (!client) throw new Error('Geliver token girilmedi.');
  const res = await client.post(`/offers/${offerId}/accept`);
  return res.data; // { trackingNumber, labelURL, responsiveLabelURL, ... }
};

export const getShipment = async (shipmentId) => {
  if (!client) throw new Error('Geliver token girilmedi.');
  const res = await client.get(`/shipments/${shipmentId}`);
  return res.data;
};

export const trackingUrl = (shipmentId) =>
  `https://app.geliver.io/shipments/${shipmentId}`;
