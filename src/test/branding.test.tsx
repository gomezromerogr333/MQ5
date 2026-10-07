import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const html = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'));

/** Ancho y alto reales de un PNG (cabecera IHDR). */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('Marca: iconos, instalación y vista previa del enlace', () => {
  it('todo archivo referenciado en <head> existe en public/', () => {
    const refs = [...html.matchAll(/<link[^>]+href="(\/[^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(5);
    for (const ref of refs) {
      expect(existsSync(join(root, 'public', ref)), `falta public${ref}`).toBe(true);
    }
  });

  it('la imagen del enlace es una URL ABSOLUTA y el archivo existe (1200×630, ligero para WhatsApp)', () => {
    const og = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1] ?? '';
    const tw = html.match(/name="twitter:image"\s+content="([^"]+)"/)?.[1] ?? '';
    expect(og).toMatch(/^https:\/\//);
    expect(tw).toBe(og);
    const file = join(root, 'public', new URL(og).pathname);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).length).toBeLessThan(300 * 1024); // WhatsApp muestra la tarjeta grande por debajo de ~300 KB
    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:height" content="630"');
  });

  it('el manifiesto es instalable: nombre, standalone, 192, 512 y maskable con su tamaño real', () => {
    expect(manifest.name).toBe('MathQuest 5');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    const byPurpose = (p: string) => manifest.icons.filter((i: { purpose: string }) => i.purpose === p);
    expect(byPurpose('maskable').length).toBeGreaterThanOrEqual(1);
    for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
      const [w, h] = icon.sizes.split('x').map(Number);
      const file = join(root, 'public', icon.src);
      expect(existsSync(file), `falta ${icon.src}`).toBe(true);
      expect(pngSize(file), `${icon.src} no mide ${icon.sizes}`).toEqual([w, h]);
    }
    expect(manifest.icons.some((i: { sizes: string; purpose: string }) => i.sizes === '192x192' && i.purpose === 'any')).toBe(true);
    expect(manifest.icons.some((i: { sizes: string; purpose: string }) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true);
  });

  it('apple-touch-icon mide 180×180', () => {
    expect(pngSize(join(root, 'public/apple-touch-icon.png'))).toEqual([180, 180]);
  });
});
