import { Suspense } from "react";
import PairView from "../../pair-view";
import PairLink from "./pair-link";

// Shareable pairing: /pair/<idA>/<idB>[?ta=<type>&tb=<type>] loads the check directly.
export default function SharedPair({ params }: PageProps<"/pair/[a]/[b]">) {
  return (
    <Suspense fallback={<PairView />}>
      {params.then(({ a, b }) => (
        <PairLink a={a} b={b} />
      ))}
    </Suspense>
  );
}
