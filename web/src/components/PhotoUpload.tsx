import type { ChangeEvent } from "react";
import type { ImageInput } from "@rootsight/shared/schema";

// Claude caps base64 images at 5 MB and phone photos are bigger: downscale to a JPEG first.
async function toJpeg(file: File, maxSide = 1568): Promise<ImageInput> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return { imageBase64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" };
}

// TODO(ui-owner): photo preview thumbnail, drag & drop.
export default function PhotoUpload({ onPhoto, disabled }: { onPhoto: (img: ImageInput) => void; disabled: boolean }) {
  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) onPhoto(await toJpeg(file));
  };
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <label style={{ cursor: "pointer" }}>
        📁 Upload photo
        <input type="file" accept="image/*" hidden disabled={disabled} onChange={onChange} />
      </label>
      <label style={{ cursor: "pointer" }}>
        📷 Take photo
        <input type="file" accept="image/*" capture="environment" hidden disabled={disabled} onChange={onChange} />
      </label>
    </div>
  );
}
