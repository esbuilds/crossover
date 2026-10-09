import { Suspense } from "react";
import Crossover from "../../crossover";

// Shareable link: /s/<qloo entity id> loads that entity's slate directly.
export default function Shared({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<Crossover />}>
      {params.then(({ id }) => (
        <Crossover initialId={id} />
      ))}
    </Suspense>
  );
}
