import { api } from "./client";
import type { Customer, SubmitCustomer } from "./types";

export const getCustomers = (): Promise<Customer[]> => api.get("/customers");

export const getCustomer = (id: string): Promise<Customer> =>
	api.get(`/customers/${id}`);

export const createCustomer = (
	customer: SubmitCustomer,
): Promise<{ success: true; id: string }> => api.post("/customers", customer);

export const updateCustomer = (
	id: string,
	customer: SubmitCustomer,
): Promise<{ success: true }> => api.put(`/customers/${id}`, customer);

export const deleteCustomer = (id: string): Promise<{ success: true }> =>
	api.delete(`/customers/${id}`);

export const requestConsent = (id: string): Promise<{ success: true }> =>
	api.post(`/customers/${id}/request-consent`);

export const revokeConsent = (id: string): Promise<{ success: true }> =>
	api.post(`/customers/${id}/revoke-consent`);
