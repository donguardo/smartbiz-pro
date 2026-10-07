export function seo(path: string) {
  return {
    meta: [{ property: "og:url", content: "https://mvp.com.ai" + path }],
    links: [{ rel: "canonical", href: "https://mvp.com.ai" + path }],
  };
}
