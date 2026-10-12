"use client";
import type { SceneAtmosphere } from "@/lib/studio/contracts";

function Worlds() {
  return <><option value="rain">Rintik Resonansi · bulatan dan riak</option><option value="flow">Arus Cahaya · partikel dan pita</option><option value="spectrum">Spektrum Ruang · kontur frekuensi</option><option value="light">Ruang Cahaya · bidang lembut</option><option value="resonance">Resonansi · garis geometris</option></>;
}
export function AtmosphereControls({ value, onChange, section = false }: { value: SceneAtmosphere; onChange: (value: SceneAtmosphere) => void; section?: boolean }) {
  const update = (patch: Partial<SceneAtmosphere>) => onChange({ ...value, ...patch });
  return <div className="story-atmosphere-controls">
    <p className="story-help">{section ? "Aura depan berubah di section ini. Latar tetap mengikuti soundtrack Room." : "Satu soundtrack menjaga latar. Musik section atau suara video memberi kehidupan pada Aura depan."}</p>
    <div className="story-preset-buttons" aria-label="Pilihan suasana cepat">
      <button type="button" onClick={() => update({ intensity: "calm", response: "energy", sharpAccents: false, world: "rain" })}>Hangat / sendu</button>
      <button type="button" onClick={() => update({ intensity: "balanced", response: "beat", sharpAccents: false, world: "flow" })}>Mengalir</button>
      <button type="button" onClick={() => update({ intensity: "lively", response: "beat", sharpAccents: false, world: "spectrum" })}>Berirama</button>
    </div>
    {!section && <label>Aura belakang · soundtrack Room<select value={value.backgroundWorld ?? "rain"} onChange={event => update({ backgroundWorld: event.target.value as SceneAtmosphere["backgroundWorld"] })}><Worlds /></select></label>}
    <label>{section ? "Aura depan section ini" : "Aura depan · pilihan awal section"}<select value={value.world ?? "rain"} onChange={event => update({ world: event.target.value as SceneAtmosphere["world"] })}><Worlds /></select></label>
    <label>Intensitas Aura<select value={value.intensity} onChange={event => update({ intensity: event.target.value as SceneAtmosphere["intensity"] })}><option value="calm">Lembut</option><option value="balanced">Sedang</option><option value="lively">Terasa hidup</option></select></label>
    <label>Respons terhadap musik<select value={value.response} onChange={event => update({ response: event.target.value as SceneAtmosphere["response"] })}><option value="off">Komposisi diam</option><option value="energy">Riak dan aliran lembut</option><option value="beat">Hentakan mengikuti serangan bunyi</option></select></label>
    <label className="story-check"><input type="checkbox" checked={value.sharpAccents ?? false} onChange={event => update({ sharpAccents: event.target.checked })} />Aksen cahaya di tepi media</label>
    {!section && <><label>Gerakan saat digulir<select value={value.motion} onChange={event => update({ motion: event.target.value as SceneAtmosphere["motion"] })}><option value="watermill">Watermill · mengalir mengikuti guliran</option><option value="soft">Peralihan lembut</option><option value="none">Tanpa gerakan</option></select></label><label className="story-check"><input type="checkbox" checked={value.backgroundAura} onChange={event => update({ backgroundAura: event.target.checked })} />Aura latar menyala</label></>}
    <p className="story-help">Foto dan teks tetap tenang. Saat sumber suaranya berhenti, lapisan Auranya ikut berhenti.</p>
  </div>;
}

