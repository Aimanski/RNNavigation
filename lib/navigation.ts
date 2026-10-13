// Navigation

import type { Href, useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/* Navigation */
export function resetTo(router: Router, href: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

/* Navigation */
export function goBackOr(router: Router, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
