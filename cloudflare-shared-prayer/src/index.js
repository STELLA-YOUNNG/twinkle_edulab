export default {
  async fetch() {
    const upstream = await fetch("https://stella-younng.github.io/twinkle_edulab/prayer-board/", {
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "no-store, max-age=0");
    headers.set("Content-Type", "text/html; charset=UTF-8");
    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });
  }
};
