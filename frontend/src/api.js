import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export async function getPublicConfig() {
  const { data } = await api.get('/config/public');
  return data;
}

export async function getAdminConfig(adminUsername) {
  const { data } = await api.get(`/admin/config?adminUsername=${encodeURIComponent(adminUsername)}`);
  return data;
}

export async function saveAdminConfig(adminUsername, config) {
  const { data } = await api.post('/admin/config', { adminUsername, ...config });
  return data;
}

export async function loginUser(username, password) {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
}

export async function searchUsers(q) {
  const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
  return data;
}

export async function getAssetByTag(tag) {
  const { data } = await api.get(`/assets/bytag/${encodeURIComponent(tag)}`);
  return data;
}

export async function checkoutAsset(id, userId, expectedCheckin, assetInfo, userName, note) {
  const { data } = await api.post(`/assets/${id}/checkout`, {
    userId,
    expectedCheckin,
    note: note || undefined,
    assetName: assetInfo?.name || assetInfo?.asset_tag || '',
    assetModel: assetInfo?.model?.name || '',
    serial: assetInfo?.serial || '',
    userName: userName || '',
  });
  return data;
}

export async function checkinAsset(id, assetInfo, userName, note) {
  const { data } = await api.post(`/assets/${id}/checkin`, {
    note: note || undefined,
    assetName: assetInfo?.name || assetInfo?.asset_tag || '',
    assetModel: assetInfo?.model?.name || '',
    serial: assetInfo?.serial || '',
    userName: userName || '',
  });
  return data;
}

export async function getUserCheckouts(userId) {
  const { data } = await api.get(`/users/${userId}/checkouts`);
  return data;
}

export async function getActivityLog(adminUsername) {
  const { data } = await api.get(`/admin/activity?adminUsername=${encodeURIComponent(adminUsername)}`);
  return data;
}

export async function testAcsConnection(adminUsername) {
  const { data } = await api.post('/acs/test', { adminUsername });
  return data;
}

export async function setupAcsSource(adminUsername) {
  const { data } = await api.post('/acs/setup-source', { adminUsername });
  return data;
}

export async function verifyAcsSource(adminUsername) {
  const { data } = await api.post('/acs/verify', { adminUsername });
  return data;
}

export async function probeAcsFields(adminUsername) {
  const { data } = await api.post('/acs/probe', { adminUsername });
  return data;
}

export async function uploadAssetImage(id, file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post(`/assets/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
