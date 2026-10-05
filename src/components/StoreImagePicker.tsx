import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Coffee, Store, Utensils, WashingMachine, Scissors, Cake, ShoppingBag, Flower2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { streamImage } from '@/lib/stream-image';

const PRESETS = [Store, Coffee, Utensils, WashingMachine, Scissors, Cake, ShoppingBag, Flower2];

async function imageFile(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image preview is unavailable.');
  ctx.drawImage(image, 0, 0, 512, 512);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Unable to prepare the image.');
  return new File([blob], 'store-image.png', { type: 'image/png' });
}

export function StoreImagePicker({ onSave, disabled }: { onSave: (file: File) => Promise<void>; disabled: boolean }) {
  const { t } = useT();
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [final, setFinal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const choose = (index: number, element: HTMLElement) => {
    const Icon = PRESETS[index];
    if (!Icon) return;
    const color = getComputedStyle(element).color;
    const svg = renderToStaticMarkup(<Icon size={512} color={color} strokeWidth={1.25} />);
    setPreview(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    setFinal(true); setError('');
  };
  const generate = async () => {
    setGenerating(true); setPreview(null); setFinal(false); setError('');
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error(t('app.loading'));
      await streamImage('/api/store-image', { prompt }, (source, done) => { setPreview(source); setFinal(done); }, undefined, { Authorization: `Bearer ${data.session.access_token}` });
    } catch (e) { setError(e instanceof Error ? e.message : t('profile.imageError')); setFinal(false); }
    finally { setGenerating(false); }
  };
  return <div className="mt-6 border-t border-border pt-5">
    <h3 className="text-sm font-semibold">{t('profile.presets')}</h3>
    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
      {PRESETS.map((Icon, index) => <Button key={index} variant="outline" className="h-14 text-primary" disabled={disabled || generating} aria-label={t(`profile.icon${index}`)} title={t(`profile.icon${index}`)} onClick={(event) => choose(index, event.currentTarget)}><Icon className="size-7" aria-hidden /></Button>)}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); void generate(); }} className="mt-5 space-y-3">
      <label htmlFor="logo-prompt" className="block text-sm font-semibold">{t('profile.aiTitle')}</label>
      <textarea id="logo-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} placeholder={t('profile.aiPlaceholder')} className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" disabled={generating} />
      <p className="text-xs text-muted-foreground">{t('profile.aiCost')}</p>
      <Button type="submit" disabled={disabled || generating || prompt.trim().length < 3}><Sparkles className="size-4" aria-hidden />{t(generating ? 'profile.generating' : 'profile.generate')}</Button>
    </form>
    {error && <p role="alert" className="mt-3 break-words text-sm text-destructive">{error}</p>}
    {preview && <div className="mt-4 flex flex-wrap items-center gap-4">
      <img src={preview} alt={t('profile.imagePreview')} className={`size-32 rounded-md border border-border bg-muted object-contain transition-[filter] ${final ? 'blur-0' : 'blur-2xl'}`} />
      <Button disabled={!final || generating || disabled} onClick={async () => { try { await onSave(await imageFile(preview)); } catch (e) { setError(e instanceof Error ? e.message : t('profile.imageError')); } }}>{t('profile.useImage')}</Button>
    </div>}
    <span className="sr-only" role="status">{generating ? t('profile.generating') : final ? t('profile.imagePreview') : ''}</span>
  </div>;
}