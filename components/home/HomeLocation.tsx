import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

export function HomeLocation({ copy }: { copy: Record<string, string> }) {
  const c = copy as Record<AdminCopyKey, string>;
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xl font-bold text-site-text sm:text-2xl">
          {getCopyValue(c, "site.home.location.title")}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {getCopyValue(c, "site.home.location.subtitle")}
        </p>
        <div className="mt-6 rounded-2xl border border-site-border bg-site-card p-6 shadow-sm">
          <p className="text-gray-600">
            {getCopyValue(c, "site.home.location.body")}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {getCopyValue(c, "site.home.location.hint")}
          </p>
        </div>
      </div>
    </section>
  );
}
