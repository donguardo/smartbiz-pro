import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/store-image')({
  server: { handlers: { POST: async ({ request }) => {
    const { generateStoreImage } = await import('@/lib/image-gateway.server');
    return generateStoreImage(request);
  } } },
});