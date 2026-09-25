import { useState, type ChangeEvent } from "react";
import type { ImageInput, PlantProfile } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";
import PlantThumb from "./PlantThumb";
import { CameraIcon, ImageIcon, ScanIcon } from "./icons";

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

type Props = { busy: string | null; error: string; onPhoto: (img: ImageInput) => void; onSample: (p: PlantProfile) => void };

export default function Scan({ busy, error, onPhoto, onSample }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const img = await toJpeg(file);
    setPreview(`data:${img.mediaType};base64,${img.imageBase64}`);
    onPhoto(img);
  };

  return (
    <div className="screen">
      <p className="eyebrow">Identify</p>
      <h1 className="title">Scan a plant</h1>
      <p className="subtitle">Fill the frame with the whole plant, leaves and stem, in good light.</p>

      <div className="viewfinder">
        {preview && <img src={preview} alt="Your photo" />}
        <div className="corners" aria-hidden="true"><i /><i /><i /><i /></div>
        {busy ? (
          <>
            <div className="scanline" aria-hidden="true" />
            <div className="scan-status" role="status">{busy}</div>
          </>
        ) : (
          !preview && (
            <div className="hint">
              <ScanIcon />
              <strong>Point at a plant</strong>
              <span style={{ opacity: 0.75, fontSize: 14 }}>Claude identifies the species, then grows it in 3D with its roots.</span>
            </div>
          )
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="capture">
        <label className="btn">
          <CameraIcon /> Take photo
          <input type="file" accept="image/*" capture="environment" hidden disabled={!!busy} onChange={onChange} />
        </label>
        <label className="btn ghost">
          <ImageIcon /> Library
          <input type="file" accept="image/*" hidden disabled={!!busy} onChange={onChange} />
        </label>
      </div>

      <h2 className="section-title">No plant nearby? Try one</h2>
      <div className="samples">
        {Object.values(fixtures).map((p) => (
          <button key={p.species.scientificName} className="sample" onClick={() => onSample(p)}>
            <div className="thumb"><PlantThumb profile={p} /></div>
            <strong style={{ fontSize: 14 }}>{p.species.commonName}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
