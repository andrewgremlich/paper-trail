import { api } from "./client";
import type { Customer, SubmitCustomer } from "./types";

export const getCustomers = (): Promise<Customer[]> => api.get("/customers");

export const getCustomer = (id: number): Promise<Customer> =>
	api.get(`/customers/${id}`);

export const createCustomer = (
	customer: SubmitCustomer,
): Promise<{ success: true; id: number }> => api.post("/customers", customer);

export const updateCustomer = (
	id: number,
	customer: SubmitCustomer,
): Promise<{ success: true }> => api.put(`/customers/${id}`, customer);

export const deleteCustomer = (id: number): Promise<{ success: true }> =>
	api.delete(`/customers/${id}`);

export const requestConsent = (id: number): Promise<{ success: true }> =>
	api.post(`/customers/${id}/request-consent`);
