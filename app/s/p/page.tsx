import { Suspense } from "react";
import Crossover from "../../crossover";
import ProxyLink from "./proxy-link";

// Shareable proxy-mode link: /s/p?name=Graza&d=<description>&p=<id>:10,<id>:5 rebuilds the run without the form.
export default function SharedProxy() {
  return (
    <Suspense fallback={<Crossover />}>
      <ProxyLink />
    </Suspense>
  );
}
