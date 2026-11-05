/**
 * Image source priority for the homepage news/event preview.
 * Events authored together with a News article often carry their editorial
 * image on the News row only; never duplicate or move media objects.
 * The result contains relative Storage paths; presentation uses mediaUrl().
 */
export type HomeEventImage = {
  id: string;
  title: string;
  hero_image_path?: string | null;
  external_url?: string | null;
  slug?: string | null;
};
export type HomeNewsImage = {
  id: string;
  title?: string | null;
  hero_image_path?: string | null;
  related_event_id?: string | null;
};

export function eventImagePathCandidates(
  event: HomeEventImage,
  news: HomeNewsImage[],
): string[] {
  const fromExternal = /^news:([0-9a-f-]{36})$/i.exec(event.external_url || '')?.[1];
  const fromSlug = /^news-([0-9a-f-]{36})$/i.exec(event.slug || '')?.[1];
  const linkedNewsId = fromExternal || fromSlug;
  const linked = linkedNewsId ? news.find(item => item.id === linkedNewsId) : undefined;
  const reverse = news.find(item => item.related_event_id === event.id);
  const matchingTitle = news.find(item => item.title?.trim() === event.title.trim());
  return [...new Set([
    event.hero_image_path,
    linked?.hero_image_path,
    reverse?.hero_image_path,
    matchingTitle?.hero_image_path,
  ].filter((path): path is string => !!path?.trim()))];
}
