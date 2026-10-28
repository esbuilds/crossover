import { redirect } from "next/navigation";

// /review was Pick three's working address; Pick three has its own route since Oct 13.
export default function Review() {
  redirect("/pick-three");
}
