export async function uploadToIPFS(file: File, name: string, description: string): Promise<string> {
  try {
    // Backward-compatible helper name; implementation now uses a secure server route.
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    formData.append("description", description);

    const uploadRes = await fetch("/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error("Storage upload failed", uploadRes.status, errorText);
      throw new Error("Failed to upload metadata");
    }

    const json = await uploadRes.json();
    if (!json?.metadataUri) {
      throw new Error("Storage upload did not return metadataUri");
    }

    return String(json.metadataUri);
  } catch (error) {
    console.error("Error uploading metadata:", error);
    throw new Error("Failed to upload metadata");
  }
}
