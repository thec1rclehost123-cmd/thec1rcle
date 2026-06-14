"use client";

import { getApiErrorMessage, guestApi } from "../../../lib/api/client";

export async function uploadGuestAvatar(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  const { response, data } = await guestApi.profiles.avatar(formData);
  if (!response.ok || !data?.url) {
    throw new Error(getApiErrorMessage(data, "Failed to upload image."));
  }
  return data.url;
}
