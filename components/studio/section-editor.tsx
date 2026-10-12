"use client";

import { useState } from "react";
import type { Media } from "@/lib/data/contracts";
import type { StudioMediaSetting, StudioSectionPlan } from "@/lib/studio/contracts";
import { emptySection, sectionCapacity, sectionLabel, sectionMediaType, sectionTypeLabels } from "@/lib/studio/authoring";
import { Dialog } from "@/components/ui/dialog";
import { PhotoIcon, VideoIcon } from "@/components/ui";

export function MediaThumbnail({ item, url }: { item: Media; url?: string }) {
  return <span className="story-thumb">{url ? item.type === "photo" ?
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" src={url} loading="lazy" /> : <video src={url} preload="metadata" muted playsInline /> : null}<span className="story-thumb__kind">{item.type === "video" ? <VideoIcon size={14} /> : <PhotoIcon size={14} />}</span></span>;
}

export function MediaInspection({ item, url, onClose }: { item: Media | null; url?: string; onClose: () => void }) {
  return <Dialog open={Boolean(item)} onClose={onClose} title={item?.originalFileName ?? "Lihat media"} className="story-media-dialog">{item ? <>
    {item.type === "video" ? <video controls playsInline src={url} autoPlay /> :
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={item.originalFileName} />}
    <p>{item.contributorName ? `Dari ${item.contributorName} · ` : ""}{(item.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
  </> : null}</Dialog>;
}

export function SectionEditor({ sections, media, settings, urls, onChange, onSetting, onRecommend }: {
  sections: StudioSectionPlan[]; media: Media[]; settings: StudioMediaSetting[]; urls: Record<string, string>;
  onChange: (sections: StudioSectionPlan[]) => void; onSetting: (mediaId: string, patch: Partial<StudioMediaSetting>) => void; onRecommend: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Media | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const selected = settings.map(setting => media.find(item => item.id === setting.mediaId)).filter((item): item is Media => Boolean(item));
  const assigned = new Set(sections.flatMap(section => section.mediaIds));
  const pickingSection = sections.find(section => section.id === picker);
  function patch(id: string, value: Partial<StudioSectionPlan>) { onChange(sections.map(section => section.id === id ? { ...section, ...value } : section)); }
  function assign(sectionId: string, mediaId: string) {
    const section = sections.find(item => item.id === sectionId);
    const item = selected.find(item => item.id === mediaId);
    if (!section || !item) { setFeedback("Media ini tidak ada dalam pilihan Momen."); return; }
    if (item.type !== sectionMediaType(section.type)) { setFeedback(`Slot ${sectionTypeLabels[section.type]} hanya menerima ${sectionMediaType(section.type) === "video" ? "video" : "foto"}.`); return; }
    if (section.mediaIds.includes(mediaId)) { setFeedback("Media ini sudah ada di section tersebut."); return; }
    if (section.mediaIds.length >= sectionCapacity(section.type)) { setFeedback("Slot penuh. Lepaskan media yang ingin diganti terlebih dahulu."); return; }
    patch(sectionId, { mediaIds: [...section.mediaIds, mediaId] });
    setFeedback(`${item.originalFileName} ditambahkan.`);
  }
  function move(index: number, offset: number) {
    const next = [...sections]; const other = index + offset;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    onChange(next.map((section, order) => ({ ...section, order })));
  }
  function moveItem(section: StudioSectionPlan, index: number, offset: number) {
    const ids = [...section.mediaIds]; [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    patch(section.id, { mediaIds: ids });
  }
  return <div className="story-builder">
    <div className="story-media-tray"><div className="story-media-tray__heading"><div><strong>Momen pilihanmu</strong><p>Seret ke slot. Di ponsel, ketuk <b>Isi slot</b>.</p></div><span>{selected.length - assigned.size} belum ditempatkan</span></div>
      <div className="story-media-tray__items">{selected.map(item => <div key={item.id} className="story-media-chip" draggable onDragStart={event => { event.dataTransfer.setData("application/x-kenangin-media", item.id); event.dataTransfer.effectAllowed = "copy"; }}>
        <button type="button" aria-label={`Lihat ${item.originalFileName}`} onClick={() => setInspect(item)}><MediaThumbnail item={item} url={urls[item.id]} /><span>{item.originalFileName}</span></button><small>{assigned.has(item.id) ? "✓ Terpasang" : item.type === "video" ? "Video" : "Foto"}</small>
      </div>)}</div>
    </div>
    <div className="story-builder__toolbar"><span>{sections.length} section · susun sesukamu</span><button type="button" className="ui-button ui-button--secondary" onClick={onRecommend}>✦ Rekomendasikan dong</button></div>
    <p className="story-builder__feedback" role="status">{feedback || "Satu momen boleh dipakai kembali di section lain. Keterangan tampil di bawah medianya."}</p>
    {!sections.length ? <div className="story-empty"><span aria-hidden="true">01</span><h3>Ceritamu dimulai di sini.</h3><p>Beri satu momen panggungnya sendiri, kumpulkan beberapa dalam slider, atau mulai dengan sepenggal teks.</p></div> : null}
    <div className="story-section-list">{sections.map((section, index) => <article className="story-section" key={section.id} data-section-id={section.id}>
      <header><span className="story-section__number">{String(index + 1).padStart(2, "0")}</span><div><span className="ui-eyebrow">{sectionTypeLabels[section.type]}</span><label className="sr-only" htmlFor={`title-${section.id}`}>Judul section {index + 1}</label><input id={`title-${section.id}`} maxLength={100} value={section.title ?? ""} placeholder={sectionLabel(section, index)} onChange={event => patch(section.id, { title: event.target.value })} /></div><div className="story-section__actions"><button type="button" aria-label={`Naikkan section ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Turunkan section ${index + 1}`} disabled={index === sections.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Hapus section ${index + 1}`} onClick={() => setRemove(section.id)}>×</button></div></header>
      <div className={`story-section__body ${section.type === "text" ? "story-section__body--text" : ""}`}>
        {section.type !== "text" ? <div className={`story-slots ${dragOver === section.id ? "is-over" : ""}`} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragOver(section.id); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null); }} onDrop={event => { event.preventDefault(); setDragOver(null); assign(section.id, event.dataTransfer.getData("application/x-kenangin-media")); }}>
          {section.mediaIds.map((id, mediaIndex) => { const item = selected.find(item => item.id === id); return item ? <div className="story-slot" key={id}>
            <button className="story-slot__preview" type="button" aria-label={`Lihat ${item.originalFileName}`} onClick={() => setInspect(item)}><MediaThumbnail item={item} url={urls[id]} /><span>{item.originalFileName}</span></button>
            <div className="story-slot__actions"><button type="button" disabled={mediaIndex === 0} aria-label={`Geser ${item.originalFileName} ke kiri`} onClick={() => moveItem(section, mediaIndex, -1)}>←</button><button type="button" disabled={mediaIndex === section.mediaIds.length - 1} aria-label={`Geser ${item.originalFileName} ke kanan`} onClick={() => moveItem(section, mediaIndex, 1)}>→</button><button type="button" aria-label={`Lepaskan ${item.originalFileName}`} onClick={() => patch(section.id, { mediaIds: section.mediaIds.filter(value => value !== id) })}>×</button></div>
          </div> : null; })}
          {section.mediaIds.length < sectionCapacity(section.type) ? <button className="story-slot story-slot--empty" type="button" onClick={() => setPicker(section.id)}><span aria-hidden="true">+</span><strong>Isi slot</strong><small>{sectionMediaType(section.type) === "video" ? "Video" : "Foto"} · {section.mediaIds.length}/{sectionCapacity(section.type)}</small></button> : null}
        </div> : null}
        <div className="story-section__writing"><label htmlFor={`caption-${section.id}`}>{section.type === "text" ? "Apa yang ingin kamu sampaikan?" : "Keterangan untuk momen ini"}</label><textarea id={`caption-${section.id}`} rows={5} maxLength={2000} value={section.caption ?? ""} placeholder={section.type === "text" ? "Lalu, tibalah hari yang selalu kita ingat…" : "Lihat betapa serunya kita hari itu…"} onChange={event => patch(section.id, { caption: event.target.value })} /><small>{(section.caption ?? "").length}/2000 · {section.type === "text" ? "Ikut mengalir saat cerita digulir" : "Tampil di bawah tengah media"}</small><label className="story-check"><input type="checkbox" checked={Boolean(section.emphasis)} onChange={event => patch(section.id, { emphasis: event.target.checked })} /><span>Beri penekanan<small>Suasana sedikit lebih terasa pada bagian ini.</small></span></label></div>
      </div>
      {section.mediaIds.length ? <details className="story-media-settings"><summary>Potongan, suara & tampilan media</summary><p>Pengaturan media yang dipakai berulang berlaku di semua section.</p>{section.mediaIds.map(id => { const setting = settings.find(item => item.mediaId === id); const item = selected.find(item => item.id === id); return item && setting ? <div className="story-media-settings__row" key={id}><strong>{item.originalFileName}</strong><label>Tampilan<select value={setting.fit} onChange={event => onSetting(id, { fit: event.target.value as "contain" | "cover" })}><option value="contain">Utuh</option><option value="cover">Penuhi bingkai</option></select></label>{item.type === "video" ? <><label>Suara {Math.round(setting.volume * 100)}%<input type="range" min={0} max={1} step={.05} value={setting.volume} onChange={event => onSetting(id, { volume: Number(event.target.value) })} /></label><label>Dari detik<input type="number" min={0} step={.1} value={setting.trimInSec ?? ""} placeholder="0" onChange={event => onSetting(id, { trimInSec: event.target.value === "" ? null : Number(event.target.value) })} /></label><label>Sampai detik<input type="number" min={0} step={.1} value={setting.trimOutSec ?? ""} placeholder="Selesai" onChange={event => onSetting(id, { trimOutSec: event.target.value === "" ? null : Number(event.target.value) })} /></label><label className="story-check"><input type="checkbox" checked={setting.loop} onChange={event => onSetting(id, { loop: event.target.checked })} />Ulangi video</label></> : null}</div> : null; })}</details> : null}
    </article>)}</div>
    <button type="button" className="story-add-section" onClick={() => setAdding(true)} disabled={sections.length >= 80}><span aria-hidden="true">+</span> Tambahkan section <small>{sections.length}/80</small></button>
    <Dialog open={adding} onClose={() => setAdding(false)} title="Tambahkan section" className="story-picker"><p>Pilih cara momen ini bercerita.</p><div className="story-type-options">{(Object.keys(sectionTypeLabels) as StudioSectionPlan["type"][]).map(type => <button type="button" key={type} onClick={() => { onChange([...sections, emptySection(type, `section_${crypto.randomUUID().replaceAll("-", "")}`, sections.length)]); setAdding(false); }}><strong>{sectionTypeLabels[type]}</strong><span>{type === "text" ? "Jeda cerita, pesan, atau pergantian bab." : `${sectionCapacity(type) === 1 ? "Satu momen, satu sorotan." : "Hingga 5 momen dalam satu slider."} Keterangan darimu.`}</span></button>)}</div></Dialog>
    <Dialog open={Boolean(pickingSection)} onClose={() => setPicker(null)} title={`Isi slot ${pickingSection ? sectionTypeLabels[pickingSection.type] : ""}`} className="story-picker"><p>Pilih media untuk ditambahkan. Tutup ketika selesai.</p><div className="story-pick-grid">{selected.filter(item => item.type === (pickingSection && sectionMediaType(pickingSection.type))).map(item => <button type="button" key={item.id} disabled={pickingSection?.mediaIds.includes(item.id) || (pickingSection?.mediaIds.length ?? 0) >= (pickingSection ? sectionCapacity(pickingSection.type) : 0)} onClick={() => { if (picker) assign(picker, item.id); }}><MediaThumbnail item={item} url={urls[item.id]} /><span>{item.originalFileName}</span><small>{pickingSection?.mediaIds.includes(item.id) ? "✓ Terpasang" : "Tambahkan"}</small></button>)}</div>{!selected.some(item => item.type === (pickingSection && sectionMediaType(pickingSection.type))) ? <p>Belum ada media jenis ini. Pilih dahulu di langkah Momen.</p> : null}<button type="button" className="ui-button ui-button--primary" onClick={() => setPicker(null)}>Selesai</button></Dialog>
    <MediaInspection item={inspect} url={inspect ? urls[inspect.id] : undefined} onClose={() => setInspect(null)} />
    <Dialog open={Boolean(remove)} onClose={() => setRemove(null)} title="Hapus section ini?"><p>Keterangan dan pilihan musik section dilepas. File media serta musik tetap ada di Room.</p><div className="journey-dialog__actions"><button type="button" className="ui-button ui-button--secondary" onClick={() => setRemove(null)}>Batal</button><button type="button" className="ui-button ui-button--primary" onClick={() => { onChange(sections.filter(section => section.id !== remove).map((section, order) => ({ ...section, order }))); setRemove(null); }}>Hapus section</button></div></Dialog>
  </div>;
}
