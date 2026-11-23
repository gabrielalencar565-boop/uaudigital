export type CarouselMedia = { id?: string; url: string; type: string | null; name?: string | null; thumbUrl?: string };

export type CarouselPage = {
  /** foto: a própria imagem. vídeo: a miniatura (poster) que acompanha o vídeo */
  id: string;
  url: string;
  thumbUrl?: string;
  /** url do vídeo, quando a página é um vídeo */
  videoUrl: string | null;
  /** ids que formam a página (miniatura + vídeo): ordenar, apagar etc. valem para todos */
  ids: string[];
};

const posterBase = (name: string | null | undefined) => (name && /-poster\.jpe?g$/i.test(name) ? name.replace(/-poster\.jpe?g$/i, "").toLowerCase() : null);
const videoBase = (name: string | null | undefined) => (name ? name.replace(/\.[^./]+$/, "").toLowerCase() : null);

/**
 * Páginas de um carrossel. Quando a página é um vídeo, o upload guarda o vídeo (video/*) e uma miniatura "<nome>-poster.jpg"; só a miniatura aparecia
 * (como foto) e o vídeo ficava de fora. Aqui cada miniatura é ligada ao vídeo do mesmo nome e vira UMA página de vídeo, na posição da miniatura.
 * Vídeo sem miniatura vira página de vídeo sem capa; foto comum segue como foto. Recebe a mídia já ordenada (order_index, created_at).
 */
export function buildCarouselPages(media: CarouselMedia[]): CarouselPage[] {
  const videoByBase = new Map<string, CarouselMedia>();
  for (const m of media) {
    if (!m.type?.startsWith("video/")) continue;
    const b = videoBase(m.name);
    if (b && !videoByBase.has(b)) videoByBase.set(b, m);
  }
  const usedVideos = new Set<string>();
  const pages: CarouselPage[] = [];
  for (const m of media) {
    if (m.type?.startsWith("image/")) {
      const b = posterBase(m.name);
      const video = b ? videoByBase.get(b) : undefined;
      if (video && !usedVideos.has(video.id ?? video.url)) {
        usedVideos.add(video.id ?? video.url);
        pages.push({ id: m.id ?? m.url, url: m.url, thumbUrl: m.thumbUrl, videoUrl: video.url, ids: [m.id ?? m.url, video.id ?? video.url] });
      } else {
        pages.push({ id: m.id ?? m.url, url: m.url, thumbUrl: m.thumbUrl, videoUrl: null, ids: [m.id ?? m.url] });
      }
    }
  }
  for (const m of media) {
    if (m.type?.startsWith("video/") && !usedVideos.has(m.id ?? m.url)) {
      pages.push({ id: m.id ?? m.url, url: "", thumbUrl: undefined, videoUrl: m.url, ids: [m.id ?? m.url] });
    }
  }
  return pages;
}
