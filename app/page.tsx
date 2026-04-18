import GlobalHomeButton from "./components/GlobalHomeButton";
import SiteHomePage, { metadata } from "./site/page";

export { metadata };

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <SiteHomePage searchParams={searchParams} />
      <GlobalHomeButton />
    </>
  );
}
