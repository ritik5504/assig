import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  /**
   * Calculates a trip and its HOS schedule without saving it to the database.
   * Useful for trip simulation/previews.
   */
  calculateTrip: async (payload) => {
    const response = await apiClient.post('/trips/calculate/', payload);
    return response.data;
  },

  /**
   * Persists a planned trip and all calculated logs in the database.
   */
  saveTrip: async (payload) => {
    const response = await apiClient.post('/trips/', payload);
    return response.data;
  },

  /**
   * Lists all saved historical trips.
   */
  listTrips: async () => {
    const response = await apiClient.get('/trips/');
    return response.data;
  },

  /**
   * Retrieves detail info of a single trip, including its logs.
   */
  getTrip: async (id) => {
    const response = await apiClient.get(`/trips/${id}/`);
    return response.data;
  },

  /**
   * Deletes a saved trip by ID.
   */
  deleteTrip: async (id) => {
    const response = await apiClient.delete(`/trips/${id}/`);
    return response.data;
  },
};
