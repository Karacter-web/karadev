import { Helmet } from "react-helmet-async";

type Props = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

/**
 * Per-route head metadata. Title/description dedupe by name so they
 * override the static index.html copy for JS-executing crawlers.
 * canonical/og:url are self-referencing relative paths so they stay
 * correct across preview, production, and custom domains.
 */
export function SEO({ title, description, path, noindex }: Props) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={path} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={path} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
}