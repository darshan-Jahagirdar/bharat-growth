import type { Metadata } from 'next';
import { headers } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'bharatgrowth.app';
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https';
  const baseUrl = `${protocol}://${host}`;

  return {
    title: 'BharatGrowth Progress',
    description: 'A focused progress dashboard for the BharatGrowth product journey.',
    openGraph: {
      title: 'BharatGrowth Progress',
      description: 'Every meaningful step, visible.',
      url: `${baseUrl}/progress`,
      siteName: 'BharatGrowth',
      images: [
        {
          url: `${baseUrl}/og.png`,
          width: 1731,
          height: 909,
          alt: 'BharatGrowth progress dashboard',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'BharatGrowth Progress',
      description: 'Every meaningful step, visible.',
      images: [`${baseUrl}/og.png`],
    },
  };
}

export default function ProgressLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
