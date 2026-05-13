import { api } from "./client";
import type { UpdateUserProfile, UserProfile } from "./types";

export const getUserProfile = async (): Promise<UserProfile> => {
	return api.get<UserProfile>("/user-profile");
};

export const updateUserProfile = async (
	profile: UpdateUserProfile,
): Promise<UserProfile> => {
	return api.put<UserProfile>("/user-profile", profile);
};

export const deleteAllUserData = async (): Promise<void> => {
	await api.delete("/user-profile");
};
