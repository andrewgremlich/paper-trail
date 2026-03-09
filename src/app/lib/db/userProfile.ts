import { api } from "./client";
import type { UpdateUserProfile, UserProfile } from "./types";

export const getUserProfile = async (): Promise<UserProfile> => {
	return api.get<UserProfile>("/user-profile");
};

export const updateUserProfile = async (
	profile: UpdateUserProfile,
): Promise<UserProfile | null> => {
	try {
		return await api.put<UserProfile>("/user-profile", profile);
	} catch {
		return null;
	}
};
