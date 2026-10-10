import { redirect } from "next/navigation";

// /review was the front door's working address before it moved to / (Oct 10).
export default function Review() {
  redirect("/");
}
